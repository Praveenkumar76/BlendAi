import os
import uuid
import base64
import shutil
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from groq import Groq
from sentence_transformers import SentenceTransformer
import chromadb
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_db_manager, MongoDBManager

load_dotenv()

# --- CONFIGURATION ---
PERSIST_DIRECTORY = "./recursive_chroma_db"
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"
# Corrected to a current, active model on Groq
GROQ_MODEL_NAME = "openai/gpt-oss-120b" 
# A list of all collections you want the API to search across
COLLECTION_NAMES = ["web_content"]

# Image upload configuration
UPLOAD_DIR = "./uploads"
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

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
        Searches all loaded collections, combines, re-ranks the results,
        and returns documents, metadata, AND distances.
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
        # --- CRUCIAL CHANGE: Capture the distances ---
        top_distances = [item['distance'] for item in all_results[:n_results]]
        
        # --- CRUCIAL CHANGE: Return the distances ---
        return {"documents": top_documents, "metadatas": top_metadatas, "distances": top_distances}
# --- INITIALIZE SERVICES ---

app = FastAPI(title="Blender RAG API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

print("Loading embedding model...")
embedding_model = None
try:
    # Try to load the primary model
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device='cpu')
    print("✅ Embedding model loaded successfully")
except Exception as e:
    print(f"❌ Failed to load primary embedding model: {e}")
    try:
        # Try a simpler fallback model
        print("Trying fallback embedding model...")
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
        print("✅ Fallback embedding model loaded successfully")
    except Exception as e2:
        print(f"❌ Failed to load fallback embedding model: {e2}")
        print("⚠️ AI responses will be limited without embedding model")
        embedding_model = None

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

class ChatRename(BaseModel):
    new_title: str

class ChatShare(BaseModel):
    share_token: Optional[str] = None
    is_public: bool = False

# --- AUTHENTICATION ---
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: MongoDBManager = Depends(get_db_manager)):
    """Get current user from JWT token"""
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

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

@app.put("/api/chat/rename/{chat_id}")
async def rename_chat(chat_id: str, chat_rename: ChatRename, current_user: dict = Depends(get_current_user), db: MongoDBManager = Depends(get_db_manager)):
    """Rename a chat session."""
    try:
        # Verify the chat belongs to the current user
        chat = db.chats.find_one({"chat_id": chat_id, "user_id": current_user["user_id"]})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found or access denied")
        
        success = db.rename_chat(chat_id, chat_rename.new_title)
        if not success:
            raise HTTPException(status_code=404, detail="Chat not found")
        return {"status": "success", "message": "Chat renamed successfully.", "new_title": chat_rename.new_title}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error renaming chat: {str(e)}")

@app.delete("/api/chat/delete/{chat_id}")
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user), db: MongoDBManager = Depends(get_db_manager)):
    """Delete a chat session and all its messages."""
    try:
        # Verify the chat belongs to the current user
        chat = db.chats.find_one({"chat_id": chat_id, "user_id": current_user["user_id"]})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found or access denied")
        
        success = db.delete_chat(chat_id)
        if not success:
            raise HTTPException(status_code=404, detail="Chat not found")
        return {"status": "success", "message": "Chat deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting chat: {str(e)}")

@app.post("/api/chat/share/{chat_id}")
async def share_chat(chat_id: str, current_user: dict = Depends(get_current_user), db: MongoDBManager = Depends(get_db_manager)):
    """Generate a shareable link for a chat session."""
    try:
        # Check if chat exists and belongs to the current user
        chat = db.chats.find_one({"chat_id": chat_id, "user_id": current_user["user_id"]})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found or access denied")
        
        # Generate a unique share token
        import secrets
        share_token = secrets.token_urlsafe(32)
        
        # Store share token in database
        db.chats.update_one(
            {"chat_id": chat_id},
            {"$set": {"share_token": share_token, "is_public": True}}
        )
        
        return {
            "status": "success",
            "share_token": share_token,
            "share_url": f"http://127.0.0.1:8003/api/chat/shared/{share_token}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sharing chat: {str(e)}")

@app.get("/api/chat/shared/{share_token}")
async def get_shared_chat(share_token: str, db: MongoDBManager = Depends(get_db_manager)):
    """Get a shared chat by share token."""
    try:
        chat = db.chats.find_one({"share_token": share_token, "is_public": True})
        if not chat:
            raise HTTPException(status_code=404, detail="Shared chat not found or expired")
        
        # Get messages for this chat
        messages = db.get_chat_messages(chat_id=chat["chat_id"])
        
        return {
            "chat": {
                "chat_id": chat["chat_id"],
                "title": chat["title"],
                "created_at": chat["created_at"],
                "message_count": chat["message_count"]
            },
            "messages": messages
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving shared chat: {str(e)}")

@app.delete("/api/chat/unshare/{chat_id}")
async def unshare_chat(chat_id: str, current_user: dict = Depends(get_current_user), db: MongoDBManager = Depends(get_db_manager)):
    """Remove sharing from a chat session."""
    try:
        # Verify the chat belongs to the current user
        chat = db.chats.find_one({"chat_id": chat_id, "user_id": current_user["user_id"]})
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found or access denied")
        
        result = db.chats.update_one(
            {"chat_id": chat_id},
            {"$unset": {"share_token": "", "is_public": ""}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        return {"status": "success", "message": "Chat sharing removed successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error unsharing chat: {str(e)}")

# --- IMAGE UPLOAD ENDPOINTS ---

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files for serving uploaded images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.post("/api/users/upload-avatar/{user_id}")
async def upload_avatar(user_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user), db: MongoDBManager = Depends(get_db_manager)):
    """Upload and update user profile image."""
    try:
        # Verify user exists and matches current user
        if current_user["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate file type
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.")
        
        # Validate file size
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filename = f"avatar_{user_id}_{uuid.uuid4().hex}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        # Update user profile in database
        image_url = f"/uploads/{filename}"
        db.users.update_one(
            {"user_id": user_id},
            {"$set": {"profile_image": image_url}}
        )
        
        # Delete old avatar if exists
        if user.get("profile_image") and user["profile_image"].startswith("/uploads/"):
            old_file_path = os.path.join(UPLOAD_DIR, user["profile_image"].split("/")[-1])
            if os.path.exists(old_file_path):
                os.remove(old_file_path)
        
        return {
            "status": "success",
            "message": "Avatar updated successfully",
            "image_url": image_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading avatar: {str(e)}")

@app.delete("/api/users/remove-avatar/{user_id}")
async def remove_avatar(user_id: str, current_user: dict = Depends(get_current_user), db: MongoDBManager = Depends(get_db_manager)):
    """Remove user profile image."""
    try:
        # Verify user exists and matches current user
        if current_user["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Remove profile image from database
        db.users.update_one(
            {"user_id": user_id},
            {"$unset": {"profile_image": ""}}
        )
        
        # Delete old avatar file if exists
        if user.get("profile_image") and user["profile_image"].startswith("/uploads/"):
            old_file_path = os.path.join(UPLOAD_DIR, user["profile_image"].split("/")[-1])
            if os.path.exists(old_file_path):
                os.remove(old_file_path)
        
        return {"status": "success", "message": "Avatar removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing avatar: {str(e)}")

# --- AI RESPONSE FUNCTION ---

async def get_ai_response(question: str) -> str:
    """Get AI response using the RAG system"""
    # Check if embedding model is available
    if embedding_model is None:
        return "I'm sorry, the AI system is currently unavailable due to a technical issue. Please try again later or contact support."
    
    if not vector_db.is_ready():
        return "I'm sorry, the AI system is currently unavailable. Please try again later."
    
    try:
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
                If the says about negative about you or blender, just say sorry for things in proper manner and If the context is not helpful or does not contain the answer, just say this not in my context of blender something polished. you may use your general knowledge to answer the question about Blender. NOTE this please doesn't provide anything apart from blender, mathematics, physics.
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
    except Exception as e:
        print(f"Error in get_ai_response: {e}")
        return "I'm sorry, there was an error processing your request. Please try again."

# async def get_ai_response(question: str) -> str:
#     """
#     Get AI response using a robust RAG system with a system-role prompt to enforce persona.
#     """
#     if embedding_model is None or not vector_db.is_ready():
#         return "I'm sorry, the AI system is currently unavailable. Please try again."

#     try:
#         question_embedding = embedding_model.encode(question).tolist()
#         search_results = vector_db.query(query_embedding=question_embedding, n_results=5)
#         context_chunks = search_results.get("documents", [])
#         distances = search_results.get("distances", [])

#         RELEVANCY_THRESHOLD = 0.6
#         if not context_chunks or distances[0] > RELEVANCY_THRESHOLD:
#             # This guardrail correctly handles off-topic questions before they reach the LLM.
#             # The canned response clearly states its role without revealing its origin.
#             return "I am a specialized AI assistant for Blender. My purpose is to answer questions using a dedicated Blender knowledge base."

#         context = "\n\n---\n\n".join(context_chunks)

#         if USE_GROQ:
#             try:
#                 # --- KEY CHANGE: Using a System Role for Persona Control ---
#                 # The system message sets the "rules of the universe" for the AI.
#                 # It's much more effective at preventing identity leakage.
#                 system_prompt = """You are BlenderBot, a specialized AI assistant expert in the 3D software Blender.
# - Your ONLY function is to answer questions about Blender based on the user's provided context.
# - You MUST NOT reveal you are an AI model, language model, only mention you are a BlenderBot.
# - Your responses must be direct and start without any preamble.
# - If the context does not contain the answer, you MUST reply with the exact phrase: "I'm sorry, I couldn't find specific information about that in my Blender knowledge base." """

#                 user_prompt = f"""CONTEXT:
# {context}

# ---
# Based on the context above, answer the question: {question}"""

#                 completion = groq_client.chat.completions.create(
#                     model=GROQ_MODEL_NAME,
#                     # Using the messages API with distinct system and user roles
#                     messages=[
#                         {"role": "system", "content": system_prompt},
#                         {"role": "user", "content": user_prompt}
#                     ],
#                     temperature=0.2,
#                     max_tokens=2048
#                 )
#                 answer = completion.choices[0].message.content

#                 if "couldn't find specific information" not in answer:
#                     answer += f"\n\n*Source: Based on {len(context_chunks)} relevant guides from the Blender knowledge base.*"
                
#                 return answer
#             except Exception as e:
#                 print(f"Error calling Groq API: {e}")
#                 return "I'm sorry, an error occurred while generating the response."
#         else:
#             return generate_fallback_response(question, context_chunks, search_results.get("metadatas", []))

#     except Exception as e:
#         print(f"Error in get_ai_response: {e}")
#         return "I'm sorry, there was an error processing your request. Please try again."

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