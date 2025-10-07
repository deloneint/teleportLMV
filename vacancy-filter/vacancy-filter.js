// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ОСНОВНОЙ ФАЙЛ
// ========================================

// Переменные для фильтра по вакансиям
let selectedVacancies = new Set(); // Выбранные вакансии

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ИНИЦИАЛИЗАЦИЯ
// ========================================
function initVacancyFilter() {
    console.log('🔍 Инициализация фильтра по вакансиям...');
    
    // Проверяем, что карта загружена
    if (!window.map || !window.map.geoObjects) {
        console.warn('⚠️ Карта не загружена, ждем...');
        setTimeout(initVacancyFilter, 1000);
        return;
    }
    
    // Загружаем список вакансий
    loadVacanciesList();
    
    // Настраиваем обработчики событий
    setupVacancyFilterEventListeners();
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ЗАГРУЗКА ВАКАНСИЙ
// ========================================
function loadVacanciesList() {
    try {
        // Извлекаем вакансии по проектам
        const projectsVacancies = extractVacanciesByProjects();
        
        if (!projectsVacancies || Object.keys(projectsVacancies).length === 0) {
            console.warn('⚠️ Не найдено вакансий для отображения');
            displayEmptyVacanciesList();
            return;
        }
        
        // Отображаем список в модальном окне
        displayVacanciesByProjects(projectsVacancies);
        
        const totalVacancies = Object.values(projectsVacancies).reduce((sum, vacancies) => {
            return sum + vacancies.reduce((projectSum, vacancy) => {
                return projectSum + (typeof vacancy === 'object' ? vacancy.count : 1);
            }, 0);
        }, 0);
        const uniqueVacancies = Object.values(projectsVacancies).reduce((sum, vacancies) => sum + vacancies.length, 0);
        console.log(`✅ Загружено ${uniqueVacancies} уникальных вакансий (${totalVacancies} маркеров) из ${Object.keys(projectsVacancies).length} проектов`);
    } catch (error) {
        console.error('❌ Ошибка загрузки списка вакансий:', error);
        showVacancyFilterError('Ошибка загрузки списка вакансий');
    }
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ИЗВЛЕЧЕНИЕ ВАКАНСИЙ ИЗ МАРКЕРОВ
// ========================================
function extractVacanciesByProjects() {
    const projectsVacancies = {};
    const vacancyCounts = {};
    
    console.log('🔍 Извлечение вакансий из маркеров...');
    
    // Проверяем, что карта и маркеры существуют
    if (!window.map?.geoObjects) {
        console.warn('⚠️ Карта или geoObjects не найдены');
        return {};
    }
    
    const geoObjectsLength = window.map.geoObjects.getLength();
    if (geoObjectsLength === 0) {
        console.warn('⚠️ На карте нет маркеров');
        return {};
    }
    
    // Проверяем режим работы (Все проекты или Один проект)
    const projectMode = window.getProjectMode ? window.getProjectMode() : 'all';
    const isSingleProjectMode = projectMode === 'single';
    
    console.log('🔍 Режим работы:', projectMode, 'isSingleProjectMode:', isSingleProjectMode);
    
    // Проходим по всем маркерам на карте
    window.map.geoObjects.each((marker, index) => {
        const markerData = marker.data;
        
        // Пропускаем маркеры без данных или служебные маркеры
        if (!markerData?.project || (!markerData.project && !markerData.store)) {
            return;
        }
        
        const projectName = markerData.project;
        
        // Пропускаем Магнит
        if (projectName === 'magnet') {
            return;
        }
        
        // Если режим "Один проект", показываем только выбранный проект
        if (isSingleProjectMode && window.selectedProject && window.selectedProject !== projectName) {
            return;
        }
        
        // Извлекаем вакансии из данных маркера
        const stores = markerData.store.stores || [markerData.store];
        
        stores.forEach(store => {
            let vacancy = null;
            
            // Для ВкусВилл вакансия в поле position, для Лента и Лента Штат - в поле vacancy
            if (projectName === 'vkusvill') {
                vacancy = store.position;
            } else if (projectName === 'lenta' || projectName === 'lentaShtat') {
                vacancy = store.vacancy;
            }
            
            // Проверяем, что вакансия валидна
            if (vacancy && vacancy !== '#N/A' && vacancy !== '-' && vacancy.trim() !== '') {
                const cleanVacancy = vacancy.trim();
                
                if (!projectsVacancies[projectName]) {
                    projectsVacancies[projectName] = new Set();
                    vacancyCounts[projectName] = {};
                }
                
                projectsVacancies[projectName].add(cleanVacancy);
                vacancyCounts[projectName][cleanVacancy] = (vacancyCounts[projectName][cleanVacancy] || 0) + 1;
            }
        });
    });
    
    // Преобразуем Set в массивы и сортируем, добавляем информацию о количестве
    const result = {};
    Object.entries(projectsVacancies).forEach(([projectName, vacanciesSet]) => {
        result[projectName] = Array.from(vacanciesSet).sort().map(vacancy => ({
            name: vacancy,
            count: vacancyCounts[projectName][vacancy] || 0
        }));
    });
    
    console.log('🔍 Итоговый результат извлечения вакансий:', result);
    console.log('🔍 Количество проектов с вакансиями:', Object.keys(result).length);
    
    return result;
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ОТОБРАЖЕНИЕ ПУСТОГО СПИСКА
// ========================================
function displayEmptyVacanciesList() {
    const container = document.getElementById('vacancyListContainer');
    if (!container) {
        console.error('❌ Контейнер списка вакансий не найден');
        return;
    }
    
    container.innerHTML = `
        <div style="text-align: center; color: #666; font-style: italic; padding: 20px;">
            <p>Вакансии не найдены</p>
            <p style="font-size: 14px; margin-top: 10px;">Убедитесь, что проект загружен и на карте есть маркеры</p>
        </div>
    `;
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ОТОБРАЖЕНИЕ СПИСКА ПО ПРОЕКТАМ
// ========================================
function displayVacanciesByProjects(projectsVacancies) {
    const container = document.getElementById('vacancyListContainer');
    if (!container) {
        console.error('❌ Контейнер списка вакансий не найден');
        return;
    }
    
    // Валидация входных данных
    if (!projectsVacancies || typeof projectsVacancies !== 'object') {
        console.error('❌ Неверный формат данных вакансий');
        displayEmptyVacanciesList();
        return;
    }
    
    if (Object.keys(projectsVacancies).length === 0) {
        displayEmptyVacanciesList();
        return;
    }
    
    // Создаем HTML для списка вакансий по проектам
    const projectsHTML = Object.entries(projectsVacancies).map(([projectName, vacancies]) => {
        // Валидация данных проекта
        if (!projectName || !Array.isArray(vacancies)) {
            console.warn('⚠️ Неверные данные проекта:', projectName, vacancies);
            return '';
        }
        
        const projectDisplayName = getProjectDisplayName(projectName);
        const vacanciesHTML = vacancies.map(vacancy => {
            // Валидация данных вакансии
            if (!vacancy) {
                console.warn('⚠️ Пустая вакансия в проекте:', projectName);
                return '';
            }
            
            const vacancyName = typeof vacancy === 'string' ? vacancy : vacancy.name;
            const vacancyCount = typeof vacancy === 'object' ? vacancy.count : 0;
            
            if (!vacancyName || vacancyName.trim() === '') {
                console.warn('⚠️ Пустое название вакансии в проекте:', projectName);
                return '';
            }
            
            const countText = vacancyCount > 0 ? ` (${vacancyCount})` : '';
            
            return `
                <button 
                    class="vacancy-button ${selectedVacancies.has(vacancyName) ? 'selected' : ''}" 
                    data-vacancy="${vacancyName.replace(/"/g, '&quot;')}"
                    onclick="toggleVacancySelection('${vacancyName.replace(/'/g, "\\'")}')"
                    title="Количество магазинов: ${vacancyCount}"
                >
                    ${vacancyName}${countText}
                </button>
            `;
        }).filter(html => html !== '').join('');
        
        if (vacanciesHTML === '') {
            console.warn('⚠️ Нет валидных вакансий в проекте:', projectName);
            return '';
        }
        
        return `
            <div class="project-section">
                <h4 class="project-title">${projectDisplayName}</h4>
                <div class="vacancies-grid">
                    ${vacanciesHTML}
                </div>
            </div>
        `;
    }).filter(html => html !== '').join('');
    
    if (projectsHTML === '') {
        console.warn('⚠️ Не удалось создать HTML для вакансий');
        displayEmptyVacanciesList();
        return;
    }
    
    container.innerHTML = `
        <div class="vacancy-list">
            ${projectsHTML}
        </div>
    `;
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ПОЛУЧЕНИЕ НАЗВАНИЯ ПРОЕКТА
// ========================================
function getProjectDisplayName(projectName) {
    const projectNames = {
        'lenta': 'Лента',
        'lentaShtat': 'Лента Штат',
        'vkusvill': 'ВкусВилл'
    };
    return projectNames[projectName] || projectName;
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ПЕРЕКЛЮЧЕНИЕ ВЫБОРА ВАКАНСИИ
// ========================================
function toggleVacancySelection(vacancy) {
    // Валидация входных данных
    if (!vacancy || typeof vacancy !== 'string' || vacancy.trim() === '') {
        console.warn('⚠️ Неверные данные вакансии для переключения:', vacancy);
        return;
    }
    
    const cleanVacancy = vacancy.trim();
    
    if (selectedVacancies.has(cleanVacancy)) {
        selectedVacancies.delete(cleanVacancy);
    } else {
        selectedVacancies.add(cleanVacancy);
    }
    
    // Обновляем визуальное состояние кнопки
    const button = document.querySelector(`[data-vacancy="${cleanVacancy.replace(/"/g, '&quot;')}"]`);
    if (button) {
        button.classList.toggle('selected', selectedVacancies.has(cleanVacancy));
    } else {
        console.warn('⚠️ Кнопка вакансии не найдена:', cleanVacancy);
    }
    
    updateVacancyFilterStatus();
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ОБНОВЛЕНИЕ СТАТУСА
// ========================================
function updateVacancyFilterStatus() {
    const statusText = selectedVacancies.size > 0 
        ? `Выбрано вакансий: ${selectedVacancies.size}`
        : 'Выберите вакансии для фильтрации';
    console.log(`🔍 Статус фильтра: ${statusText}`);
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ОБРАБОТЧИКИ СОБЫТИЙ
// ========================================
function setupVacancyFilterEventListeners() {
    // Обработчик для кнопки "Показать"
    const showVacancyFilterBtn = document.getElementById('showVacancyFilterBtn');
    if (showVacancyFilterBtn) {
        showVacancyFilterBtn.addEventListener('click', () => {
            applyVacancyFilter();
        });
    }
    
    // Обработчик для кнопки "Сбросить фильтр"
    const resetVacancyFilterBtn = document.getElementById('resetVacancyFilterBtn');
    if (resetVacancyFilterBtn) {
        resetVacancyFilterBtn.addEventListener('click', () => {
            resetVacancyFilter();
        });
    }
    
    // Обработчик для кнопки "Закрыть"
    const closeVacancyFilterBtn = document.getElementById('closeVacancyFilterBtn');
    if (closeVacancyFilterBtn) {
        closeVacancyFilterBtn.addEventListener('click', () => {
            hideVacancyFilterModal();
        });
    }
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - МОДАЛЬНОЕ ОКНО
// ========================================
function showVacancyFilterModal() {
    console.log('🔍 Открытие модального окна фильтра...');
    if (window.isModalOpen) return;
    
    window.isModalOpen = true;
    const modal = document.getElementById('vacancyFilterModal');
    if (modal) {
        modal.style.display = 'flex';
        console.log('🔍 Модальное окно отображено, инициализируем фильтр...');
        // Инициализируем фильтр при открытии
        initVacancyFilter();
    } else {
        console.error('❌ Модальное окно фильтра не найдено');
    }
}

function hideVacancyFilterModal() {
    window.isModalOpen = false;
    const modal = document.getElementById('vacancyFilterModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ПРИМЕНЕНИЕ ФИЛЬТРА
// ========================================
function applyVacancyFilter() {
    try {
        console.log('🔍 Применение фильтра по вакансиям...');
        console.log('🔍 Выбранные вакансии:', Array.from(selectedVacancies));
        
        if (selectedVacancies.size === 0) {
            console.log('⚠️ Не выбрано ни одной вакансии для фильтрации');
            return;
        }
        
        // Применяем фильтр к маркерам
        filterMarkersByVacancies();
        
        hideVacancyFilterModal();
        console.log(`✅ Фильтр применен: показано ${selectedVacancies.size} типов вакансий`);
    } catch (error) {
        console.error('❌ Ошибка применения фильтра:', error);
    }
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ФИЛЬТРАЦИЯ МАРКЕРОВ
// ========================================
function filterMarkersByVacancies() {
    if (!window.map?.geoObjects) {
        console.error('❌ Карта или geoObjects не найдены');
        return;
    }
    
    console.log('🔍 Начинаем фильтрацию маркеров...');
    
    let visibleMarkers = 0;
    let hiddenMarkers = 0;
    
    // Проходим по всем маркерам на карте
    window.map.geoObjects.each((marker, index) => {
        const markerData = marker.data;
        
        // Пропускаем служебные маркеры
        if (!markerData?.project) {
            return;
        }
        
        const projectName = markerData.project;
        
        // Скрываем Магнит
        if (projectName === 'magnet') {
            marker.options.set('visible', false);
            hiddenMarkers++;
            return;
        }
        
        // Проверяем, есть ли в маркере выбранные вакансии
        const hasSelectedVacancy = checkMarkerHasSelectedVacancies(markerData, projectName);
        
        marker.options.set('visible', hasSelectedVacancy);
        if (hasSelectedVacancy) {
            visibleMarkers++;
        } else {
            hiddenMarkers++;
        }
    });
    
    console.log(`✅ Фильтрация завершена: показано ${visibleMarkers} маркеров, скрыто ${hiddenMarkers} маркеров`);
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ПРОВЕРКА ВАКАНСИЙ В МАРКЕРЕ
// ========================================
function checkMarkerHasSelectedVacancies(markerData, projectName) {
    const stores = markerData.store.stores || [markerData.store];
    
    return stores.some(store => {
        let vacancy = null;
        
        // Для ВкусВилл вакансия в поле position, для Лента и Лента Штат - в поле vacancy
        if (projectName === 'vkusvill') {
            vacancy = store.position;
        } else if (projectName === 'lenta' || projectName === 'lentaShtat') {
            vacancy = store.vacancy;
        }
        
        // Проверяем, что вакансия валидна и выбрана пользователем
        return vacancy && vacancy !== '#N/A' && vacancy !== '-' && 
               vacancy.trim() !== '' && selectedVacancies.has(vacancy.trim());
    });
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - СБРОС ФИЛЬТРА
// ========================================
function resetVacancyFilter() {
    console.log('🔍 Сброс фильтра по вакансиям...');
    
    if (!window.map?.geoObjects) {
        console.error('❌ Карта или geoObjects не найдены');
        return;
    }
    
    // Показываем все маркеры
    window.map.geoObjects.each(marker => {
        marker.options.set('visible', true);
    });
    
    // Очищаем выбранные вакансии
    selectedVacancies.clear();
    
    // Обновляем UI
    document.querySelectorAll('.vacancy-button.selected').forEach(button => {
        button.classList.remove('selected');
    });
    
    console.log('✅ Фильтр сброшен: все маркеры показаны');
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ОТОБРАЖЕНИЕ ОШИБКИ
// ========================================
function showVacancyFilterError(message) {
    const container = document.getElementById('vacancyListContainer');
    if (container) {
        container.innerHTML = `
            <div class="vacancy-filter-error">
                <p style="text-align: center; color: #dc3545; font-weight: 500; padding: 20px;">
                    ❌ ${message}
                </p>
            </div>
        `;
    }
}

// ========================================
// 🔍 ФИЛЬТР ПО ВАКАНСИЯМ - ЭКСПОРТ ФУНКЦИЙ
// ========================================
window.initVacancyFilter = initVacancyFilter;
window.showVacancyFilterModal = showVacancyFilterModal;
window.hideVacancyFilterModal = hideVacancyFilterModal;
window.applyVacancyFilter = applyVacancyFilter;
window.toggleVacancySelection = toggleVacancySelection;
window.extractVacanciesByProjects = extractVacanciesByProjects;
window.filterMarkersByVacancies = filterMarkersByVacancies;
window.resetVacancyFilter = resetVacancyFilter;