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
let isLoadingData = false; // Флаг для loadDataFromGoogleSheets
let isLoadingProjectData = false; // Флаг для loadProjectDataForMap

// Переменные для хранения ссылок на объекты маршрута
let currentRouteLine = null;
let currentStartMarker = null;
let currentEndMarker = null;

// Переменная для хранения ссылки на маркер поиска
let currentSearchMarker = null;

// Конфигурация API
const CONFIG = {
    yandex: {
        // API ключ для Яндекс.Карт (получите бесплатно на https://developer.tech.yandex.ru/)
        apiKey: '8fa26024-9a91-4eed-b529-4585b18b7ac8', // Новый рабочий API ключ
        center: [55.7558, 37.6176], // Москва
        zoom: 10
    },

    googleScript: {
        // URL для Google Apps Script 
        // Получите URL: Google Apps Script → Deploy → Manage deployments → Copy URL
        // Пример: https://script.google.com/macros/s/AKfycbz.../exec
        url: 'https://script.google.com/macros/s/AKfycbwrb90AMeN5cub2EFnFgxzbShvkAtyDUBijaz4CdKXXi_AWf-fsSEmSqZJ4rCU1TrQA/exec'
    }
};

// Функция для предварительной загрузки данных всех проектов
async function preloadAllProjectData() {
    try {
        await loadDataFromGoogleScript(CONFIG.googleScript.url, 'lenta');
        startAutoCacheUpdate();
    } catch (error) {
        // Ошибка не критична, данные будут загружены при необходимости
    }
}

// Функция для автоматического обновления кэша каждый час
function startAutoCacheUpdate() {
    const CACHE_UPDATE_INTERVAL = 60 * 60 * 1000;
    
    setInterval(async () => {
        try {
            if (projectDataCache.size === 0) {
                await updateCache();
                return;
            }
            
            const now = Date.now();
            let needsUpdate = false;
            
            projectDataCache.forEach((data) => {
                if (now - data.timestamp > CACHE_UPDATE_INTERVAL) {
                    needsUpdate = true;
                }
            });
            
            if (needsUpdate) {
                await updateCache();
            }
        } catch (error) {
            // Ошибка не критична
        }
    }, CACHE_UPDATE_INTERVAL);
}

// Функция для обновления кэша
async function updateCache() {
    try {
        await loadDataFromGoogleScript(CONFIG.googleScript.url, 'lenta');
    } catch (error) {
        // Ошибка не критична
    }
}

// Функция для принудительного обновления кэша
async function forceUpdateCache() {
    try {
        projectDataCache.clear();
        await loadDataFromGoogleScript(CONFIG.googleScript.url, 'lenta');
    } catch (error) {
        // Ошибка не критична
    }
}

// Делаем функцию доступной глобально для отладки
window.forceUpdateCache = forceUpdateCache;

// Функция для загрузки данных из Google таблиц
async function loadDataFromGoogleSheets(project) {
    // Проверяем, не загружается ли уже
    if (isLoadingData) {
        return { storesData: [], citiesData: [] };
    }
    
    // Устанавливаем флаг загрузки
    isLoadingData = true;
    
    // Показываем индикатор загрузки
    showLoading(true, `Загружаем данные всех проектов...`);
    
    try {
        // Загружаем данные из всех листов (кроме "Магнит Тариф")
        // Данные автоматически сохраняются в кэше в loadDataFromGoogleScript
        const rawData = await loadDataFromGoogleScript(CONFIG.googleScript.url, project);
        
        if (rawData && rawData.length > 0) {
            // Извлекаем уникальные города/области с координатами
            const cities = extractUniqueCities(rawData, project);
            
            // Сохраняем данные в глобальные переменные
            window.storesData = rawData;
            citiesData = cities;
            
            return { storesData: rawData, citiesData: cities };
        } else {
            return { storesData: [], citiesData: [] };
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных из Google таблиц:', error);
        return { storesData: [], citiesData: [] };
    } finally {
        // Скрываем индикатор загрузки
        showLoading(false);
        // Сбрасываем флаг загрузки
        isLoadingData = false;
    }
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
document.addEventListener('DOMContentLoaded', function() {
    initDOMCache();
    initMap();
    setupEventListeners();
    
    // Предварительно загружаем данные всех проектов в фоне
    preloadAllProjectData();
    
    // Добавляем обработчик для кнопки закрытия панели информации о магазине
    const closeStoreInfoBtn = document.getElementById('closeStoreInfoBtn');
    if (closeStoreInfoBtn) {
        closeStoreInfoBtn.addEventListener('click', hideStoreInfo);
    }
    
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
        setTimeout(() => {
            showProjectModal();
        }, 1000);
        
        // Добавляем обработчики событий для модального окна
        setupModalEventListeners();
    }
});

// Создание карты
function createMap() {
    try {
        map = new window.ymaps.Map('map', {
            center: CONFIG.yandex.center,
            zoom: CONFIG.yandex.zoom,
            controls: ['zoomControl', 'fullscreenControl']
        });
        
        // Добавляем обработчик клика по карте для закрытия информационных окон
        map.events.add('click', function (e) {
            if (currentSearchMarker && currentSearchMarker.balloon) {
                currentSearchMarker.balloon.close();
            }
        });
    } catch (error) {
        showError(`Ошибка создания карты: ${error.message}`);
    }
}

// Инициализация карты
function initMap() {
    if (!CONFIG.yandex.apiKey) {
        createMapPlaceholder();
        return;
    }
    
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${CONFIG.yandex.apiKey}&lang=ru_RU`;
    
    script.onload = () => {
        setTimeout(() => {
            if (window.ymaps && window.ymaps.ready) {
                window.ymaps.ready(() => {
                    createMap();
                });
            } else {
                createMap();
            }
        }, 1000);
    };
    
    script.onerror = () => {
        showError('Ошибка загрузки Яндекс.Карт. Проверьте интернет-соединение и API ключ.');
        createMapPlaceholder();
    };
    
    document.head.appendChild(script);
}

// Поиск адреса через Nominatim (OpenStreetMap, бесплатно)
async function performSearch() {
    const query = DOMCache.searchInput.value.trim();
    if (!query) {
        showError('Введите адрес для поиска');
        return;
    }

    if (!map) {
        showError('Карта не загружена');
        return;
    }

    showLoading(true, 'Ищем адрес...');

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=ru&addressdetails=1&accept-language=ru`;
        const response = await fetch(url);
        const data = await response.json();

        const suggestions = data.map((item, index) => ({
            id: index,
            display_name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
        }));

        displaySearchResults(suggestions);

    } catch (error) {
        showError(`Ошибка поиска: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Отображение результатов поиска
function displaySearchResults(results) {
    const resultsContainer = DOMCache.searchResults;
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">Адреса не найдены</div>';
        resultsContainer.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = results.map((result, index) => 
        `<div class="search-result" data-lat="${result.lat}" data-lon="${result.lon}" data-name="${result.display_name.replace(/"/g, '&quot;')}">
            ${result.display_name}
        </div>`
    ).join('');
    
    // Добавляем обработчики клика для результатов поиска
    resultsContainer.querySelectorAll('.search-result').forEach(item => {
        item.addEventListener('click', function() {
            const location = {
                lat: parseFloat(this.dataset.lat),
                lon: parseFloat(this.dataset.lon),
                display_name: this.dataset.name
            };
            selectLocation(location);
        });
    });
    
    resultsContainer.style.display = 'block';
}

// Выбор местоположения
function selectLocation(location) {
    if (!map) {
        return;
    }

    // Очищаем старый маркер поиска, если он есть
    if (currentSearchMarker) {
        map.geoObjects.remove(currentSearchMarker);
        currentSearchMarker = null;
    }

    // Создаем HTML для информационного окна с кнопками
    const infoWindowContent = `
        <div class="search-marker-info">
            <div class="search-marker-address">${location.display_name}</div>
            <div class="search-marker-buttons">
                <button class="search-route-btn start-btn" onclick="setSearchLocationAsRoutePoint('start', '${location.display_name.replace(/'/g, "\\'")}')">Откуда</button>
                <button class="search-route-btn end-btn" onclick="setSearchLocationAsRoutePoint('end', '${location.display_name.replace(/'/g, "\\'")}')">Куда</button>
            </div>
        </div>
    `;

    // Добавляем новый маркер на Яндекс.Карту с информационным окном
    currentSearchMarker = new window.ymaps.Placemark(
        [location.lat, location.lon],
        { 
            hintContent: location.display_name,
            balloonContent: infoWindowContent
        },
        {
            preset: 'islands#blueDotIcon'
        }
    );
    
    // Открываем информационное окно при каждом клике на метку
    currentSearchMarker.events.add('click', function () {
        // Принудительно закрываем, если открыто, затем открываем заново
        if (currentSearchMarker.balloon.isOpen()) {
            currentSearchMarker.balloon.close();
        }
        // Небольшая задержка для корректного переоткрытия
        setTimeout(() => {
            currentSearchMarker.balloon.open();
        }, 50);
    });
    
    map.geoObjects.add(currentSearchMarker);

    // Центрируем карту
    map.setCenter([location.lat, location.lon], 15);

    // Скрываем результаты поиска
    DOMCache.searchResults.style.display = 'none';
    
    // Очищаем поле поиска
    DOMCache.searchInput.value = location.display_name;
    
    // Скрываем информацию о маршруте
    DOMCache.routeInfo.style.display = 'none';
}

// Отображение информации о маршруте
function displayRouteInfo(route) {
    const routeInfo = DOMCache.routeInfo;
    
    // Форматируем время в удобном виде
    const formatTime = (minutes) => {
        if (minutes < 60) {
            return `${minutes} мин`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`;
        }
    };
    
    // Форматируем расстояние
    const formatDistance = (km) => {
        if (km < 1) {
            return `${Math.round(km * 1000)} м`;
        } else {
            return `${km} км`;
        }
    };
    
    // Рассчитываем примерное время в пути при разных скоростях
    const timeByWalking = Math.round(route.distance * 60 / 5); // 5 км/ч пешком
    const timeByBike = Math.round(route.distance * 60 / 15); // 15 км/ч на велосипеде
    
    routeInfo.innerHTML = `
        <div class="route-header">
            <h4>📊 Информация о маршруте</h4>
        </div>
        
        <div class="route-main-info">
            <div class="route-stat primary">
                <span class="stat-label">🚗 На автомобиле</span>
                <span class="stat-value">${formatTime(route.duration)}</span>
            </div>
            <div class="route-stat primary">
                <span class="stat-label">📏 Расстояние</span>
                <span class="stat-value">${formatDistance(route.distance)}</span>
            </div>
        </div>
        
        <div class="route-alternatives">
            <div class="route-stat">
                <span class="stat-label">🚶 Пешком</span>
                <span class="stat-value">${formatTime(timeByWalking)}</span>
            </div>
            <div class="route-stat">
                <span class="stat-label">🚴 На велосипеде</span>
                <span class="stat-value">${formatTime(timeByBike)}</span>
            </div>
        </div>
    `;
    
    routeInfo.style.display = 'block';
    
    // Показываем кнопку для открытия в Яндекс.Картах
    const yandexMapsButton = document.getElementById('yandexMapsButton');
    if (yandexMapsButton) yandexMapsButton.style.display = 'block';
}

// Открытие маршрута в Яндекс.Картах
function openInYandexMaps() {
    const startPoint = DOMCache.startPoint.value.trim();
    const endPoint = DOMCache.endPoint.value.trim();
    
    if (!startPoint && !endPoint) {
        showError('Введите хотя бы один адрес');
        return;
    }
    
    let yandexMapsUrl;
    
    if (startPoint && endPoint) {
        // Если есть оба адреса - строим маршрут
        yandexMapsUrl = `https://yandex.ru/maps/?rtext=${encodeURIComponent(startPoint)}~${encodeURIComponent(endPoint)}&rtt=auto`;
    } else if (startPoint) {
        // Если есть только начальная точка - показываем её
        yandexMapsUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(startPoint)}`;
    } else {
        // Если есть только конечная точка - показываем её
        yandexMapsUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(endPoint)}`;
    }
    
    // Открываем в новой вкладке
    window.open(yandexMapsUrl, '_blank');
}

// Очистка маршрута и всех данных
function clearRoute() {
    // Сохраняем текущее положение карты
    let currentCenter = [55.7558, 37.6176]; // По умолчанию Москва
    let currentZoom = 10;
    
    if (map) {
        currentCenter = map.getCenter();
        currentZoom = map.getZoom();
    }
    
    // Очищаем поля ввода
    DOMCache.startPoint.value = '';
    DOMCache.endPoint.value = '';
    
    // Очищаем маршруты через сохраненные ссылки
    if (currentRouteLine) {
        map.geoObjects.remove(currentRouteLine);
        currentRouteLine = null;
    }
    
    if (currentStartMarker) {
        map.geoObjects.remove(currentStartMarker);
        currentStartMarker = null;
    }
    
    if (currentEndMarker) {
        map.geoObjects.remove(currentEndMarker);
        currentEndMarker = null;
    }
    
    // Очищаем маркер поиска
    if (currentSearchMarker) {
        map.geoObjects.remove(currentSearchMarker);
        currentSearchMarker = null;
    }
    
    // Скрываем информацию о маршруте
    DOMCache.routeInfo.style.display = 'none';
    
    // Скрываем результаты поиска
    DOMCache.searchResults.style.display = 'none';
    
    // Очищаем поле поиска
    DOMCache.searchInput.value = '';
    
    // Возвращаем карту в то же положение, где она была
    if (map) {
        map.setCenter(currentCenter, currentZoom);
    }
}

// Показать/скрыть индикатор загрузки
function showLoading(show, message = 'Загружаем...') {
    const loadingElement = DOMCache.loading;
    if (loadingElement) {
        const loadingText = loadingElement.querySelector('.loading-text');
        
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

// Показать ошибку
function showError(message) {
    showNotification(message, 'error');
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Поиск адреса
    if (DOMCache.searchBtn) {
        DOMCache.searchBtn.addEventListener('click', performSearch);
    }
    
    // Построение маршрута
    if (DOMCache.buildRouteBtn) {
        DOMCache.buildRouteBtn.addEventListener('click', buildRoute);
    }
    
    // Открытие в Яндекс.Картах
    const openInYandexMapsBtn = document.getElementById('openInYandexMapsBtn');
    if (openInYandexMapsBtn) {
        openInYandexMapsBtn.addEventListener('click', openInYandexMaps);
    }

    // Очистка маршрута
    if (DOMCache.clearRouteBtn) {
        DOMCache.clearRouteBtn.addEventListener('click', clearRoute);
    }
    
    // Смена проекта
    if (DOMCache.changeProjectBtn) {
        DOMCache.changeProjectBtn.addEventListener('click', showProjectModal);
    }
    
    // Поиск по Enter в поле ввода
    if (DOMCache.searchInput) {
        DOMCache.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // Кнопки маршрута в правой панели
    const setAsStartPointBtn = document.getElementById('setAsStartPoint');
    if (setAsStartPointBtn) {
        setAsStartPointBtn.addEventListener('click', () => setStoreAsRoutePoint('start'));
    }
    
    const setAsEndPointBtn = document.getElementById('setAsEndPoint');
    if (setAsEndPointBtn) {
        setAsEndPointBtn.addEventListener('click', () => setStoreAsRoutePoint('end'));
    }
}

// Глобальные функции для onclick атрибутов
window.selectProject = selectProject;
window.showProjectModal = showProjectModal;



// Создание заглушки карты без API
function createMapPlaceholder() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {

        return;
    }
    
    // Создаем заглушку с инструкцией
    mapContainer.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
        ">
            <div style="font-size: 48px; margin-bottom: 20px;">🗺️</div>
            <h3 style="color: #495057; margin-bottom: 15px;">Карта недоступна</h3>
            <p style="color: #6c757d; margin-bottom: 20px; max-width: 400px;">
                Для отображения карты необходим действующий API ключ Яндекс.Карт
            </p>
            <div style="
                background: #e9ecef;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
                font-family: monospace;
                font-size: 14px;
                color: #495057;
                border: 1px solid #dee2e6;
            ">
                <strong>Как получить API ключ:</strong><br>
                1. Перейдите на <a href="https://developer.tech.yandex.ru/" target="_blank" style="color: #007bff;">developer.tech.yandex.ru</a><br>
                2. Создайте приложение "Яндекс.Карты"<br>
                3. Скопируйте полученный ключ<br>
                4. Замените в файле script.js
            </button>
        </div>
    `;
}



// Функции для работы с модальным окном
function showProjectModal() {
    if (isModalOpen) return;
    
    isModalOpen = true;
    const modal = DOMCache.projectModal;
    if (modal) {
        modal.style.display = 'flex';
    } else {
        return;
    }
    
    // Сбрасываем текущий выбор для возможности смены проекта
    selectedProject = null;
    selectedCity = null;
    
    // Закрываем правую панель при открытии модального окна смены проекта
    hideStoreInfo();
    
    // Сбрасываем флаги загрузки
    isLoadingProject = false;
    isLoadingData = false;
    isLoadingProjectData = false;
    
    // НЕ очищаем кеш здесь - он будет очищен только при реальной смене проекта
    
    // Добавляем обработчики событий для модального окна
    setupModalEventListeners();
}

function hideProjectModal() {
    isModalOpen = false;
    if (DOMCache.projectModal) {
        DOMCache.projectModal.style.display = 'none';
    }
}

function setupModalEventListeners() {
    // Выбор проекта
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach((card, index) => {
        const projectName = card.dataset.project;
    
    // Убираем старые обработчики, если они есть
        card.removeEventListener('click', card._projectClickHandler);
        
        // Создаем новый обработчик
        card._projectClickHandler = () => {

            selectProject(projectName);
        };
        
        card.addEventListener('click', card._projectClickHandler);
    });
    
    // Поиск города - обработчик будет добавлен в selectProject
    
    // Кнопка "Назад"
    const backToProjectBtn = document.getElementById('backToProjectBtn');
    
    if (backToProjectBtn) {
        backToProjectBtn.addEventListener('click', backToProjectSelection);
    }
}

function selectProject(project) {
    // Проверяем, действительно ли меняется проект
    if (selectedProject && selectedProject !== project) {
        // Примечание: данные всех проектов уже загружены в кэш при инициализации
        // Очищать кэш не нужно - это нарушает логику предварительной загрузки
        
        // Закрываем правую панель при смене проекта
        hideStoreInfo();
    }
    
    selectedProject = project;
    
    // Убираем выделение со всех карточек
    document.querySelectorAll('.project-card').forEach(card => {
        card.classList.remove('selected');
    });
    
        // Выделяем выбранную карточку
    const selectedCard = document.querySelector(`[data-project="${project}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Показываем выбор города/области
    const citySelection = document.getElementById('citySelection');
    const backToProjectBtn = document.getElementById('backToProjectBtn');
    const continueBtn = document.getElementById('continueBtn');
    
    if (citySelection && backToProjectBtn && continueBtn) {
        citySelection.style.display = 'block';
        backToProjectBtn.style.display = 'inline-block';
        continueBtn.disabled = true;
        continueBtn.textContent = 'Начать работу';
    }
    
    // Сбрасываем обработчик кнопки
    if (continueBtn) {
        continueBtn.onclick = null;
    }
    
    // Обновляем заголовок в зависимости от проекта
    const citySelectionTitle = document.getElementById('citySelectionTitle');
    const citySearchInputElement = document.getElementById('citySearchInput');
    
    if (citySelectionTitle && citySearchInputElement) {
        if (project === 'magnet') {
            citySelectionTitle.innerHTML = '🏙️ Выберите область';
            citySearchInputElement.placeholder = 'Поиск области...';
        } else {
            citySelectionTitle.innerHTML = '🏙️ Выберите город';
            citySearchInputElement.placeholder = 'Поиск города...';
        }
    }
    
    // Очищаем предыдущие данные
    citiesData = [];
    const cityGrid = document.getElementById('cityGrid');
    if (cityGrid) {
        cityGrid.innerHTML = '';
    }
    
    // Добавляем обработчик поиска городов
    const citySearchInput = document.getElementById('citySearchInput');
    if (citySearchInput) {
        // Удаляем старый обработчик, если он есть
        if (citySearchInput._searchHandler) {
            citySearchInput.removeEventListener('input', citySearchInput._searchHandler);
        }
        
        // Создаем новый обработчик
        citySearchInput._searchHandler = (e) => filterCities(e.target.value);
        citySearchInput.addEventListener('input', citySearchInput._searchHandler);
    }
    
    // Загружаем города/области для выбранного проекта
    loadCitiesForProject(project).catch(error => {


    });
}

function backToProjectSelection() {
    selectedProject = null;
    selectedCity = null;
    
    // Закрываем правую панель при возврате к выбору проекта
    hideStoreInfo();
    
    // Скрываем выбор города/области
    document.getElementById('citySelection').style.display = 'none';
    document.getElementById('backToProjectBtn').style.display = 'none';
    document.getElementById('continueBtn').disabled = true;
    document.getElementById('continueBtn').textContent = 'Начать работу';
    
    // Сбрасываем обработчик кнопки
    const continueBtn = document.getElementById('continueBtn');
    continueBtn.onclick = null;
    
    // Убираем выделение с карточек
    document.querySelectorAll('.project-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Сбрасываем заголовок и placeholder
    const citySelectionTitle = document.getElementById('citySelectionTitle');
    if (citySelectionTitle) {
        citySelectionTitle.innerHTML = '🏙️ Выберите город';
    }
    document.getElementById('citySearchInput').placeholder = 'Поиск города...';
    
    // Очищаем поиск города
    document.getElementById('citySearchInput').value = '';
    filterCities('');
}



async function loadCitiesForProject(project) {
    if (!project) {
        return;
    }
    
    // Проверяем, не загружается ли уже проект
    if (isLoadingProject) {
        return;
    }
    
    // Проверяем кеш
    // Примечание: данные всех проектов уже загружены в кэш при инициализации
    if (projectDataCache.has(project)) {
        const cachedData = projectDataCache.get(project);
        citiesData = cachedData.cities;
        displayCities(citiesData);
        

        
        return;
    }
    
    // Устанавливаем флаг загрузки
    isLoadingProject = true;
    
    try {
        // Загружаем данные из Google таблиц
        const { storesData, citiesData: projectCities } = await loadDataFromGoogleSheets(project);
        
        if (projectCities && projectCities.length > 0) {
            citiesData = projectCities;
            displayCities(citiesData);
            
            // Кэш уже заполнен в loadDataFromGoogleScript, дополнительно сохранять не нужно
        } else {
            loadTestCities(project);
        }
        
    } catch (error) {
        loadTestCities(project);
    } finally {
        // Сбрасываем флаг загрузки
        isLoadingProject = false;
    }
}

// Загрузка данных из Google Apps Script
function loadDataFromGoogleScript(scriptUrl, project) {
    return new Promise((resolve, reject) => {
        // Список всех листов для загрузки (кроме "Магнит Тариф")
        const allSheets = ['lenta', 'magnet', 'vkusvill'];
        const loadedData = {};
        let completedSheets = 0;
        
        // Функция для обработки загрузки одного листа
        const loadSheet = (sheetName) => {
            const callbackName = 'callback_' + Math.random().toString(36).substr(2, 9);
            const url = `${scriptUrl}?sheet=${sheetName}&callback=${callbackName}`;
            
            // Устанавливаем таймаут для запроса
            const timeout = setTimeout(() => {
                loadedData[sheetName] = [];
                completedSheets++;
                delete window[callbackName];
                checkCompletion();
            }, 30000);
            
            window[callbackName] = function(data) {
                clearTimeout(timeout);
                loadedData[sheetName] = data || [];
                completedSheets++;
                delete window[callbackName];
                checkCompletion();
            };
            
            const script = document.createElement('script');
            script.src = url;
            script.onerror = () => {
                clearTimeout(timeout);
                loadedData[sheetName] = [];
                completedSheets++;
                delete window[callbackName];
                checkCompletion();
            };
            
            document.head.appendChild(script);
        };
        
        // Функция для проверки завершения загрузки всех листов
        const checkCompletion = () => {
            if (completedSheets === allSheets.length) {
                // Сохраняем все загруженные данные в кэш
                allSheets.forEach(sheetName => {
                    if (loadedData[sheetName] && loadedData[sheetName].length > 0) {
                        // Извлекаем уникальные города/области с координатами для каждого листа
                        const cities = extractUniqueCities(loadedData[sheetName], sheetName);
                        
                        // Сохраняем в кэш
                        projectDataCache.set(sheetName, {
                            cities: cities,
                            stores: loadedData[sheetName],
                            timestamp: Date.now()
                        });
                    } else {
                        // Сохраняем пустые данные в кэш
                        projectDataCache.set(sheetName, {
                            cities: [],
                            stores: [],
                            timestamp: Date.now()
                        });
                    }
                });
                
                // Возвращаем данные для запрошенного проекта
                const requestedData = loadedData[project] || [];
                resolve(requestedData);
            }
        };
        
        // Загружаем все листы параллельно
        allSheets.forEach(sheetName => {
            loadSheet(sheetName);
        });
    });
}

// Извлечение уникальных городов/областей с координатами
function extractUniqueCities(rawData, project) {
    const field = project === 'magnet' ? 'area' : 'city';
    const locations = new Map();
    
    rawData.forEach((item, index) => {
        const value = item[field];
        if (value && value !== 'Не указан' && value !== 'Не указана' && value !== '') {
            const trimmedValue = value.trim();
            
            if (!locations.has(trimmedValue)) {
                let coordinates = null;
                
                if (item.coordinates) {
                    const coords = item.coordinates.split(',').map(coord => parseFloat(coord.trim()));
                    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                        coordinates = coords;
                    }
                }
                
                locations.set(trimmedValue, {
                    name: trimmedValue,
                    coordinates: coordinates,
                    storeCount: 0
                });
            }
            
            const location = locations.get(trimmedValue);
            location.storeCount++;
        }
    });
    
    return Array.from(locations.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Загрузка тестовых данных (fallback)
function loadTestCities(project) {
    const testLocations = {
        lenta: [
            'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
            'Нижний Новгород', 'Челябинск', 'Самара', 'Ростов-на-Дону', 'Уфа',
            'Волгоград', 'Пермь', 'Воронеж', 'Краснодар', 'Саратов'
        ],
        magnet: [
            'Московская область', 'Ленинградская область', 'Краснодарский край', 'Волгоградская область', 'Ростовская область',
            'Самарская область', 'Республика Башкортостан', 'Пермский край', 'Воронежская область', 'Саратовская область',
            'Тюменская область', 'Удмуртская Республика', 'Алтайский край', 'Ульяновская область', 'Иркутская область'
        ],
        vkusvill: [
            'Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск', 'Казань',
            'Нижний Новгород', 'Челябинск', 'Самара', 'Ростов-на-Дону', 'Уфа',
            'Волгоград', 'Пермь', 'Воронеж', 'Краснодар', 'Саратов'
        ]
    };
    
    citiesData = testLocations[project] || [];
    displayCities(citiesData);
}

function displayCities(cities) {
    const cityGrid = document.getElementById('cityGrid');
    if (!cityGrid) {
        return;
    }
    
    cityGrid.innerHTML = '';
    
    if (!cities || cities.length === 0) {
        cityGrid.innerHTML = '<div class="no-cities">Нет доступных городов для выбранного проекта</div>';
        return;
    }
    
    let createdCount = 0;
    cities.forEach((city, index) => {
        const cityItem = document.createElement('div');
        cityItem.className = 'city-item';
        
        // Проверяем, является ли city объектом или строкой
        if (typeof city === 'object' && city.name) {
            cityItem.textContent = city.name;
        } else {
            cityItem.textContent = city;
        }
        
        // Добавляем обработчик клика
        cityItem.addEventListener('click', (event) => {
            selectCity(city, event);
        });
        
        cityGrid.appendChild(cityItem);
        createdCount++;
    });
}

// Показать индикатор загрузки
function showLoadingIndicator(message = 'Загружаем города...') {
    const cityGrid = document.getElementById('cityGrid');
    if (cityGrid) {
        // Скрываем сетку городов
        cityGrid.style.display = 'none';
        
        // Создаем контейнер для индикатора загрузки поверх сетки
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        
        // Добавляем индикатор загрузки в родительский контейнер
        const citySelection = document.getElementById('citySelection');
        if (citySelection) {
            citySelection.appendChild(loadingOverlay);
        }
    }
}

// Скрыть индикатор загрузки
function hideLoadingIndicator() {
    const cityGrid = document.getElementById('cityGrid');
    if (cityGrid) {
        // Показываем сетку городов обратно
        cityGrid.style.display = 'grid';
    }
    
    // Удаляем индикатор загрузки
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

function selectCity(city, event) {
    // ВАЖНО: Если selectedProject равен null, пытаемся восстановить его
    if (!selectedProject) {
        // Пытаемся найти активный проект по выделенной карточке
        const activeProjectCard = document.querySelector('.project-card.selected');
        if (activeProjectCard) {
            const projectName = activeProjectCard.dataset.project;
            selectedProject = projectName;
        } else {
            return;
        }
    }
    
    // Обновляем выбранный город
    // Проверяем, является ли city объектом или строкой
    if (typeof city === 'object' && city.name) {
        selectedCity = city.name;
    } else {
        selectedCity = city;
    }
    
    // Убираем выделение со всех городов
    document.querySelectorAll('.city-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Выделяем выбранный город
    if (event && event.target) {
        event.target.classList.add('selected');
    }
    
    // Активируем кнопку "Начать работу"
    const continueBtn = document.getElementById('continueBtn');
    if (!continueBtn) {
        return;
    }
    
    continueBtn.disabled = false;
    continueBtn.textContent = 'Начать работу';
    
    // Добавляем обработчик для кнопки "Начать работу"
    continueBtn.onclick = function() {
        // Показываем индикатор загрузки на кнопке
        continueBtn.disabled = true;
        continueBtn.innerHTML = '<span class="loading-spinner-small"></span> Инициализируем карту...';
        
        loadProjectDataForMap();
    };
}

function filterCities(searchTerm) {
    const filteredCities = citiesData.filter(city => {
        // Проверяем, является ли city объектом или строкой
        const cityName = typeof city === 'object' && city.name ? city.name : city;
        return cityName.toLowerCase().includes(searchTerm.toLowerCase());
    });
    displayCities(filteredCities);
}

async function loadProjectDataForMap() {
    // Проверяем, не выполняется ли уже загрузка
    if (isLoadingProjectData) {
        return;
    }
    
    // Устанавливаем флаг загрузки
    isLoadingProjectData = true;
    
    // Получаем ссылку на кнопку
    const continueButton = document.getElementById('continueBtn');
    
    try {
        // Восстанавливаем кнопку "Начать работу"
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.textContent = 'Начать работу';
        }
        

        
        if (!selectedProject || !selectedCity) {
    
            return;
        }
        
        // Сохраняем выбранные настройки
        localStorage.setItem('selectedProject', selectedProject);
        localStorage.setItem('selectedCity', selectedCity);
        
        // Скрываем модальное окно
        hideProjectModal();
        
        // Обновляем информацию о проекте в левой панели
        updateProjectInfo();
        
        // Проверяем кеш для данных проекта
        // Примечание: данные всех проектов уже загружены в кэш при инициализации
        let storesData, projectCities;
        
        if (projectDataCache.has(selectedProject)) {
            const cachedData = projectDataCache.get(selectedProject);
            storesData = cachedData.stores;
            projectCities = cachedData.cities;
            
        } else {
            // Загружаем данные из всех листов (данные автоматически сохраняются в кэше)
            const result = await loadDataFromGoogleSheets(selectedProject);
            storesData = result.storesData;
            projectCities = result.citiesData;
        }
        
        if (storesData.length === 0) {
    
            return;
        }
        
        // Обновляем сообщение загрузки
        showLoading(true, `Центрируем карту на ${selectedCity}...`);
        
        // Обновляем текст кнопки
        if (continueButton) {
            continueButton.innerHTML = '<span class="loading-spinner-small"></span> Центрируем карту...';
        }
        
        // Центрируем карту на выбранном городе/области
        centerMapOnCity(selectedCity);
        
        // Небольшая задержка для плавности
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Показываем уведомление с правильными названиями
        const projectName = getProjectDisplayName(selectedProject);
        const locationType = selectedProject === 'magnet' ? 'области' : 'города';

        
        // Загружаем данные для выбранного проекта и города/области
        loadProjectDataForCity(selectedProject, selectedCity);
        
        // Обновляем текст кнопки на завершение
        if (continueButton) {
            continueButton.innerHTML = '<span class="loading-spinner-small"></span> Готово!';
            setTimeout(() => {
                continueButton.disabled = false;
                continueButton.textContent = 'Начать работу';
            }, 1000);
        }
        
        // Скрываем индикатор загрузки
        showLoading(false);
        
    } catch (error) {


        // Скрываем индикатор загрузки при ошибке
        showLoading(false);
    } finally {
        // Сбрасываем флаг загрузки
        isLoadingProjectData = false;
    }
}

// Функция для загрузки данных проекта для конкретного города/области
async function loadProjectDataForCity(project, city) {
    try {
        // Получаем координаты выбранного города/области
        const cityData = findCityCoordinates(city);
        if (!cityData || !cityData.coordinates) {
            console.error('Координаты города не найдены');
            return;
        }

        // Загружаем данные всех проектов и отображаем магазины по координатам
        await createAllProjectMarkersByCoordinates(cityData.coordinates, city);
    } catch (error) {
        console.error('Ошибка загрузки данных проекта:', error);
    }
}

// Функция создания меток для всех проектов по координатам
async function createAllProjectMarkersByCoordinates(cityCoordinates, cityName) {
    try {
        // Очищаем существующие метки
        clearMapMarkers();
        
        // Радиус поиска в километрах (можно настроить)
        const searchRadius = 100; // 100 км радиус поиска
        
        // Получаем данные всех проектов из кэша
        const allProjects = ['lenta', 'magnet', 'vkusvill'];
        let totalStores = 0;
        let processedStores = 0;
        
        // Сначала подсчитываем общее количество магазинов для прогресса
        for (const project of allProjects) {
            if (projectDataCache.has(project)) {
                const projectData = projectDataCache.get(project);
                const stores = projectData.stores || [];
                
                // Фильтруем магазины по координатам
                const nearbyStores = stores.filter(store => {
                    if (!store.coordinates) return false;
                    
                    const coords = store.coordinates.split(',').map(coord => parseFloat(coord.trim()));
                    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return false;
                    
                    const distance = calculateDistance(cityCoordinates, coords);
                    return distance <= searchRadius;
                });
                
                totalStores += nearbyStores.length;
            }
        }
        
        if (totalStores === 0) {
            showLoading(false);
            return;
        }
        
        // Показываем индикатор загрузки
        showLoading(true, `Загрузка магазинов: 0 из ${totalStores}`);
        
        // Обрабатываем каждый проект
        for (const project of allProjects) {
            if (!projectDataCache.has(project)) continue;
            
            const projectData = projectDataCache.get(project);
            const stores = projectData.stores || [];
            
            // Фильтруем магазины по координатам
            const nearbyStores = stores.filter(store => {
                if (!store.coordinates) return false;
                
                const coords = store.coordinates.split(',').map(coord => parseFloat(coord.trim()));
                if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return false;
                
                const distance = calculateDistance(cityCoordinates, coords);
                return distance <= searchRadius;
            });
            
            // Группируем магазины по адресу для каждого проекта
            const storesByAddress = new Map();
            
            for (const store of nearbyStores) {
                if (store.fullAddress) {
                    const key = `${store.fullAddress}_${project}`;
                    if (!storesByAddress.has(key)) {
                        storesByAddress.set(key, { stores: [], address: store.fullAddress, project: project });
                    }
                    storesByAddress.get(key).stores.push(store);
                }
            }
            
            // Создаем метки для каждого уникального адреса
            for (const [key, storeGroup] of storesByAddress) {
                processedStores++;
                showLoading(true, `Загрузка магазинов: ${processedStores} из ${totalStores}`);
                
                // Геокодируем адрес
                const coordinates = await geocodeFullAddress(storeGroup.address);
                
                if (coordinates) {
                    // Создаем метку на карте с группированными данными
                    createStoreMarker(coordinates, storeGroup, project);
                }
            }
        }
        
        // Скрываем индикатор загрузки
        showLoading(false);
        
    } catch (error) {
        console.error('Ошибка создания меток по координатам:', error);
        showLoading(false);
    }
}

// Функция создания меток для проекта "Лента"
async function createLentaMarkers(selectedCity) {
    try {

        
        // Получаем данные из кэша
        if (!projectDataCache.has('lenta')) {
            return;
        }
        
        const lentaData = projectDataCache.get('lenta');
        const stores = lentaData.stores;
        
        if (!stores || stores.length === 0) {
            return;
        }
        
        // Фильтруем магазины по выбранному городу
        const cityStores = stores.filter(store => {
            return store.city && store.city.toLowerCase() === selectedCity.toLowerCase();
        });
        

        
        // Очищаем существующие метки
        clearMapMarkers();
        
        // Группируем магазины по адресу
        const storesByAddress = new Map();
        
        for (const store of cityStores) {
            if (store.fullAddress) {
                if (!storesByAddress.has(store.fullAddress)) {
                    storesByAddress.set(store.fullAddress, []);
                }
                storesByAddress.get(store.fullAddress).push(store);
            }
        }
    
        // Создаем метки для каждого уникального адреса
        const totalAddresses = storesByAddress.size;
        let processedAddresses = 0;
        
        // Показываем индикатор загрузки адресов
        showLoading(true, `Загрузка адресов: 0 из ${totalAddresses}`);
        
        for (const [address, stores] of storesByAddress) {
            // Обновляем прогресс
            processedAddresses++;
            showLoading(true, `Загрузка адресов: ${processedAddresses} из ${totalAddresses}`);
            
            // Геокодируем адрес через нашу универсальную функцию
            const coordinates = await geocodeFullAddress(address);
            
            if (coordinates) {
                // Создаем метку на карте с группированными данными
                createStoreMarker(coordinates, { stores, address }, 'lenta');
                    }
        }
        
        // Скрываем индикатор загрузки после завершения
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
    }
}

// Функция создания меток для проекта "Магнит"
async function createMagnetMarkers(selectedArea) {
    try {
        // Получаем данные из кэша
        if (!projectDataCache.has('magnet')) {
            return;
        }
        
        const magnetData = projectDataCache.get('magnet');
        const stores = magnetData.stores;
        
        if (!stores || stores.length === 0) {
            return;
        }
        
        // Фильтруем магазины по выбранной области
        const areaStores = stores.filter(store => {
            return store.area && store.area.toLowerCase() === selectedArea.toLowerCase();
        });
        
        // Очищаем существующие метки
        clearMapMarkers();
        
        // Группируем магазины по адресу
        const storesByAddress = new Map();
        
        for (const store of areaStores) {
            if (store.fullAddress) {
                if (!storesByAddress.has(store.fullAddress)) {
                    storesByAddress.set(store.fullAddress, []);
                }
                storesByAddress.get(store.fullAddress).push(store);
            }
        }
    
        // Создаем метки для каждого уникального адреса
        const totalAddresses = storesByAddress.size;
        let processedAddresses = 0;
        
        // Показываем индикатор загрузки адресов
        showLoading(true, `Загрузка адресов: 0 из ${totalAddresses}`);
        
        for (const [address, stores] of storesByAddress) {
            // Обновляем прогресс
            processedAddresses++;
            showLoading(true, `Загрузка адресов: ${processedAddresses} из ${totalAddresses}`);
            
            // Геокодируем адрес через нашу универсальную функцию
            const coordinates = await geocodeFullAddress(address);
            
            if (coordinates) {
                // Создаем метку на карте с группированными данными
                createStoreMarker(coordinates, { stores, address }, 'magnet');
            }
        }
        
        // Скрываем индикатор загрузки после завершения
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
    }
}

// Функция создания меток для проекта "ВкусВилл"
async function createVkusvillMarkers(selectedCity) {
    try {
        // Получаем данные из кэша
        if (!projectDataCache.has('vkusvill')) {
            return;
        }
        
        const vkusvillData = projectDataCache.get('vkusvill');
        const stores = vkusvillData.stores;
        
        if (!stores || stores.length === 0) {
            return;
        }
        
        // Фильтруем магазины по выбранной области
        const areaStores = stores.filter(store => {
            return store.city && store.city.toLowerCase() === selectedCity.toLowerCase();
        });
        
        // Очищаем существующие метки
        clearMapMarkers();
        
        // Группируем магазины по адресу
        const storesByAddress = new Map();
        
        for (const store of areaStores) {
            if (store.fullAddress) {
                if (!storesByAddress.has(store.fullAddress)) {
                    storesByAddress.set(store.fullAddress, []);
                }
                storesByAddress.get(store.fullAddress).push(store);
            }
        }
    
        // Создаем метки для каждого уникального адреса
        const totalAddresses = storesByAddress.size;
        let processedAddresses = 0;
        
        // Показываем индикатор загрузки адресов
        showLoading(true, `Загрузка адресов: 0 из ${totalAddresses}`);
        
        for (const [address, stores] of storesByAddress) {
            // Обновляем прогресс
            processedAddresses++;
            showLoading(true, `Загрузка адресов: ${processedAddresses} из ${totalAddresses}`);
            
            // Геокодируем адрес через нашу универсальную функцию
            const coordinates = await geocodeFullAddress(address);
            
            if (coordinates) {
                // Создаем метку на карте с группированными данными
                createStoreMarker(coordinates, { stores, address }, 'vkusvill');
            }
        }
        
        // Скрываем индикатор загрузки после завершения
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
    }
}

// Функция очистки меток с карты
function clearMapMarkers() {
    if (map && map.geoObjects) {
        map.geoObjects.removeAll();
    }
}

// Функция создания метки магазина
function createStoreMarker(coordinates, storeData, projectType) {
    try {
        if (!map || !coordinates) {
            return;
        }
        
        // Определяем содержимое метки
        let iconContent = '🏪';
        let hintContent = storeData.address || storeData.fullAddress;
        
        // Добавляем информацию о проекте в подсказку
        const projectName = getProjectDisplayName(projectType);
        hintContent = `${projectName}\n${hintContent}`;
        
        if (storeData.stores && storeData.stores.length > 1) {
            // Если несколько вакансий - показываем количество
            iconContent = storeData.stores.length;
            hintContent = `${projectName}\n${storeData.stores.length} вакансий\n${storeData.address}`;
        } else if (storeData.vacancy) {
            // Если одна вакансия - показываем её
            iconContent = storeData.vacancy;
        }
        
        // Создаем метку в виде капельки
        const marker = new window.ymaps.Placemark([coordinates.lat, coordinates.lon], {
            // Содержимое метки
            iconContent: iconContent,
            hintContent: hintContent
        }, {
            // Стиль метки - капелька
            preset: 'islands#blueDotIcon',
            iconColor: getProjectColor(projectType)
        });
        
        // Добавляем метку на карту
        map.geoObjects.add(marker);
        
        // Добавляем обработчик клика на метку после добавления на карту
        marker.events.add('click', function() {
            showStoreInfo(storeData, projectType);
        });
        
    } catch (error) {
        // Ошибка не критична
    }
}

// Функция показа информации о магазине
function showStoreInfo(storeData, projectType) {
    try {
        // Проверяем существование элементов
        const storeTkElement = document.getElementById('storeTk');
        const storeAddressElement = document.getElementById('storeAddress');
        const storeDetailsElement = document.getElementById('storeDetails');
        const panel = document.getElementById('storeInfoPanel');
        
        if (!panel) {
            return;
        }
        
        // Заполняем заголовок магазина
        const projectName = getProjectDisplayName(projectType);
        
        if (storeData.stores && storeData.stores.length > 0) {
            const firstStore = storeData.stores[0];
            if (storeAddressElement) {
                storeAddressElement.textContent = `${projectName} - ${storeData.address}`;
            }
            if (storeTkElement) {
                if (projectType === 'magnet') {
                    storeTkElement.textContent = `Потребность: ${firstStore.need || '-'}`;
                } else if (projectType === 'vkusvill') {
                    // Для ВкусВилл не показываем ТК
                    storeTkElement.textContent = '';
                } else {
                    storeTkElement.textContent = `ТК: ${firstStore.tk || '-'}`;
                }
            }
        } else {
            if (storeAddressElement) {
                storeAddressElement.textContent = `${projectName} - ${storeData.address || storeData.fullAddress || '-'}`;
            }
            if (storeTkElement) {
                if (projectType === 'magnet') {
                    storeTkElement.textContent = `Потребность: ${storeData.need || '-'}`;
                } else if (projectType === 'vkusvill') {
                    // Для ВкусВилл не показываем ТК
                    storeTkElement.textContent = '';
                } else {
                    storeTkElement.textContent = `ТК: ${storeData.tk || '-'}`;
                }
            }
        }
        
        // Очищаем контейнер вакансий
        if (storeDetailsElement) {
            storeDetailsElement.innerHTML = '';
            
            // Добавляем вакансии
            const stores = storeData.stores || [storeData];
            stores.forEach((store, index) => {
                const vacancyItem = document.createElement('div');
                vacancyItem.className = 'detail-item';
                
                // Определяем тип проекта для отображения
                const isMagnet = projectType === 'magnet';
                const isVkusvill = projectType === 'vkusvill';
                
                if (isMagnet) {
                    // Для проекта Магнит создаем отдельный блок для каждого активного тарифа
                    let tariffBlocks = '';
                    
                    if (store.auto && store.auto.toLowerCase() === 'да' && store.tariffAuto !== '#N/A') {
                        const formattedTariff = (store.tariffAuto || '-').replace(/\n/g, '<br>');
                        tariffBlocks += `
                            <div class="detail-item">
                                <div class="vacancy-title">Авто</div>
                                <div class="vacancy-details">
                                    <div class="vacancy-detail">${formattedTariff}</div>
                                </div>
                            </div>
                        `;
                    }
                    
                    if (store.bike && store.bike.toLowerCase() === 'да' && store.tariffBike !== '#N/A') {
                        const formattedTariff = (store.tariffBike || '-').replace(/\n/g, '<br>');
                        tariffBlocks += `
                            <div class="detail-item">
                                <div class="vacancy-title">Вело</div>
                                <div class="vacancy-details">
                                    <div class="vacancy-detail">${formattedTariff}</div>
                                </div>
                            </div>
                        `;
                    }
                    
                    if (store.electroBike && store.electroBike.toLowerCase() === 'да' && store.tariffElectroBike !== '#N/A') {
                        const formattedTariff = (store.tariffElectroBike || '-').replace(/\n/g, '<br>');
                        tariffBlocks += `
                            <div class="detail-item">
                                <div class="vacancy-title">ЭлектроВело</div>
                                <div class="vacancy-details">
                                    <div class="vacancy-detail">${formattedTariff}</div>
                                </div>
                            </div>
                        `;
                    }
                    
                    if (store.pesh && store.pesh.toLowerCase() === 'да' && store.tariffPesh !== '#N/A') {
                        const formattedTariff = (store.tariffPesh || '-').replace(/\n/g, '<br>');
                        tariffBlocks += `
                            <div class="detail-item">
                                <div class="vacancy-title">Пеший</div>
                                <div class="vacancy-details">
                                    <div class="vacancy-detail">${formattedTariff}</div>
                                </div>
                            </div>
                        `;
                    }
                    
                    // Если есть активные тарифы, добавляем их в контейнер
                    if (tariffBlocks) {
                        storeDetailsElement.insertAdjacentHTML('beforeend', tariffBlocks);
                    } else {
                    }
                    
                    // Не создаем vacancyItem для Магнит, так как мы уже добавили блоки напрямую
                    return;
                } else if (isVkusvill) {
                    // Для проекта ВкусВилл показываем без ТК и с "Средний доход в день"
                    vacancyItem.innerHTML = `
                        <div class="vacancy-title">Вакансия ${index + 1}</div>
                        <div class="vacancy-details">
                            <div class="vacancy-detail"><strong>Вакансия:</strong> ${store.position || '-'}</div>
                            <div class="vacancy-detail"><strong>Потребность:</strong> ${store.need || '-'}</div>
                            <div class="vacancy-detail"><strong>Средний доход в день:</strong> ${store.income || '-'} руб.</div>
                        </div>
                    `;
                } else {
                    // Для других проектов (Лента) показываем как раньше
                    vacancyItem.innerHTML = `
                        <div class="vacancy-title">Вакансия ${index + 1}</div>
                        <div class="vacancy-details">
                            <div class="vacancy-detail"><strong>Вакансия:</strong> ${store.vacancy || '-'}</div>
                            <div class="vacancy-detail"><strong>Потребность:</strong> ${store.position || '-'}</div>
                            <div class="vacancy-detail"><strong>Тариф:</strong> ${store.tariff || '-'} руб.</div>
                        </div>
                    `;
                }
                
                storeDetailsElement.appendChild(vacancyItem);
            });
        }
        
        // Показываем панель
        panel.style.display = 'block';
        panel.classList.add('show');
    } catch (error) {
        // Ошибка не критична
    }
}

// Функция скрытия панели информации о магазине
function hideStoreInfo() {
    try {
        const panel = document.getElementById('storeInfoPanel');
        panel.classList.remove('show');
        // Скрываем панель после завершения анимации
                setTimeout(() => {
            panel.style.display = 'none';
        }, 300);    } catch (error) {
        // Ошибка не критична
    }
}

// Функция получения цвета для проекта
function getProjectColor(projectType) {
    const colors = {
        'lenta': '#45b7d1',      // Синий для Ленты
        'magnet': '#ff6b6b',     // Красный для Магнита
        'vkusvill': '#008000'    // Зеленый для ВкусВилла
    };
    
    return colors[projectType] || '#666666';
}

function getProjectDisplayName(project) {
    const projectNames = {
        'lenta': 'Лента',
        'magnet': 'Магнит',
        'vkusvill': 'ВкусВилл'
    };
    return projectNames[project] || project;
}

// Центрирование карты на выбранном городе/области
function centerMapOnCity(cityName) {
    if (!map || !cityName) {
        return;
    }

    try {
        // Ищем координаты в загруженных данных
        const cityData = findCityCoordinates(cityName);
        
        if (cityData && cityData.coordinates) {
            // Центрируем карту на городе/области с плавной анимацией
            map.setCenter(cityData.coordinates, 10, {
                duration: 800,
                timingFunction: 'ease'
            });
            

            return;
        }
        
        // Используем Москву как fallback
        const moscowCoords = [55.7558, 37.6176];
        map.setCenter(moscowCoords, 10);
        
    } catch (error) {
        const moscowCoords = [55.7558, 37.6176];
        map.setCenter(moscowCoords, 10);
    }
}

// Функция для поиска координат города в загруженных данных
function findCityCoordinates(cityName) {
    // Ищем город/область в текущих данных
    const cityData = citiesData.find(city => city.name === cityName);
    
    if (cityData && cityData.coordinates) {
        return cityData;
    }
    
    return null;
}

// Добавление метки города на карту
function addCityMarker(coords, cityName) {
    if (!map || !window.ymaps || !window.ymaps.Placemark) {
        return;
    }
    
    try {
        // Удаляем предыдущую метку города, если есть
        if (window.cityMarker) {
            map.geoObjects.remove(window.cityMarker);
        }
        
        // Создаем новую метку
        const marker = new window.ymaps.Placemark(coords, {
            balloonContent: `<strong>${cityName}</strong><br>Выбранный город`
        }, {
            preset: 'islands#blueDotIcon',
            iconColor: '#3b82f6'
        });
        
        // Добавляем метку на карту
        map.geoObjects.add(marker);
        window.cityMarker = marker;
        
    } catch (error) {
        // Ошибка не критична
    }
}

// Обновление информации о проекте в левой панели
function updateProjectInfo() {
    const projectInfo = document.getElementById('currentProjectInfo');
    const changeProjectBtn = document.getElementById('changeProjectBtn');
    const updateCacheBtn = document.getElementById('updateCacheBtn');
    
    if (!projectInfo || !changeProjectBtn || !updateCacheBtn) {
        return;
    }
    
    if (selectedProject && selectedCity) {
        const projectName = getProjectDisplayName(selectedProject);
        const locationType = selectedProject === 'magnet' ? 'области' : 'города';
        
        projectInfo.innerHTML = `
            <div class="project-name">Все проекты</div>
            <div class="city-name">${locationType}: ${selectedCity}</div>
            <div class="project-note">Показываются магазины всех проектов в радиусе 100 км</div>
        `;
        
        changeProjectBtn.style.display = 'inline-block';
        updateCacheBtn.style.display = 'inline-block';
    } else {
        projectInfo.innerHTML = '<p>Проект не выбран</p>';
        changeProjectBtn.style.display = 'none';
        updateCacheBtn.style.display = 'none';
    }
}

// Создание простого маршрута по прямой линии
function createSimpleRoute(startCoords, endCoords) {
    const distance = calculateDistance(startCoords, endCoords);
    const duration = calculateDuration(startCoords, endCoords);
   
    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {
                summary: {
                    distance: distance,
                    duration: duration
                }
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [startCoords[1], startCoords[0]], // [lon, lat]
                    [endCoords[1], endCoords[0]]
                ]
            }
        }]
    };
}

// Расчет расстояния между двумя точками (формула гаверсинуса)
function calculateDistance(coord1, coord2) {
    const R = 6371; // Радиус Земли в км
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Расчет примерного времени в пути (60 км/ч)
function calculateDuration(coord1, coord2) {
    const distance = calculateDistance(coord1, coord2);
    const speed = 60; // км/ч
    return distance / speed; // часы
}

// Умное построение маршрута с автоматическим переключением API
async function buildRouteSmart(startCoords, endCoords, profile) {
    // Используем простой маршрут по прямой линии (без внешних API)
    // Это избегает проблем с CORS и API ключами
    return createSimpleRoute(startCoords, endCoords);
}

// Геокодирование адреса через Nominatim (OpenStreetMap, бесплатно)
async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=ru&addressdetails=1&accept-language=ru`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'MapApp/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const result = data[0];
            const coords = [parseFloat(result.lat), parseFloat(result.lon)];
            return coords;
        } else {
            return null;
        }
        
    } catch (error) {

        return null;
    }
}

// Универсальная функция геокодирования через API Яндекс.Карт для fullAddress
async function geocodeFullAddress(fullAddress) {
    try {
        if (!fullAddress || fullAddress.trim() === '') {
            return null;
        }
        
        if (!window.ymaps || !window.ymaps.geocode) {
    
            return await geocodeAddress(fullAddress);
        }
        
        // Используем API Яндекс.Карт для геокодирования
        const result = await window.ymaps.geocode(fullAddress, {
            results: 1,
            kind: 'house'
        });
        
        if (result.geoObjects.getLength() > 0) {
            const geoObject = result.geoObjects.get(0);
            const coords = geoObject.geometry.getCoordinates();
            
            return {
                lat: coords[0],
                lon: coords[1],
                address: geoObject.getAddressLine()
            };
        }
        
        return null;
        
    } catch (error) {

        // Fallback на Nominatim
        return await geocodeAddress(fullAddress);
    }
}

// Построение маршрута (основная функция)
async function buildRoute() {
    const startPoint = DOMCache.startPoint.value.trim();
    const endPoint = DOMCache.endPoint.value.trim();

    if (!startPoint || !endPoint) {
        showError('Укажите начальную и конечную точки');
        return;
    }

    if (!map) {
        showError('Карта не загружена');
        return;
    }

    try {
        // Получаем координаты через Nominatim
        const startCoords = await geocodeAddress(startPoint);
        const endCoords = await geocodeAddress(endPoint);

        if (!startCoords || !endCoords) {
            showError('Не удалось найти координаты для указанных адресов');
            return;
        }

        // Определяем профиль маршрутизации
        const profile = 'driving-car'; // По умолчанию

        // Строим маршрут
        const routeData = await buildRouteSmart(startCoords, endCoords, profile);

        if (!routeData || !routeData.features || routeData.features.length === 0) {
            showError('Не удалось построить маршрут');
            return;
        }

        const route = routeData.features[0];
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // [lat, lon]

        // Очищаем старые маршруты через сохраненные ссылки
        if (currentRouteLine) {
            map.geoObjects.remove(currentRouteLine);
            currentRouteLine = null;
        }
        
        if (currentStartMarker) {
            map.geoObjects.remove(currentStartMarker);
            currentStartMarker = null;
        }
        
        if (currentEndMarker) {
            map.geoObjects.remove(currentEndMarker);
            currentEndMarker = null;
        }

        // Добавляем маркеры точек на Яндекс.Карту
        currentStartMarker = new window.ymaps.Placemark(startCoords, { 
            iconContent: 'A', 
            hintContent: startPoint,
            preset: 'islands#blueDotIcon'
        });
        currentEndMarker = new window.ymaps.Placemark(endCoords, { 
            iconContent: 'B', 
            hintContent: endPoint,
            preset: 'islands#redDotIcon'
        });

        // Добавляем линию маршрута на Яндекс.Карту
        currentRouteLine = new window.ymaps.Polyline(coordinates, {
            strokeColor: '#3b82f6',
            strokeWidth: 6,
            strokeOpacity: 0.9
        });

        map.geoObjects.add(currentStartMarker);
        map.geoObjects.add(currentEndMarker);
        map.geoObjects.add(currentRouteLine);

        // Подстраиваем карту под маршрут
        try {
            const bounds = routeLine.geometry.getBounds();
            if (bounds) {
                map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 50 });
            }
        } catch (boundsError) {
            // Центрируем карту на середине маршрута
            const centerLat = (startCoords[0] + endCoords[0]) / 2;
            const centerLon = (startCoords[1] + endCoords[1]) / 2;
            map.setCenter([centerLat, centerLon], 12);
        }

        // Показываем информацию о маршруте
        const distance = route.properties.summary.distance;
        const duration = route.properties.summary.duration;

        if (distance && duration) {
            displayRouteInfo({
                distance: Math.round(distance * 10) / 10,
                duration: Math.round(duration * 10) / 10
            });
        }

        // Кнопка Яндекс.Карт теперь всегда видна



    } catch (error) {

    }
}

// Отображение информации о маршруте
function displayRouteInfo(route) {
    const routeInfo = DOMCache.routeInfo;
    if (routeInfo) {
        routeInfo.innerHTML = `
            <div class="route-info">
                <h3>Информация о маршруте</h3>
                <p><strong>Расстояние:</strong> ${route.distance} км</p>
                <p><strong>Время в пути:</strong> ${route.duration} ч</p>
            </div>
        `;
        routeInfo.style.display = 'block';
    }
}

// Функция для установки магазина как точки маршрута
function setStoreAsRoutePoint(pointType) {
    try {
        // Получаем адрес из правой панели
        const storeAddressElement = document.getElementById('storeAddress');
        if (!storeAddressElement) {
    
            return;
        }
        
        const storeAddress = storeAddressElement.textContent.trim();
        if (!storeAddress || storeAddress === '-') {

            return;
        }
        
        // Определяем поле ввода в зависимости от типа точки
        const inputFieldId = pointType === 'start' ? 'startPoint' : 'endPoint';
        const inputField = document.getElementById(inputFieldId);
        
        if (!inputField) {

            return;
        }
        
        // Устанавливаем адрес в поле ввода
        inputField.value = storeAddress;
        
        // Показываем уведомление
        const pointName = pointType === 'start' ? 'начальной' : 'конечной';

        
        // Фокусируемся на поле ввода для удобства пользователя
        inputField.focus();
        
    } catch (error) {


    }
}

// Функция для установки найденного адреса как точки маршрута
function setSearchLocationAsRoutePoint(pointType, address) {
    try {
        // Определяем поле ввода в зависимости от типа точки
        const inputFieldId = pointType === 'start' ? 'startPoint' : 'endPoint';
        const inputField = document.getElementById(inputFieldId);
        
        if (!inputField) {

            return;
        }
        
        // Устанавливаем адрес в поле ввода
        inputField.value = address;
        
        // Показываем уведомление
        const pointName = pointType === 'start' ? 'начальной' : 'конечной';

        
        // Фокусируемся на поле ввода для удобства пользователя
        inputField.focus();
        
        // Закрываем информационное окно маркера
        if (currentSearchMarker && currentSearchMarker.balloon) {
            currentSearchMarker.balloon.close();
        }
        
    } catch (error) {


    }
}

// Делаем функцию доступной глобально для вызова из HTML
window.setSearchLocationAsRoutePoint = setSearchLocationAsRoutePoint;
