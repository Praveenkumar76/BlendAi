// Profile Page JavaScript
class ProfileManager {
    constructor() {
        this.userId = localStorage.getItem('userId');
        this.authToken = localStorage.getItem('authToken');
        this.userData = null;
        this.activityLog = [];
        this.init();
    }

    async init() {
        if (!this.userId) {
            this.redirectToLogin();
            return;
        }

        this.setupEventListeners();
        this.showLoading();
        await this.loadUserProfile();
        await this.loadChatHistory(); // This will also update stats and activity
        this.hideLoading();
    }

    setupEventListeners() {
        // Avatar upload
        document.getElementById('profile-avatar').addEventListener('click', () => {
            document.getElementById('avatar-upload').click();
        });
        document.getElementById('avatar-upload').addEventListener('change', (e) => {
            this.handleAvatarUpload(e.target.files[0]);
        });

        // Buttons
        document.getElementById('save-profile').addEventListener('click', () => this.saveProfile());
        document.getElementById('change-password').addEventListener('click', () => this.changePassword());
        document.getElementById('export-data').addEventListener('click', () => this.exportUserData());
        document.getElementById('delete-account').addEventListener('click', () => this.deleteAccount());

        // Preferences
        document.querySelectorAll('.toggle-input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.updatePreference(e.target.dataset.preference, e.target.checked);
            });
        });
    }

    async apiRequest(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
        };
        const config = { method, headers };
        if (body) {
            config.body = JSON.stringify(body);
        }
        const response = await fetch(`http://127.0.0.1:8003/api${endpoint}`, config);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'An unknown error occurred' }));
            throw new Error(errorData.detail);
        }
        if (response.status === 204) return null; // Handle No Content response
        return response.json();
    }

    async loadUserProfile() {
        try {
            this.userData = await this.apiRequest(`/users/${this.userId}`);
            this.updateProfileDisplay();
            this.addActivity('Logged In', 'fas fa-sign-in-alt');
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showToast(error.message, 'error');
        }
    }

    updateProfileDisplay() {
        if (!this.userData) return;
        document.getElementById('profile-name').textContent = this.userData.name;
        document.getElementById('profile-email').textContent = this.userData.email;
        document.getElementById('edit-name').value = this.userData.name;
        document.getElementById('edit-email').value = this.userData.email;

        if (this.userData.profile_image) {
            document.getElementById('avatar-img').src = this.userData.profile_image;
        }
        if (this.userData.preferences) {
            for (const key in this.userData.preferences) {
                const toggle = document.querySelector(`[data-preference="${key}"]`);
                if (toggle) toggle.checked = this.userData.preferences[key];
            }
        }
    }

    async loadChatHistory() {
        try {
            const chatHistory = await this.apiRequest(`/chat/history/${this.userId}`);
            this.updateStats(chatHistory);
            this.displayChatHistory(chatHistory);
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.showToast('Could not load chat history.', 'error');
        }
    }
    
    updateStats(chatHistory) {
        const totalChats = chatHistory.length;
        const totalMessages = chatHistory.reduce((sum, chat) => sum + chat.message_count, 0);
        const memberSince = this.userData ? Math.max(0, Math.floor((new Date() - new Date(this.userData.created_at)) / (1000 * 60 * 60 * 24))) : 0;

        document.getElementById('total-chats').textContent = totalChats;
        document.getElementById('total-messages').textContent = totalMessages;
        document.getElementById('member-since').textContent = memberSince;
    }

    displayChatHistory(chatHistory) {
        const list = document.getElementById('chat-history-list');
        list.innerHTML = '';
        if (chatHistory.length === 0) {
            list.innerHTML = '<p class="empty-list-text">No recent chats to display.</p>';
            return;
        }

        chatHistory.slice(0, 5).forEach(chat => {
            const item = document.createElement('div');
            item.className = 'chat-history-item';
            item.innerHTML = `
                <div class="chat-history-icon"><i class="fas fa-comments"></i></div>
                <div class="chat-history-content">
                    <div class="chat-history-title">${this.truncateText(chat.title, 30)}</div>
                    <div class="chat-history-time">${this.formatDate(chat.last_message_at)}</div>
                </div>`;
            
            // **FIX: Make chat history items clickable**
            item.addEventListener('click', () => {
                localStorage.setItem('loadChatId', chat.chat_id);
                window.location.href = 'chat.html';
            });
            list.appendChild(item);
        });
    }
    
    addActivity(title, iconClass) {
        this.activityLog.unshift({ title, iconClass, time: new Date() });
        this.displayActivity();
    }

    displayActivity() {
        const list = document.getElementById('activity-list');
        list.innerHTML = '';
        if (this.activityLog.length === 0) {
            list.innerHTML = '<p class="empty-list-text">No recent activity.</p>';
            return;
        }

        this.activityLog.slice(0, 5).forEach(item => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <div class="activity-icon"><i class="${item.iconClass}"></i></div>
                <div class="activity-content">
                    <div class="activity-title">${item.title}</div>
                    <div class="activity-time">${this.formatDate(item.time)}</div>
                </div>`;
            list.appendChild(activityItem);
        });
    }

    async saveProfile() {
        const name = document.getElementById('edit-name').value.trim();
        if (!name) {
            this.showToast('Name cannot be empty.', 'error');
            return;
        }

        this.showLoading();
        try {
            const updatedUser = await this.apiRequest(`/users/update/${this.userId}`, 'PATCH', { name });
            this.userData = updatedUser;
            this.updateProfileDisplay();
            this.addActivity('Updated Profile Info', 'fas fa-user-edit');
            this.showToast('Profile updated successfully!', 'success');
        } catch (error) {
            this.showToast(`Error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showToast('Please fill all password fields.', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            this.showToast('New passwords do not match.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            this.showToast('Password must be at least 6 characters.', 'error');
            return;
        }

        this.showLoading();
        try {
            await this.apiRequest(`/users/change-password/${this.userId}`, 'POST', { currentPassword, newPassword });
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            this.addActivity('Changed Password', 'fas fa-key');
            this.showToast('Password changed successfully!', 'success');
        } catch (error) {
            this.showToast(`Error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleAvatarUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showToast('Please select a valid image file.', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.showToast('Image file must be less than 5MB.', 'error');
            return;
        }

        this.showLoading();
        const formData = new FormData();
        formData.append('profile_image', file);

        try {
            const updatedUser = await this.apiRequest(`/users/upload-avatar/${this.userId}`, 'POST', formData); // Note: body handled differently for FormData
            this.userData = updatedUser;
            this.updateProfileDisplay();
            this.addActivity('Updated Profile Picture', 'fas fa-camera');
            this.showToast('Avatar updated successfully!', 'success');
        } catch (error) {
            this.showToast(`Upload failed: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async updatePreference(key, value) {
        try {
            const updatedUser = await this.apiRequest(`/users/preferences/${this.userId}`, 'PATCH', { [key]: value });
            this.userData = updatedUser;
            this.addActivity(`Updated preference: ${key}`, 'fas fa-toggle-on');
            this.showToast('Preference updated!', 'success');
        } catch (error) {
            this.showToast(`Error: ${error.message}`, 'error');
        }
    }

    async exportUserData() {
        // This remains a client-side simulation as it doesn't require a complex backend endpoint
        const userDataExport = { user: this.userData, exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(userDataExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `blendai-user-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.addActivity('Exported User Data', 'fas fa-file-download');
        this.showToast('User data exported successfully!', 'success');
    }

    async deleteAccount() {
        if (!confirm('Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone.')) return;

        this.showLoading();
        try {
            await this.apiRequest(`/users/delete/${this.userId}`, 'DELETE');
            this.addActivity('Deleted Account', 'fas fa-user-slash');
            this.showToast('Account deleted successfully.', 'success');
            localStorage.clear();
            setTimeout(() => window.location.href = 'index.html', 2000);
        } catch (error) {
            this.showToast(`Error: ${error.message}`, 'error');
            this.hideLoading();
        }
    }

    redirectToLogin() {
        this.showToast('Please log in to continue.', 'info');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    }

    showLoading() { document.getElementById('loading-overlay').classList.add('show'); }
    hideLoading() { document.getElementById('loading-overlay').classList.remove('show'); }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    }

    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffSeconds = Math.round(Math.abs(now - date) / 1000);
        
        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        const diffMinutes = Math.round(diffSeconds / 60);
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.round(diffHours / 24);
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});