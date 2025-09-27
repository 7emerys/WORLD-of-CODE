// Функция для проверки авторизации
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth', {
            credentials: 'include'
        });
        return await response.json();
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        return { authenticated: false };
    }
}

async function showUserProfile(userData) {
    const authButtons = document.getElementById('authButtons');

    if (!authButtons) {
        console.error('Элемент authButtons не найден');
        return;
    }

    // Создаем контейнер для профиля
    const profileDiv = document.createElement('div');
    profileDiv.className = 'user-profile';

    const profileDropdown = document.createElement('div');
    profileDropdown.className = 'profile-dropdown';

    try {
        // Загружаем данные профиля
        const response = await fetch("/api/profile/data", {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const data = await response.json();

        // Создаем аватар
        const avatarImg = document.createElement('img');
        avatarImg.src = data.avatar || '/static/images/default-avatar.png';
        avatarImg.className = 'user-avatar';
        avatarImg.alt = 'Аватар пользователя';
        avatarImg.onerror = function() {
            this.src = '/static/images/default-avatar.png';
        };

        // Создаем выпадающее меню
        const dropdownMenu = document.createElement('div');
        dropdownMenu.id = 'dropdownMenu';
        dropdownMenu.className = 'dropdown-menu';

        // Элементы меню
        const profileLink = document.createElement('a');
        profileLink.className = 'dropdown-item';
        profileLink.href = '/static/profile.html';
        profileLink.textContent = 'Профиль';

        const divider = document.createElement('div');
        divider.className = 'dropdown-divider';

        const logoutBtn = document.createElement('a');
        logoutBtn.className = 'dropdown-item';
        logoutBtn.href = '#';
        logoutBtn.textContent = 'Выйти';
        logoutBtn.onclick = function(e) {
            e.preventDefault();
            logout();
        };

        // Собираем меню
        dropdownMenu.appendChild(profileLink);
        dropdownMenu.appendChild(divider);
        dropdownMenu.appendChild(logoutBtn);

        // Собираем профиль
        profileDropdown.appendChild(avatarImg);
        profileDropdown.appendChild(dropdownMenu);
        profileDiv.appendChild(profileDropdown);

        // Обработчик клика по аватару
        avatarImg.onclick = function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        };

        // Заменяем кнопки на аватар
        authButtons.innerHTML = '';
        authButtons.appendChild(profileDiv);

    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        // Можно показать заглушку или оставить кнопки авторизации
        authButtons.innerHTML = '<a href="/static/login.html">Войти</a>';
    }
}

// Функция для выхода из системы
async function logout() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.reload();
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}

// Закрытие выпадающего меню при клике вне его
document.addEventListener('click', function(event) {
    const dropdownMenu = document.getElementById('dropdownMenu');
    const avatarImg = document.querySelector('.user-avatar');

    if (dropdownMenu && dropdownMenu.classList.contains('show') &&
        !dropdownMenu.contains(event.target) &&
        !avatarImg.contains(event.target)) {
        dropdownMenu.classList.remove('show');
    }
});

// Основная функция инициализации
document.addEventListener('DOMContentLoaded', async function() {
    const authData = await checkAuth();

    if (authData.authenticated && authData.user) {
        // Пользователь авторизован - показываем аватарку
        showUserProfile(authData.user);
    }

    // Обработчик кнопки "Начать"
    document.getElementById('startButton').addEventListener('click', async function() {
        const authData = await checkAuth();
        if (authData.authenticated) {
            window.location.href = '/static/tasks.html';
        } else {
            if (authData.message === "Токен истёк") {
                alert("Ваша сессия истекла. Авторизуйтесь снова.");
            }
            window.location.href = '/static/login.html';
        }
    });
});
