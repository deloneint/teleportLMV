class SimpleAuth {
    constructor() {
        this.currentUser = null;
        this.isLoginMode = true;
        this.statusSubscription = null; // Подписка на изменения статуса
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingSession();
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

        const phoneInput = document.getElementById('phone');
        
        phoneInput.addEventListener('focus', (e) => {
            e.target.dataset.userInteracted = 'true';
        });

        phoneInput.addEventListener('input', (e) => {
            const cursorPosition = e.target.selectionStart;
            const oldValue = e.target.value;
            const newValue = this.formatPhone(e.target.value);
            
            e.target.value = newValue;
            
            const newCursorPosition = this.getNewCursorPosition(oldValue, newValue, cursorPosition);
            e.target.setSelectionRange(newCursorPosition, newCursorPosition);
            
            this.updatePhoneValidation(e.target, 'phoneStatus');
        });

        phoneInput.addEventListener('keydown', (e) => {
            this.handlePhoneKeydown(e);
        });
        
        phoneInput.addEventListener('blur', (e) => {
            if (e.target.value.length === 0) {
                const statusElement = document.getElementById('phoneStatus');
                statusElement.style.display = 'none';
                e.target.classList.remove('valid', 'invalid');
            }
        });

        const regPhoneInput = document.getElementById('regPhone');
        
        regPhoneInput.addEventListener('focus', (e) => {
            e.target.dataset.userInteracted = 'true';
        });
        
        regPhoneInput.addEventListener('input', (e) => {
            const cursorPosition = e.target.selectionStart;
            const oldValue = e.target.value;
            const newValue = this.formatPhone(e.target.value);
            
            e.target.value = newValue;
            
            const newCursorPosition = this.getNewCursorPosition(oldValue, newValue, cursorPosition);
            e.target.setSelectionRange(newCursorPosition, newCursorPosition);
            
            this.updatePhoneValidation(e.target, 'regPhoneStatus');
        });

        regPhoneInput.addEventListener('keydown', (e) => {
            this.handlePhoneKeydown(e);
        });
        
        regPhoneInput.addEventListener('blur', (e) => {
            if (e.target.value.length === 0) {
                const statusElement = document.getElementById('regPhoneStatus');
                statusElement.style.display = 'none';
                e.target.classList.remove('valid', 'invalid');
            }
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
                // Сохраняем сессию в localStorage
                const sessionData = {
                    sessionId: sessionResult.session.id,
                    userId: result.user.id,
                    expires: new Date(sessionResult.session.expires_at).getTime()
                };
                
                localStorage.setItem('auth_session', JSON.stringify(sessionData));
                
                this.currentUser = result.user;
                
                // Запускаем мониторинг статуса пользователя
                this.startUserStatusMonitoring(result.user.id);
                
                this.showNotification('Успешный вход!', 'success');
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                console.log('Ошибка создания сессии:', sessionResult);
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
                // Сохраняем сессию в localStorage
                const sessionData = {
                    sessionId: sessionResult.session.id,
                    userId: result.user.id,
                    expires: new Date(sessionResult.session.expires_at).getTime()
                };
                
                localStorage.setItem('auth_session', JSON.stringify(sessionData));
                
                this.currentUser = result.user;
                
                // Запускаем мониторинг статуса пользователя
                this.startUserStatusMonitoring(result.user.id);
                
                this.showNotification('Регистрация успешна!', 'success');

                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                console.log('Ошибка создания сессии при регистрации:', sessionResult);
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


    async checkExistingSession() {
        const session = localStorage.getItem('auth_session');
        if (session) {
            try {
                const sessionData = JSON.parse(session);
                
                // Проверяем сессию через Supabase
                const sessionResult = await window.SupabaseAuth.checkSession(sessionData.sessionId);
                
                if (sessionResult.success && sessionData.expires > Date.now()) {
                    // Получаем данные пользователя из сессии
                    this.currentUser = sessionResult.session.users || { id: sessionData.userId };
                    
                    // Проверяем статус пользователя
                    const statusResult = await window.SupabaseAuth.checkUserStatus(sessionData.userId);
                    
                    if (statusResult.success && statusResult.isActive) {
                        // Запускаем мониторинг статуса пользователя
                        this.startUserStatusMonitoring(sessionData.userId);
                        // Перенаправляем на главную страницу
                        window.location.href = 'index.html';
                    } else {
                        // Пользователь деактивирован, очищаем сессию
                        this.forceLogout('Ваш аккаунт был деактивирован администратором');
                    }
                } else {
                    // Сессия недействительна, удаляем её
                    this.clearSession();
                }
            } catch (error) {
                this.clearSession();
            }
        }
    }




    logout() {
        this.stopUserStatusMonitoring();
        this.currentUser = null;
        this.clearSession();
        window.location.href = 'auth.html';
    }

    forceLogout(message) {
        this.stopUserStatusMonitoring();
        this.currentUser = null;
        this.clearSession();
        this.showNotification(message, 'error');
        
        window.location.href = 'auth.html';
    }

    clearSession() {
        localStorage.removeItem('auth_session');
    }

    startUserStatusMonitoring(userId) {
        this.stopUserStatusMonitoring();
        
        this.statusSubscription = window.SupabaseAuth.subscribeToUserStatus(userId, (isActive) => {
            if (!isActive) {
                this.forceLogout('Ваш аккаунт был деактивирован администратором');
            }
        });
        
        this.startPeriodicStatusCheck(userId);
    }
    
    startPeriodicStatusCheck(userId) {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }
        
        this.statusCheckInterval = setInterval(async () => {
            try {
                const statusResult = await window.SupabaseAuth.checkUserStatus(userId);
                
                if (!statusResult.success || !statusResult.isActive) {
                    clearInterval(this.statusCheckInterval);
                    this.forceLogout('Ваш аккаунт был деактивирован администратором');
                }
            } catch (error) {
                console.error('Ошибка периодической проверки статуса:', error);
            }
        }, 30000); // Проверяем каждые 30 секунд
    }

    stopUserStatusMonitoring() {
        if (this.statusSubscription) {
            window.SupabaseAuth.unsubscribeFromUserStatus(this.statusSubscription);
            this.statusSubscription = null;
        }
        
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }


    validatePhone(phone) {
        const phoneRegex = /^\+7\s?\(\d{3}\)\s?\d{3}-\d{2}-\d{2}$/;
        return phoneRegex.test(phone);
    }

    handlePhoneKeydown(e) {
        const input = e.target;
        const cursorPosition = input.selectionStart;
        const value = input.value;
        
        if ([8, 9, 27, 46, 37, 38, 39, 40].includes(e.keyCode)) {
            if (e.keyCode === 8) {
                e.preventDefault();
                this.handleBackspace(input, cursorPosition);
                return;
            }
            if (e.keyCode === 46) {
                e.preventDefault();
                this.handleDelete(input, cursorPosition);
                return;
            }
            return;
        }
        
        if (e.ctrlKey && [65, 67, 86, 88].includes(e.keyCode)) {
            return;
        }
        
        if (e.keyCode < 48 || e.keyCode > 57) {
            e.preventDefault();
            return;
        }
        
        if (cursorPosition <= 3) {
            input.setSelectionRange(4, 4);
        }
    }

    handleBackspace(input, cursorPosition) {
        const value = input.value;
        
        if (cursorPosition <= 3) {
            return;
        }
        
        if (cursorPosition > 0 && [' ', '(', ')', '-'].includes(value[cursorPosition - 1])) {
            const newValue = value.slice(0, cursorPosition - 2) + value.slice(cursorPosition);
            input.value = this.formatPhone(newValue);
            input.setSelectionRange(cursorPosition - 2, cursorPosition - 2);
        } else {
            const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
            input.value = this.formatPhone(newValue);
            input.setSelectionRange(cursorPosition - 1, cursorPosition - 1);
        }
    }

    handleDelete(input, cursorPosition) {
        const value = input.value;
        
        if (cursorPosition >= value.length) {
            return;
        }
        
        if (cursorPosition < value.length && [' ', '(', ')', '-'].includes(value[cursorPosition])) {
            const newValue = value.slice(0, cursorPosition) + value.slice(cursorPosition + 2);
            input.value = this.formatPhone(newValue);
            input.setSelectionRange(cursorPosition, cursorPosition);
        } else {
            const newValue = value.slice(0, cursorPosition) + value.slice(cursorPosition + 1);
            input.value = this.formatPhone(newValue);
            input.setSelectionRange(cursorPosition, cursorPosition);
        }
    }

    getNewCursorPosition(oldValue, newValue, oldCursorPosition) {
        const digitsBeforeCursor = oldValue.slice(0, oldCursorPosition).replace(/\D/g, '').length;
        
        let newCursorPosition = 0;
        let digitCount = 0;
        
        for (let i = 0; i < newValue.length; i++) {
            if (/\d/.test(newValue[i])) {
                digitCount++;
                if (digitCount === digitsBeforeCursor) {
                    newCursorPosition = i + 1;
                    break;
                }
            }
        }
        
        return Math.min(newCursorPosition, newValue.length);
    }

    updatePhoneValidation(input, statusElementId) {
        const statusElement = document.getElementById(statusElementId);
        const value = input.value;
        const isValid = this.validatePhone(value);
        
        input.classList.remove('valid', 'invalid');
        statusElement.classList.remove('valid', 'invalid');
        
        const hasUserInteraction = input.dataset.userInteracted === 'true';
        
        if (value.length === 0) {
            if (!hasUserInteraction) {
                statusElement.style.display = 'none';
            } else {
                statusElement.style.display = 'none';
            }
        } else if (value.length < 18) {
            if (hasUserInteraction) {
                input.classList.add('invalid');
                statusElement.textContent = 'Введите полный номер телефона';
                statusElement.classList.add('invalid');
                statusElement.style.display = 'block';
            }
        } else if (isValid) {
            input.classList.add('valid');
            statusElement.textContent = '✓ Номер телефона корректен';
            statusElement.classList.add('valid');
            statusElement.style.display = 'block';
        } else {
            input.classList.add('invalid');
            statusElement.textContent = '✗ Неверный формат номера';
            statusElement.classList.add('invalid');
            statusElement.style.display = 'block';
        }
    }

    formatPhone(value) {

        const numbers = value.replace(/\D/g, '');
        

        let cleanNumbers = numbers;
        if (cleanNumbers.startsWith('8')) {
            cleanNumbers = '7' + cleanNumbers.slice(1);
        }
        
        if (!cleanNumbers.startsWith('7') && cleanNumbers.length > 0) {
            cleanNumbers = '7' + cleanNumbers;
        }
        
        cleanNumbers = cleanNumbers.slice(0, 11);
        
        if (cleanNumbers.length === 0) {
            return '';
        } else if (cleanNumbers.length <= 1) {
            return '+7';
        } else if (cleanNumbers.length <= 4) {
            return '+7 (' + cleanNumbers.slice(1);
        } else if (cleanNumbers.length <= 7) {
            return '+7 (' + cleanNumbers.slice(1, 4) + ') ' + cleanNumbers.slice(4);
        } else if (cleanNumbers.length <= 9) {
            return '+7 (' + cleanNumbers.slice(1, 4) + ') ' + cleanNumbers.slice(4, 7) + '-' + cleanNumbers.slice(7);
        } else {
            return '+7 (' + cleanNumbers.slice(1, 4) + ') ' + cleanNumbers.slice(4, 7) + '-' + cleanNumbers.slice(7, 9) + '-' + cleanNumbers.slice(9);
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
                
        const phoneInput = document.getElementById('phone');
        const regPhoneInput = document.getElementById('regPhone');
        
        if (phoneInput) {
            phoneInput.dataset.userInteracted = 'false';
            phoneInput.classList.remove('valid', 'invalid');
            const phoneStatus = document.getElementById('phoneStatus');
            if (phoneStatus) phoneStatus.style.display = 'none';
        }
        
        if (regPhoneInput) {
            regPhoneInput.dataset.userInteracted = 'false';
            regPhoneInput.classList.remove('valid', 'invalid');
            const regPhoneStatus = document.getElementById('regPhoneStatus');
            if (regPhoneStatus) regPhoneStatus.style.display = 'none';
        }
    }
}




document.addEventListener('DOMContentLoaded', () => {
    new SimpleAuth();
});


window.SimpleAuth = SimpleAuth;
