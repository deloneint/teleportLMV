// Защищенная версия script.js - загружает конфигурацию с сервера
let CONFIG = null;

// Загрузка конфигурации с сервера
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        CONFIG = await response.json();
        console.log('Configuration loaded successfully');
    } catch (error) {
        console.error('Failed to load configuration:', error);
        // Fallback конфигурация (без API ключей)
        CONFIG = {
            yandex: {
                apiKey: 'DEMO_KEY',
                center: [55.7558, 37.6176],
                zoom: 10
            },
            googleScript: {
                url: '/api/google-script'
            }
        };
    }
}

// Остальной код остается тем же, но использует CONFIG из сервера
// ... (весь остальной код из script.js)

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async function() {
    // Загружаем конфигурацию перед инициализацией
    await loadConfig();
    
    // Проверяем авторизацию
    if (!checkAuth()) {
        return;
    }
    
    initDOMCache();
    initMap();
    setupEventListeners();
    
    // Предварительно загружаем данные всех проектов в фоне
    preloadAllProjectData();
    
    // Проверяем, есть ли сохраненные настройки
    const savedProject = localStorage.getItem('selectedProject');
    const savedCity = localStorage.getItem('selectedCity');
    
    if (savedProject && savedCity) {
        // Если есть сохраненные настройки, применяем их
        selectedProject = savedProject;
        selectedCity = savedCity;
        updateProjectInfo();
        centerMapOnCity(selectedCity);
    } else {
        // Показываем модальное окно выбора проекта и города
        showProjectModal();
    }
});
