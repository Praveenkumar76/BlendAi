import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, DuplicateKeyError
import bcrypt
from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv()

class MongoDBManager:
    """MongoDB database manager for BlendAI application"""
    
    def __init__(self):
        # Prefer env var, but fall back to the provided production cluster URI
        self.mongodb_url = os.getenv(
            "MONGODB_URL",
            "mongodb+srv://Tulasiram04:Je3XmIKKl9dWmuHI@blendai-user.sgplmk1.mongodb.net/?retryWrites=true&w=majority&appName=BlendAI-User",
        )
        self.database_name = os.getenv("MONGODB_DATABASE", "blendai_db")
        self.jwt_secret = os.getenv("JWT_SECRET_KEY", "your-secret-key")
        self.jwt_algorithm = "HS256"
        
        try:
            self.client = MongoClient(self.mongodb_url, serverSelectionTimeoutMS=5000)
            # Test connection
            self.client.admin.command('ping')
            self.db = self.client[self.database_name]
            
            # Initialize collections
            self.users = self.db.users
            self.chats = self.db.chats
            self.messages = self.db.messages
            
            # Create indexes for better performance
            self._create_indexes()
            
            print(f"✅ Connected to MongoDB: {self.database_name}")
            
        except ConnectionFailure as e:
            print(f"❌ Failed to connect to MongoDB: {e}")
            raise e
    
    def _create_indexes(self):
        """Create database indexes for better performance"""
        try:
            # User collection indexes (email unique, case-insensitive)
            try:
                self.users.create_index(
                    "email",
                    unique=True,
                    collation={"locale": "en", "strength": 2}
                )
            except TypeError:
                # Fallback for MongoDB versions that don't support collation in create_index via driver
                self.users.create_index("email", unique=True)
            self.users.create_index("user_id", unique=True)
            
            # Chat collection indexes
            self.chats.create_index("user_id")
            self.chats.create_index("chat_id", unique=True)
            
            # Messages collection indexes
            self.messages.create_index("chat_id")
            self.messages.create_index("user_id")
            self.messages.create_index("timestamp")
            
            print("✅ Database indexes created successfully")
        except Exception as e:
            print(f"⚠️ Warning: Could not create indexes: {e}")
    
    def is_connected(self) -> bool:
        """Check if MongoDB connection is active"""
        try:
            self.client.admin.command('ping')
            return True
        except:
            return False
    
    # User Management Methods
    def create_user(self, name: str, email: str, password: str) -> Dict[str, Any]:
        """Create a new user with hashed password"""
        try:
            # Normalize email
            normalized_email = (email or "").strip().lower()
            if not normalized_email:
                raise Exception("Email is required")

            # Guard: check if email already exists
            existing_user = self.users.find_one({"email": normalized_email})
            if existing_user:
                raise Exception("User with this email already exists")

            # Hash the password
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            user_data = {
                "user_id": self._generate_id(),
                "name": name,
                "email": normalized_email,
                "password": hashed_password,
                "created_at": datetime.utcnow(),
                "profile_image": None,
                "preferences": {}
            }
            
            result = self.users.insert_one(user_data)
            if result.inserted_id:
                # Remove password from returned data
                user_data.pop("password", None)
                return user_data
            else:
                raise Exception("Failed to create user")
                
        except DuplicateKeyError as e:
            try:
                key = e.details.get('keyValue') if hasattr(e, 'details') and e.details else None
                if key:
                    raise Exception(f"User already exists for {key}")
            except Exception:
                pass
            raise Exception("User with this email already exists")
        except Exception as e:
            raise Exception(f"Error creating user: {str(e)}")

    def user_email_exists(self, email: str) -> bool:
        """Check if a user exists for the given email (normalized)."""
        try:
            normalized_email = (email or "").strip().lower()
            return self.users.find_one({"email": normalized_email}) is not None
        except Exception:
            return False
    
    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user and return user data if valid"""
        try:
            normalized_email = (email or "").strip().lower()
            user = self.users.find_one({"email": normalized_email})
            if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                # Remove password from returned data
                user.pop("password", None)
                user['_id'] = str(user['_id'])  # Convert ObjectId to string
                return user
            return None
        except Exception as e:
            print(f"Authentication error: {e}")
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by user_id"""
        try:
            user = self.users.find_one({"user_id": user_id})
            if user:
                user.pop("password", None)
                user['_id'] = str(user['_id'])
                return user
            return None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    # Chat Management Methods
    def create_chat(self, user_id: str, title: str) -> str:
        """Create a new chat and return chat_id"""
        try:
            chat_id = self._generate_id()
            chat_data = {
                "chat_id": chat_id,
                "user_id": user_id,
                "title": title,
                "created_at": datetime.utcnow(),
                "last_message_at": datetime.utcnow(),
                "message_count": 0
            }
            
            result = self.chats.insert_one(chat_data)
            if result.inserted_id:
                return chat_id
            else:
                raise Exception("Failed to create chat")
        except Exception as e:
            raise Exception(f"Error creating chat: {str(e)}")
    
    def get_user_chats(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all chats for a user"""
        try:
            chats = list(self.chats.find({"user_id": user_id}).sort("last_message_at", -1))
            for chat in chats:
                chat['_id'] = str(chat['_id'])
            return chats
        except Exception as e:
            print(f"Error getting user chats: {e}")
            return []
    
    def update_chat_last_message(self, chat_id: str):
        """Update the last message timestamp for a chat"""
        try:
            self.chats.update_one(
                {"chat_id": chat_id},
                {
                    "$set": {"last_message_at": datetime.utcnow()},
                    "$inc": {"message_count": 1}
                }
            )
        except Exception as e:
            print(f"Error updating chat: {e}")
    
    # Message Management Methods
    def save_message(self, chat_id: str, user_id: str, text: str, sender: str) -> str:
        """Save a message and return message_id"""
        try:
            message_id = self._generate_id()
            message_data = {
                "message_id": message_id,
                "chat_id": chat_id,
                "user_id": user_id,
                "text": text,
                "sender": sender,
                "timestamp": datetime.utcnow()
            }
            
            result = self.messages.insert_one(message_data)
            if result.inserted_id:
                # Update chat's last message time
                self.update_chat_last_message(chat_id)
                return message_id
            else:
                raise Exception("Failed to save message")
        except Exception as e:
            raise Exception(f"Error saving message: {str(e)}")
    
    def get_chat_messages(self, user_id: Optional[str] = None, chat_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all messages, prioritized by chat_id if provided."""
        try:
            query: Dict[str, Any] = {}
            # Primary: filter by chat_id when provided
            if chat_id:
                query["chat_id"] = chat_id
            # Fallback: filter by user_id when chat_id is not provided
            elif user_id:
                query["user_id"] = user_id
            else:
                return []

            messages = list(self.messages.find(query).sort("timestamp", 1))
            for message in messages:
                message['_id'] = str(message['_id'])
            return messages
        except Exception as e:
            print(f"Error getting messages: {e}")
            return []
    
    def get_or_create_user_chat(self, user_id: str) -> str:
        """Get existing chat for user or create a new one"""
        try:
            # Try to find existing chat
            existing_chat = self.chats.find_one({"user_id": user_id})
            if existing_chat:
                return existing_chat["chat_id"]
            
            # Create new chat if none exists
            return self.create_chat(user_id, "New Chat")
        except Exception as e:
            print(f"Error getting/creating chat: {e}")
            return self.create_chat(user_id, "New Chat")
    
    # Utility Methods
    def _generate_id(self) -> str:
        """Generate a unique ID"""
        import uuid
        return str(uuid.uuid4())
    
    def create_jwt_token(self, user_id: str) -> str:
        """Create JWT token for user"""
        payload = {
            "user_id": user_id,
            "exp": datetime.utcnow().timestamp() + (24 * 60 * 60)  # 24 hours
        }
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
    
    def verify_jwt_token(self, token: str) -> Optional[str]:
        """Verify JWT token and return user_id"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            return payload.get("user_id")
        except JWTError:
            return None
    
    def close_connection(self):
        """Close MongoDB connection"""
        if hasattr(self, 'client'):
            self.client.close()
            print("MongoDB connection closed")

# Global database instance
db_manager = None

def get_db_manager() -> MongoDBManager:
    """Get or create database manager instance"""
    global db_manager
    if db_manager is None:
        db_manager = MongoDBManager()
    return db_manager
