#!/usr/bin/env python3
"""
Test script to check MongoDB connection and database functionality
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_database_connection():
    """Test MongoDB connection and basic operations"""
    try:
        from database import get_db_manager
        
        print("🔍 Testing MongoDB connection...")
        db = get_db_manager()
        
        if not db.is_connected():
            print("❌ MongoDB connection failed!")
            return False
        
        print("✅ MongoDB connection successful!")
        
        # Test basic operations
        print("\n🧪 Testing basic database operations...")
        
        # Test user creation
        test_user = db.create_user("Test User", "test@example.com", "testpassword123")
        print(f"✅ User created: {test_user['name']} ({test_user['user_id']})")
        
        # Test user authentication
        auth_user = db.authenticate_user("test@example.com", "testpassword123")
        if auth_user:
            print(f"✅ User authentication successful: {auth_user['name']}")
        else:
            print("❌ User authentication failed!")
            return False
        
        # Test chat creation
        chat_id = db.create_chat(test_user['user_id'], "Test Chat")
        print(f"✅ Chat created: {chat_id}")
        
        # Test message saving
        message_id = db.save_message(chat_id, test_user['user_id'], "Hello, this is a test message!", "user")
        print(f"✅ Message saved: {message_id}")
        
        # Test message retrieval
        messages = db.get_chat_messages(test_user['user_id'])
        print(f"✅ Retrieved {len(messages)} messages")
        
        # Test JWT token creation
        token = db.create_jwt_token(test_user['user_id'])
        print(f"✅ JWT token created: {token[:50]}...")
        
        # Test JWT token verification
        verified_user_id = db.verify_jwt_token(token)
        if verified_user_id == test_user['user_id']:
            print("✅ JWT token verification successful")
        else:
            print("❌ JWT token verification failed!")
            return False
        
        print("\n🎉 All database tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

def test_environment_variables():
    """Test if required environment variables are set"""
    print("🔍 Checking environment variables...")
    
    required_vars = ['MONGODB_URL', 'MONGODB_DATABASE', 'JWT_SECRET_KEY']
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("Please create a .env file based on env_template.txt")
        return False
    else:
        print("✅ All required environment variables are set")
        return True

def main():
    """Main test function"""
    print("🚀 BlendAI Database Connection Test")
    print("=" * 50)
    
    # Test environment variables
    if not test_environment_variables():
        sys.exit(1)
    
    print()
    
    # Test database connection
    if not test_database_connection():
        sys.exit(1)
    
    print("\n✅ All tests completed successfully!")
    print("Your MongoDB setup is working correctly.")

if __name__ == "__main__":
    main()
