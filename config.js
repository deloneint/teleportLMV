// Конфигурация приложения
// В продакшене эти значения будут заменены переменными окружения
const CONFIG = {
    yandex: {
        apiKey: import.meta.env.VITE_YANDEX_API_KEY || 'YOUR_YANDEX_API_KEY',
        center: [55.7558, 37.6176],
        zoom: 10
    },
    googleScript: {
        url: import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'YOUR_GOOGLE_SCRIPT_URL'
    }
};

// Экспортируем конфигурацию
export default CONFIG;
