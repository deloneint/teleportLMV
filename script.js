let map = null;
let selectedProject = null;
let selectedCity = null;
let citiesData = [];
let isModalOpen = false;
let isSingleProjectMode = false;
let statusSubscription = null; // Подписка на изменения статуса пользователя 


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
    loading: null,
    projectModeSwitch: null
};

let projectDataCache = new Map();
let isLoadingProject = false;
let isLoadingData = false; 
let isLoadingProjectData = false; 

let currentRouteLine = null;
let currentStartMarker = null;
let currentEndMarker = null;

let currentSearchMarker = null;

let markerPositions = new Map();

function getOffsetCoordinates(originalLat, originalLon) {
    const key = `${originalLat.toFixed(6)},${originalLon.toFixed(6)}`;
    
    if (!markerPositions.has(key)) {
        markerPositions.set(key, []);
    }
    
    const markersAtPosition = markerPositions.get(key);
    const offsetDistance = 0.0005; 
    
    if (markersAtPosition.length === 0) {
        markersAtPosition.push({ lat: originalLat, lon: originalLon });
        return { lat: originalLat, lon: originalLon };
    }
    
    const angle = (markersAtPosition.length * 60) * (Math.PI / 180); 
    const offsetLat = originalLat + offsetDistance * Math.cos(angle);
    const offsetLon = originalLon + offsetDistance * Math.sin(angle);
    
    markersAtPosition.push({ lat: offsetLat, lon: offsetLon });
    
    return { lat: offsetLat, lon: offsetLon };
}

async function preloadAllProjectData() {
    try {
        await loadDataFromGoogleScript(CONFIG.googleScript.url, 'lenta');
        startAutoCacheUpdate();
    } catch (error) {
        console.error('Ошибка в preloadAllProjectData:', error);
    }
}

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
        }
    }, CACHE_UPDATE_INTERVAL);
}

async function updateCache() {
    try {
        await loadDataFromGoogleScript(CONFIG.googleScript.url, 'lenta');
    } catch (error) {
    }
}

async function forceUpdateCache() {
    const updateCacheBtn = document.getElementById('updateCacheBtn');

    try {
        if (updateCacheBtn) {
            updateCacheBtn.disabled = true;
            updateCacheBtn.innerHTML = '⏳ Обновляем...';
        }
        showLoading(true, 'Загружаем данные всех проектов...');

        projectDataCache.clear();

        clearAllCache();
        
        await loadDataFromGoogleScript(CONFIG.googleScript.url, 'lenta');

        showLoading(false);
        
        showNotification('Данные обновлены', 'success');
    } catch (error) {
        showLoading(false);
        showNotification('Ошибка обновления данных', 'error');
    } finally {
        if (updateCacheBtn) {
            updateCacheBtn.disabled = false;
            updateCacheBtn.innerHTML = '🔄 Обновить данные';
        }
    }
}

window.forceUpdateCache = forceUpdateCache;


async function loadDataFromGoogleSheets(project) {
    
    if (isLoadingData) {
        return { storesData: [], citiesData: [] };
    }

    const cachedData = getCachedData(project);
    if (cachedData) {
        window.storesData = cachedData.storesData;
        citiesData = cachedData.citiesData;
        return cachedData;
    }
    
    isLoadingData = true;
    
    showLoading(true, `Загружаем данные всех проектов...`);
    
    try {
        
        const rawData = await loadDataFromGoogleScript(CONFIG.googleScript.url, project);
        
        if (rawData && rawData.length > 0) {
            const cities = extractUniqueCities(rawData, project);
            const result = { storesData: rawData, citiesData: cities };
            
            setCachedData(project, result);
            
            window.storesData = rawData;
            citiesData = cities;
            
            return result;
        } else {
            return { storesData: [], citiesData: [] };
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных из Google таблиц:', error);
        return { storesData: [], citiesData: [] };
    } finally {
        showLoading(false);
        isLoadingData = false;
    }
}

// Кэш для геокодирования
const geocodingCache = new Map();

function getCachedGeocoding(address) {
    try {
        const cached = localStorage.getItem(`geocoding_${address}`);
        if (cached) {
            const data = JSON.parse(cached);
            const age = Date.now() - data.timestamp;
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней
            
            if (age < maxAge) {
                return data.coordinates;
            } else {
                localStorage.removeItem(`geocoding_${address}`);
            }
        }
    } catch (error) {
        console.error('Ошибка чтения кэша геокодирования:', error);
        localStorage.removeItem(`geocoding_${address}`);
    }
    return null;
}

function setCachedGeocoding(address, coordinates) {
    try {
        localStorage.setItem(`geocoding_${address}`, JSON.stringify({
            coordinates: coordinates,
            timestamp: Date.now()
        }));
    } catch (error) {
        console.error('Ошибка записи кэша геокодирования:', error);
        clearOldGeocodingCache();
        try {
            localStorage.setItem(`geocoding_${address}`, JSON.stringify({
                coordinates: coordinates,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('Не удалось сохранить в кэш геокодирования:', e);
        }
    }
}

function clearOldGeocodingCache() {
    try {
        const keys = Object.keys(localStorage);
        const geocodingKeys = keys.filter(key => key.startsWith('geocoding_'));
        
        const sortedKeys = geocodingKeys.map(key => ({
            key,
            timestamp: JSON.parse(localStorage.getItem(key)).timestamp
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        const keysToRemove = sortedKeys.slice(0, Math.floor(sortedKeys.length / 2));
        keysToRemove.forEach(item => {
            localStorage.removeItem(item.key);
        });
        
    } catch (error) {
        console.error('Ошибка очистки кэша геокодирования:', error);
    }
}

function clearAllGeocodingCache() {
    try {
        const keys = Object.keys(localStorage);
        const geocodingKeys = keys.filter(key => key.startsWith('geocoding_'));
        geocodingKeys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
        console.error('Ошибка очистки кэша геокодирования:', error);
    }
}

function getCachedData(project) {
    try {
        const cached = localStorage.getItem(`project_data_${project}`);
        if (cached) {
            const data = JSON.parse(cached);
            const age = Date.now() - data.timestamp;
            const maxAge = 30 * 60 * 1000; // 30 минут
            
            if (age < maxAge) {
                return data.data;
            } else {
                localStorage.removeItem(`project_data_${project}`);
            }
        }
    } catch (error) {
        console.error('Ошибка чтения кэша:', error);
        localStorage.removeItem(`project_data_${project}`);
    }
    return null;
}

function setCachedData(project, data) {
    try {
        localStorage.setItem(`project_data_${project}`, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
    } catch (error) {
        console.error('Ошибка записи кэша:', error);
        clearOldCache();
        try {
            localStorage.setItem(`project_data_${project}`, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('Не удалось сохранить в кэш:', e);
        }
    }
}

function clearOldCache() {
    try {
        const keys = Object.keys(localStorage);
        const projectKeys = keys.filter(key => key.startsWith('project_data_'));
        
        const sortedKeys = projectKeys.sort((a, b) => {
            const dataA = JSON.parse(localStorage.getItem(a));
            const dataB = JSON.parse(localStorage.getItem(b));
            return dataA.timestamp - dataB.timestamp;
        });
        
        const keysToRemove = sortedKeys.slice(0, Math.floor(sortedKeys.length / 2));
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
    } catch (error) {
        console.error('Ошибка очистки кэша:', error);
    }
}

function clearAllCache() {
    try {
        const keys = Object.keys(localStorage);
        const projectKeys = keys.filter(key => key.startsWith('project_data_'));
        projectKeys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
        console.error('Ошибка очистки кэша:', error);
    }
}

function checkCacheStatus() {
    const keys = Object.keys(localStorage);
    const projectKeys = keys.filter(key => key.startsWith('project_data_'));
    
    projectKeys.forEach(key => {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            const age = Date.now() - data.timestamp;
            const maxAge = 30 * 60 * 1000; // 30 минут 
            const status = age < maxAge ? '✅ Активен' : '⏰ Устарел';
        } catch (error) {
        }
    });
    
    if (projectKeys.length === 0) {
    }
}

function checkGeocodingCacheStatus() {
    const keys = Object.keys(localStorage);
    const geocodingKeys = keys.filter(key => key.startsWith('geocoding_'));
     
    if (geocodingKeys.length > 0) {
        let totalAge = 0;
        let validEntries = 0;
        
        geocodingKeys.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                const age = Date.now() - data.timestamp;
                const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней
                
                if (age < maxAge) {
                    validEntries++;
                    totalAge += age;
                }
            } catch (error) {
                console.error(`Ошибка чтения ${key}:`, error);
            }
        });
        
        if (validEntries > 0) {
            console.log(`  Средний возраст: ${Math.round(totalAge / validEntries / 1000 / 60)} минут`);
        }
    } else {
        console.log('  Кэш пуст');
    }
}

window.checkCacheStatus = checkCacheStatus;
window.checkGeocodingCacheStatus = checkGeocodingCacheStatus;
window.clearAllGeocodingCache = clearAllGeocodingCache;

let autoUpdateInterval = null;

function startAutoCacheUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }
    
    autoUpdateInterval = setInterval(async () => {
        
        const keys = Object.keys(localStorage);
        const projectKeys = keys.filter(key => key.startsWith('project_data_'));
        
        let hasExpired = false;
        
        for (const key of projectKeys) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                const age = Date.now() - data.timestamp;
                const maxAge = 30 * 60 * 1000; // 30 минут
                
                if (age >= maxAge) {
                    hasExpired = true;
                }
            } catch (error) {
                console.error(`Ошибка проверки кэша ${key}:`, error);
            }
        }
        
        if (hasExpired) {
            try {
                clearAllCache();
                
                await loadDataFromGoogleScript(CONFIG.googleScript.url, 'lenta');
                
            } catch (error) {
                console.error('❌ Ошибка автоматического обновления кэша:', error);
            }
        } else {
        }
    }, 10 * 60 * 1000); // Проверка 10 минут 
}

function stopAutoCacheUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
    }
}

window.startAutoCacheUpdate = startAutoCacheUpdate;
window.stopAutoCacheUpdate = stopAutoCacheUpdate;

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
    DOMCache.projectModeSwitch = document.getElementById('projectModeSwitch');
}

async function checkAuth() {
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
        
        const sessionResult = await window.SupabaseAuth.checkSession(sessionData.sessionId);
        
        if (!sessionResult.success) {
            localStorage.removeItem('auth_session');
            window.location.href = 'auth.html';
            return false;
        }
        
        const statusResult = await window.SupabaseAuth.checkUserStatus(sessionData.userId);
        
        if (!statusResult.success || !statusResult.isActive) {
            localStorage.removeItem('auth_session');
            showNotification('Ваш аккаунт был деактивирован администратором', 'error');
            window.location.href = 'auth.html';
            return false;
        }
        
        startUserStatusMonitoring(sessionData.userId);
        
        return true;
    } catch (error) {
        localStorage.removeItem('auth_session');
        window.location.href = 'auth.html';
        return false;
    }
}

function logout() {
    stopUserStatusMonitoring();
    stopAutoCacheUpdate();
    localStorage.removeItem('auth_session');
    window.location.href = 'auth.html';
}

function startUserStatusMonitoring(userId) {
    stopUserStatusMonitoring();
    
    statusSubscription = window.SupabaseAuth.subscribeToUserStatus(userId, (isActive) => {
        if (!isActive) {
            showNotification('Ваш аккаунт был деактивирован администратором', 'error');
            window.location.href = 'auth.html';
        }
    });
    
    startPeriodicStatusCheck(userId);
}

function startPeriodicStatusCheck(userId) {
    if (window.statusCheckInterval) {
        clearInterval(window.statusCheckInterval);
    }
    
    window.statusCheckInterval = setInterval(async () => {
        try {
            const statusResult = await window.SupabaseAuth.checkUserStatus(userId);
            
            if (!statusResult.success || !statusResult.isActive) {
                clearInterval(window.statusCheckInterval);
                showNotification('Ваш аккаунт был деактивирован администратором', 'error');
                window.location.href = 'auth.html';
            }
        } catch (error) {
            console.error('Ошибка периодической проверки статуса:', error);
        }
    }, 30000); 
}

function stopUserStatusMonitoring() {
    if (statusSubscription) {
        window.SupabaseAuth.unsubscribeFromUserStatus(statusSubscription);
        statusSubscription = null;
    }
    
    if (window.statusCheckInterval) {
        clearInterval(window.statusCheckInterval);
        window.statusCheckInterval = null;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    if (!(await checkAuth())) {
        return;
    }
    
    initDOMCache();
    initMap();
    setupEventListeners();
    
    preloadAllProjectData();

    startAutoCacheUpdate();
    
    const closeStoreInfoBtn = document.getElementById('closeStoreInfoBtn');
    if (closeStoreInfoBtn) {
        closeStoreInfoBtn.addEventListener('click', hideStoreInfo);
    }
    
    const savedProject = localStorage.getItem('selectedProject');
    const savedCity = localStorage.getItem('selectedCity');
    
    if (savedProject && savedCity) {
        selectedProject = savedProject;
        window.selectedProject = selectedProject;
        selectedCity = savedCity;
        updateProjectInfo();
        centerMapOnCity(selectedCity);
    } else {
        setTimeout(() => {
            showProjectModal();
        }, 1000);
        
        setupModalEventListeners();
    }
});

function createMap() {
    try {
        map = new window.ymaps.Map('map', {
            center: CONFIG.yandex.center,
            zoom: CONFIG.yandex.zoom,
            controls: ['zoomControl', 'fullscreenControl']
        });
        window.map = map;
        
        map.events.add('click', function (e) {
            if (currentSearchMarker && currentSearchMarker.balloon) {
                currentSearchMarker.balloon.close();
            }
        });
    } catch (error) {
        showError(`Ошибка создания карты: ${error.message}`);
    }
}

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

function selectLocation(location) {
    if (!map) {
        return;
    }

    if (currentSearchMarker) {
        map.geoObjects.remove(currentSearchMarker);
        currentSearchMarker = null;
    }

    const infoWindowContent = `
        <div class="search-marker-info">
            <div class="search-marker-address">${location.display_name}</div>
            <div class="search-marker-buttons">
                <button class="search-route-btn start-btn" onclick="setSearchLocationAsRoutePoint('start', '${location.display_name.replace(/'/g, "\\'")}')">Откуда</button>
                <button class="search-route-btn end-btn" onclick="setSearchLocationAsRoutePoint('end', '${location.display_name.replace(/'/g, "\\'")}')">Куда</button>
            </div>
        </div>
    `;

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
    
    currentSearchMarker.events.add('click', function () {
        if (currentSearchMarker.balloon.isOpen()) {
            currentSearchMarker.balloon.close();
        }
        setTimeout(() => {
            currentSearchMarker.balloon.open();
        }, 50);
    });
    
    map.geoObjects.add(currentSearchMarker);

    map.setCenter([location.lat, location.lon], 15);

    DOMCache.searchResults.style.display = 'none';
    
    DOMCache.searchInput.value = location.display_name;
    
    DOMCache.routeInfo.style.display = 'none';
}

function openInYandexMaps() {
    const startPoint = DOMCache.startPoint.value.trim();
    const endPoint = DOMCache.endPoint.value.trim();
    
    if (!startPoint && !endPoint) {
        showError('Введите хотя бы один адрес');
        return;
    }
    
    let yandexMapsUrl;
    
    if (startPoint && endPoint) {
        yandexMapsUrl = `https://yandex.ru/maps/?rtext=${encodeURIComponent(startPoint)}~${encodeURIComponent(endPoint)}&rtt=auto`;
    } else if (startPoint) {
        yandexMapsUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(startPoint)}`;
    } else {
        yandexMapsUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(endPoint)}`;
    }
    
    window.open(yandexMapsUrl, '_blank');
}

function clearRoute() {
    let currentCenter = [55.7558, 37.6176]; 
    let currentZoom = 10;
    
    if (map) {
        currentCenter = map.getCenter();
        currentZoom = map.getZoom();
    }
    
    DOMCache.startPoint.value = '';
    DOMCache.endPoint.value = '';
    
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
    
    if (currentSearchMarker) {
        map.geoObjects.remove(currentSearchMarker);
        currentSearchMarker = null;
    }
    
    DOMCache.routeInfo.style.display = 'none';
    
    DOMCache.searchResults.style.display = 'none';
    
    DOMCache.searchInput.value = '';
    
    if (map) {
        map.setCenter(currentCenter, currentZoom);
    }
}

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

function showError(message) {
    console.error(message);
    alert(message);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    switch (type) {
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#212529';
            break;
        default:
            notification.style.backgroundColor = '#007bff';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

function toggleProjectMode() {
    isSingleProjectMode = !isSingleProjectMode;
    
    if (DOMCache.projectModeSwitch) {
        if (isSingleProjectMode) {
            DOMCache.projectModeSwitch.classList.add('single-project');
        } else {
            DOMCache.projectModeSwitch.classList.remove('single-project');
        }
    }
    
    updateProjectInfo();
    
    console.log(`Режим проектов изменен на: ${isSingleProjectMode ? 'Один проект' : 'Все проекты'}`);
}

function getProjectMode() {
    return isSingleProjectMode ? 'single' : 'all';
}

function setupEventListeners() {
    if (DOMCache.searchBtn) {
        DOMCache.searchBtn.addEventListener('click', performSearch);
    }
    
    if (DOMCache.buildRouteBtn) {
        DOMCache.buildRouteBtn.addEventListener('click', buildRoute);
    }
    
    if (DOMCache.clearRouteBtn) {
        DOMCache.clearRouteBtn.addEventListener('click', clearRoute);
    }
    
    if (DOMCache.changeProjectBtn) {
        DOMCache.changeProjectBtn.addEventListener('click', showProjectModal);
    }

    if (DOMCache.updateCacheBtn) {
        DOMCache.updateCacheBtn.addEventListener('click', forceUpdateCache);
    }
    
    if (DOMCache.searchInput) {
        DOMCache.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    const setAsStartPointBtn = document.getElementById('setAsStartPoint');
    if (setAsStartPointBtn) {
        setAsStartPointBtn.addEventListener('click', () => setStoreAsRoutePoint('start'));
    }
    
    const setAsEndPointBtn = document.getElementById('setAsEndPoint');
    if (setAsEndPointBtn) {
        setAsEndPointBtn.addEventListener('click', () => setStoreAsRoutePoint('end'));
    }
    
    if (DOMCache.projectModeSwitch) {
        DOMCache.projectModeSwitch.addEventListener('click', toggleProjectMode);
    }
    
    const openVacancyFilterBtn = document.getElementById('openVacancyFilterBtn');
    if (openVacancyFilterBtn) {
        openVacancyFilterBtn.addEventListener('click', () => {
            if (window.showVacancyFilterModal) {
                window.showVacancyFilterModal();
            }
        });
    }
}

window.selectProject = selectProject;
window.showProjectModal = showProjectModal;
window.toggleProjectMode = toggleProjectMode;
window.getProjectMode = getProjectMode;
window.loadSingleProjectData = loadSingleProjectData;
window.loadAllProjectsData = loadAllProjectsData;
window.createSingleProjectMarkers = createSingleProjectMarkers;
window.map = map;
window.selectedProject = selectedProject;



function createMapPlaceholder() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {

        return;
    }
    
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



function showProjectModal() {
    if (isModalOpen) return;
    
    isModalOpen = true;
    const modal = DOMCache.projectModal;
    if (modal) {
        modal.style.display = 'flex';
    } else {
        return;
    }
    
    selectedProject = null;
    window.selectedProject = selectedProject;
    selectedCity = null;
    
    isSingleProjectMode = false;
    if (DOMCache.projectModeSwitch) {
        DOMCache.projectModeSwitch.classList.remove('single-project');
    }
    
    hideStoreInfo();
    
    isLoadingProject = false;
    isLoadingData = false;
    isLoadingProjectData = false;
 
    setupModalEventListeners();
}

function hideProjectModal() {
    isModalOpen = false;
    if (DOMCache.projectModal) {
        DOMCache.projectModal.style.display = 'none';
    }
}

function setupModalEventListeners() {
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach((card, index) => {
        const projectName = card.dataset.project;
    
        card.removeEventListener('click', card._projectClickHandler);
        
        card._projectClickHandler = () => {

            selectProject(projectName);
        };
        
        card.addEventListener('click', card._projectClickHandler);
    });
    
    
    const backToProjectBtn = document.getElementById('backToProjectBtn');
    
    if (backToProjectBtn) {
        backToProjectBtn.addEventListener('click', backToProjectSelection);
    }
}

function selectProject(project) {
    if (selectedProject && selectedProject !== project) {
        hideStoreInfo();
    }
    
    selectedProject = project;
    window.selectedProject = selectedProject;
    
    document.querySelectorAll('.project-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const selectedCard = document.querySelector(`[data-project="${project}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    const citySelection = document.getElementById('citySelection');
    const backToProjectBtn = document.getElementById('backToProjectBtn');
    const continueBtn = document.getElementById('continueBtn');
    
    if (citySelection && backToProjectBtn && continueBtn) {
        citySelection.style.display = 'block';
        backToProjectBtn.style.display = 'inline-block';
        continueBtn.disabled = true;
        continueBtn.textContent = 'Начать работу';
    }
    
    if (continueBtn) {
        continueBtn.onclick = null;
    }
    
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
    
    citiesData = [];
    const cityGrid = document.getElementById('cityGrid');
    if (cityGrid) {
        cityGrid.innerHTML = '';
    }
    
    const citySearchInput = document.getElementById('citySearchInput');
    if (citySearchInput) {
        if (citySearchInput._searchHandler) {
            citySearchInput.removeEventListener('input', citySearchInput._searchHandler);
        }
        
        citySearchInput._searchHandler = (e) => filterCities(e.target.value);
        citySearchInput.addEventListener('input', citySearchInput._searchHandler);
    }
    
    loadCitiesForProject(project).catch(error => {


    });
}

function backToProjectSelection() {
    selectedProject = null;
    window.selectedProject = selectedProject;
    selectedCity = null;
    
    hideStoreInfo();
    
    document.getElementById('citySelection').style.display = 'none';
    document.getElementById('backToProjectBtn').style.display = 'none';
    document.getElementById('continueBtn').disabled = true;
    document.getElementById('continueBtn').textContent = 'Начать работу';
    
    const continueBtn = document.getElementById('continueBtn');
    continueBtn.onclick = null;
    
    document.querySelectorAll('.project-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const citySelectionTitle = document.getElementById('citySelectionTitle');
    if (citySelectionTitle) {
        citySelectionTitle.innerHTML = '🏙️ Выберите город';
    }
    document.getElementById('citySearchInput').placeholder = 'Поиск города...';
    
    document.getElementById('citySearchInput').value = '';
    filterCities('');
}

async function loadCitiesForProject(project) {
    if (!project) {
        return;
    }
    
    if (isLoadingProject) {
        return;
    }
    
    if (projectDataCache.has(project)) {
        const cachedData = projectDataCache.get(project);
        citiesData = cachedData.cities;
        displayCities(citiesData);
        
        return;
    }
    
    isLoadingProject = true;
    
    try {
        const { storesData, citiesData: projectCities } = await loadDataFromGoogleSheets(project);
        
        if (projectCities && projectCities.length > 0) {
            citiesData = projectCities;
            displayCities(citiesData);
            
        } else {
            loadTestCities(project);
        }
        
    } catch (error) {
        loadTestCities(project);
    } finally {
        isLoadingProject = false;
    }
}

function loadDataFromGoogleScript(scriptUrl, project) {
    
    return new Promise((resolve, reject) => {
        const allSheets = ['lenta', 'lentaShtat', 'magnet', 'vkusvill'];
        const loadedData = {};
        let completedSheets = 0;
        
        const loadSheet = (sheetName) => {
            const callbackName = 'callback_' + Math.random().toString(36).substr(2, 9);
            const url = `${scriptUrl}?sheet=${sheetName}&callback=${callbackName}`;
            
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
        
        const checkCompletion = () => {
            if (completedSheets === allSheets.length) {
                allSheets.forEach(sheetName => {
                    if (loadedData[sheetName] && loadedData[sheetName].length > 0) {
                        const cities = extractUniqueCities(loadedData[sheetName], sheetName);
                        
                        projectDataCache.set(sheetName, {
                            cities: cities,
                            stores: loadedData[sheetName],
                            timestamp: Date.now()
                        });

                        setCachedData(sheetName, {
                            storesData: loadedData[sheetName],
                            citiesData: cities
                        });
                        
                    } else {
                        projectDataCache.set(sheetName, {
                            cities: [],
                            stores: [],
                            timestamp: Date.now()
                        });
                    }
                });
                
                const requestedData = loadedData[project] || [];
                resolve(requestedData);
            }
        };
        
        allSheets.forEach(sheetName => {
            loadSheet(sheetName);
        });
    });
}

function extractUniqueCities(rawData, project) {
    const field = project === 'magnet' ? 'area' : 'city';
    const locations = new Map();

    const shouldMergeCities = (project === 'lenta' || project === 'lentaShtat');
    
    rawData.forEach((item, index) => {
        const value = item[field];
        if (value && value !== 'Не указан' && value !== 'Не указана' && value !== '') {
            const trimmedValue = value.trim();
            
            let locationKey = trimmedValue;
            let displayName = trimmedValue;
            
            if (shouldMergeCities) {
                if (trimmedValue === 'Москва' || trimmedValue === 'Московская область') {
                    locationKey = 'Москва и Московская область';
                    displayName = 'Москва и Московская область';
                }
                else if (trimmedValue === 'Санкт-Петербург' || trimmedValue === 'Ленинградская область') {
                    locationKey = 'Санкт-Петербург и Ленинградская область';
                    displayName = 'Санкт-Петербург и Ленинградская область';
                }
            }
            
            if (!locations.has(locationKey)) {
                let coordinates = null;
                
                if (item.coordinates) {
                    const coords = item.coordinates.split(',').map(coord => parseFloat(coord.trim()));
                    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                        coordinates = coords;
                    }
                }
                
                locations.set(locationKey, {
                    name: displayName,
                    originalNames: shouldMergeCities && (trimmedValue === 'Москва' || trimmedValue === 'Московская область' || trimmedValue === 'Санкт-Петербург' || trimmedValue === 'Ленинградская область') 
                        ? (locationKey === 'Москва и Московская область' ? ['Москва', 'Московская область'] : ['Санкт-Петербург', 'Ленинградская область'])
                        : [trimmedValue],
                    coordinates: coordinates,
                    storeCount: 0
                });
            }
            
            const location = locations.get(locationKey);
            location.storeCount++;
        }
    });
    
    return Array.from(locations.values()).sort((a, b) => a.name.localeCompare(b.name));
}

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
        ],
        lentaShtat: [
            'Москва'
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
        
        if (typeof city === 'object' && city.name) {
            cityItem.textContent = city.name;
        } else {
            cityItem.textContent = city;
        }
        
        cityItem.addEventListener('click', (event) => {
            selectCity(city, event);
        });
        
        cityGrid.appendChild(cityItem);
        createdCount++;
    });
}

function showLoadingIndicator(message = 'Загружаем города...') {
    const cityGrid = document.getElementById('cityGrid');
    if (cityGrid) {
        cityGrid.style.display = 'none';
        
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        
        const citySelection = document.getElementById('citySelection');
        if (citySelection) {
            citySelection.appendChild(loadingOverlay);
        }
    }
}

function hideLoadingIndicator() {
    const cityGrid = document.getElementById('cityGrid');
    if (cityGrid) {
        cityGrid.style.display = 'grid';
    }
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

function selectCity(city, event) {
    if (!selectedProject) {
        const activeProjectCard = document.querySelector('.project-card.selected');
        if (activeProjectCard) {
            const projectName = activeProjectCard.dataset.project;
            selectedProject = projectName;
            window.selectedProject = selectedProject;
        } else {
            return;
        }
    }
    
    if (typeof city === 'object' && city.name) {
        selectedCity = city.name;
    } else {
        selectedCity = city;
    }
    
    document.querySelectorAll('.city-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    if (event && event.target) {
        event.target.classList.add('selected');
    }
    
    const continueBtn = document.getElementById('continueBtn');
    if (!continueBtn) {
        return;
    }
    
    continueBtn.disabled = false;
    continueBtn.textContent = 'Начать работу';
    
    continueBtn.onclick = function() {
        continueBtn.disabled = true;
        continueBtn.innerHTML = '<span class="loading-spinner-small"></span> Инициализируем карту...';
        
        if (isSingleProjectMode) {
            loadSingleProjectData();
        } else {
            loadAllProjectsData();
        }
    };
}

function filterCities(searchTerm) {
    const filteredCities = citiesData.filter(city => {
        const cityName = typeof city === 'object' && city.name ? city.name : city;
        return cityName.toLowerCase().includes(searchTerm.toLowerCase());
    });
    displayCities(filteredCities);
}

async function loadSingleProjectData() {
    if (isLoadingProjectData) {
        return;
    }
    
    isLoadingProjectData = true;
    
    try {
        if (!selectedProject || !selectedCity) {
            console.error('Не выбран проект или город');
            return;
        }
        
        localStorage.setItem('selectedProject', selectedProject);
        localStorage.setItem('selectedCity', selectedCity);
        
        hideProjectModal();
        updateProjectInfo();
        
        let storesData, projectCities;
        
        if (projectDataCache.has(selectedProject)) {
            const cachedData = projectDataCache.get(selectedProject);
            storesData = cachedData.stores;
            projectCities = cachedData.cities;
        } else {
            const cachedData = getCachedData(selectedProject);
            if (cachedData) {
                storesData = cachedData.storesData;
                projectCities = cachedData.citiesData;
                
                projectDataCache.set(selectedProject, {
                    stores: cachedData.storesData,
                    cities: cachedData.citiesData,
                    lastUpdated: Date.now()
                });
            } else {
                const result = await loadDataFromGoogleSheets(selectedProject);
                storesData = result.storesData;
                projectCities = result.citiesData;
                
                projectDataCache.set(selectedProject, {
                    stores: result.storesData,
                    cities: result.citiesData,
                    lastUpdated: Date.now()
                });
            }
        }
        
        if (storesData.length === 0) {
            return;
        }
        
        showLoading(true, `Центрируем карту на ${selectedCity}...`);
        
        const continueButton = document.getElementById('continueBtn');
        if (continueButton) {
            continueButton.innerHTML = '<span class="loading-spinner-small"></span> Центрируем карту...';
        }
        
        centerMapOnCity(selectedCity);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await createSingleProjectMarkers(selectedProject, selectedCity);
        
        if (continueButton) {
            continueButton.innerHTML = '<span class="loading-spinner-small"></span> Готово!';
            setTimeout(() => {
                continueButton.textContent = 'Начать работу';
            }, 2000);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных одного проекта:', error);
        showError('Ошибка загрузки данных проекта');
    } finally {
        isLoadingProjectData = false;
    }
}

async function loadAllProjectsData() {
    if (isLoadingProjectData) {
        return;
    }
    
    isLoadingProjectData = true;
    
    try {
        if (!selectedProject || !selectedCity) {
            console.error('Не выбран проект или город');
            return;
        }
        
        localStorage.setItem('selectedProject', selectedProject);
        localStorage.setItem('selectedCity', selectedCity);
        
        hideProjectModal();
        updateProjectInfo();
        
        const allProjects = ['lenta', 'magnet', 'vkusvill', 'lentaShtat'];
        
        for (const project of allProjects) {
            if (projectDataCache.has(project)) {
            } else {
                const cachedData = getCachedData(project);
                if (cachedData) {
                    projectDataCache.set(project, {
                        stores: cachedData.storesData,
                        cities: cachedData.citiesData,
                        lastUpdated: Date.now()
                    });
                } else {
                    const result = await loadDataFromGoogleSheets(project);
                    projectDataCache.set(project, {
                        stores: result.storesData,
                        cities: result.citiesData,
                        lastUpdated: Date.now()
                    });
                }
            }
        }
        
        showLoading(true, `Центрируем карту на ${selectedCity}...`);
        
        const continueButton = document.getElementById('continueBtn');
        if (continueButton) {
            continueButton.innerHTML = '<span class="loading-spinner-small"></span> Центрируем карту...';
        }
        
        centerMapOnCity(selectedCity);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const cityData = findCityCoordinates(selectedCity);
        if (cityData && cityData.coordinates) {
            await createAllProjectMarkersByCoordinates(cityData.coordinates, selectedCity);
        }
        
        if (continueButton) {
            continueButton.innerHTML = '<span class="loading-spinner-small"></span> Готово!';
            setTimeout(() => {
                continueButton.textContent = 'Начать работу';
            }, 2000);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных всех проектов:', error);
        showError('Ошибка загрузки данных проектов');
    } finally {
        isLoadingProjectData = false;
    }
}

async function loadProjectDataForMap() {
    if (isLoadingProjectData) {
        return;
    }
    
    isLoadingProjectData = true;
    
    const continueButton = document.getElementById('continueBtn');
    
    try {
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.textContent = 'Начать работу';
        }
        
        if (!selectedProject || !selectedCity) {
    
            return;
        }
        
        localStorage.setItem('selectedProject', selectedProject);
        localStorage.setItem('selectedCity', selectedCity);
        
        hideProjectModal();
        
        updateProjectInfo();
        
        let storesData, projectCities;
        
        if (projectDataCache.has(selectedProject)) {
            const cachedData = projectDataCache.get(selectedProject);
            storesData = cachedData.stores;
            projectCities = cachedData.cities;
            
        } else {
            const result = await loadDataFromGoogleSheets(selectedProject);
            storesData = result.storesData;
            projectCities = result.citiesData;
        }
        
        if (storesData.length === 0) {
    
            return;
        }
        
        showLoading(true, `Центрируем карту на ${selectedCity}...`);
        
        if (continueButton) {
            continueButton.innerHTML = '<span class="loading-spinner-small"></span> Центрируем карту...';
        }
        
        centerMapOnCity(selectedCity);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const projectName = getProjectDisplayName(selectedProject);
        const locationType = selectedProject === 'magnet' ? 'области' : 'города';

        
        loadProjectDataForCity(selectedProject, selectedCity);
        
        if (continueButton) {
            continueButton.innerHTML = '<span class="loading-spinner-small"></span> Готово!';
            setTimeout(() => {
                continueButton.disabled = false;
                continueButton.textContent = 'Начать работу';
            }, 1000);
        }
        
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
    } finally {
        isLoadingProjectData = false;
    }
}

async function loadProjectDataForCity(project, city) {
    try {
        const cityData = findCityCoordinates(city);
        if (!cityData || !cityData.coordinates) {
            return;
        }

        await createAllProjectMarkersByCoordinates(cityData.coordinates, city);
    } catch (error) {
    }
}

async function createSingleProjectMarkers(project, city) {
    try {
        clearMapMarkers();
        
        if (!projectDataCache.has(project)) {
            return;
        }
        
        const projectData = projectDataCache.get(project);
        const stores = projectData.stores || [];
                
        if (project === 'magnet' && stores.length > 0) {
            const uniqueAreas = [...new Set(stores.map(store => store.area).filter(area => area))].slice(0, 10);
        } else if (stores.length > 0) {
            const uniqueCities = [...new Set(stores.map(store => store.city).filter(city => city))].slice(0, 10);
        }
        
        const cityStores = stores.filter(store => {
            if (project === 'magnet') {
                if (!store.area) {
                    return false;
                }
                const storeArea = store.area.toLowerCase();
                const searchArea = city.toLowerCase();
                const matches = storeArea.includes(searchArea) || searchArea.includes(storeArea);
                
                if (matches) {
                }
                
                return matches;
            } else {
                if (!store.city) {
                    return false;
                }
                if (project === 'lenta' || project === 'lentaShtat') {
                    const storeCity = store.city.toLowerCase();
                    
                    if (city === 'Москва и Московская область') {
                        return storeCity === 'москва' || storeCity === 'московская область';
                    } else if (city === 'Санкт-Петербург и Ленинградская область') {
                        return storeCity === 'санкт-петербург' || storeCity === 'ленинградская область';
                    } else {
                        return storeCity === city.toLowerCase();
                    }
                } else {
                return store.city.toLowerCase() === city.toLowerCase();
                }
            }
        });
        
        
        if (cityStores.length === 0) {
            showLoading(false);
            return;
        }
        
        showLoading(true, `Загрузка магазинов: 0 из ${cityStores.length}`);
        
        const storesByAddress = new Map();
        
        for (const store of cityStores) {
            if (store.fullAddress) {
                const key = `${store.fullAddress}_${project}`;
                if (!storesByAddress.has(key)) {
                    storesByAddress.set(key, { stores: [], address: store.fullAddress, project: project });
                }
                storesByAddress.get(key).stores.push(store);
            }
        }
        
        let processedStores = 0;
        for (const [key, storeGroup] of storesByAddress) {
            processedStores++;
            showLoading(true, `Загрузка магазинов: ${processedStores} из ${cityStores.length}`);
            
            const coordinates = await geocodeFullAddress(storeGroup.address);
            
            if (coordinates) {
                createStoreMarker(coordinates, storeGroup, project);
            }
        }
        
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
    }
}

async function createAllProjectMarkersByCoordinates(cityCoordinates, cityName) {
    try {
        clearMapMarkers();
        
        const searchRadius = 25; //Радиус поиска в километрах
        
        const allProjects = ['lenta', 'magnet', 'vkusvill', 'lentaShtat'];
        let totalStores = 0;
        let processedStores = 0;
        
        for (const project of allProjects) {
            if (projectDataCache.has(project)) {
                const projectData = projectDataCache.get(project);
                const stores = projectData.stores || [];
                
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
        
        showLoading(true, `Загрузка магазинов: 0 из ${totalStores}`);
        
        for (const project of allProjects) {
            if (!projectDataCache.has(project)) continue;
            
            const projectData = projectDataCache.get(project);
            const stores = projectData.stores || [];
            
            const nearbyStores = stores.filter(store => {
                if (!store.coordinates) return false;
                
                const coords = store.coordinates.split(',').map(coord => parseFloat(coord.trim()));
                if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return false;
                
                const distance = calculateDistance(cityCoordinates, coords);
                return distance <= searchRadius;
            });
            
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
            
            for (const [key, storeGroup] of storesByAddress) {
                processedStores++;
                showLoading(true, `Загрузка магазинов: ${processedStores} из ${totalStores}`);
                
                const coordinates = await geocodeFullAddress(storeGroup.address);
                
                if (coordinates) {
                    createStoreMarker(coordinates, storeGroup, project);
                }
            }
        }
        
        let allErrors = [];
        for (const project of allProjects) {
            if (!projectDataCache.has(project)) continue;
            
            const projectData = projectDataCache.get(project);
            const stores = projectData.stores || [];
            
            const nearbyStores = stores.filter(store => {
                if (!store.coordinates) return false;
                
                const coords = store.coordinates.split(',').map(coord => parseFloat(coord.trim()));
                if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return false;
                
                const distance = calculateDistance(cityCoordinates, coords);
                return distance <= searchRadius;
            });
            
            const errors = detectDataErrors(nearbyStores, project);
            if (errors.length > 0) {
                allErrors = allErrors.concat(errors);
            }
        }
        
        if (allErrors.length > 0) {
            setTimeout(() => {
                showErrorModal(allErrors);
            }, 1000); 
        }
        
        showLoading(false);
        
    } catch (error) {
        console.error('Ошибка создания меток по координатам:', error);
        showLoading(false);
    }
}

async function createLentaMarkers(selectedCity) {
    try {

        if (!projectDataCache.has('lenta')) {
            return;
        }
        
        const lentaData = projectDataCache.get('lenta');
        const stores = lentaData.stores;
        
        if (!stores || stores.length === 0) {
            return;
        }
        
        const cityStores = stores.filter(store => {
            return store.city && store.city.toLowerCase() === selectedCity.toLowerCase();
        });
        

        
        clearMapMarkers();
        
        const storesByAddress = new Map();
        
        for (const store of cityStores) {
            if (store.fullAddress) {
                if (!storesByAddress.has(store.fullAddress)) {
                    storesByAddress.set(store.fullAddress, []);
                }
                storesByAddress.get(store.fullAddress).push(store);
            }
        }
        const totalAddresses = storesByAddress.size;
        let processedAddresses = 0;
        
        showLoading(true, `Загрузка адресов: 0 из ${totalAddresses}`);
        
        for (const [address, stores] of storesByAddress) {
            processedAddresses++;
            showLoading(true, `Загрузка адресов: ${processedAddresses} из ${totalAddresses}`);
            
            const coordinates = await geocodeFullAddress(address);
            
            if (coordinates) {
                createStoreMarker(coordinates, { stores, address }, 'lenta');
                    }
        }
        
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
    }
}

async function createMagnetMarkers(selectedArea) {
    try {
        if (!projectDataCache.has('magnet')) {
            return;
        }
        
        const magnetData = projectDataCache.get('magnet');
        const stores = magnetData.stores;
        
        if (!stores || stores.length === 0) {
            return;
        }
        
        const areaStores = stores.filter(store => {
            return store.area && store.area.toLowerCase() === selectedArea.toLowerCase();
        });
        
        clearMapMarkers();
        
        const storesByAddress = new Map();
        
        for (const store of areaStores) {
            if (store.fullAddress) {
                if (!storesByAddress.has(store.fullAddress)) {
                    storesByAddress.set(store.fullAddress, []);
                }
                storesByAddress.get(store.fullAddress).push(store);
            }
        }
    
        const totalAddresses = storesByAddress.size;
        let processedAddresses = 0;
        
        showLoading(true, `Загрузка адресов: 0 из ${totalAddresses}`);
        
        for (const [address, stores] of storesByAddress) {
            processedAddresses++;
            showLoading(true, `Загрузка адресов: ${processedAddresses} из ${totalAddresses}`);
            
            const coordinates = await geocodeFullAddress(address);
            
            if (coordinates) {
                createStoreMarker(coordinates, { stores, address }, 'magnet');
            }
        }
        
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
    }
}

async function createVkusvillMarkers(selectedCity) {
    try {
        if (!projectDataCache.has('vkusvill')) {
            return;
        }
        
        const vkusvillData = projectDataCache.get('vkusvill');
        const stores = vkusvillData.stores;
        
        if (!stores || stores.length === 0) {
            return;
        }
        
        const areaStores = stores.filter(store => {
            return store.city && store.city.toLowerCase() === selectedCity.toLowerCase();
        });
        
        clearMapMarkers();
        
        const storesByAddress = new Map();
        
        for (const store of areaStores) {
            if (store.fullAddress) {
                if (!storesByAddress.has(store.fullAddress)) {
                    storesByAddress.set(store.fullAddress, []);
                }
                storesByAddress.get(store.fullAddress).push(store);
            }
        }
    
        const totalAddresses = storesByAddress.size;
        let processedAddresses = 0;
        
 адресов
        showLoading(true, `Загрузка адресов: 0 из ${totalAddresses}`);
        
        for (const [address, stores] of storesByAddress) {
            processedAddresses++;
            showLoading(true, `Загрузка адресов: ${processedAddresses} из ${totalAddresses}`);
            
            const coordinates = await geocodeFullAddress(address);
            
            if (coordinates) {
                createStoreMarker(coordinates, { stores, address }, 'vkusvill');
            }
        }
        
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
    }
}

function clearMapMarkers() {
    if (map && map.geoObjects) {
        map.geoObjects.removeAll();
    }
    markerPositions.clear();
}

function createStoreMarker(coordinates, storeData, projectType) {
    try {
        if (!map || !coordinates) {
            return;
        }
        
        let iconContent = '🏪';
        let hintContent = storeData.address || storeData.fullAddress;
        
        const projectName = getProjectDisplayName(projectType);
        hintContent = `${projectName}\n${hintContent}`;
        
        if (storeData.stores && storeData.stores.length > 1) {
            iconContent = storeData.stores.length;
            hintContent = `${projectName}\n${storeData.stores.length} вакансий\n${storeData.address}`;
        } else if (storeData.vacancy) {
            iconContent = storeData.vacancy;
        }
        
        const offsetCoords = getOffsetCoordinates(coordinates.lat, coordinates.lon);
        
        const marker = new window.ymaps.Placemark([offsetCoords.lat, offsetCoords.lon], {
            iconContent: iconContent,
            hintContent: hintContent
        }, {
            preset: 'islands#blueDotIcon',
            iconColor: getProjectColor(projectType)
        });

        marker.data = {
            project: projectType,
            store: storeData
        };
        
        map.geoObjects.add(marker);
        
        marker.events.add('click', function() {
            showStoreInfo(storeData, projectType);
        });
        
    } catch (error) {
    }
}

function showStoreInfo(storeData, projectType) {
    try {
        const storeTkElement = document.getElementById('storeTk');
        const storeAddressElement = document.getElementById('storeAddress');
        const storeDetailsElement = document.getElementById('storeDetails');
        const panel = document.getElementById('storeInfoPanel');
        
        if (!panel) {
            return;
        }
        
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
                    storeTkElement.textContent = '';
                } else {
                    storeTkElement.textContent = `ТК: ${storeData.tk || '-'}`;
                }
            }
        }
        
        if (storeDetailsElement) {
            storeDetailsElement.innerHTML = '';
            
            const stores = storeData.stores || [storeData];
            stores.forEach((store, index) => {
                const vacancyItem = document.createElement('div');
                vacancyItem.className = 'detail-item';
                
                const isLenta = projectType === 'lenta';
                const isMagnet = projectType === 'magnet';
                const isVkusvill = projectType === 'vkusvill';
                const isLentaShtat = projectType === 'lentaShtat';
                
                if (isMagnet) {
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
                    
                    if (tariffBlocks) {
                        storeDetailsElement.insertAdjacentHTML('beforeend', tariffBlocks);
                    } else {
                    }
                    
                    return;
                } else if (isVkusvill) {
                    let vkusvillDetails = `
                        <div class="vacancy-title">Вакансия ${index + 1}</div>
                        <div class="vacancy-details">
                            <div class="vacancy-detail"><strong>Вакансия:</strong> ${store.position || '-'}</div>
                            <div class="vacancy-detail"><strong>Потребность:</strong> ${store.need || '-'}</div>
                            <div class="vacancy-detail"><strong>Средний доход в день:</strong> ${store.income || '-'} руб.</div>
                            <div class="vacancy-detail"><strong>Куратор:</strong> ${store.mentors || '-'}</div>
                    `;
                    if (store.smena && store.smena !== '-' && store.smena !== '#N/A') {
                        vkusvillDetails += `<div class="vacancy-detail"><strong>Смена:</strong> ${store.smena}</div>`;
                    }
                    
                    if (store.metro && store.metro !== '-' && store.metro !== '#N/A') {
                        vkusvillDetails += `<div class="vacancy-detail"><strong>Метро:</strong> ${store.metro}</div>`;
                    }
                    
                    vkusvillDetails += `</div>`;
                    
                    vacancyItem.innerHTML = vkusvillDetails;
                } else if (isLentaShtat) {
                    vacancyItem.innerHTML = `
                        <div class="vacancy-title">Вакансия ${index + 1}</div>
                        <div class="vacancy-details">
                            <div class="vacancy-detail"><strong>Вакансия:</strong> ${store.vacancy || '-'}</div>
                            <div class="vacancy-detail"><strong>Потребность:</strong> ${store.position || '-'}</div>
                            <div class="vacancy-detail"><strong>Тариф:</strong> ${store.tariff || '-'}</div>
                            <div class="vacancy-detail"><strong>Требования:</strong> ${store.requirments || '-'}</div>
                            <div class="vacancy-detail"><strong>График:</strong> ${store.graph || '-'}</div>
                        </div>
                    `;
                    } else if (isLenta) {
                    let formattedTariff = store.tariff || '-';
                    if (formattedTariff !== '-' && formattedTariff !== '#N/A') {
                        try {
                            formattedTariff = String(formattedTariff).replace(/\n/g, '<br>');
                        } catch (e) {
                            console.warn('Ошибка форматирования тарифа:', e);
                        }
                    }
                    vacancyItem.innerHTML = `
                        <div class="vacancy-title">Вакансия ${index + 1}</div>
                        <div class="vacancy-details">
                            <div class="vacancy-detail"><strong>Вакансия:</strong> ${store.vacancy || '-'}</div>
                            <div class="vacancy-detail"><strong>Потребность:</strong> ${store.position || '-'}</div>
                            <div class="vacancy-detail"><strong>Тариф:</strong> ${formattedTariff}</div>
                            <div class="vacancy-detail"><strong>Приоритет:</strong> ${store.prioritet || '-'}</div>
                            <div class="vacancy-detail"><strong>График:</strong> ${store.graphic || '-'}</div>
                        </div>
                    `;
                } else {
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
        
        panel.style.display = 'block';
        panel.classList.add('show');
    } catch (error) {
    }
}

function hideStoreInfo() {
    try {
        const panel = document.getElementById('storeInfoPanel');
        panel.classList.remove('show');
                setTimeout(() => {
            panel.style.display = 'none';
        }, 300);    } catch (error) {
    }
}

function getProjectColor(projectType) {
    const colors = {
        'lenta': '#45b7d1',      // Синий 
        'magnet': '#ff6b6b',     // Красный 
        'vkusvill': '#008000',   // Зеленый 
        'lentaShtat': '#9c27b0' // Фиолетовый
    };
    
    return colors[projectType] || '#666666';
}

function getProjectDisplayName(project) {
    const projectNames = {
        'lenta': 'Лента',
        'magnet': 'Магнит',
        'vkusvill': 'ВкусВилл',
        'lentaShtat': 'Лента Штат'
    };
    return projectNames[project] || project;
}

function centerMapOnCity(cityName) {
    if (!map || !cityName) {
        return;
    }

    try {
        const cityData = findCityCoordinates(cityName);
        
        if (cityData && cityData.coordinates) {
            map.setCenter(cityData.coordinates, 10, {
                duration: 800,
                timingFunction: 'ease'
            });
            

            return;
        }
        
        const moscowCoords = [55.7558, 37.6176];
        map.setCenter(moscowCoords, 10);
        
    } catch (error) {
        const moscowCoords = [55.7558, 37.6176];
        map.setCenter(moscowCoords, 10);
    }
}

function findCityCoordinates(cityName) {
    const cityData = citiesData.find(city => city.name === cityName);
    
    if (cityData && cityData.coordinates) {
        return cityData;
    }
    
    return null;
}

function addCityMarker(coords, cityName) {
    if (!map || !window.ymaps || !window.ymaps.Placemark) {
        return;
    }
    
    try {
        if (window.cityMarker) {
            map.geoObjects.remove(window.cityMarker);
        }
        
        const marker = new window.ymaps.Placemark(coords, {
            balloonContent: `<strong>${cityName}</strong><br>Выбранный город`
        }, {
            preset: 'islands#blueDotIcon',
            iconColor: '#3b82f6'
        });
        
        map.geoObjects.add(marker);
        window.cityMarker = marker;
        
    } catch (error) {
    }
}

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
        
        if (isSingleProjectMode) {
            projectInfo.innerHTML = `
                <div class="project-name">${projectName}</div>
                <div class="city-name">${locationType}: ${selectedCity}</div>
                <div class="project-note">Показываются магазины выбранного проекта в выбранном городе/области</div>
            `;
        } else {
            projectInfo.innerHTML = `
                <div class="project-name">Все проекты</div>
                <div class="city-name">${locationType}: ${selectedCity}</div>
                <div class="project-note">Показываются магазины всех проектов в радиусе 25 км</div>
            `;
        }
        
        changeProjectBtn.style.display = 'inline-block';
        updateCacheBtn.style.display = 'inline-block';
    } else {
        projectInfo.innerHTML = '<p>Проект не выбран</p>';
        changeProjectBtn.style.display = 'none';
        updateCacheBtn.style.display = 'none';
    }
}

async function buildRouteSmart(startCoords, endCoords, profile) {
    return createSimpleRoute(startCoords, endCoords);
}

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
                    [startCoords[1], startCoords[0]], 
                    [endCoords[1], endCoords[0]]
                ]
            }
        }]
    };
}

function calculateDistance(coord1, coord2) {
    const R = 6371; 
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateDuration(coord1, coord2) {
    const distance = calculateDistance(coord1, coord2);
    const speed = 60; 
    return distance / speed; 
}

async function geocodeAddress(address) {
    
    if (address.trim() === 'Москва, Московская область') {
        return [55.7558, 37.6173];
    }
    
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

async function geocodeFullAddress(fullAddress) {
    try {
        if (!fullAddress || fullAddress.trim() === '') {
            return null;
        }

        if (fullAddress.trim() === 'Москва, Московская область') {
            return {
                lat: 55.7558,
                lon: 37.6173,
                address: fullAddress
            };
        }
        
        const cachedCoords = getCachedGeocoding(fullAddress);
        if (cachedCoords) {
            return {
                lat: cachedCoords[0],
                lon: cachedCoords[1],
                address: fullAddress
            };
        }
        
        let coordinates = null;
        
        if (!window.ymaps || !window.ymaps.geocode) {
            // Nominatim
            coordinates = await geocodeAddress(fullAddress);
        } else {
            // Яндекс API
            try {
                const result = await window.ymaps.geocode(fullAddress, {
                    results: 1,
                    kind: 'house'
                });
                
                if (result.geoObjects.getLength() > 0) {
                    const geoObject = result.geoObjects.get(0);
                    const coords = geoObject.geometry.getCoordinates();
                    coordinates = [coords[0], coords[1]];
                }
            } catch (error) {
                console.error(`❌ Ошибка Яндекс геокодирования: ${error.message}`);
                //Nominatim
                coordinates = await geocodeAddress(fullAddress);
            }
        }
        
        if (coordinates) {
            setCachedGeocoding(fullAddress, coordinates);
            
            return {
                lat: coordinates[0],
                lon: coordinates[1],
                address: fullAddress
            };
        }
        
        return null;
        
    } catch (error) {
        console.error(`❌ Ошибка геокодирования: ${error.message}`);
        return null;
    }
}

async function buildRoute() {
    openInYandexMaps();
}


function setStoreAsRoutePoint(pointType) {
    try {
        const storeAddressElement = document.getElementById('storeAddress');
        if (!storeAddressElement) {
            return;
        }
        
        const storeAddress = storeAddressElement.textContent.trim();
        if (!storeAddress || storeAddress === '-') {
            return;
        }
        
        const inputFieldId = pointType === 'start' ? 'startPoint' : 'endPoint';
        const inputField = document.getElementById(inputFieldId);
        
        if (!inputField) {
            return;
        }
        
        inputField.value = storeAddress;
        
        const pointName = pointType === 'start' ? 'начальной' : 'конечной';
        
        inputField.focus();
        
    } catch (error) {
    }
}

function setSearchLocationAsRoutePoint(pointType, address) {
    try {
        const inputFieldId = pointType === 'start' ? 'startPoint' : 'endPoint';
        const inputField = document.getElementById(inputFieldId);
        
        if (!inputField) {

            return;
        }
        
        inputField.value = address;
        
        const pointName = pointType === 'start' ? 'начальной' : 'конечной';

        inputField.focus();
        
        if (currentSearchMarker && currentSearchMarker.balloon) {
            currentSearchMarker.balloon.close();
        }
        
    } catch (error) {


    }
}

window.setSearchLocationAsRoutePoint = setSearchLocationAsRoutePoint;

function detectDataErrors(storesData, projectType) {
    const errors = [];
    
    storesData.forEach((store, index) => {
        const storeErrors = [];
        
        if (projectType === 'lenta') {
            if (store.tk === '#N/A') storeErrors.push('ТК');
            if (store.vacancy === '#N/A') storeErrors.push('Вакансия');
            if (store.position === '#N/A') storeErrors.push('Потребность');
            if (store.tariff === '#N/A') storeErrors.push('Тариф');
        } else if (projectType === 'magnet') {
            if (store.need === '#N/A') storeErrors.push('Потребность');
        } else if (projectType === 'vkusvill') {
            if(store.fullAddress === '#N/A') storeErrors.push('Полный адрес');
            if (store.position === '#N/A') storeErrors.push('Вакансия');
            if (store.need === '#N/A') storeErrors.push('Потребность');
            if (store.income === '#N/A') storeErrors.push('Средний доход в день');
        }
        
        if (storeErrors.length > 0) {
            errors.push({
                index: index + 1,
                address: store.fullAddress || store.address || 'Адрес не указан',
                project: getProjectDisplayName(projectType),
                fields: storeErrors,
                store: store
            });
        }
    });
    
    return errors;
}

function showErrorModal(errors) {
    if (errors.length === 0) return;
    
    const errorModal = document.createElement('div');
    errorModal.className = 'error-modal-overlay';
    errorModal.innerHTML = `
        <div class="error-modal-content">
            <div class="error-modal-header">
                <h2>⚠️ Обнаружены ошибки в данных</h2>
                <button class="error-close-btn" onclick="closeErrorModal()">×</button>
            </div>
            <div class="error-modal-body">
                <p>Найдено <strong>${errors.length}</strong> записей с ошибками #N/A:</p>
                <div class="error-list">
                    ${errors.map(error => `
                        <div class="error-item">
                            <div class="error-header">
                                <span class="error-project">${error.project}</span>
                            </div>
                            <div class="error-address">${error.address}</div>
                            <div class="error-fields">
                                <strong>Проблемные поля:</strong> ${error.fields.join(', ')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(errorModal);
    
    setTimeout(() => {
        errorModal.classList.add('show');
    }, 10);
}

function closeErrorModal() {
    const errorModal = document.querySelector('.error-modal-overlay');
    if (errorModal) {
        errorModal.classList.remove('show');
        setTimeout(() => {
            errorModal.remove();
        }, 300);
    }
}

window.closeErrorModal = closeErrorModal;
