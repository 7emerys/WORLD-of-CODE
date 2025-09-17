document.addEventListener("DOMContentLoaded", async function() {
    // Проверка авторизации
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
    async function loadProfileData()
    {
        try
        {
            const response = await fetch("/api/profile/data", {credentials: 'include'});

            if (response.status === 401)
            {
                window.location.href = "/static/login.html";
                return;
            }

            const data = await response.json();

            if (data.success)
            {
                // Обновляем данные на странице
                document.querySelector(".profile-name").textContent = data.username;
                document.getElementById("logo").src = data.avatar;
            }

            else
            {
                console.error("Ошибка загрузки данных:", data.message);
            }
        }
        catch (error)
        {
            console.error("Ошибка сети:", error);
        }
    }

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