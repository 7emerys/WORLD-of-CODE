document.addEventListener("DOMContentLoaded", function() {
    init();
    loadProfileData();
});

// Элементы DOM
const gallery = document.getElementById("gallery");
const settingsBtn = document.getElementById('settings-btn');
const popupMenu = document.getElementById('popup-menu');
const tasksContainer = document.querySelector('.all_task');
let selectedLanguage = null;

// 1. Проверка авторизации


// 2. Инициализация языков с бесконечной прокруткой
function initLanguages() {
    selectedLanguage = localStorage.getItem('selectedLanguage') || 'JS';
    const originalItems = Array.from(document.querySelectorAll('.image-wrapper'));

    // Очищаем галерею
    gallery.innerHTML = '';

    // Создаем 5 копий оригинальных элементов (для бесконечного эффекта)
    for (let i = 0; i < 5; i++) {
        originalItems.forEach(item => {
            const clone = item.cloneNode(true);
            const languageName = clone.querySelector('img').alt;
            clone.dataset.langName = languageName;
            gallery.appendChild(clone);
        });
    }

    // Центрируем выбранный язык
    setTimeout(() => {
        const items = Array.from(document.querySelectorAll('.image-wrapper'));
        const targetItem = items.find(item =>
            item.dataset.langName === selectedLanguage
        ) || items[Math.floor(items.length / 2)];

        scrollToItem(targetItem);
    }, 100);
}

// Прокрутка к конкретному элементу
function scrollToItem(item) {
    const galleryWidth = gallery.offsetWidth;
    const itemLeft = item.offsetLeft;
    const itemWidth = item.offsetWidth;

    gallery.scrollLeft = itemLeft - (galleryWidth / 2) + (itemWidth / 2);
    updateActiveLanguage();
}

// 3. Настройка бесконечного скролла
function setupLanguageScroll() {
    let isScrolling = false;
    let scrollTimeout;
    const items = document.querySelectorAll('.image-wrapper');
    const itemWidth = items[0]?.offsetWidth || 170;
    const scrollThreshold = itemWidth * 2;

    gallery.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (isScrolling) return;

            updateActiveLanguage();

            // Бесконечный скролл вправо
            if (gallery.scrollLeft > gallery.scrollWidth - gallery.offsetWidth - scrollThreshold) {
                isScrolling = true;
                gallery.scrollLeft -= itemWidth * 5;
                setTimeout(() => isScrolling = false, 100);
            }
            // Бесконечный скролл влево
            else if (gallery.scrollLeft < scrollThreshold) {
                isScrolling = true;
                gallery.scrollLeft += itemWidth * 5;
                setTimeout(() => isScrolling = false, 100);
            }
        }, 50);
    });

    // Обработчик клика для выбора языка
    gallery.addEventListener('click', (e) => {
        const clickedWrapper = e.target.closest('.image-wrapper');
        if (!clickedWrapper) return;

        // Получаем имя языка из dataset
        const languageName = clickedWrapper.dataset.langName;
        if (!languageName) return;

        selectedLanguage = languageName;
        localStorage.setItem('selectedLanguage', selectedLanguage);

        // Прокручиваем к центру с анимацией
        smoothScrollToItem(clickedWrapper);
    });
}

// Плавная прокрутка к элементу
function smoothScrollToItem(item) {
    const galleryWidth = gallery.offsetWidth;
    const itemLeft = item.offsetLeft;
    const itemWidth = item.offsetWidth;

    const targetScroll = itemLeft - (galleryWidth / 2) + (itemWidth / 2);

    gallery.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
    });

    // Обновляем активный язык после завершения анимации
    setTimeout(updateActiveLanguage, 300);
}

// 4. Обновление активного языка
function updateActiveLanguage() {
    const center = gallery.scrollLeft + gallery.offsetWidth / 2;
    let newActive = null;

    document.querySelectorAll('.image-wrapper').forEach(wrapper => {
        const wrapperCenter = wrapper.offsetLeft + wrapper.offsetWidth / 2;
        const distance = Math.abs(wrapperCenter - center);

        if (distance < wrapper.offsetWidth / 2) {
            wrapper.classList.add('active');
            newActive = wrapper.dataset.langName;
        } else {
            wrapper.classList.remove('active');
        }
    });

    if (newActive && newActive !== selectedLanguage) {
        selectedLanguage = newActive;
        localStorage.setItem('selectedLanguage', selectedLanguage);
    }
}

// 5. Загрузка задач из БД
async function loadAllTasks() {
    try {
        tasksContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Загрузка задач...</p>
            </div>
        `;

        const response = await fetch('/api/tasks', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (!data || !data.tasks || data.tasks.length === 0) {
            throw new Error('Нет задач в базе данных');
        }

        renderTasks(data.tasks);

    } catch (error) {
        console.error('Ошибка загрузки задач:', error);
        renderErrorState(error.message);
    }
}

// 6. Отрисовка задач
function renderTasks(tasks) {
    tasksContainer.innerHTML = '';

    if (tasks.length < 10) {
        tasksContainer.innerHTML += `
            <div class="warning-message">
                <p>В базе данных меньше 10 задач (найдено: ${tasks.length})</p>
            </div>
        `;
    }

    // Создаем строки по 2 задачи в каждой
    for (let i = 0; i < tasks.length; i += 2) {
        const row = document.createElement('div');
        row.className = 'task_row';

        // Первая задача в ряду
        if (tasks[i]) {
            row.appendChild(createTaskElement(tasks[i]));
        }

        // Вторая задача в ряду (или пустой блок для выравнивания)
        if (tasks[i + 1]) {
            row.appendChild(createTaskElement(tasks[i + 1]));
        } else {
            // Добавляем пустой блок для выравнивания
            const emptyTask = document.createElement('div');
            emptyTask.className = 'task empty';
            row.appendChild(emptyTask);
        }

        tasksContainer.appendChild(row);
    }
}

// 7. Создание элемента задачи
function createTaskElement(task) {
    const element = document.createElement('div');
    element.className = 'task active-task';

    // Форматируем описание задачи
    const shortDescription = task.short_description || task.description || 'Описание появится скоро';
    const truncatedDescription = shortDescription.length > 100
        ? shortDescription.substring(0, 100) + '...'
        : shortDescription;

    element.innerHTML = `
        <img src="${task.logo_url || '/img/task/Python.png'}"
             class="world"
             alt="${task.title || 'Задача'}">
        <p class="task_text">${(task.title || 'НОВАЯ ЗАДАЧА').toUpperCase()}</p>
        <p class="task_text2">${truncatedDescription}</p>
    `;

    element.onclick = () => {
        saveUserSelection(task.id, selectedLanguage)
            .then(() => {
                window.location.href = `/interpretator.html?task_id=${task.id}&lang=${encodeURIComponent(selectedLanguage)}`;
            })
    };

    return element;
}

// 8. Сохранение выбора пользователя
async function saveUserSelection(taskId, language) {
    try {
        const response = await fetch('/api/save-selection', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                task_id: taskId,
                language: language
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка сохранения выбора');
        }

        return await response.json();
    } catch (error) {
        console.error('Ошибка:', error);
        throw error;
    }
}

// 9. Отрисовка состояния ошибки
function renderErrorState(message = 'Произошла ошибка при загрузке задач') {
    tasksContainer.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
            <button class="retry-btn">Попробовать снова</button>
        </div>
    `;
    tasksContainer.querySelector('.retry-btn').onclick = loadAllTasks;
}

// 10. Настройка всплывающего меню
function setupPopupMenu() {
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popupMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => popupMenu.classList.remove('active'));
    popupMenu.addEventListener('click', (e) => e.stopPropagation());
}

// Инициализация при загрузке страницы
async function init() {
    if (await checkAuth()) {
        initLanguages();
        setupLanguageScroll();
        setupPopupMenu();
        loadAllTasks();
    }
}

// Загрузка аватара
    async function loadProfileData() {
        try {
            const response = await fetch("/api/profile/data", {credentials: 'include'});

            if (response.status === 401) {
                window.location.href = "/static/login.html";
                return;
            }

            const data = await response.json();

            if (data.success) {
                // Обновляем данные на странице
                document.getElementById("logo2").src = data.avatar;

                // Устанавливаем уровень
                    const levelRadio = document.querySelector(`input[name="level"][value="${data.jms}"]`);
                    if (levelRadio) levelRadio.checked = true;
            } else {
                    showNotification("Ошибка загрузки данных профиля", 'error');
                }
        } catch (error) {
            console.error("Ошибка сети:", error);
        }
    }

// Запускаем инициализацию
init();