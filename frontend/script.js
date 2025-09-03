document.addEventListener('DOMContentLoaded', () => {
    // ------------------- LOADING SCREEN -------------------
    let pageLoaded = true;
    let timerComplete = false;

    function hideLoadingScreen() {
        if (pageLoaded && timerComplete) {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) loadingScreen.style.display = 'none';
        }
    }

    setTimeout(() => {
        timerComplete = true;
        hideLoadingScreen();
    }, 1300);

    // ------------------- CHAT FUNCTIONALITY -------------------
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.querySelector('.send');

    function addChatMessageAndRedirect() {
        const message = chatInput.value.trim();
        if (!message) return;

        // Store the initial message to be used on the next page
        localStorage.setItem("initialMessage", message);

        // Redirect to the new chat page
        window.location.href = 'chat.html';
    }

    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission
            addChatMessageAndRedirect();
        }
    });

    if (sendBtn) {
        sendBtn.addEventListener('click', addChatMessageAndRedirect);
    }

    // ------------------- LOGIN BUTTON REDIRECTION -------------------
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = 'login.html'; // Redirects to the login page
        });
    }

    // ------------------- AVATAR AND ARROW FUNCTIONALITY -------------------
    const avatarImg = document.querySelector('.generic-avatar');
    const arrowImg = document.querySelector('.arrow-forward');

    // Avatar click - redirect to login/profile
    if (avatarImg) {
        avatarImg.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
        avatarImg.style.cursor = 'pointer';
    }

    // Arrow click - redirect to chat page
    if (arrowImg) {
        arrowImg.addEventListener('click', () => {
            window.location.href = 'chat.html';
        });
        arrowImg.style.cursor = 'pointer';
    }
});