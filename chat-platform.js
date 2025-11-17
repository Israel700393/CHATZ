// Sistema de Chat Completo com Perfil e Notificações
const ADMIN_PASSWORD = 'Range@2126';

class ChatPlatform {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.accessCodes = new Map();
        this.allUsers = new Map();
        this.userProfiles = new Map();
        this.allMessages = [];
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.lastMessageCount = 0;
        
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.requestNotificationPermission();
        this.startRealtimeSync();
    }

    loadFromStorage() {
        const savedCodes = localStorage.getItem('accessCodes');
        if (savedCodes) {
            this.accessCodes = new Map(JSON.parse(savedCodes));
            this.buildUsersFromCodes();
        }

        const savedProfiles = localStorage.getItem('userProfiles');
        if (savedProfiles) {
            this.userProfiles = new Map(JSON.parse(savedProfiles));
        }

        const savedMessages = localStorage.getItem('globalMessages');
        if (savedMessages) {
            this.allMessages = JSON.parse(savedMessages);
            this.lastMessageCount = this.allMessages.length;
        }

        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.markUserOnline();
            this.showChatScreen();
        }
    }

    buildUsersFromCodes() {
        this.allUsers.clear();
        this.accessCodes.forEach((data, code) => {
            const profile = this.userProfiles.get(code) || {};
            this.allUsers.set(code, {
                id: code,
                name: profile.name || data.assignedName,
                avatar: profile.photo || (profile.name || data.assignedName).charAt(0).toUpperCase(),
                accessCode: code,
                status: profile.status || '',
                photo: profile.photo || null,
                online: false
            });
        });
    }

    saveToStorage() {
        localStorage.setItem('accessCodes', JSON.stringify([...this.accessCodes]));
        localStorage.setItem('userProfiles', JSON.stringify([...this.userProfiles]));
        localStorage.setItem('globalMessages', JSON.stringify(this.allMessages));
        if (this.currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
    }

    setupEventListeners() {
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('accessCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('usernameInput').focus();
        });
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Admin Password
        document.getElementById('adminBtn').addEventListener('click', () => this.showAdminPasswordScreen());
        document.getElementById('adminPasswordBtn').addEventListener('click', () => this.checkAdminPassword());
        document.getElementById('adminPasswordInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkAdminPassword();
        });
        document.getElementById('cancelAdminBtn').addEventListener('click', () => this.showLoginScreen());
        document.getElementById('backToLoginBtn').addEventListener('click', () => this.showLoginScreen());
        document.getElementById('createAccessBtn').addEventListener('click', () => this.createAccessCode());

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // Profile
        document.getElementById('userInfoClick').addEventListener('click', () => this.showProfileModal());
        document.getElementById('closeProfileModal').addEventListener('click', () => this.closeProfileModal());
        document.getElementById('changePhotoBtn').addEventListener('click', () => {
            document.getElementById('profilePhotoInput').click();
        });
        document.getElementById('profilePhotoInput').addEventListener('change', (e) => this.updateProfilePhoto(e));
        document.getElementById('saveNameBtn').addEventListener('click', () => this.updateProfileName());
        document.getElementById('saveStatusBtn').addEventListener('click', () => this.updateProfileStatus());

        // Mensagem
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Mídia
        document.getElementById('photoBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('cameraBtn').addEventListener('click', () => {
            document.getElementById('photoInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => this.handlePhotoUpload(e));
        document.getElementById('photoInput').addEventListener('change', (e) => this.handlePhotoUpload(e));
        
        // Áudio
        const audioBtn = document.getElementById('audioBtn');
        audioBtn.addEventListener('mousedown', () => this.startRecording());
        audioBtn.addEventListener('mouseup', () => this.stopRecording());
        audioBtn.addEventListener('mouseleave', () => {
            if (this.isRecording) this.stopRecording();
        });
        audioBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        audioBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });

        // Buscar
        document.getElementById('searchUsers').addEventListener('input', (e) => {
            this.filterConversations(e.target.value);
        });
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('adminPasswordScreen').classList.remove('active');
        document.getElementById('adminScreen').classList.remove('active');
        document.getElementById('chatScreen').classList.remove('active');
        document.getElementById('adminPasswordInput').value = '';
    }

    showAdminPasswordScreen() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('adminPasswordScreen').classList.add('active');
        document.getElementById('adminScreen').classList.remove('active');
        document.getElementById('chatScreen').classList.remove('active');
        document.getElementById('adminPasswordInput').focus();
    }

    checkAdminPassword() {
        const password = document.getElementById('adminPasswordInput').value;
        if (password === ADMIN_PASSWORD) {
            this.showAdminScreen();
        } else {
            alert('Senha incorreta!');
            document.getElementById('adminPasswordInput').value = '';
        }
    }

    showAdminScreen() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('adminPasswordScreen').classList.remove('active');
        document.getElementById('adminScreen').classList.add('active');
        document.getElementById('chatScreen').classList.remove('active');
        this.renderAccessCodes();
    }

    showChatScreen() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('adminPasswordScreen').classList.remove('active');
        document.getElementById('adminScreen').classList.remove('active');
        document.getElementById('chatScreen').classList.add('active');
        
        this.updateCurrentUserDisplay();
        this.updateOnlineStatus();
        this.renderConversations();
    }

    updateCurrentUserDisplay() {
        const profile = this.userProfiles.get(this.currentUser.accessCode) || {};
        const displayName = profile.name || this.currentUser.name;
        const displayStatus = profile.status || '';
        const displayPhoto = profile.photo;

        document.getElementById('currentUsername').textContent = displayName;
        document.getElementById('currentUserStatus').textContent = displayStatus;
        
        const avatarEl = document.getElementById('currentUserAvatar');
        if (displayPhoto) {
            avatarEl.style.backgroundImage = `url(${displayPhoto})`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.textContent = '';
        } else {
            avatarEl.style.backgroundImage = '';
            avatarEl.textContent = displayName.charAt(0).toUpperCase();
        }
    }

    showProfileModal() {
        const profile = this.userProfiles.get(this.currentUser.accessCode) || {};
        
        document.getElementById('profileNameInput').value = profile.name || this.currentUser.name;
        document.getElementById('profileStatusInput').value = profile.status || '';
        document.getElementById('profileAccessCode').textContent = this.currentUser.accessCode;
        
        const avatarEl = document.getElementById('profileAvatar');
        if (profile.photo) {
            avatarEl.style.backgroundImage = `url(${profile.photo})`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.textContent = '';
        } else {
            avatarEl.style.backgroundImage = '';
            avatarEl.textContent = (profile.name || this.currentUser.name).charAt(0).toUpperCase();
        }
        
        document.getElementById('profileModal').classList.add('show');
    }

    closeProfileModal() {
        document.getElementById('profileModal').classList.remove('show');
    }

    updateProfilePhoto(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const profile = this.userProfiles.get(this.currentUser.accessCode) || {};
            profile.photo = e.target.result;
            this.userProfiles.set(this.currentUser.accessCode, profile);
            this.saveToStorage();
            this.buildUsersFromCodes();
            
            const avatarEl = document.getElementById('profileAvatar');
            avatarEl.style.backgroundImage = `url(${e.target.result})`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.textContent = '';
            
            this.updateCurrentUserDisplay();
            this.renderConversations();
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    }

    updateProfileName() {
        const newName = document.getElementById('profileNameInput').value.trim();
        if (!newName) {
            alert('Digite um nome válido');
            return;
        }

        const profile = this.userProfiles.get(this.currentUser.accessCode) || {};
        profile.name = newName;
        this.userProfiles.set(this.currentUser.accessCode, profile);
        this.saveToStorage();
        this.buildUsersFromCodes();
        
        this.currentUser.name = newName;
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        
        this.updateCurrentUserDisplay();
        this.renderConversations();
        alert('Nome atualizado!');
    }

    updateProfileStatus() {
        const newStatus = document.getElementById('profileStatusInput').value.trim();
        
        const profile = this.userProfiles.get(this.currentUser.accessCode) || {};
        profile.status = newStatus;
        this.userProfiles.set(this.currentUser.accessCode, profile);
        this.saveToStorage();
        this.buildUsersFromCodes();
        
        this.updateCurrentUserDisplay();
        alert('Recado atualizado!');
    }

    createAccessCode() {
        const code = document.getElementById('newAccessCode').value.trim();
        const name = document.getElementById('newUserName').value.trim();

        if (!code || !name) {
            alert('Por favor, preencha o código e o nome');
            return;
        }

        if (this.accessCodes.has(code)) {
            alert('Este código já existe!');
            return;
        }

        this.accessCodes.set(code, {
            code: code,
            assignedName: name,
            createdAt: Date.now()
        });

        this.buildUsersFromCodes();
        this.saveToStorage();
        this.renderAccessCodes();

        document.getElementById('newAccessCode').value = '';
        document.getElementById('newUserName').value = '';

        alert(`Código ${code} criado! O usuário verá todos os contatos ao fazer login.`);
    }

    renderAccessCodes() {
        const container = document.getElementById('accessCodesList');
        
        if (this.accessCodes.size === 0) {
            container.innerHTML = '<p style="color: #8696a0; text-align: center; padding: 20px;">Nenhum código criado ainda</p>';
            return;
        }

        container.innerHTML = '';
        const onlineUsers = this.getOnlineUsers();
        
        this.accessCodes.forEach((data, code) => {
            const item = document.createElement('div');
            item.className = 'access-code-item';
            const isOnline = onlineUsers.some(u => u.accessCode === code);
            
            item.innerHTML = `
                <div class="access-code-info">
                    <div class="access-code-number">${code}</div>
                    <div class="access-code-name">${data.assignedName}</div>
                </div>
                <span class="access-code-status ${isOnline ? 'active' : 'inactive'}">
                    ${isOnline ? '● Online' : '○ Offline'}
                </span>
                <button class="delete-btn" onclick="chatApp.deleteAccessCode('${code}')">Excluir</button>
            `;
            
            container.appendChild(item);
        });
    }

    deleteAccessCode(code) {
        if (confirm(`Deseja realmente excluir o código ${code}?`)) {
            this.accessCodes.delete(code);
            this.userProfiles.delete(code);
            this.buildUsersFromCodes();
            this.saveToStorage();
            this.renderAccessCodes();
        }
    }

    handleLogin() {
        const code = document.getElementById('accessCodeInput').value.trim();
        const username = document.getElementById('usernameInput').value.trim();

        if (!code || !username) {
            alert('Por favor, preencha o código de acesso e seu nome');
            return;
        }

        const accessData = this.accessCodes.get(code);
        if (!accessData) {
            alert('Código de acesso inválido!');
            return;
        }

        this.currentUser = {
            id: code + '_' + Date.now(),
            name: username,
            avatar: username.charAt(0).toUpperCase(),
            accessCode: code,
            assignedName: accessData.assignedName,
            loginTime: Date.now()
        };

        this.markUserOnline();
        this.saveToStorage();
        this.showChatScreen();
    }

    handleLogout() {
        if (confirm('Deseja realmente sair?')) {
            this.markUserOffline();
            localStorage.removeItem('currentUser');
            this.currentUser = null;
            this.currentChat = null;
            
            document.getElementById('accessCodeInput').value = '';
            document.getElementById('usernameInput').value = '';
            this.showLoginScreen();
        }
    }

    markUserOnline() {
        const onlineData = JSON.parse(localStorage.getItem('onlineUsers') || '[]');
        const filtered = onlineData.filter(u => u.accessCode !== this.currentUser.accessCode);
        
        filtered.push({
            id: this.currentUser.id,
            name: this.currentUser.name,
            avatar: this.currentUser.avatar,
            accessCode: this.currentUser.accessCode,
            lastSeen: Date.now()
        });
        
        localStorage.setItem('onlineUsers', JSON.stringify(filtered));
    }

    markUserOffline() {
        if (!this.currentUser) return;
        
        const onlineData = JSON.parse(localStorage.getItem('onlineUsers') || '[]');
        const filtered = onlineData.filter(u => u.id !== this.currentUser.id);
        localStorage.setItem('onlineUsers', JSON.stringify(filtered));
    }

    getOnlineUsers() {
        const onlineData = JSON.parse(localStorage.getItem('onlineUsers') || '[]');
        const now = Date.now();
        return onlineData.filter(u => (now - u.lastSeen) < 30000);
    }

    updateOnlineStatus() {
        const onlineUsers = this.getOnlineUsers();
        this.allUsers.forEach((user, userId) => {
            user.online = onlineUsers.some(u => u.accessCode === userId);
        });
    }

    renderConversations() {
        const container = document.getElementById('conversationsList');
        container.innerHTML = '';

        if (this.allUsers.size === 0) {
            container.innerHTML = '<p style="color: #8696a0; text-align: center; padding: 20px;">Nenhum usuário cadastrado</p>';
            return;
        }

        const sortedUsers = Array.from(this.allUsers.entries())
            .filter(([userId]) => userId !== this.currentUser.accessCode)
            .sort((a, b) => {
                if (a[1].online !== b[1].online) return b[1].online ? 1 : -1;
                return a[1].name.localeCompare(b[1].name);
            });

        sortedUsers.forEach(([userId, user]) => {
            const userMessages = this.allMessages.filter(m => 
                (m.senderId === this.currentUser.id && m.receiverCode === userId) ||
                (m.senderCode === userId && m.receiverId === this.currentUser.id)
            );
            
            const lastMessage = userMessages[userMessages.length - 1];
            const unreadCount = userMessages.filter(m => 
                m.receiverId === this.currentUser.id && !m.read
            ).length;

            const item = document.createElement('div');
            item.className = 'conversation-item';
            if (this.currentChat === userId) {
                item.classList.add('active');
            }

            let preview = 'Nenhuma mensagem ainda';
            if (lastMessage) {
                if (lastMessage.type === 'image') preview = '📷 Foto';
                else if (lastMessage.type === 'audio') preview = '🎤 Áudio';
                else preview = lastMessage.text;
                
                if (lastMessage.senderId === this.currentUser.id) {
                    preview = 'Você: ' + preview;
                }
            }

            const avatarContent = user.photo 
                ? `<div class="avatar" style="background-image: url(${user.photo}); background-size: cover;"></div>`
                : `<div class="avatar">${user.avatar}</div>`;

            item.innerHTML = `
                <div class="avatar-wrapper">
                    ${avatarContent}
                    <div class="${user.online ? 'online-indicator' : 'offline-indicator'}"></div>
                </div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <span class="conversation-name">${user.name}</span>
                        <span class="conversation-time">${lastMessage ? this.formatTime(lastMessage.timestamp) : ''}</span>
                    </div>
                    <div class="conversation-preview">${preview}</div>
                </div>
                ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
            `;

            item.addEventListener('click', () => this.openChat(userId));
            container.appendChild(item);
        });
    }

    openChat(userId) {
        this.currentChat = userId;
        const user = this.allUsers.get(userId);
        
        this.allMessages.forEach(msg => {
            if (msg.senderCode === userId && msg.receiverId === this.currentUser.id) {
                msg.read = true;
            }
        });
        this.saveToStorage();
        
        document.getElementById('emptyChat').style.display = 'none';
        document.getElementById('chatContent').style.display = 'flex';
        
        document.getElementById('chatUsername').textContent = user.name;
        
        const chatAvatarEl = document.getElementById('chatAvatar');
        if (user.photo) {
            chatAvatarEl.style.backgroundImage = `url(${user.photo})`;
            chatAvatarEl.style.backgroundSize = 'cover';
            chatAvatarEl.textContent = '';
        } else {
            chatAvatarEl.style.backgroundImage = '';
            chatAvatarEl.textContent = user.avatar;
        }
        
        document.getElementById('chatStatus').textContent = user.online ? 'online' : 'offline';
        document.getElementById('chatStatus').className = user.online ? 'status online' : 'status';
        
        this.renderMessages();
        this.renderConversations();
        
        document.getElementById('messageInput').focus();
    }

    renderMessages() {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';

        const chatMessages = this.allMessages.filter(m => 
            (m.senderId === this.currentUser.id && m.receiverCode === this.currentChat) ||
            (m.senderCode === this.currentChat && m.receiverId === this.currentUser.id)
        );
        
        chatMessages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.senderId === this.currentUser.id ? 'sent' : 'received'}`;
            
            let content = '';
            if (msg.type === 'image') {
                content = `<img src="${msg.data}" class="message-image" onclick="window.open('${msg.data}')" alt="Imagem">`;
            } else if (msg.type === 'audio') {
                content = `
                    <div class="message-audio">
                        <button class="audio-play-btn" onclick="chatApp.playAudio('${msg.data}')">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                        <div class="audio-waveform"></div>
                        <span class="audio-duration">0:${msg.duration || '05'}</span>
                    </div>
                `;
            } else {
                content = `<div class="message-text">${this.escapeHtml(msg.text)}</div>`;
            }
            
            messageDiv.innerHTML = `
                <div class="message-bubble">
                    ${msg.senderId !== this.currentUser.id ? `<div class="message-sender">${msg.senderName}</div>` : ''}
                    ${content}
                    <div class="message-time">${this.formatTime(msg.timestamp)}</div>
                </div>
            `;
            
            container.appendChild(messageDiv);
        });

        container.scrollTop = container.scrollHeight;
    }

    sendMessage(type = 'text', data = null) {
        const input = document.getElementById('messageInput');
        let text = input.value.trim();

        if (type === 'text' && !text) return;
        if (!this.currentChat) return;

        const message = {
            id: Date.now().toString() + Math.random(),
            senderId: this.currentUser.id,
            senderName: this.currentUser.name,
            senderCode: this.currentUser.accessCode,
            receiverId: null,
            receiverCode: this.currentChat,
            type: type,
            text: type === 'text' ? text : '',
            data: data,
            timestamp: Date.now(),
            read: false,
            duration: type === 'audio' ? Math.floor(Math.random() * 30 + 5) : null
        };

        this.allMessages.push(message);
        this.saveToStorage();

        input.value = '';
        this.renderMessages();
        this.renderConversations();
    }

    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.sendMessage('image', e.target.result);
        };
        reader.readAsDataURL(file);
        
        event.target.value = '';
    }

    async startRecording() {
        if (this.isRecording) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.sendMessage('audio', e.target.result);
                };
                reader.readAsDataURL(audioBlob);
                
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            
            document.getElementById('audioBtn').style.background = '#dc3545';
            
        } catch (error) {
            alert('Erro ao acessar o microfone. Permita o acesso ao microfone.');
            console.error('Erro:', error);
        }
    }

    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;

        this.mediaRecorder.stop();
        this.isRecording = false;
        
        document.getElementById('audioBtn').style.background = '';
    }

    playAudio(dataUrl) {
        const audio = new Audio(dataUrl);
        audio.play();
    }

    startRealtimeSync() {
        setInterval(() => {
            if (this.currentUser) {
                this.markUserOnline();
            }
        }, 5000);

        setInterval(() => {
            if (this.currentUser) {
                this.checkNewMessages();
                this.updateOnlineStatus();
                this.buildUsersFromCodes();
                this.renderConversations();
                
                if (document.getElementById('adminScreen').classList.contains('active')) {
                    this.renderAccessCodes();
                }
            }
        }, 2000);
    }

    checkNewMessages() {
        const savedMessages = localStorage.getItem('globalMessages');
        if (!savedMessages) return;

        const newMessages = JSON.parse(savedMessages);
        
        if (newMessages.length > this.lastMessageCount) {
            const latest = newMessages.slice(this.lastMessageCount);
            
            latest.forEach(msg => {
                if (msg.receiverCode === this.currentUser.accessCode && !msg.read) {
                    const sender = this.allUsers.get(msg.senderCode);
                    if (sender) {
                        let notifText = msg.text;
                        if (msg.type === 'image') notifText = '📷 Enviou uma foto';
                        if (msg.type === 'audio') notifText = '🎤 Enviou um áudio';
                        
                        this.showNotification(sender.name, notifText);
                    }
                    
                    if (this.currentChat === msg.senderCode) {
                        msg.read = true;
                    }
                }
            });
            
            this.allMessages = newMessages;
            this.lastMessageCount = newMessages.length;
            
            if (this.currentChat) {
                this.renderMessages();
            }
            this.renderConversations();
        }
    }

    showNotification(sender, message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(sender, {
                body: message,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2325D366"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>',
                tag: 'chat-message-' + Date.now(),
                requireInteraction: false
            });

            setTimeout(() => notification.close(), 5000);
        }

        const toast = document.getElementById('notificationToast');
        toast.querySelector('.notification-sender').textContent = sender;
        toast.querySelector('.notification-message').textContent = message;
        toast.classList.add('show');

        this.playNotificationSound();

        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('Audio not supported');
        }
    }

    filterConversations(query) {
        const items = document.querySelectorAll('.conversation-item');
        const searchTerm = query.toLowerCase();

        items.forEach(item => {
            const name = item.querySelector('.conversation-name').textContent.toLowerCase();
            if (name.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 86400000) {
            return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 604800000) {
            const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            return days[date.getDay()];
        } else {
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

let chatApp;
document.addEventListener('DOMContentLoaded', () => {
    chatApp = new ChatPlatform();
});
