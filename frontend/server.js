// server.js

// Import necessary packages
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config(); // This loads environment variables from your .env file

// Initialize Express app
const app = express();
const port = 8000;

// Middleware - these are functions that run for every request
app.use(cors()); // Allows your front-end to make requests to the server
app.use(express.json()); // Parses incoming JSON data from requests
app.use(express.static('.')); // Serve static files from current directory

// MongoDB Connection URI from .env file (fallback to provided cluster URI)
const uri = process.env.MONGODB_URI || 'mongodb+srv://Tulasiram04:Je3XmIKKl9dWmuHI@blendai-user.sgplmk1.mongodb.net/?retryWrites=true&w=majority&appName=BlendAI-User';

// Create a new MongoClient
const client = new MongoClient(uri);

// Function to connect to MongoDB
async function connectToMongo() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB!");
    } catch (e) {
        console.error("Could not connect to MongoDB", e);
    }
}

// Connect to the database
connectToMongo();

// API Endpoints

// Endpoint for user sign-up
app.post('/api/users/signup', async (req, res) => {
    try {
        {console.log("Sign up");}
        const db = client.db('BlendAI-User');
        const usersCollection = db.collection('users');
        const { name, email, password } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists.' });
        }

        // Create new user document
        const newUser = { name, email: normalizedEmail, password };
        const result = await usersCollection.insertOne(newUser);
        res.status(201).json({ message: 'User created successfully', userId: result.insertedId });
    } catch (error) {
        res.status(500).json({ message: 'Server error during sign up', error });
    }
});

// Endpoint for user sign-in
app.post('/api/users/signin', async (req, res) => {
    try {
        const db = client.db('BlendAI-User');
        const usersCollection = db.collection('users');
        const { email, password } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();

        // Find user by email and password
        const user = await usersCollection.findOne({ email: normalizedEmail, password });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        res.status(200).json({ 
            message: 'Sign in successful', 
            userId: user._id, 
            userName: user.name 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error during sign in', error });
    }
});

// Endpoint for sending a chat message
app.post('/api/chat/send-message', async (req, res) => {
    try {
        const db = client.db('BlendAI-User');
        const chatsCollection = db.collection('chats');
        const { userId, message, sender } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Find existing chat or create a new one
        const chat = await chatsCollection.findOne({ userId: new ObjectId(userId) });

        const newMessage = {
            text: message,
            sender: sender,
            timestamp: new Date()
        };

        if (chat) {
            await chatsCollection.updateOne(
                { _id: chat._id },
                { $push: { messages: newMessage } }
            );
        } else {
            await chatsCollection.insertOne({
                userId: new ObjectId(userId),
                messages: [newMessage]
            });
        }
        res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error sending message', error });
    }
});

// Endpoint for fetching chat history
app.get('/api/chat/get-messages/:userId', async (req, res) => {
    try {
        const db = client.db('BlendAI-User');
        const chatsCollection = db.collection('chats');
        const { userId } = req.params;

        const chat = await chatsCollection.findOne({ userId: new ObjectId(userId) });

        if (!chat) {
            return res.status(404).json({ messages: [] });
        }

        res.status(200).json({ messages: chat.messages });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching messages', error });
    }
});

// Endpoint for getting user details by ID
app.get('/api/users/:userId', async (req, res) => {
    try {
        const db = client.db('BlendAI-User');
        const usersCollection = db.collection('users');
        const { userId } = req.params;

        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Return only safe user data (exclude password)
        res.status(200).json({ 
            name: user.name, 
            email: user.email,
            userId: user._id 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching user details', error });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});