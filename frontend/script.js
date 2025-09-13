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

    // ------------------- LOGIN BUTTON AND PROFILE AVATAR REDIRECTION -------------------
    const loginBtn = document.getElementById('login-btn');
    const mainProfileContainer = document.getElementById('main-profile-container');
    const mainProfileAvatar = document.getElementById('main-profile-avatar');
    const mainProfileDropdown = document.getElementById('main-profile-dropdown');
    const mainProfileOption = document.getElementById('main-profile-option');
    const mainSignoutOption = document.getElementById('main-signout-option');

    if (loginBtn && mainProfileContainer) {
        // Only hide login when BOTH a valid userId and token exist
        const storedUserId = localStorage.getItem('userId');
        const storedToken = localStorage.getItem('authToken');
        const hasValidUserId = !!(storedUserId && storedUserId !== 'undefined' && storedUserId !== 'null');
        const hasValidToken = !!(storedToken && storedToken !== 'undefined' && storedToken !== 'null');
        const isLoggedIn = hasValidUserId && hasValidToken;

        // Show/hide appropriate elements
        loginBtn.style.display = isLoggedIn ? 'none' : 'block';
        mainProfileContainer.style.display = isLoggedIn ? 'block' : 'none';

        loginBtn.addEventListener('click', () => {
            window.location.href = 'login.html'; // Redirects to the login page
        });
    }

    // Load user profile image if available
    const loadProfileImage = async () => {
        const storedUserId = localStorage.getItem('userId');
        const storedToken = localStorage.getItem('authToken');
        if (storedUserId && storedToken) {
            try {
                const response = await fetch(`http://127.0.0.1:8003/api/users/${storedUserId}`, {
                    headers: { "Authorization": `Bearer ${storedToken}` }
                });
                if (response.ok) {
                    const userData = await response.json();
                    if (userData.profile_image) {
                        const imageUrl = userData.profile_image.startsWith('http') 
                            ? userData.profile_image 
                            : `http://127.0.0.1:8003${userData.profile_image}`;
                        document.getElementById('main-avatar-img').src = imageUrl;
                    }
                }
            } catch (error) {
                console.error('Error loading profile image:', error);
            }
        }
    };

    // Load profile image on page load
    loadProfileImage();

    // Main profile avatar dropdown functionality
    if (mainProfileAvatar && mainProfileDropdown) {
        // Toggle dropdown on avatar click
        mainProfileAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            mainProfileDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!mainProfileAvatar.contains(e.target) && !mainProfileDropdown.contains(e.target)) {
                mainProfileDropdown.classList.remove('show');
            }
        });

        // Profile option
        if (mainProfileOption) {
            mainProfileOption.addEventListener('click', () => {
                window.location.href = 'profile.html';
                mainProfileDropdown.classList.remove('show');
            });
        }

        // Sign out option
        if (mainSignoutOption) {
            mainSignoutOption.addEventListener('click', () => {
                if (confirm('Are you sure you want to sign out?')) {
                    localStorage.clear();
                    window.location.href = 'index.html';
                }
                mainProfileDropdown.classList.remove('show');
            });
        }
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