#!/usr/bin/env python3
"""
Setup script for BlendAI backend
"""

import os
import shutil
from pathlib import Path

def create_env_file():
    """Create .env file from template if it doesn't exist"""
    env_file = Path(".env")
    template_file = Path("env_template.txt")
    
    if env_file.exists():
        print("✅ .env file already exists")
        return True
    
    if not template_file.exists():
        print("❌ env_template.txt not found")
        return False
    
    try:
        shutil.copy(template_file, env_file)
        print("✅ Created .env file from template")
        print("⚠️  Please edit .env file with your actual configuration values")
        return True
    except Exception as e:
        print(f"❌ Failed to create .env file: {e}")
        return False

def check_mongodb_installation():
    """Check if MongoDB is installed and running"""
    print("🔍 Checking MongoDB installation...")
    
    try:
        import pymongo
        print("✅ PyMongo is installed")
        
        # Try to connect to MongoDB
        from pymongo import MongoClient
        client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print("✅ MongoDB is running and accessible")
        client.close()
        return True
        
    except ImportError:
        print("❌ PyMongo is not installed. Run: pip install pymongo")
        return False
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        print("💡 Make sure MongoDB is installed and running:")
        print("   - Install MongoDB: https://docs.mongodb.com/manual/installation/")
        print("   - Start MongoDB service")
        return False

def install_dependencies():
    """Install required Python packages"""
    print("🔍 Installing Python dependencies...")
    
    try:
        import subprocess
        result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Dependencies installed successfully")
            return True
        else:
            print(f"❌ Failed to install dependencies: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error installing dependencies: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 BlendAI Backend Setup")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not Path("requirements.txt").exists():
        print("❌ Please run this script from the backend directory")
        return
    
    # Install dependencies
    if not install_dependencies():
        print("❌ Setup failed at dependency installation")
        return
    
    print()
    
    # Create .env file
    if not create_env_file():
        print("❌ Setup failed at .env file creation")
        return
    
    print()
    
    # Check MongoDB
    if not check_mongodb_installation():
        print("❌ Setup failed at MongoDB check")
        print("\n💡 Next steps:")
        print("1. Install and start MongoDB")
        print("2. Edit .env file with your configuration")
        print("3. Run: python test_db_connection.py")
        return
    
    print()
    print("🎉 Setup completed successfully!")
    print("\n📋 Next steps:")
    print("1. Edit .env file with your actual configuration values")
    print("2. Run: python test_db_connection.py")
    print("3. Run: python main.py")

if __name__ == "__main__":
    import sys
    main()
