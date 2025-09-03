document.addEventListener('DOMContentLoaded', () => {
    const signUpButton = document.getElementById('signUp');
    const signInButton = document.getElementById('signIn');
    const container = document.getElementById('container');
    const signInFormBtn = document.getElementById('signInBtn');
    const signUpFormBtn = document.getElementById('signUpBtn');

    if (signUpButton && container) {
        signUpButton.addEventListener('click', () => {
            container.classList.add("right-panel-active");
        });
    }

    if (signInButton && container) {
        signInButton.addEventListener('click', () => {
            container.classList.remove("right-panel-active");
        });
    }

    // Sign In functionality with API call
    if (signInFormBtn) {
        signInFormBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            
            // Get form data
            const signInForm = document.querySelector('.sign-in-container form');
            const email = signInForm.querySelector('input[type="email"]').value.trim().toLowerCase();
            const password = signInForm.querySelector('input[type="password"]').value;

            // Validate input
            if (!email || !password) {
                alert('Please fill in all fields');
                return;
            }

            try {
                const response = await fetch('http://127.0.0.1:8003/api/users/signin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    // Store user data and JWT token in localStorage
                    localStorage.setItem('userId', data.user.user_id);
                    localStorage.setItem('userName', data.user.name);
                    localStorage.setItem('userEmail', data.user.email);
                    localStorage.setItem('authToken', data.token);
                    console.log('Login response:', data); // Debug log
                    alert('Sign In successful! Redirecting to the chat page.');
                    window.location.href = 'chat.html';
                } else {
                    alert(response.status === 401 ? 'Invalid username or password' : (data.detail || 'Sign in failed'));
                }
            } catch (error) {
                console.error('Error during sign in:', error);
                alert('Network error. Please check if the server is running.');
            }
        });
    }

    // Sign Up functionality with API call
    if (signUpFormBtn) {
        signUpFormBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            
            // Get form data
            const signUpForm = document.querySelector('.sign-up-container form');
            const name = signUpForm.querySelector('input[type="text"]').value;
            const email = signUpForm.querySelector('input[type="email"]').value.trim().toLowerCase();
            const password = signUpForm.querySelector('input[type="password"]').value;

            // Validate input
            if (!name || !email || !password) {
                alert('Please fill in all fields');
                return;
            }

            try {
                const response = await fetch('http://127.0.0.1:8003/api/users/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Sign Up successful! Please sign in with your new account.');
                    // Clear the form
                    signUpForm.reset();
                    // Switch back to the sign-in form
                    container.classList.remove("right-panel-active");
                } else {
                    alert(data.detail || 'Sign up failed');
                }
            } catch (error) {
                console.error('Error during sign up:', error);
                alert('Network error. Please check if the server is running.');
            }
        });
    }

    // ------------------- GOOGLE LOGIN FUNCTIONALITY -------------------
    // Initialize Google Sign-In
    window.onload = function() {
        google.accounts.id.initialize({
            client_id: "910712581034-r1tcrt6k0o4gg3k4quiqie1pgfif5982.apps.googleusercontent.com",
            callback: handleGoogleResponse
        });
    };

    // Handle Google OAuth response
    function handleGoogleResponse(response) {
        // Decode the JWT token to get user info
        const userInfo = parseJwt(response.credential);
        
        // Store user information (Google OAuth doesn't need our JWT token)
        localStorage.setItem('userId', userInfo.sub);
        localStorage.setItem('userName', userInfo.name);
        localStorage.setItem('userEmail', userInfo.email);
        localStorage.setItem('authToken', 'google_oauth'); // Special marker for Google auth
        
        alert(`Welcome ${userInfo.name}! Redirecting to chat page.`);
        window.location.href = 'chat.html';
    }

    // Parse JWT token
    function parseJwt(token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    }

    // Google Sign-In button click handlers
    const googleSignUpBtn = document.querySelector('.google-signup-btn');
    const googleSignInBtn = document.querySelector('.google-signin-btn');

    if (googleSignUpBtn) {
        googleSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            google.accounts.id.prompt();
        });
    }

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            google.accounts.id.prompt();
        });
    }
});