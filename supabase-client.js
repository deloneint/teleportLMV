// supabase-client.js
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2'

// Инициализация Supabase клиента
const supabase = createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
);

// Функция хеширования паролей (простая версия)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Функция проверки пароля
async function verifyPassword(password, hash) {
    const hashedPassword = await hashPassword(password);
    return hashedPassword === hash;
}

// Функция перевода ошибок на русский
function translateError(error) {
    const errorMessages = {
        'PGRST116': 'Пользователь не найден',
        '23505': 'Пользователь с таким номером телефона уже существует',
        '23503': 'Ошибка связи с базой данных',
        '42501': 'Недостаточно прав для выполнения операции',
        '42P01': 'Таблица не найдена',
        '42703': 'Поле не найдено',
        '22001': 'Слишком длинное значение',
        '22003': 'Числовое значение вне допустимого диапазона',
        '22007': 'Неверный формат даты',
        '22008': 'Неверный формат времени',
        '22012': 'Деление на ноль',
        '22023': 'Неверный параметр',
        '22024': 'Неверный escape-символ',
        '22025': 'Неверный escape-последовательность',
        '22026': 'Строка данных неверной длины',
        '22027': 'Неверный формат времени'
    };
    
    // Если error - это объект с кодом
    if (error && error.code) {
        return errorMessages[error.code] || error.message || 'Неизвестная ошибка';
    }
    
    // Если error - это строка с кодом
    if (typeof error === 'string') {
        return errorMessages[error] || error;
    }
    
    // Если error - это объект с message
    if (error && error.message) {
        return error.message;
    }
    
    return 'Неизвестная ошибка';
}

// Функция регистрации пользователя
async function registerUser(fullName, phone, password) {
    try {
        // Сначала проверяем, существует ли пользователь с таким телефоном
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('phone', phone)
            .single();
        
        if (existingUser) {
            return { 
                success: false, 
                error: 'Пользователь с таким номером телефона уже зарегистрирован' 
            };
        }
        
        // Если пользователь не найден, создаем нового
        const passwordHash = await hashPassword(password);
        
        const { data, error } = await supabase
            .from('users')
            .insert([
                { 
                    full_name: fullName, 
                    phone: phone, 
                    password_hash: passwordHash 
                }
            ])
            .select()
            .single();
        
        if (error) {
            console.error('Supabase error:', error);
            return { 
                success: false, 
                error: translateError(error)
            };
        }
        
        return { success: true, user: data };
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        return { 
            success: false, 
            error: translateError(error)
        };
    }
}

// Функция входа пользователя
async function loginUser(phone, password) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .eq('is_active', true)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return { 
                    success: false, 
                    error: 'Пользователь с таким номером телефона не найден' 
                };
            }
            console.error('Supabase error:', error);
            return { 
                success: false, 
                error: translateError(error)
            };
        }
        
        const isValid = await verifyPassword(password, data.password_hash);
        if (!isValid) {
            return { 
                success: false, 
                error: 'Неверный пароль' 
            };
        }
        
        // Обновляем время последнего входа
        const { error: updateError } = await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', data.id);
        
        if (updateError) {
            console.warn('Не удалось обновить время входа:', updateError);
        }
        
        return { success: true, user: data };
    } catch (error) {
        console.error('Ошибка входа:', error);
        return { 
            success: false, 
            error: translateError(error)
        };
    }
}

// Функция создания сессии
async function createSession(userId) {
    try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1); // 24 часа
        
        const { data, error } = await supabase
            .from('sessions')
            .insert([
                { 
                    user_id: userId, 
                    expires_at: expiresAt.toISOString() 
                }
            ])
            .select()
            .single();
        
        if (error) {
            console.error('Supabase error:', error);
            return { 
                success: false, 
                error: translateError(error)
            };
        }
        
        return { success: true, session: data };
    } catch (error) {
        console.error('Ошибка создания сессии:', error);
        return { 
            success: false, 
            error: translateError(error)
        };
    }
}

// Функция проверки сессии
async function checkSession(sessionId) {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select(`
                *,
                users (*)
            `)
            .eq('id', sessionId)
            .gt('expires_at', new Date().toISOString())
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return { 
                    success: false, 
                    error: 'Сессия не найдена или истекла' 
                };
            }
            console.error('Supabase error:', error);
            return { 
                success: false, 
                error: translateError(error)
            };
        }
        
        return { success: true, session: data };
    } catch (error) {
        console.error('Ошибка проверки сессии:', error);
        return { 
            success: false, 
            error: translateError(error)
        };
    }
}

// Функция выхода
async function logoutUser(sessionId) {
    try {
        const { error } = await supabase
            .from('sessions')
            .delete()
            .eq('id', sessionId);
        
        if (error) {
            console.error('Supabase error:', error);
            return { 
                success: false, 
                error: translateError(error)
            };
        }
        
        return { success: true };
    } catch (error) {
        console.error('Ошибка выхода:', error);
        return { 
            success: false, 
            error: translateError(error)
        };
    }
}

// Экспорт функций
window.SupabaseAuth = {
    registerUser,
    loginUser,
    createSession,
    checkSession,
    logoutUser
};