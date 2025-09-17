document.addEventListener("DOMContentLoaded", async function() {
    // Элементы страницы
    const imageInput = document.getElementById('image-input');
    const uploadBtn = document.getElementById('upload-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const logo = document.getElementById('logo');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');

    // Функция для показа уведомлений
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '5px';
        notification.style.color = 'white';
        notification.style.zIndex = '1000';
        notification.style.transition = 'opacity 0.5s';

        if (type === 'success') {
            notification.style.backgroundColor = '#4CAF50';
        } else {
            notification.style.backgroundColor = '#F44336';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }

    // Функция для проверки авторизации
    async function checkAuth() {
        try {
            const response = await fetch("/api/check-auth", {
                credentials: 'include'
            });
            return await response.json();
        } catch (error) {
            console.error("Auth check failed:", error);
            return {authenticated: false};
        }
    }

    // Загрузка данных профиля
    async function loadProfileData() {
        try {
            const response = await fetch("/api/profile/data", {
                credentials: 'include'
            });

            if (response.status === 401) {
                window.location.href = "/static/login.html";
                return;
            }

            const data = await response.json();

            if (data.success) {
                // Заполняем поля формы
                document.querySelector(".pseudo-input").value = data.username || '';
                document.querySelector(".pseudo-input2").value = data.bio || '';
                document.querySelector(".language-select").value = data.fav_lang || '';
                document.querySelector(".City_select").value = data.city || '';
                if (data.avatar) {
                    document.getElementById("logo").src = data.avatar;
                }

                // Устанавливаем уровень
                const levelRadio = document.querySelector(`input[name="level"][value="${data.jms}"]`);
                if (levelRadio) levelRadio.checked = true;
            } else {
                showNotification("Ошибка загрузки данных профиля", 'error');
            }
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
            showNotification("Ошибка загрузки данных профиля", 'error');
        }
    }

    // Обработчик кнопки "Обновить" (аватар)
    uploadBtn.addEventListener('click', function() {
        imageInput.click();
    });

    imageInput.addEventListener('change', async function(e) {
        if (e.target.files && e.target.files[0]) {
            const formData = new FormData();
            formData.append('avatar', e.target.files[0]);

            try {
                const response = await fetch("/api/profile/update-avatar", {
                    method: "POST",
                    credentials: 'include',
                    body: formData
                });

                const result = await response.json();
                if (result.success) {
                    document.getElementById("logo").src = result.avatar;
                    showNotification("Аватар успешно обновлен", 'success');
                } else {
                    showNotification("Ошибка: " + result.message, 'error');
                }
            } catch (error) {
                showNotification("Ошибка загрузки аватара", 'error');
                console.error(error);
            }
        }
    });

    // Обработчик кнопки "Сохранить" (все данные, кроме аватара)
    document.querySelector(".btn_save").addEventListener("click", async function() {
        const formData = new FormData();
        formData.append("username", document.querySelector(".pseudo-input").value);
        formData.append("bio", document.querySelector(".pseudo-input2").value);
        formData.append("fav_lang", document.querySelector(".language-select").value);
        formData.append("city", document.querySelector(".City_select").value);
        formData.append("level", document.querySelector('input[name="level"]:checked').value);

        try {
            const response = await fetch("/api/profile/update", {
                method: "POST",
                credentials: 'include',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                showNotification("Данные профиля сохранены", 'success');
            } else {
                showNotification("Ошибка: " + result.message, 'error');
            }
        } catch (error) {
            showNotification("Произошла ошибка при сохранении данных", 'error');
            console.error(error);
        }
    });

    // Обработчик кнопки "Удалить" аватар
    deleteBtn.addEventListener('click', async function() {
        try {
            const response = await fetch("/api/profile/delete-avatar", {
                method: "POST",
                credentials: 'include'
            });

            const result = await response.json();
            if (result.success) {
                document.getElementById("logo").src = "/img/настройки/logo.png";
                showNotification("Аватар удален", 'success');
            } else {
                showNotification("Ошибка: " + result.message, 'error');
            }
        } catch (error) {
            showNotification("Ошибка удаления аватара", 'error');
            console.error(error);
        }
    });

    // Обработчики модального окна удаления аккаунта
    deleteAccountBtn.addEventListener('click', function() {
        deleteModal.style.display = 'flex';
    });

    cancelDeleteBtn.addEventListener('click', function() {
        deleteModal.style.display = 'none';
    });

    confirmDeleteBtn.addEventListener("click", async function() {
        try {
            const response = await fetch("/api/profile/delete", {
                method: "POST",
                credentials: 'include'
            });

            const result = await response.json();
            if (result.success) {
                window.location.href = "/static/login.html";
            } else {
                showNotification("Ошибка: " + result.message, 'error');
                deleteModal.style.display = 'none';
            }
        } catch (error) {
            console.error("Ошибка:", error);
            showNotification("Произошла ошибка при удалении аккаунта", 'error');
            deleteModal.style.display = 'none';
        }
    });

    // Инициализация
    async function init() {
        const auth = await checkAuth();
        if (!auth.authenticated) {
            window.location.href = "/static/login.html";
            return;
        }

        await loadProfileData();
    }

    init();
});