# BlendAI MongoDB Setup Guide

This guide will help you set up MongoDB integration for the BlendAI application.

## 🚀 Quick Setup

### 1. Install MongoDB

**Windows:**
```bash
# Download and install MongoDB Community Server from:
# https://www.mongodb.com/try/download/community

# Or use Chocolatey:
choco install mongodb

# Start MongoDB service
net start MongoDB
```

**macOS:**
```bash
# Using Homebrew:
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

**Linux (Ubuntu/Debian):**
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 2. Install Python Dependencies

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy environment template
cp env_template.txt .env

# Edit .env file with your configuration
# At minimum, set:
# - MONGODB_URL (default: mongodb://localhost:27017)
# - MONGODB_DATABASE (default: blendai_db)
# - JWT_SECRET_KEY (generate a secure random string)
# - GROQ_API_KEY (get from https://console.groq.com/)
```

### 4. Test Database Connection

```bash
# Run the database test
python test_db_connection.py
```

### 5. Start the Application

```bash
# Start the backend server
python main.py
```

## 🔧 Configuration Details

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017` | Yes |
| `MONGODB_DATABASE` | Database name | `blendai_db` | Yes |
| `JWT_SECRET_KEY` | Secret key for JWT tokens | - | Yes |
| `GROQ_API_KEY` | Groq API key for LLM | - | Yes |

### MongoDB Collections

The application creates the following collections:

- **users**: User accounts and authentication data
- **chats**: Chat sessions metadata
- **messages**: Individual chat messages

## 🧪 Testing

### Health Check Endpoints

Once the server is running, you can check the status:

```bash
# Check MongoDB connection
curl http://localhost:8003/api/health/database

# Check vector database
curl http://localhost:8003/api/health/vector-db

# Check Groq API
curl http://localhost:8003/api/health/groq
```

### Manual Testing

1. **User Registration:**
```bash
curl -X POST http://localhost:8003/api/users/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "password123"}'
```

2. **User Login:**
```bash
curl -X POST http://localhost:8003/api/users/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

3. **Send Message (with JWT token):**
```bash
curl -X POST http://localhost:8003/api/chat/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"user_id": "USER_ID", "message": "Hello!", "sender": "user"}'
```

## 🔒 Security Features

### Password Hashing
- Passwords are hashed using bcrypt before storage
- Salt rounds are automatically generated

### JWT Authentication
- JWT tokens expire after 24 hours
- Tokens are required for protected endpoints
- Google OAuth users get special handling

### Database Security
- Unique indexes on email and user_id
- Input validation and sanitization
- Error handling without information leakage

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running: `mongosh` or `mongo`
   - Check connection string in .env file
   - Verify firewall settings

2. **Import Errors**
   - Run: `pip install -r requirements.txt`
   - Check Python version (3.8+ required)

3. **JWT Token Issues**
   - Ensure JWT_SECRET_KEY is set in .env
   - Check token expiration (24 hours)
   - Verify Authorization header format

4. **Database Index Errors**
   - Drop and recreate database if needed
   - Check MongoDB version compatibility

### Logs and Debugging

Enable debug logging by setting environment variable:
```bash
export PYTHONPATH=.
python main.py
```

Check MongoDB logs:
```bash
# Windows
tail -f "C:\Program Files\MongoDB\Server\6.0\log\mongod.log"

# macOS/Linux
tail -f /var/log/mongodb/mongod.log
```

## 📊 Database Schema

### Users Collection
```json
{
  "_id": "ObjectId",
  "user_id": "uuid",
  "name": "string",
  "email": "string (unique)",
  "password": "hashed_string",
  "created_at": "datetime",
  "profile_image": "string|null",
  "preferences": "object"
}
```

### Chats Collection
```json
{
  "_id": "ObjectId",
  "chat_id": "uuid",
  "user_id": "uuid",
  "title": "string",
  "created_at": "datetime",
  "last_message_at": "datetime",
  "message_count": "number"
}
```

### Messages Collection
```json
{
  "_id": "ObjectId",
  "message_id": "uuid",
  "chat_id": "uuid",
  "user_id": "uuid",
  "text": "string",
  "sender": "user|bot",
  "timestamp": "datetime"
}
```

## 🚀 Production Deployment

For production deployment:

1. **Use MongoDB Atlas** or a managed MongoDB service
2. **Set strong JWT secret** (32+ characters)
3. **Enable SSL/TLS** for MongoDB connections
4. **Use environment-specific configurations**
5. **Set up monitoring and logging**
6. **Implement rate limiting**
7. **Use reverse proxy** (nginx/Apache)

## 📝 API Documentation

The API documentation is available at:
- Swagger UI: `http://localhost:8003/docs`
- ReDoc: `http://localhost:8003/redoc`

## 🤝 Support

If you encounter issues:

1. Check this README first
2. Run the test script: `python test_db_connection.py`
3. Check the health endpoints
4. Review MongoDB and application logs
5. Ensure all environment variables are set correctly
