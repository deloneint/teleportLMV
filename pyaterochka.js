/**
 * Специфичная логика для проекта "Х5-групп курьеры"
 * Этот файл содержит функции, специфичные для работы с данными курьеров Х5-групп
 */

// Конфигурация для проекта Х5-групп курьеры
const PYATEROCHKA_CONFIG = {
    // Настройки отображения
    displaySettings: {
        icon: '🚚',
        color: '#ff9500',
        name: 'Х5-групп курьеры',
        description: 'Служба доставки'
    },
    
    // Поля данных, специфичные для курьеров
    dataFields: {
        // Основные поля
        address: 'address',
        fullAddress: 'fullAddress',
        city: 'city',
        
        // Специфичные поля для курьеров
        courierName: 'courierName',
        courierPhone: 'courierPhone',
        deliveryZone: 'deliveryZone',
        workingHours: 'workingHours',
        status: 'status', // active, inactive, busy
        rating: 'rating',
        ordersCount: 'ordersCount',
        vehicleType: 'vehicleType' // bike, car, scooter
    },
    
    // Настройки фильтрации
    filters: {
        status: ['active', 'inactive', 'busy'],
        vehicleType: ['bike', 'car', 'scooter'],
        rating: {
            min: 1,
            max: 5
        }
    }
};

/**
 * Обработка данных курьеров Х5-групп
 * @param {Array} rawData - Сырые данные из Google Sheets
 * @returns {Array} Обработанные данные курьеров
 */
function processPyaterochkaData(rawData) {
    if (!rawData || !Array.isArray(rawData)) {
        console.warn('Некорректные данные для обработки Х5-групп');
        return [];
    }
    
    return rawData.map((courier, index) => {
        return {
            id: courier.id || `pyaterochka_${index}`,
            address: courier.address || courier.fullAddress || 'Адрес не указан',
            fullAddress: courier.fullAddress || courier.address || 'Адрес не указан',
            city: courier.city || 'Город не указан',
            courierName: courier.courierName || courier.name || 'Курьер',
            courierPhone: courier.courierPhone || courier.phone || '',
            deliveryZone: courier.deliveryZone || 'Зона не указана',
            workingHours: courier.workingHours || 'График не указан',
            status: courier.status || 'active',
            rating: parseFloat(courier.rating) || 0,
            ordersCount: parseInt(courier.ordersCount) || 0,
            vehicleType: courier.vehicleType || 'bike',
            coordinates: {
                lat: parseFloat(courier.lat) || 0,
                lon: parseFloat(courier.lon) || 0
            }
        };
    }).filter(courier => 
        courier.coordinates.lat !== 0 && 
        courier.coordinates.lon !== 0
    );
}

/**
 * Создание HTML для отображения информации о курьере
 * @param {Object} courierData - Данные курьера
 * @returns {string} HTML строка
 */
function createPyaterochkaInfoHTML(courierData) {
    const statusText = {
        'active': '🟢 Активен',
        'inactive': '🔴 Неактивен', 
        'busy': '🟡 Занят'
    };
    
    const vehicleIcons = {
        'bike': '🚲',
        'car': '🚗',
        'scooter': '🛵'
    };
    
    const status = statusText[courierData.status] || '❓ Неизвестно';
    const vehicleIcon = vehicleIcons[courierData.vehicleType] || '🚚';
    
    return `
        <div class="pyaterochka-info">
            <div class="courier-header">
                <h4>${vehicleIcon} ${courierData.courierName}</h4>
                <span class="status">${status}</span>
            </div>
            
            <div class="courier-details">
                <div class="detail-row">
                    <strong>Адрес:</strong> ${courierData.address}
                </div>
                
                ${courierData.courierPhone ? `
                <div class="detail-row">
                    <strong>Телефон:</strong> 
                    <a href="tel:${courierData.courierPhone}">${courierData.courierPhone}</a>
                </div>
                ` : ''}
                
                <div class="detail-row">
                    <strong>Зона доставки:</strong> ${courierData.deliveryZone}
                </div>
                
                <div class="detail-row">
                    <strong>График работы:</strong> ${courierData.workingHours}
                </div>
                
                <div class="detail-row">
                    <strong>Рейтинг:</strong> 
                    <span class="rating">${'⭐'.repeat(Math.floor(courierData.rating))} ${courierData.rating}/5</span>
                </div>
                
                <div class="detail-row">
                    <strong>Заказов выполнено:</strong> ${courierData.ordersCount}
                </div>
            </div>
        </div>
    `;
}

/**
 * Фильтрация курьеров по статусу
 * @param {Array} couriers - Массив курьеров
 * @param {string} status - Статус для фильтрации
 * @returns {Array} Отфильтрованные курьеры
 */
function filterPyaterochkaByStatus(couriers, status) {
    if (!status || status === 'all') {
        return couriers;
    }
    
    return couriers.filter(courier => courier.status === status);
}

/**
 * Фильтрация курьеров по типу транспорта
 * @param {Array} couriers - Массив курьеров
 * @param {string} vehicleType - Тип транспорта для фильтрации
 * @returns {Array} Отфильтрованные курьеры
 */
function filterPyaterochkaByVehicle(couriers, vehicleType) {
    if (!vehicleType || vehicleType === 'all') {
        return couriers;
    }
    
    return couriers.filter(courier => courier.vehicleType === vehicleType);
}

/**
 * Фильтрация курьеров по рейтингу
 * @param {Array} couriers - Массив курьеров
 * @param {number} minRating - Минимальный рейтинг
 * @returns {Array} Отфильтрованные курьеры
 */
function filterPyaterochkaByRating(couriers, minRating = 0) {
    return couriers.filter(courier => courier.rating >= minRating);
}

/**
 * Получение статистики по курьерам
 * @param {Array} couriers - Массив курьеров
 * @returns {Object} Статистика
 */
function getPyaterochkaStats(couriers) {
    const stats = {
        total: couriers.length,
        active: 0,
        inactive: 0,
        busy: 0,
        averageRating: 0,
        totalOrders: 0,
        vehicleTypes: {
            bike: 0,
            car: 0,
            scooter: 0
        }
    };
    
    let totalRating = 0;
    
    couriers.forEach(courier => {
        // Статусы
        if (courier.status === 'active') stats.active++;
        else if (courier.status === 'inactive') stats.inactive++;
        else if (courier.status === 'busy') stats.busy++;
        
        // Рейтинг
        totalRating += courier.rating;
        
        // Заказы
        stats.totalOrders += courier.ordersCount;
        
        // Типы транспорта
        if (courier.vehicleType in stats.vehicleTypes) {
            stats.vehicleTypes[courier.vehicleType]++;
        }
    });
    
    stats.averageRating = stats.total > 0 ? (totalRating / stats.total).toFixed(1) : 0;
    
    return stats;
}

// Экспорт функций для использования в основном коде
window.PyaterochkaUtils = {
    config: PYATEROCHKA_CONFIG,
    processData: processPyaterochkaData,
    createInfoHTML: createPyaterochkaInfoHTML,
    filterByStatus: filterPyaterochkaByStatus,
    filterByVehicle: filterPyaterochkaByVehicle,
    filterByRating: filterPyaterochkaByRating,
    getStats: getPyaterochkaStats
};

console.log('✅ Х5-групп курьеры utilities loaded');
