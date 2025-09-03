const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const messagesDiv = document.getElementById("messages");
const historyList = document.getElementById("history-list");
const newChatBtn = document.getElementById("new-chat-btn");
const searchInput = document.querySelector(".search-box input");

let firstMessageSaved = false;
const userId = localStorage.getItem("userId");

// ------------------- LOAD INITIAL MESSAGE -------------------
window.addEventListener("DOMContentLoaded", async () => {
    // Load user details and update the display
    await loadUserDetails();
    
    const initialMessage = localStorage.getItem("initialMessage");
    if (initialMessage) {
        document.title = initialMessage.length > 20 ? initialMessage.substring(0,20) + "..." : initialMessage;
        addMessage(initialMessage, "user-message");
        simulateBotResponse(initialMessage);
        addToHistory(initialMessage);
        await sendMessageToServer(initialMessage, "user");
        firstMessageSaved = true;
        localStorage.removeItem("initialMessage");
    }
    loadMessagesFromServer();
});

// ------------------- SEND MESSAGE -------------------
sendBtn.addEventListener("click", () => {
    const msg = userInput.value.trim();
    if (msg) sendMessage(msg);
});

userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        const msg = userInput.value.trim();
        if (msg) sendMessage(msg);
    }
});

async function sendMessage(messageText) {
    addMessage(messageText, "user-message");
    if (!firstMessageSaved) {
        addToHistory(messageText);
        firstMessageSaved = true;
    }
    userInput.value = "";
    await sendMessageToServer(messageText, "user");
    simulateBotResponse(messageText);
}

// ------------------- ADD MESSAGE -------------------
function addMessage(text, className) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", className);
    msgDiv.textContent = text;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ------------------- BOT RESPONSE -------------------
async function simulateBotResponse(userText) {
    try {
        // Show typing indicator
        showTypingIndicator();
        
        // Send message to server and get AI response
        const response = await sendMessageToServer(userText, "user");
        
        // Remove typing indicator
        removeTypingIndicator();
        
        // Add the AI response
        if (response && response.text) {
            addMessage(response.text, "bot-message");
        } else {
            addMessage("I'm sorry, I couldn't generate a response. Please try again.", "bot-message");
        }
    } catch (error) {
        console.error("Error getting AI response:", error);
        removeTypingIndicator();
        addMessage("I'm sorry, there was an error processing your request. Please try again.", "bot-message");
    }
}

// ------------------- TYPING INDICATOR -------------------
function showTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("message", "bot-message", "typing-indicator");
    typingDiv.innerHTML = `
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.querySelector(".typing-indicator");
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// ------------------- CHAT HISTORY -------------------
function addToHistory(text) {
    const historyItem = document.createElement("li");
    historyItem.textContent = text.length > 20 ? text.substring(0,20) + "..." : text;
    historyList.appendChild(historyItem);
}

// ------------------- SEARCH HISTORY -------------------
searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    historyList.querySelectorAll("li").forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(query) ? "" : "none";
    });
});

// ------------------- NEW CHAT -------------------
newChatBtn.addEventListener("click", () => {
    window.location.href = "index.html";
});

// ------------------- SERVER FUNCTIONS -------------------
async function sendMessageToServer(message, sender) {
    if (!userId) return;
    
    const authToken = localStorage.getItem('authToken');
    const headers = { "Content-Type": "application/json" };
    
    // Add Authorization header if we have a JWT token (not Google OAuth)
    if (authToken && authToken !== 'google_oauth') {
        headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    try {
        const response = await fetch("http://127.0.0.1:8003/api/chat/send-message", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ user_id: userId, message, sender })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (err) {
        console.error("Send Message Error:", err);
        throw err;
    }
}

async function loadMessagesFromServer() {
    if (!userId) return;
    
    const authToken = localStorage.getItem('authToken');
    const headers = {};
    
    // Add Authorization header if we have a JWT token (not Google OAuth)
    if (authToken && authToken !== 'google_oauth') {
        headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    try {
        const res = await fetch(`http://127.0.0.1:8003/api/chat/get-messages/${userId}`, {
            headers: headers
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                data.forEach(msg => addMessage(msg.text, msg.sender + "-message"));
            }
        }
    } catch (err) {
        console.error("Load Messages Error:", err);
    }
}

// ------------------- LOAD USER DETAILS -------------------
async function loadUserDetails() {
    const userNameElement = document.querySelector('.user-name');
    
    if (!userId) {
        console.log('No userId found in localStorage');
        return;
    }
    
    const authToken = localStorage.getItem('authToken');
    const headers = {};
    
    // Add Authorization header if we have a JWT token (not Google OAuth)
    if (authToken && authToken !== 'google_oauth') {
        headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    try {
        const response = await fetch(`http://127.0.0.1:8003/api/users/${userId}`, {
            headers: headers
        });
        if (response.ok) {
            const userData = await response.json();
            if (userNameElement && userData.name) {
                userNameElement.textContent = userData.name;
            }
        } else {
            console.error('Failed to fetch user data:', response.status);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        // Fallback to localStorage
        const storedUserName = localStorage.getItem('userName');
        if (storedUserName && storedUserName !== 'undefined' && userNameElement) {
            userNameElement.textContent = storedUserName;
        }
    }
}
