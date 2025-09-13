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
    const authToken = localStorage.getItem('authToken');
    
    if (!userId || !authToken) {
        console.log('❌ Missing userId or authToken, redirecting to login');
        window.location.href = 'login.html';
        return;
    }
    
    // Debug: Check stored values
    console.log('🔍 Stored userId:', userId);
    console.log('🔍 Stored authToken:', authToken.substring(0, 50) + '...');
    console.log('🔍 Token exists:', !!authToken);
    
    // Test authentication by making a simple request
    try {
        const response = await fetch(`http://127.0.0.1:8003/api/users/${userId}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            console.log('❌ Token validation failed, redirecting to login');
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }
        
        console.log('✅ Token validation successful');
    } catch (error) {
        console.log('❌ Token validation error:', error);
        localStorage.clear();
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
            if (!currentChatId && response.chat_id) {
                currentChatId = response.chat_id;
                await loadChatHistory(); 
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
        msgDiv.innerHTML = marked.parse(text);
    } else {
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
    if (typingIndicator) typingIndicator.remove();
}

// --- CHAT HISTORY & MANAGEMENT ---
newChatBtn.addEventListener("click", () => {
    currentChatId = null;
    messagesDiv.innerHTML = '';
    addMessage("Ask me anything to start a new chat.", "bot-message");
    document.querySelectorAll('#history-list li').forEach(item => item.classList.remove('active-chat'));
});

searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    historyList.querySelectorAll("li").forEach(item => {
        const title = item.querySelector('.chat-title').textContent.toLowerCase();
        item.style.display = title.includes(query) ? "" : "none";
    });
});

async function loadChatHistory() {
    const authToken = localStorage.getItem('authToken');
    const headers = { "Authorization": `Bearer ${authToken}` };

    try {
        const res = await fetch(`http://127.0.0.1:8003/api/chat/history/${userId}`, { headers });
        if (res.ok) {
            const chats = await res.json();
            historyList.innerHTML = '';
            chats.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
            
            chats.forEach(chat => {
                const li = createChatHistoryItem(chat);
                historyList.appendChild(li);
            });
        }
    } catch (err) {
        console.error('Load Chat History Error:', err);
    }
}

function createChatHistoryItem(chat) {
    const li = document.createElement('li');
    li.dataset.chatId = chat.chat_id;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-title';
    titleSpan.textContent = chat.title || 'Chat';
    
    const kebabMenu = document.createElement('div');
    kebabMenu.className = 'kebab-menu';
    kebabMenu.innerHTML = '&#8942;'; // Vertical ellipsis character

    const optionsMenu = document.createElement('div');
    optionsMenu.className = 'options-menu';
    optionsMenu.innerHTML = `
        <button class="rename-btn">Rename</button>
        <button class="share-btn">Share</button>
        <button class="delete-btn">Delete</button>
    `;

    li.appendChild(titleSpan);
    li.appendChild(kebabMenu);
    li.appendChild(optionsMenu);

    // Event listeners
    titleSpan.addEventListener('click', () => {
        currentChatId = chat.chat_id;
        document.querySelectorAll('#history-list li').forEach(item => item.style.backgroundColor = '');
        li.style.backgroundColor = '#222';
        loadChatMessages(currentChatId);
    });

    kebabMenu.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent chat from loading
        optionsMenu.style.display = optionsMenu.style.display === 'block' ? 'none' : 'block';
    });

    optionsMenu.querySelector('.rename-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleRenameChat(chat.chat_id, titleSpan);
        optionsMenu.style.display = 'none';
    });

    optionsMenu.querySelector('.share-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleShareChat(chat.chat_id, e.target);
        optionsMenu.style.display = 'none';
    });
    
    optionsMenu.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteChat(chat.chat_id, li);
        optionsMenu.style.display = 'none';
    });
    
    // Hide menu if clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!li.contains(e.target)) {
            optionsMenu.style.display = 'none';
        }
    });

    return li;
}

// --- RENAME, SHARE, DELETE LOGIC ---

function handleRenameChat(chatId, titleSpan) {
    const currentTitle = titleSpan.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-input';
    input.value = currentTitle;
    
    titleSpan.replaceWith(input);
    input.focus();

    const saveRename = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            try {
                const authToken = localStorage.getItem('authToken');
                if (!authToken) {
                    showToast('Please sign in again to continue.', 'error');
                    window.location.href = 'login.html';
                    return;
                }
                
                console.log('Auth token exists:', !!authToken);
                console.log('Making rename request for chat:', chatId);
                
                const response = await fetch(`http://127.0.0.1:8003/api/chat/rename/${chatId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ new_title: newTitle })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    titleSpan.textContent = result.new_title;
                    showToast('Chat renamed successfully!', 'success');
                } else {
                    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                    throw new Error(`Failed to rename chat: ${errorData.detail || response.statusText}`);
                }
            } catch (error) {
                console.error('Error renaming chat:', error);
                showToast('Failed to rename chat. Please try again.', 'error');
                titleSpan.textContent = currentTitle; // Revert on error
            }
        } else {
            titleSpan.textContent = currentTitle; // Revert if empty or unchanged
        }
        input.replaceWith(titleSpan);
    };

    input.addEventListener('blur', saveRename);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveRename();
        }
    });
}

async function handleShareChat(chatId, button) {
    const originalText = button.textContent;
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            showToast('Please sign in again to continue.', 'error');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('Making share request for chat:', chatId);
        const response = await fetch(`http://127.0.0.1:8003/api/chat/share/${chatId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            await navigator.clipboard.writeText(result.share_url);
            button.textContent = 'Copied!';
            showToast('Share link copied to clipboard!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(`Failed to generate share link: ${errorData.detail || response.statusText}`);
        }
    } catch (e) {
        console.error("Failed to share chat:", e);
        button.textContent = 'Failed!';
        showToast('Failed to generate share link. Please try again.', 'error');
    } finally {
        setTimeout(() => { button.textContent = originalText; }, 2000);
    }
}

async function handleDeleteChat(chatId, listItemElement) {
    if (confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
        try {
            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                showToast('Please sign in again to continue.', 'error');
                window.location.href = 'login.html';
                return;
            }
            
            console.log('Making delete request for chat:', chatId);
            const response = await fetch(`http://127.0.0.1:8003/api/chat/delete/${chatId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                listItemElement.remove();
                if (currentChatId === chatId) {
                    newChatBtn.click(); // Reset to new chat view
                }
                showToast('Chat deleted successfully!', 'success');
            } else {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(`Failed to delete chat: ${errorData.detail || response.statusText}`);
            }
        } catch(e) {
            console.error("Failed to delete chat:", e);
            showToast('Failed to delete chat. Please try again.', 'error');
        }
    }
}

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
            headers,
            body: JSON.stringify({ user_id: userId, message, sender, chat_id: currentChatId })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();

    } catch (err) {
        console.error("Send Message Error:", err);
        throw err;
    }
}

async function getChatMessages(chatId) {
    const authToken = localStorage.getItem('authToken');
    const headers = { "Authorization": `Bearer ${authToken}` };
    try {
        const res = await fetch(`http://127.0.0.1:8003/api/chat/get-messages/${chatId}`, { headers });
        if (res.ok) {
            return await res.json();
        }
        return null;
    } catch(err) {
        console.error("Get Chat Messages Error:", err);
        return null;
    }
}

async function loadChatMessages(chatId) {
    messagesDiv.innerHTML = '';
    addMessage('Loading chat...', 'bot-message');
    
    const messages = await getChatMessages(chatId);
    
    messagesDiv.innerHTML = ''; // Clear "Loading..." message
    if (messages) {
        messages.forEach(msg => addMessage(msg.text, `${msg.sender}-message`));
    } else {
        addMessage('Failed to load chat messages.', 'bot-message');
    }
}

async function loadUserDetails() {
    const userNameElement = document.querySelector('.user-name');
    const userAvatarElement = document.querySelector('.user-avatar');
    const authToken = localStorage.getItem('authToken');
    const headers = { "Authorization": `Bearer ${authToken}` };
    
    try {
        const response = await fetch(`http://127.0.0.1:8003/api/users/${userId}`, { headers });
        if (response.ok) {
            const userData = await response.json();
            if (userNameElement && userData.name) {
                userNameElement.textContent = userData.name;
            }
            if (userAvatarElement && userData.profile_image) {
                const imageUrl = userData.profile_image.startsWith('http') 
                    ? userData.profile_image 
                    : `http://127.0.0.1:8003${userData.profile_image}`;
                userAvatarElement.src = imageUrl;
            }
        } else {
            userNameElement.textContent = localStorage.getItem('userName') || 'User';
        }
    } catch (error) {
        userNameElement.textContent = localStorage.getItem('userName') || 'User';
    }
}

// --- UTILITY FUNCTIONS ---
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}