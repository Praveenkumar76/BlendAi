import os
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from groq import Groq
from sentence_transformers import SentenceTransformer
import chromadb
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_db_manager, MongoDBManager

load_dotenv()

# --- CONFIGURATION ---
PERSIST_DIRECTORY = "./blender_chroma_db_final"
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"
# Corrected to a current, active model on Groq
GROQ_MODEL_NAME = "openai/gpt-oss-120b" 
# A list of all collections you want the API to search across
COLLECTION_NAMES = ["merged_collection", "langchain"]

# --- DATABASE ABSTRACTION CLASS ---

class VectorDatabase:
    """A class to handle all interactions with the ChromaDB multi-collection setup."""
    def __init__(self, path: str, collection_names: list[str]):
        print(f"Loading vector database from '{path}'...")
        self.client = chromadb.PersistentClient(path=path)
        self.collections = []
        for name in collection_names:
            try:
                collection = self.client.get_collection(name)
                self.collections.append(collection)
                print(f"✅ Collection '{name}' loaded successfully with {collection.count()} documents.")
            except Exception as e:
                print(f"❌ FAILED to load collection '{name}'. It will be skipped. Error: {e}")

    def is_ready(self) -> bool:
        """Check if any collections were loaded successfully."""
        return len(self.collections) > 0

    def query(self, query_embedding: list[float], n_results: int = 5) -> dict:
        """
        Searches all loaded collections, combines, and re-ranks the results.
        Returns a dictionary containing the top documents and their metadata.
        """
        all_results = []
        for collection in self.collections:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                include=['documents', 'metadatas', 'distances']
            )
            
            num_retrieved = len(results['ids'][0])
            for i in range(num_retrieved):
                all_results.append({
                    "distance": results['distances'][0][i],
                    "document": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i]
                })
        
        # Re-rank all combined results by distance (lowest is best)
        all_results.sort(key=lambda item: item['distance'])
        
        # Extract the top N overall results
        top_documents = [item['document'] for item in all_results[:n_results]]
        top_metadatas = [item['metadata'] for item in all_results[:n_results]]
        
        return {"documents": top_documents, "metadatas": top_metadatas}

# --- INITIALIZE SERVICES ---

app = FastAPI(title="Blender RAG API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

print("Loading embedding model...")
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device='cpu')

vector_db = VectorDatabase(path=PERSIST_DIRECTORY, collection_names=COLLECTION_NAMES)

# Initialize MongoDB
try:
    db_manager = get_db_manager()
    print("✅ MongoDB connection established")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    db_manager = None

try:
    groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    USE_GROQ = True
    print("✅ Groq client initialized successfully")
except Exception as e:
    USE_GROQ = False
    print(f"⚠️ Groq client initialization failed: {e}")

# --- HEALTH CHECK ENDPOINTS ---

@app.get("/api/health/database")
async def check_database_health():
    """Check database connection status"""
    if db_manager and db_manager.is_connected():
        return {"status": "healthy", "database": "MongoDB", "message": "Database connection is active"}
    else:
        return {"status": "unhealthy", "database": "MongoDB", "message": "Database connection failed"}

@app.get("/api/health/vector-db")
async def check_vector_db_health():
    """Check vector database status"""
    if vector_db.is_ready():
        return {"status": "healthy", "database": "ChromaDB", "message": "Vector database is ready"}
    else:
        return {"status": "unhealthy", "database": "ChromaDB", "message": "Vector database is not ready"}

@app.get("/api/health/groq")
async def check_groq_health():
    """Check Groq API status"""
    if USE_GROQ:
        return {"status": "healthy", "service": "Groq", "message": "Groq API is configured"}
    else:
        return {"status": "unhealthy", "service": "Groq", "message": "Groq API is not configured"}

# --- DATABASE SCHEMA MODELS ---

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    user_id: str
    name: str
    email: str
    created_at: datetime
    profile_image: Optional[str] = None
    preferences: Optional[dict] = None

class MessageCreate(BaseModel):
    user_id: str
    message: str
    sender: str  # "user" or "bot"
    chat_id: Optional[str] = None

class MessageResponse(BaseModel):
    message_id: str
    text: str
    sender: str
    timestamp: datetime
    chat_id: str

class ChatResponse(BaseModel):
    chat_id: str
    user_id: str
    title: str
    created_at: datetime
    last_message_at: datetime
    message_count: int

class Query(BaseModel):
    text: str
    user_id: Optional[str] = None

# --- AUTHENTICATION ---
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: MongoDBManager = Depends(get_db_manager)):
    """Get current user from JWT token"""
    token = credentials.credentials
    user_id = db.verify_jwt_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# --- USER MANAGEMENT ENDPOINTS ---

@app.post("/api/users/signup", response_model=UserResponse)
async def signup(user: UserCreate, db: MongoDBManager = Depends(get_db_manager)):
    """Create a new user account"""
    try:
        new_user = db.create_user(user.name, user.email, user.password)
        return UserResponse(**new_user)
    except Exception as e:
        if "already exists" in str(e):
            raise HTTPException(status_code=409, detail="User already exists")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/users/signin")
async def signin(user: UserLogin, db: MongoDBManager = Depends(get_db_manager)):
    """Authenticate user and return user data with JWT token"""
    authenticated_user = db.authenticate_user(user.email, user.password)
    if not authenticated_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create JWT token
    token = db.create_jwt_token(authenticated_user["user_id"])
    
    return {
        "user": UserResponse(**authenticated_user),
        "token": token
    }

@app.get("/api/users/exists")
async def user_exists(email: EmailStr, db: MongoDBManager = Depends(get_db_manager)):
    """Diagnostic: check if a user exists by email (normalized)."""
    try:
        exists = db.user_email_exists(email)
        return {"email": email, "exists": exists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: MongoDBManager = Depends(get_db_manager)):
    """Get user details by ID"""
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(**user)

# --- CHAT MANAGEMENT ENDPOINTS ---

@app.post("/api/chat/send-message", response_model=MessageResponse)
async def send_message(message: MessageCreate, db: MongoDBManager = Depends(get_db_manager)):
    """Send a message and get AI response. Supports multi-session via optional chat_id."""
    # Verify user exists
    user = db.get_user_by_id(message.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Determine chat_id: use provided or create new with title = first 50 chars
    chat_id = message.chat_id
    if not chat_id:
        title = (message.message or "").strip()
        title = title[:50] if title else "New Chat"
        chat_id = db.create_chat(message.user_id, title)

    # Save user message
    db.save_message(chat_id, message.user_id, message.message, "user")

    # Get AI response and save
    try:
        ai_response = await get_ai_response(message.message)
        ai_message_id = db.save_message(chat_id, message.user_id, ai_response, "bot")

        # Retrieve the just-saved AI message for response
        ai_messages = db.get_chat_messages(message.user_id, chat_id)
        ai_message = next((msg for msg in ai_messages if msg["message_id"] == ai_message_id), None)
        if ai_message:
            # Ensure the response includes the correct chat_id
            ai_message["chat_id"] = chat_id
            return MessageResponse(**ai_message)
        raise Exception("Failed to retrieve AI message")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating AI response: {str(e)}")

@app.get("/api/chat/get-messages/{chat_id}", response_model=List[MessageResponse])
async def get_messages(chat_id: str, db: MongoDBManager = Depends(get_db_manager)):
    """Get all messages for a specific chat session"""
    # messages filtered by chat_id only; access control should be enforced by token in real-world use
    messages = db.get_chat_messages(user_id="", chat_id=chat_id)
    # Ensure chat_id in response
    for msg in messages:
        msg["chat_id"] = chat_id
    return [MessageResponse(**msg) for msg in messages]

@app.get("/api/chat/history/{user_id}", response_model=List[ChatResponse])
async def get_chat_history(user_id: str, db: MongoDBManager = Depends(get_db_manager)):
    """Get chat history for a user"""
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    chats = db.get_user_chats(user_id)
    return [ChatResponse(**chat) for chat in chats]

# --- AI RESPONSE FUNCTION ---

async def get_ai_response(question: str) -> str:
    """Get AI response using the RAG system"""
    if not vector_db.is_ready():
        return "I'm sorry, the AI system is currently unavailable. Please try again later."
    
    # Generate embedding
    question_embedding = embedding_model.encode(question).tolist()
    
    # Search the database
    search_results = vector_db.query(query_embedding=question_embedding, n_results=5)
    context_chunks = search_results["documents"]
    metadatas = search_results["metadatas"]

    if not context_chunks:
        return "I'm sorry, I could not find any relevant information for your question in the Blender knowledge base."
    
    # Create context for the LLM
    context = "\n\n---\n\n".join(context_chunks)
    
    # Generate response
    if USE_GROQ:
        try:
            prompt = f"""You are an expert assistant for Blender. First, try to answer the user's question using ONLY the context provided.
            If the context is not helpful or does not contain the answer, you may use your general knowledge to answer the question about Blender.
CONTEXT:
{context}

USER QUESTION: {question}

Please provide a comprehensive answer based on the context above:"""

            completion = groq_client.chat.completions.create(
                model=GROQ_MODEL_NAME,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=2048
            )
            answer = completion.choices[0].message.content
            answer += f"\n\n*Source: {len(context_chunks)} relevant guides from the Blender knowledge base.*"
            return answer
        except Exception as e:
            print(f"Error calling Groq API: {e}")
            return generate_fallback_response(question, context_chunks, metadatas)
    else:
        return generate_fallback_response(question, context_chunks, metadatas)

# --- AI QUERY ENDPOINT ---

@app.post("/query")
async def process_query(query: Query):
    """Legacy endpoint for direct AI queries"""
    answer = await get_ai_response(query.text)
    return {"answer": answer}

def generate_fallback_response(question: str, context_chunks: list, metadatas: list) -> str:
    """Generates a simple response when the main LLM is not available."""
    response_text = "Based on the retrieved context:\n\n"
    for doc, meta in zip(context_chunks, metadatas):
        title = meta.get('title', 'Blender Guide')
        response_text += f"**From {title}:**\n"
        # Provide a snippet of the document
        snippet = " ".join(doc.split()[:50])
        response_text += f'"{snippet}..."\n\n'
    response_text += "\n*Note: This is a fallback response. For a full AI answer, configure the GROQ_API_KEY.*"
    return response_text

if __name__ == "__main__":
    import uvicorn
    print("✅ Backend is ready to receive requests at http://127.0.0.1:8003")
    uvicorn.run(app, host="127.0.0.1", port=8003)