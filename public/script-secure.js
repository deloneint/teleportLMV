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

// Глобальные переменные
let map = null;
let selectedProject = null;
let selectedCity = null;
let citiesData = [];
let isModalOpen = false;

// Кэш DOM элементов
const DOMCache = {
    searchInput: null,
    searchBtn: null,
    buildRouteBtn: null,
    clearRouteBtn: null,
    startPoint: null,
    endPoint: null,
    routeInfo: null,
    searchResults: null,
    currentProjectInfo: null,
    changeProjectBtn: null,
    updateCacheBtn: null,
    projectModal: null,
    cityGrid: null,
    continueBtn: null,
    storeInfoPanel: null,
    loading: null
};

// Кеш для загруженных данных проектов
let projectDataCache = new Map();
let isLoadingProject = false;
let isLoadingData = false;
let isLoadingProjectData = false;

// Переменные для хранения ссылок на объекты маршрута
let currentRouteLine = null;
let currentStartMarker = null;
let currentEndMarker = null;

// Переменная для хранения ссылки на маркер поиска
let currentSearchMarker = null;

// Проверка авторизации
function checkAuth() {
    const session = localStorage.getItem('auth_session');
    if (!session) {
        window.location.href = 'auth.html';
        return false;
    }
    
    try {
        const sessionData = JSON.parse(session);
        if (sessionData.expires <= Date.now()) {
            localStorage.removeItem('auth_session');
            window.location.href = 'auth.html';
            return false;
        }
    } catch (error) {
        localStorage.removeItem('auth_session');
        window.location.href = 'auth.html';
        return false;
    }
    
    return true;
}

// Выход из системы
function logout() {
    localStorage.removeItem('auth_session');
    window.location.href = 'auth.html';
}

// Инициализация кэша DOM элементов
function initDOMCache() {
    DOMCache.searchInput = document.getElementById('searchInput');
    DOMCache.searchBtn = document.getElementById('searchBtn');
    DOMCache.buildRouteBtn = document.getElementById('buildRouteBtn');
    DOMCache.clearRouteBtn = document.getElementById('clearRouteBtn');
    DOMCache.startPoint = document.getElementById('startPoint');
    DOMCache.endPoint = document.getElementById('endPoint');
    DOMCache.routeInfo = document.getElementById('routeInfo');
    DOMCache.searchResults = document.getElementById('searchResults');
    DOMCache.currentProjectInfo = document.getElementById('currentProjectInfo');
    DOMCache.changeProjectBtn = document.getElementById('changeProjectBtn');
    DOMCache.updateCacheBtn = document.getElementById('updateCacheBtn');
    DOMCache.projectModal = document.getElementById('projectModal');
    DOMCache.cityGrid = document.getElementById('cityGrid');
    DOMCache.continueBtn = document.getElementById('continueBtn');
    DOMCache.storeInfoPanel = document.getElementById('storeInfoPanel');
    DOMCache.loading = document.getElementById('loading');
}

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

// Остальные функции остаются такими же, но используют CONFIG из сервера
// ... (все остальные функции из script.js)

// Экспортируем функции для глобального доступа
window.selectProject = selectProject;
window.showProjectModal = showProjectModal;
window.logout = logout;
