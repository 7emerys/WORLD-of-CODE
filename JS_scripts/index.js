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

    // Функция для отображения аватарки пользователя
    function showUserProfile(userData) {
        const authButtons = document.getElementById('authButtons');

        // Создаем элемент аватарки
        const profileDiv = document.createElement('div');
        profileDiv.className = 'user-profile';

        const profileDropdown = document.createElement('div');
        profileDropdown.className = 'profile-dropdown';

        const avatarImg = document.createElement('img');
        avatarImg.className = 'user-avatar';
        avatarImg.src = userData.avatar || '/img/default-avatar.png';
        avatarImg.alt = 'Аватар пользователя';
        avatarImg.onclick = function() {
            document.getElementById('dropdownMenu').classList.toggle('show');
        };

        const dropdownMenu = document.createElement('div');
        dropdownMenu.id = 'dropdownMenu';
        dropdownMenu.className = 'dropdown-menu';

        // Элементы выпадающего меню
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

        dropdownMenu.appendChild(profileLink);
        dropdownMenu.appendChild(divider);
        dropdownMenu.appendChild(logoutBtn);

        profileDropdown.appendChild(avatarImg);
        profileDropdown.appendChild(dropdownMenu);
        profileDiv.appendChild(profileDropdown);

        // Заменяем кнопки на аватарку
        authButtons.innerHTML = '';
        authButtons.appendChild(profileDiv);
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
