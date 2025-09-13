#!/usr/bin/env python3
"""
Test script for BlendAI backend endpoints
Run this after starting the backend server to test the new functionality
"""

import requests
import json
import os
from datetime import datetime

# Configuration
BASE_URL = "http://127.0.0.1:8003"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "testpassword123"
TEST_USER_NAME = "Test User"

def test_user_management():
    """Test user signup and signin"""
    print("=== Testing User Management ===")
    
    # Test signup
    signup_data = {
        "name": TEST_USER_NAME,
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/users/signup", json=signup_data)
        if response.status_code == 200:
            print("✅ User signup successful")
            user_data = response.json()
            user_id = user_data["user_id"]
        elif response.status_code == 409:
            print("ℹ️ User already exists, testing signin...")
            # Test signin
            signin_data = {
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
            response = requests.post(f"{BASE_URL}/api/users/signin", json=signin_data)
            if response.status_code == 200:
                print("✅ User signin successful")
                user_data = response.json()
                user_id = user_data["user"]["user_id"]
                auth_token = user_data["token"]
            else:
                print(f"❌ User signin failed: {response.text}")
                return None, None
        else:
            print(f"❌ User signup failed: {response.text}")
            return None, None
    except Exception as e:
        print(f"❌ Error in user management: {e}")
        return None, None
    
    return user_id, auth_token

def test_chat_operations(user_id, auth_token):
    """Test chat creation, rename, share, and delete"""
    print("\n=== Testing Chat Operations ===")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Test creating a chat by sending a message
    message_data = {
        "user_id": user_id,
        "message": "Hello, this is a test message for chat operations",
        "sender": "user"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/chat/send-message", 
                               json=message_data, headers=headers)
        if response.status_code == 200:
            print("✅ Chat created successfully")
            chat_data = response.json()
            chat_id = chat_data["chat_id"]
        else:
            print(f"❌ Chat creation failed: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating chat: {e}")
        return None
    
    # Test renaming chat
    rename_data = {"new_title": "Renamed Test Chat"}
    try:
        response = requests.put(f"{BASE_URL}/api/chat/rename/{chat_id}", 
                              json=rename_data, headers=headers)
        if response.status_code == 200:
            print("✅ Chat rename successful")
        else:
            print(f"❌ Chat rename failed: {response.text}")
    except Exception as e:
        print(f"❌ Error renaming chat: {e}")
    
    # Test sharing chat
    try:
        response = requests.post(f"{BASE_URL}/api/chat/share/{chat_id}", headers=headers)
        if response.status_code == 200:
            print("✅ Chat share successful")
            share_data = response.json()
            share_url = share_data["share_url"]
            print(f"   Share URL: {share_url}")
        else:
            print(f"❌ Chat share failed: {response.text}")
    except Exception as e:
        print(f"❌ Error sharing chat: {e}")
    
    # Test getting shared chat
    try:
        share_token = share_url.split("/")[-1]
        response = requests.get(f"{BASE_URL}/api/chat/shared/{share_token}")
        if response.status_code == 200:
            print("✅ Shared chat retrieval successful")
        else:
            print(f"❌ Shared chat retrieval failed: {response.text}")
    except Exception as e:
        print(f"❌ Error retrieving shared chat: {e}")
    
    # Test unsharing chat
    try:
        response = requests.delete(f"{BASE_URL}/api/chat/unshare/{chat_id}", headers=headers)
        if response.status_code == 200:
            print("✅ Chat unshare successful")
        else:
            print(f"❌ Chat unshare failed: {response.text}")
    except Exception as e:
        print(f"❌ Error unsharing chat: {e}")
    
    return chat_id

def test_image_upload(user_id, auth_token):
    """Test image upload functionality"""
    print("\n=== Testing Image Upload ===")
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Create a simple test image (1x1 pixel PNG)
    test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xdd\x8d\xb4\x1c\x00\x00\x00\x00IEND\xaeB`\x82'
    
    try:
        files = {"file": ("test.png", test_image_data, "image/png")}
        response = requests.post(f"{BASE_URL}/api/users/upload-avatar/{user_id}", 
                               files=files, headers=headers)
        if response.status_code == 200:
            print("✅ Image upload successful")
            upload_data = response.json()
            print(f"   Image URL: {upload_data['image_url']}")
        else:
            print(f"❌ Image upload failed: {response.text}")
    except Exception as e:
        print(f"❌ Error uploading image: {e}")

def test_health_endpoints():
    """Test health check endpoints"""
    print("\n=== Testing Health Endpoints ===")
    
    endpoints = [
        "/api/health/database",
        "/api/health/vector-db", 
        "/api/health/groq"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}")
            if response.status_code == 200:
                print(f"✅ {endpoint} - Healthy")
            else:
                print(f"❌ {endpoint} - Unhealthy: {response.text}")
        except Exception as e:
            print(f"❌ {endpoint} - Error: {e}")

def main():
    """Run all tests"""
    print("🚀 Starting BlendAI Backend Tests")
    print(f"Testing against: {BASE_URL}")
    print("=" * 50)
    
    # Test health endpoints first
    test_health_endpoints()
    
    # Test user management
    user_id, auth_token = test_user_management()
    if not user_id or not auth_token:
        print("❌ Cannot proceed without valid user authentication")
        return
    
    # Test chat operations
    chat_id = test_chat_operations(user_id, auth_token)
    
    # Test image upload
    test_image_upload(user_id, auth_token)
    
    print("\n" + "=" * 50)
    print("🎉 All tests completed!")
    print("\nTo test the frontend:")
    print("1. Open frontend/index.html in a browser")
    print("2. Sign in with the test user credentials")
    print("3. Try the rename, delete, share, and image upload features")

if __name__ == "__main__":
    main()
