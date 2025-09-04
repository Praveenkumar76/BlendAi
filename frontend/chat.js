const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const messagesDiv = document.getElementById("messages");
const historyList = document.getElementById("history-list");
const newChatBtn = document.getElementById("new-chat-btn");
const searchInput = document.querySelector(".search-box input");
 
let currentChatId = null;
const userId = localStorage.getItem("userId");

// --- INITIALIZATION ---
window.addEventListener("DOMContentLoaded", async () => {
    if (!userId) {
        // Redirect to login if user is not authenticated
        window.location.href = 'login.html';
        return;
    }
    
    await loadUserDetails();
    await loadChatHistory();
    addMessage("Hello! How can I help you with Blender today?", "bot-message");
});

// --- MESSAGE SENDING ---
sendBtn.addEventListener("click", handleSendMessage);
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

async function handleSendMessage() {
    const messageText = userInput.value.trim();
    if (!messageText) return;
    
    addMessage(messageText, "user-message");
    userInput.value = "";
    
    showTypingIndicator();

    try {
        const response = await sendMessageToServer(messageText, "user");
        removeTypingIndicator();
        
        if (response && response.text) {
            addMessage(response.text, "bot-message");
            // If this is the first message of a new chat, update history
            if (!currentChatId && response.chat_id) {
                currentChatId = response.chat_id;
                await loadChatHistory(); // Refresh history to show the new chat
            }
        } else {
            addMessage("I'm sorry, I couldn't generate a response. Please try again.", "bot-message");
        }
    } catch (error) {
        console.error("Error sending message:", error);
        removeTypingIndicator();
        addMessage("I'm sorry, there was an error processing your request. Please try again.", "bot-message");
    }
}

// --- UI UPDATES ---
function addMessage(text, className) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", className);

    if (className.includes("bot-message")) {
        // Use the 'marked' library to parse the entire Markdown text into HTML
        // This handles paragraphs, lists, bold, italics, etc.
        msgDiv.innerHTML = marked.parse(text);
    } else {
        // For user messages, always use textContent to prevent security risks
        msgDiv.textContent = text;
    }

    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("message", "bot-message", "typing-indicator");
    typingDiv.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.querySelector(".typing-indicator");
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// --- CHAT HISTORY & MANAGEMENT ---
newChatBtn.addEventListener("click", () => {
    currentChatId = null;
    messagesDiv.innerHTML = '';
    addMessage("Ask me anything to start a new chat.", "bot-message");
});

searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    historyList.querySelectorAll("li").forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(query) ? "" : "none";
    });
});

// --- SERVER COMMUNICATION ---
async function sendMessageToServer(message, sender) {
    const authToken = localStorage.getItem('authToken');
    const headers = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
    };
    
    try {
        const response = await fetch("http://127.0.0.1:8003/api/chat/send-message", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ user_id: userId, message, sender, chat_id: currentChatId })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();

    } catch (err) {
        console.error("Send Message Error:", err);
        throw err;
    }
}

async function loadChatMessages(chatId) {
    const authToken = localStorage.getItem('authToken');
    const headers = { "Authorization": `Bearer ${authToken}` };
    
    try {
        messagesDiv.innerHTML = '';
        addMessage('Loading chat...', 'bot-message');

        const res = await fetch(`http://127.0.0.1:8003/api/chat/get-messages/${chatId}`, { headers });
        if (res.ok) {
            const messages = await res.json();
            messagesDiv.innerHTML = ''; // Clear "Loading..." message
            messages.forEach(msg => addMessage(msg.text, `${msg.sender}-message`));
        } else {
             messagesDiv.innerHTML = '';
             addMessage('Failed to load chat messages.', 'bot-message');
        }
    } catch (err) {
        console.error("Load Chat Messages Error:", err);
        messagesDiv.innerHTML = '';
        addMessage('Error loading chat. Please check the console.', 'bot-message');
    }
}

async function loadChatHistory() {
    const authToken = localStorage.getItem('authToken');
    const headers = { "Authorization": `Bearer ${authToken}` };

    try {
        const res = await fetch(`http://127.0.0.1:8003/api/chat/history/${userId}`, { headers });
        if (res.ok) {
            const chats = await res.json();
            historyList.innerHTML = '';
            // Sort chats by most recent first
            chats.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
            
            chats.forEach(chat => {
                const li = document.createElement('li');
                li.textContent = chat.title || 'Chat';
                li.dataset.chatId = chat.chat_id;
                
                li.addEventListener('click', () => {
                    currentChatId = chat.chat_id;
                    // Visually mark the active chat
                    document.querySelectorAll('#history-list li').forEach(item => item.style.backgroundColor = '');
                    li.style.backgroundColor = '#222';
                    loadChatMessages(currentChatId);
                });
                historyList.appendChild(li);
            });
        }
    } catch (err) {
        console.error('Load Chat History Error:', err);
    }
}

async function loadUserDetails() {
    const userNameElement = document.querySelector('.user-name');
    const authToken = localStorage.getItem('authToken');
    const headers = { "Authorization": `Bearer ${authToken}` };
    
    try {
        const response = await fetch(`http://127.0.0.1:8003/api/users/${userId}`, { headers });
        if (response.ok) {
            const userData = await response.json();
            if (userNameElement && userData.name) {
                userNameElement.textContent = userData.name;
            }
        } else {
            console.error('Failed to fetch user data:', response.status);
            // Fallback to locally stored name if available
            userNameElement.textContent = localStorage.getItem('userName') || 'User';
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        userNameElement.textContent = localStorage.getItem('userName') || 'User';
    }
}