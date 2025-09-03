// Profile Page JavaScript
class ProfileManager {
    constructor() {
        this.userId = localStorage.getItem('userId');
        this.userData = null;
        this.init();
    }

    async init() {
        if (!this.userId) {
            this.redirectToLogin();
            return;
        }

        this.setupEventListeners();
        await this.loadUserProfile();
        await this.loadUserStats();
        await this.loadChatHistory();
        this.hideLoading();
    }

    setupEventListeners() {
        // Avatar upload
        const avatarUpload = document.getElementById('avatar-upload');
        const profileAvatar = document.getElementById('profile-avatar');
        
        profileAvatar.addEventListener('click', () => {
            avatarUpload.click();
        });

        avatarUpload.addEventListener('change', (e) => {
            this.handleAvatarUpload(e.target.files[0]);
        });

        // Save profile button
        document.getElementById('save-profile').addEventListener('click', () => {
            this.saveProfile();
        });

        // Change password button
        document.getElementById('change-password').addEventListener('click', () => {
            this.changePassword();
        });

        // Export data button
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportUserData();
        });

        // Delete account button
        document.getElementById('delete-account').addEventListener('click', () => {
            this.deleteAccount();
        });

        // Toggle switches
        document.getElementById('dark-mode').addEventListener('change', (e) => {
            this.updatePreference('darkMode', e.target.checked);
        });

        document.getElementById('notifications').addEventListener('change', (e) => {
            this.updatePreference('notifications', e.target.checked);
        });

        document.getElementById('auto-save').addEventListener('change', (e) => {
            this.updatePreference('autoSave', e.target.checked);
        });
    }

    async loadUserProfile() {
        try {
            const response = await fetch(`http://127.0.0.1:8003/api/users/${this.userId}`);
            if (response.ok) {
                this.userData = await response.json();
                this.updateProfileDisplay();
            } else {
                throw new Error('Failed to load user profile');
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showToast('Failed to load profile data', 'error');
        }
    }

    updateProfileDisplay() {
        if (!this.userData) return;

        // Update profile info
        document.getElementById('profile-name').textContent = this.userData.name;
        document.getElementById('profile-email').textContent = this.userData.email;

        // Update form fields
        document.getElementById('edit-name').value = this.userData.name;
        document.getElementById('edit-email').value = this.userData.email;

        // Update avatar if available
        if (this.userData.profile_image) {
            document.getElementById('avatar-img').src = this.userData.profile_image;
        }

        // Update preferences
        if (this.userData.preferences) {
            document.getElementById('dark-mode').checked = this.userData.preferences.darkMode || false;
            document.getElementById('notifications').checked = this.userData.preferences.notifications !== false;
            document.getElementById('auto-save').checked = this.userData.preferences.autoSave !== false;
        }
    }

    async loadUserStats() {
        try {
            const response = await fetch(`http://127.0.0.1:8003/api/chat/history/${this.userId}`);
            if (response.ok) {
                const chatHistory = await response.json();
                this.updateStats(chatHistory);
            }
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    updateStats(chatHistory) {
        const totalChats = chatHistory.length;
        const totalMessages = chatHistory.reduce((sum, chat) => sum + chat.message_count, 0);
        
        // Calculate days since registration
        const memberSince = this.userData ? 
            Math.floor((new Date() - new Date(this.userData.created_at)) / (1000 * 60 * 60 * 24)) : 0;

        document.getElementById('total-chats').textContent = totalChats;
        document.getElementById('total-messages').textContent = totalMessages;
        document.getElementById('member-since').textContent = memberSince;
    }

    async loadChatHistory() {
        try {
            const response = await fetch(`http://127.0.0.1:8003/api/chat/history/${this.userId}`);
            if (response.ok) {
                const chatHistory = await response.json();
                this.displayChatHistory(chatHistory);
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    displayChatHistory(chatHistory) {
        const chatHistoryList = document.getElementById('chat-history-list');
        chatHistoryList.innerHTML = '';

        if (chatHistory.length === 0) {
            chatHistoryList.innerHTML = '<p style="color: #cccccc; text-align: center; padding: 2rem;">No chat history available</p>';
            return;
        }

        chatHistory.slice(0, 5).forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-history-item';
            chatItem.innerHTML = `
                <div class="chat-history-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <div class="chat-history-content">
                    <div class="chat-history-title">${this.truncateText(chat.title, 40)}</div>
                    <div class="chat-history-time">${this.formatDate(chat.last_message_at)}</div>
                </div>
            `;
            
            chatItem.addEventListener('click', () => {
                // Navigate to chat or show chat details
                this.showToast('Chat functionality coming soon!', 'info');
            });
            
            chatHistoryList.appendChild(chatItem);
        });
    }

    async saveProfile() {
        const name = document.getElementById('edit-name').value.trim();
        const email = document.getElementById('edit-email').value.trim();

        if (!name || !email) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        this.showLoading();

        try {
            // In a real application, you would send a PUT/PATCH request to update the user
            // For now, we'll simulate the update
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.userData.name = name;
            this.userData.email = email;
            
            this.updateProfileDisplay();
            this.showToast('Profile updated successfully!', 'success');
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showToast('Failed to update profile', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showToast('Please fill in all password fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showToast('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showToast('Password must be at least 6 characters long', 'error');
            return;
        }

        this.showLoading();

        try {
            // In a real application, you would send a request to change the password
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Clear password fields
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            
            this.showToast('Password changed successfully!', 'success');
        } catch (error) {
            console.error('Error changing password:', error);
            this.showToast('Failed to change password', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleAvatarUpload(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.showToast('Image size must be less than 5MB', 'error');
            return;
        }

        this.showLoading();

        try {
            // In a real application, you would upload the file to a server
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('avatar-img').src = e.target.result;
                this.userData.profile_image = e.target.result;
                this.showToast('Avatar updated successfully!', 'success');
                this.hideLoading();
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error uploading avatar:', error);
            this.showToast('Failed to upload avatar', 'error');
            this.hideLoading();
        }
    }

    async updatePreference(key, value) {
        if (!this.userData.preferences) {
            this.userData.preferences = {};
        }
        
        this.userData.preferences[key] = value;
        
        try {
            // In a real application, you would send a request to update preferences
            await new Promise(resolve => setTimeout(resolve, 500));
            this.showToast('Preference updated!', 'success');
        } catch (error) {
            console.error('Error updating preference:', error);
            this.showToast('Failed to update preference', 'error');
        }
    }

    async exportUserData() {
        this.showLoading();

        try {
            // In a real application, you would generate and download user data
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const userDataExport = {
                user: this.userData,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            const blob = new Blob([JSON.stringify(userDataExport, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `blendai-user-data-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showToast('User data exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showToast('Failed to export data', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async deleteAccount() {
        const confirmed = confirm(
            'Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data.'
        );

        if (!confirmed) return;

        const doubleConfirmed = confirm(
            'This is your final warning. All your chats, messages, and account data will be permanently deleted. Type "DELETE" to confirm.'
        );

        if (!doubleConfirmed) return;

        this.showLoading();

        try {
            // In a real application, you would send a DELETE request
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Clear local storage
            localStorage.clear();
            
            this.showToast('Account deleted successfully', 'success');
            
            // Redirect to home page after a delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showToast('Failed to delete account', 'error');
            this.hideLoading();
        }
    }

    redirectToLogin() {
        this.showToast('Please log in to access your profile', 'warning');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('show');
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
}

// Initialize the profile manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});
