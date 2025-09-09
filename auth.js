class SimpleAuth {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = null;
        this.isLoginMode = true;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingSession();
    }

    loadUsers() {
        const users = localStorage.getItem('auth_users');
        return users ? JSON.parse(users) : [];
    }


    saveUsers() {
        localStorage.setItem('auth_users', JSON.stringify(this.users));
    }


    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const switchLink = document.getElementById('switchLink');
        const switchText = document.getElementById('switchText');


        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });


        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });


        switchLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleForms();
        });


        document.getElementById('phone').addEventListener('input', (e) => {
            e.target.value = this.formatPhone(e.target.value);
        });

        document.getElementById('regPhone').addEventListener('input', (e) => {
            e.target.value = this.formatPhone(e.target.value);
        });
    }


    toggleForms() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const switchText = document.getElementById('switchText');
        const switchLink = document.getElementById('switchLink');

        this.isLoginMode = !this.isLoginMode;

        if (this.isLoginMode) {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            switchText.innerHTML = 'Нет аккаунта? <a href="#" id="switchLink">Зарегистрироваться</a>';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            switchText.innerHTML = 'Уже есть аккаунт? <a href="#" id="switchLink">Войти</a>';
        }


        document.getElementById('switchLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleForms();
        });

        this.clearForms();
        this.hideNotification();
    }


async handleLogin() {
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;

    if (!this.validatePhone(phone)) {
        this.showNotification('Введите корректный номер телефона', 'error');
        return;
    }

    if (!password) {
        this.showNotification('Введите пароль', 'error');
        return;
    }

    this.setLoading(true);

    try {

        const result = await window.SupabaseAuth.loginUser(phone, password);
        
        if (result.success) {

            const sessionResult = await window.SupabaseAuth.createSession(result.user.id);
            
            if (sessionResult.success) {

                localStorage.setItem('auth_session', JSON.stringify({
                    sessionId: sessionResult.session.id,
                    userId: result.user.id,
                    expires: new Date(sessionResult.session.expires_at).getTime()
                }));
                
                this.currentUser = result.user;
                this.showNotification('Успешный вход!', 'success');
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                this.showNotification('Ошибка создания сессии', 'error');
            }
        } else {
            this.showNotification(result.error || 'Неверный номер телефона или пароль', 'error');
        }
    } catch (error) {
        this.showNotification('Ошибка входа. Попробуйте снова.', 'error');
    } finally {
        this.setLoading(false);
    }
}


async handleRegister() {
    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;


    if (!fullName) {
        this.showNotification('Введите ФИО', 'error');
        return;
    }

    if (!this.validatePhone(phone)) {
        this.showNotification('Введите корректный номер телефона', 'error');
        return;
    }

    if (!password) {
        this.showNotification('Введите пароль', 'error');
        return;
    }

    if (password.length < 6) {
        this.showNotification('Пароль должен содержать минимум 6 символов', 'error');
        return;
    }

    if (password !== confirmPassword) {
        this.showNotification('Пароли не совпадают', 'error');
        return;
    }

    this.setLoading(true);

    try {

        const result = await window.SupabaseAuth.registerUser(fullName, phone, password);
        
        if (result.success) {

            const sessionResult = await window.SupabaseAuth.createSession(result.user.id);
            
            if (sessionResult.success) {

                localStorage.setItem('auth_session', JSON.stringify({
                    sessionId: sessionResult.session.id,
                    userId: result.user.id,
                    expires: new Date(sessionResult.session.expires_at).getTime()
                }));
                
                this.currentUser = result.user;
                this.showNotification('Регистрация успешна!', 'success');

                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                this.showNotification('Ошибка создания сессии', 'error');
            }
        } else {
            this.showNotification(result.error || 'Ошибка регистрации', 'error');
        }
    } catch (error) {
        this.showNotification('Ошибка регистрации. Попробуйте снова.', 'error');
    } finally {
        this.setLoading(false);
    }
}


    checkExistingSession() {
        const session = localStorage.getItem('auth_session');
        if (session) {
            try {
                const sessionData = JSON.parse(session);
                const user = this.users.find(u => u.id === sessionData.userId);
                
                if (user && sessionData.expires > Date.now()) {
                    this.currentUser = user;

                    window.location.href = 'index.html';
                } else {

                    localStorage.removeItem('auth_session');
                }
            } catch (error) {
                localStorage.removeItem('auth_session');
            }
        }
    }


    saveSession() {
        if (this.currentUser) {
            const sessionData = {
                userId: this.currentUser.id,
                expires: Date.now() + (24 * 60 * 60 * 1000) // 24 часа
            };
            localStorage.setItem('auth_session', JSON.stringify(sessionData));
        }
    }


    logout() {
        this.currentUser = null;
        localStorage.removeItem('auth_session');
        window.location.href = 'auth.html';
    }


    validatePhone(phone) {
        const phoneRegex = /^\+7\s?\(\d{3}\)\s?\d{3}-\d{2}-\d{2}$/;
        return phoneRegex.test(phone);
    }


    formatPhone(value) {

        const numbers = value.replace(/\D/g, '');
        

        if (numbers.startsWith('8') && numbers.length <= 11) {
            const formatted = '+7 (' + numbers.slice(1, 4) + ') ' + numbers.slice(4, 7) + '-' + numbers.slice(7, 9) + '-' + numbers.slice(9, 11);
            return formatted;
        }
        

        if (numbers.startsWith('7') && numbers.length <= 11) {
            const formatted = '+7 (' + numbers.slice(1, 4) + ') ' + numbers.slice(4, 7) + '-' + numbers.slice(7, 9) + '-' + numbers.slice(9, 11);
            return formatted;
        }
        
        return value;
    }


    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';


        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }


    hideNotification() {
        const notification = document.getElementById('notification');
        notification.style.display = 'none';
    }


    setLoading(loading) {
        const forms = document.querySelectorAll('.auth-form');
        const buttons = document.querySelectorAll('.btn-primary');

        forms.forEach(form => {
            if (loading) {
                form.classList.add('loading');
            } else {
                form.classList.remove('loading');
            }
        });

        buttons.forEach(button => {
            button.disabled = loading;
            if (loading) {
                button.textContent = 'Загрузка...';
            } else {
                button.textContent = this.isLoginMode ? 'Войти' : 'Зарегистрироваться';
            }
        });
    }


    clearForms() {
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
    }
}




document.addEventListener('DOMContentLoaded', () => {
    new SimpleAuth();
});


window.SimpleAuth = SimpleAuth;
