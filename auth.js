// Простая система авторизации и регистрации
class SimpleAuth {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = null;
        this.isLoginMode = true;
        
        this.init();
    }

    // Инициализация
    init() {
        this.setupEventListeners();
        this.checkExistingSession();
    }

    // Загрузка пользователей из localStorage
    loadUsers() {
        const users = localStorage.getItem('auth_users');
        return users ? JSON.parse(users) : [];
    }

    // Сохранение пользователей в localStorage
    saveUsers() {
        localStorage.setItem('auth_users', JSON.stringify(this.users));
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const switchLink = document.getElementById('switchLink');
        const switchText = document.getElementById('switchText');

        // Обработчик формы входа
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Обработчик формы регистрации
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Переключение между формами
        switchLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleForms();
        });

        // Форматирование номера телефона
        document.getElementById('phone').addEventListener('input', (e) => {
            e.target.value = this.formatPhone(e.target.value);
        });

        document.getElementById('regPhone').addEventListener('input', (e) => {
            e.target.value = this.formatPhone(e.target.value);
        });
    }

    // Переключение между формами входа и регистрации
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

        // Обновляем обработчик для новой ссылки
        document.getElementById('switchLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleForms();
        });

        this.clearForms();
        this.hideNotification();
    }

    // Обработка входа
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
            // Имитация задержки сети
            await new Promise(resolve => setTimeout(resolve, 1000));

            const user = this.users.find(u => u.phone === phone && u.password === password);

            if (user) {
                this.currentUser = user;
                this.saveSession();
                this.showNotification('Успешный вход!', 'success');
                
                // Перенаправляем на главную страницу через 1.5 секунды
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                this.showNotification('Неверный номер телефона или пароль', 'error');
            }
        } catch (error) {
            this.showNotification('Ошибка входа. Попробуйте снова.', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // Обработка регистрации
    async handleRegister() {
        const fullName = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Валидация
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

        // Проверяем, не зарегистрирован ли уже такой номер
        if (this.users.find(u => u.phone === phone)) {
            this.showNotification('Пользователь с таким номером уже зарегистрирован', 'error');
            return;
        }

        this.setLoading(true);

        try {
            // Имитация задержки сети
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Создаем нового пользователя
            const newUser = {
                id: Date.now().toString(),
                fullName: fullName,
                phone: phone,
                password: password,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                isActive: true
            };

            this.users.push(newUser);
            this.saveUsers();

            this.currentUser = newUser;
            this.saveSession();
            this.showNotification('Регистрация успешна!', 'success');

            // Перенаправляем на главную страницу через 2 секунды
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } catch (error) {
            this.showNotification('Ошибка регистрации. Попробуйте снова.', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    // Проверка существующей сессии
    checkExistingSession() {
        const session = localStorage.getItem('auth_session');
        if (session) {
            try {
                const sessionData = JSON.parse(session);
                const user = this.users.find(u => u.id === sessionData.userId);
                
                if (user && sessionData.expires > Date.now()) {
                    this.currentUser = user;
                    // Перенаправляем на главную страницу
                    window.location.href = 'index.html';
                } else {
                    // Сессия истекла, удаляем её
                    localStorage.removeItem('auth_session');
                }
            } catch (error) {
                localStorage.removeItem('auth_session');
            }
        }
    }

    // Сохранение сессии
    saveSession() {
        if (this.currentUser) {
            const sessionData = {
                userId: this.currentUser.id,
                expires: Date.now() + (24 * 60 * 60 * 1000) // 24 часа
            };
            localStorage.setItem('auth_session', JSON.stringify(sessionData));
        }
    }

    // Выход из системы
    logout() {
        this.currentUser = null;
        localStorage.removeItem('auth_session');
        window.location.href = 'auth.html';
    }

    // Валидация номера телефона
    validatePhone(phone) {
        const phoneRegex = /^\+7\s?\(\d{3}\)\s?\d{3}-\d{2}-\d{2}$/;
        return phoneRegex.test(phone);
    }

    // Форматирование номера телефона
    formatPhone(value) {
        // Удаляем все нецифровые символы
        const numbers = value.replace(/\D/g, '');
        
        // Если начинается с 8, заменяем на +7
        if (numbers.startsWith('8') && numbers.length <= 11) {
            const formatted = '+7 (' + numbers.slice(1, 4) + ') ' + numbers.slice(4, 7) + '-' + numbers.slice(7, 9) + '-' + numbers.slice(9, 11);
            return formatted;
        }
        
        // Если начинается с 7, добавляем +
        if (numbers.startsWith('7') && numbers.length <= 11) {
            const formatted = '+7 (' + numbers.slice(1, 4) + ') ' + numbers.slice(4, 7) + '-' + numbers.slice(7, 9) + '-' + numbers.slice(9, 11);
            return formatted;
        }
        
        return value;
    }

    // Показать уведомление
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';

        // Автоматически скрываем через 5 секунд
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    // Скрыть уведомление
    hideNotification() {
        const notification = document.getElementById('notification');
        notification.style.display = 'none';
    }

    // Установить состояние загрузки
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

    // Очистить формы
    clearForms() {
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new SimpleAuth();
});

// Экспорт для использования в других файлах
window.SimpleAuth = SimpleAuth;
