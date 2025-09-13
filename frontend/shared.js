// Shared Chat Page JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    const messagesDiv = document.getElementById('messages');
    const sharedChatTitle = document.getElementById('shared-chat-title');
    const sharedChatDate = document.getElementById('shared-chat-date');
    
    // Get share token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('token');
    
    if (!shareToken) {
        showError('Invalid share link. No token provided.');
        return;
    }
    
    try {
        // Load shared chat
        const response = await fetch(`http://127.0.0.1:8003/api/chat/shared/${shareToken}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                showError('Shared chat not found or expired.');
            } else {
                showError('Failed to load shared chat.');
            }
            return;
        }
        
        const data = await response.json();
        const { chat, messages } = data;
        
        // Update chat info
        sharedChatTitle.textContent = chat.title;
        sharedChatDate.textContent = `Created: ${new Date(chat.created_at).toLocaleDateString()}`;
        
        // Display messages
        if (messages && messages.length > 0) {
            messages.forEach(msg => {
                addMessage(msg.text, `${msg.sender}-message`);
            });
        } else {
            addMessage('No messages in this shared chat.', 'bot-message');
        }
        
    } catch (error) {
        console.error('Error loading shared chat:', error);
        showError('Failed to load shared chat. Please try again later.');
    }
});

function addMessage(text, className) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", className);

    if (className.includes("bot-message")) {
        msgDiv.innerHTML = marked.parse(text);
    } else {
        msgDiv.textContent = text;
    }

    const messagesDiv = document.getElementById('messages');
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showError(message) {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = `
        <div class="message bot-message error-message">
            <h3>Error</h3>
            <p>${message}</p>
            <a href="index.html" class="btn btn-primary">Go to BlendAI Home</a>
        </div>
    `;
}
