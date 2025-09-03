# BlendAI - Blender AI Assistant

A modern AI-powered assistant for Blender 3D software that combines a FastAPI backend with a beautiful web frontend, using **RAG (Retrieval-Augmented Generation)** for intelligent responses.

## 🚀 Features

- **AI-Powered Blender Help**: Get instant answers to Blender questions using RAG (Retrieval-Augmented Generation)
- **LLM Integration**: Uses Groq API (llama3-70b-8192) for intelligent, context-aware responses
- **Vector Database**: ChromaDB-powered knowledge base with comprehensive Blender tutorials and guides
- **Modern Web Interface**: Beautiful, responsive chat interface with video background
- **Real-time Chat**: ChatGPT-like interface with typing indicators and message history

## 🏗️ Architecture

### Backend (`/backend/`)
- **FastAPI** web framework
- **ChromaDB** vector database for semantic search
- **Sentence Transformers** for text embeddings
- **Groq API** for LLM-powered response generation
- **RAG System**: Combines vector search with LLM for intelligent answers

### Frontend (`/BlendAI/`)
- **HTML5/CSS3** with modern design
- **Vanilla JavaScript** for chat functionality
- **Responsive layout** with video background
- **ChatGPT-style** message interface

## 🛠️ Setup Instructions

### 1. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
# Copy env_template.txt to .env and add your GROQ_API_KEY
cp env_template.txt .env
# Edit .env and add your actual GROQ_API_KEY

# Start the backend server
python -m uvicorn main:app --host 127.0.0.1 --port 8003 --reload
```

### 2. Frontend Setup

```bash
cd BlendAI

# Open index.html in your web browser
# Or serve it using a local server:
python -m http.server 8080
```

### 3. Test the Connection

Open `BlendAI/test.html` in your browser to test the backend connection.

## 🔑 Environment Variables

### Required: GROQ_API_KEY
The system requires a Groq API key for LLM-powered responses:

1. **Get a free API key**: Visit [https://console.groq.com/](https://console.groq.com/)
2. **Create account** and get your API key
3. **Create `.env` file** in the backend directory:
   ```env
   GROQ_API_KEY=your_actual_api_key_here
   ```

### Optional Configuration
```env
# Customize the LLM model
GROQ_MODEL_NAME=llama3-70b-8192

# Customize database path
PERSIST_DIRECTORY=./recursive_chroma_db
```

## 🔧 How RAG Works

### 1. **Question Processing**
- User asks a question about Blender
- System generates embeddings for the question

### 2. **Vector Search**
- Searches ChromaDB for most relevant content
- Uses semantic similarity to find best matches

### 3. **Context Retrieval**
- Retrieves top 3 most relevant document chunks
- Combines them into context for the LLM

### 4. **LLM Generation**
- Sends question + context to Groq API
- LLM generates intelligent, context-aware response
- Response is based ONLY on the retrieved knowledge

### 5. **Fallback Mode**
- If Groq API is unavailable, uses intelligent context extraction
- Still provides relevant information from the knowledge base

## 📁 Project Structure

```
Whole_BlendAi/
├── backend/
│   ├── main.py              # Main FastAPI application with RAG
│   ├── populate_detailed_db.py # Database population script
│   ├── rag.py               # RAG system setup
│   ├── merged.py            # Database migration script
│   ├── test.py              # Backend testing
│   ├── requirements.txt     # Python dependencies
│   ├── env_template.txt     # Environment variables template
│   └── recursive_chroma_db/ # Vector database
├── BlendAI/
│   ├── index.html           # Main application page
│   ├── script.js            # Chat functionality
│   ├── style.css            # Styling and layout
│   ├── test.html            # Backend connection test
│   └── Images/              # UI assets and video
└── README.md                # This file
```

## 🎯 Usage

1. **Start the backend** server on port 8003
2. **Configure GROQ_API_KEY** in `.env` file
3. **Open the frontend** in your web browser
4. **Type a question** about Blender in the chat input
5. **Get AI-powered answers** using RAG system

## 🔍 Testing

- **Backend Test**: Use `backend/test.py` to test the vector database
- **Connection Test**: Use `BlendAI/test.html` to verify frontend-backend communication
- **Full System**: Use `BlendAI/index.html` for the complete chat experience

## 🚧 Current Status

- ✅ **Backend RAG System**: Fully functional with LLM integration
- ✅ **Vector Database**: Populated with comprehensive Blender content
- ✅ **Frontend UI**: Complete and responsive
- ✅ **API Integration**: Connected and working
- ✅ **RAG Pipeline**: Complete from question to intelligent response
- 🔄 **LLM Integration**: Requires GROQ_API_KEY for full functionality

## 🐛 Troubleshooting

1. **Port Already in Use**: Change the port in `main.py` and update frontend accordingly
2. **Database Errors**: Ensure ChromaDB collections exist and are properly initialized
3. **CORS Issues**: Backend is configured to allow all origins for development
4. **API Key Missing**: System will work with fallback responses until Groq API is configured
5. **LLM Errors**: Check your GROQ_API_KEY and internet connection

## 📝 License

This project is for educational and development purposes.

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve the system.
