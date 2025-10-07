
let selectedVacancies = new Set(); 

function initVacancyFilter() {
    console.log('🔍 Инициализация фильтра по вакансиям...');
    
    if (!window.map || !window.map.geoObjects) {
        console.warn('⚠️ Карта не загружена, ждем...');
        setTimeout(initVacancyFilter, 1000);
        return;
    }
    
    loadVacanciesList();
    
    setupVacancyFilterEventListeners();
}

function loadVacanciesList() {
    try {
        const projectsVacancies = extractVacanciesByProjects();
        
        if (!projectsVacancies || Object.keys(projectsVacancies).length === 0) {
            console.warn('⚠️ Не найдено вакансий для отображения');
            displayEmptyVacanciesList();
            return;
        }
        
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

function extractVacanciesByProjects() {
    const projectsVacancies = {};
    const vacancyCounts = {};
    
    console.log('🔍 Извлечение вакансий из маркеров...');
    
    if (!window.map?.geoObjects) {
        console.warn('⚠️ Карта или geoObjects не найдены');
        return {};
    }
    
    const geoObjectsLength = window.map.geoObjects.getLength();
    if (geoObjectsLength === 0) {
        console.warn('⚠️ На карте нет маркеров');
        return {};
    }
    
    const projectMode = window.getProjectMode ? window.getProjectMode() : 'all';
    const isSingleProjectMode = projectMode === 'single';
    
    console.log('🔍 Режим работы:', projectMode, 'isSingleProjectMode:', isSingleProjectMode);
    
    window.map.geoObjects.each((marker, index) => {
        const markerData = marker.data;
        
        if (!markerData?.project || (!markerData.project && !markerData.store)) {
            return;
        }
        
        const projectName = markerData.project;
        
        if (projectName === 'magnet') {
            return;
        }
        
        if (isSingleProjectMode && window.selectedProject && window.selectedProject !== projectName) {
            return;
        }
        
        const stores = markerData.store.stores || [markerData.store];
        
        stores.forEach(store => {
            let vacancy = null;
            
            if (projectName === 'vkusvill') {
                vacancy = store.position;
            } else if (projectName === 'lenta' || projectName === 'lentaShtat') {
                vacancy = store.vacancy;
            }
            
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

function displayVacanciesByProjects(projectsVacancies) {
    const container = document.getElementById('vacancyListContainer');
    if (!container) {
        console.error('❌ Контейнер списка вакансий не найден');
        return;
    }
    
    if (!projectsVacancies || typeof projectsVacancies !== 'object') {
        console.error('❌ Неверный формат данных вакансий');
        displayEmptyVacanciesList();
        return;
    }
    
    if (Object.keys(projectsVacancies).length === 0) {
        displayEmptyVacanciesList();
        return;
    }
    
    const projectsHTML = Object.entries(projectsVacancies).map(([projectName, vacancies]) => {
        if (!projectName || !Array.isArray(vacancies)) {
            console.warn('⚠️ Неверные данные проекта:', projectName, vacancies);
            return '';
        }
        
        const projectDisplayName = getProjectDisplayName(projectName);
        const vacanciesHTML = vacancies.map(vacancy => {
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

function getProjectDisplayName(projectName) {
    const projectNames = {
        'lenta': 'Лента',
        'lentaShtat': 'Лента Штат',
        'vkusvill': 'ВкусВилл'
    };
    return projectNames[projectName] || projectName;
}

function toggleVacancySelection(vacancy) {
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
    
    const button = document.querySelector(`[data-vacancy="${cleanVacancy.replace(/"/g, '&quot;')}"]`);
    if (button) {
        button.classList.toggle('selected', selectedVacancies.has(cleanVacancy));
    } else {
        console.warn('⚠️ Кнопка вакансии не найдена:', cleanVacancy);
    }
    
    updateVacancyFilterStatus();
}

function updateVacancyFilterStatus() {
    const statusText = selectedVacancies.size > 0 
        ? `Выбрано вакансий: ${selectedVacancies.size}`
        : 'Выберите вакансии для фильтрации';
    console.log(`🔍 Статус фильтра: ${statusText}`);
}

function setupVacancyFilterEventListeners() {
    const showVacancyFilterBtn = document.getElementById('showVacancyFilterBtn');
    if (showVacancyFilterBtn) {
        showVacancyFilterBtn.addEventListener('click', () => {
            applyVacancyFilter();
        });
    }
    
    const resetVacancyFilterBtn = document.getElementById('resetVacancyFilterBtn');
    if (resetVacancyFilterBtn) {
        resetVacancyFilterBtn.addEventListener('click', () => {
            resetVacancyFilter();
        });
    }
    
    const closeVacancyFilterBtn = document.getElementById('closeVacancyFilterBtn');
    if (closeVacancyFilterBtn) {
        closeVacancyFilterBtn.addEventListener('click', () => {
            hideVacancyFilterModal();
        });
    }
}

function showVacancyFilterModal() {
    console.log('🔍 Открытие модального окна фильтра...');
    if (window.isModalOpen) return;
    
    window.isModalOpen = true;
    const modal = document.getElementById('vacancyFilterModal');
    if (modal) {
        modal.style.display = 'flex';
        console.log('🔍 Модальное окно отображено, инициализируем фильтр...');
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

function applyVacancyFilter() {
    try {
        console.log('🔍 Применение фильтра по вакансиям...');
        console.log('🔍 Выбранные вакансии:', Array.from(selectedVacancies));
        
        if (selectedVacancies.size === 0) {
            console.log('⚠️ Не выбрано ни одной вакансии для фильтрации');
            return;
        }
        
        filterMarkersByVacancies();
        
        hideVacancyFilterModal();
        console.log(`✅ Фильтр применен: показано ${selectedVacancies.size} типов вакансий`);
    } catch (error) {
        console.error('❌ Ошибка применения фильтра:', error);
    }
}

function filterMarkersByVacancies() {
    if (!window.map?.geoObjects) {
        console.error('❌ Карта или geoObjects не найдены');
        return;
    }
    
    console.log('🔍 Начинаем фильтрацию маркеров...');
    
    let visibleMarkers = 0;
    let hiddenMarkers = 0;
    
    window.map.geoObjects.each((marker, index) => {
        const markerData = marker.data;
        
        if (!markerData?.project) {
            return;
        }
        
        const projectName = markerData.project;
        
        if (projectName === 'magnet') {
            marker.options.set('visible', false);
            hiddenMarkers++;
            return;
        }
        
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

function checkMarkerHasSelectedVacancies(markerData, projectName) {
    const stores = markerData.store.stores || [markerData.store];
    
    return stores.some(store => {
        let vacancy = null;
        
        if (projectName === 'vkusvill') {
            vacancy = store.position;
        } else if (projectName === 'lenta' || projectName === 'lentaShtat') {
            vacancy = store.vacancy;
        }
        
        return vacancy && vacancy !== '#N/A' && vacancy !== '-' && 
               vacancy.trim() !== '' && selectedVacancies.has(vacancy.trim());
    });
}

function resetVacancyFilter() {
    console.log('🔍 Сброс фильтра по вакансиям...');
    
    if (!window.map?.geoObjects) {
        console.error('❌ Карта или geoObjects не найдены');
        return;
    }
    
    window.map.geoObjects.each(marker => {
        marker.options.set('visible', true);
    });
    
    selectedVacancies.clear();
    
    document.querySelectorAll('.vacancy-button.selected').forEach(button => {
        button.classList.remove('selected');
    });
    
    console.log('✅ Фильтр сброшен: все маркеры показаны');
}

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

window.initVacancyFilter = initVacancyFilter;
window.showVacancyFilterModal = showVacancyFilterModal;
window.hideVacancyFilterModal = hideVacancyFilterModal;
window.applyVacancyFilter = applyVacancyFilter;
window.toggleVacancySelection = toggleVacancySelection;
window.extractVacanciesByProjects = extractVacanciesByProjects;
window.filterMarkersByVacancies = filterMarkersByVacancies;
window.resetVacancyFilter = resetVacancyFilter;
