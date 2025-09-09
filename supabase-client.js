
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2'


const supabase = createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
);


async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


async function verifyPassword(password, hash) {
    const hashedPassword = await hashPassword(password);
    return hashedPassword === hash;
}


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
    

    if (error && error.code) {
        return errorMessages[error.code] || error.message || 'Неизвестная ошибка';
    }
    

    if (typeof error === 'string') {
        return errorMessages[error] || error;
    }
    

    if (error && error.message) {
        return error.message;
    }
    
    return 'Неизвестная ошибка';
}


async function registerUser(fullName, phone, password) {
    try {

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
                    error: 'Пользователь с таким номером телефона не найден или заблокирован' 
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


async function createSession(userId) {
    try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 12); 
        
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




window.SupabaseAuth = {
    registerUser,
    loginUser,
    createSession
};
