const character = document.getElementById('character');
const input1 = document.getElementById('input1');
const input2 = document.getElementById('input2');
const input3 = document.getElementById('input3');
const registerButton = document.getElementById('registerButton');
let currentFrame = 5;

let input2Active = false;
let animationInterval = null;

function playAnimation(startFrame, endFrame, callback) {
    clearInterval(animationInterval);
    let frame = startFrame;
    animationInterval = setInterval(() => {
        character.src = `/img/Сова пнг без фона/${frame}.png`;
        frame++;
        if (frame > endFrame) {
            clearInterval(animationInterval);
            if (callback) callback();
        }
    }, 1);
}

input1.addEventListener('focus', function() {
    playAnimation(currentFrame, 5);
});

input1.addEventListener('input', function(event) {
    if (event.inputType === "deleteContentBackward") {
        if (currentFrame > 5) {
            currentFrame--;
            character.src = `/img/Сова пнг без фона/${currentFrame}.png`;
        }
    } else {
        if (currentFrame < 26) {
            character.src = `/img/Сова пнг без фона/${currentFrame}.png`;
            currentFrame++;
        }
    }
});

input1.addEventListener('blur', function() {
    if (!input2.matches(':focus')) {
        playAnimation(currentFrame, 30);
    }
});

input2.addEventListener('focus', function() {
    clearInterval(animationInterval);
    if (!input2Active) {
        playAnimation(26, 32);
        input2Active = true;
    }
});

input3.addEventListener('focus', function() {
    clearInterval(animationInterval);
    if (!input2Active) {
        playAnimation(26, 32);
        input2Active = true;
    }
});

input2.addEventListener('input', function() {
    character.src = `/img/Сова пнг без фона/32.png`;
});

input2.addEventListener('focus', function() {
    character.src = `/img/Сова пнг без фона/32.png`;
});

input2.addEventListener('blur', function() {
    character.src = "/img/Сова пнг без фона/1.png";
});

input3.addEventListener('input', function() {
    character.src = `/img/Сова пнг без фона/32.png`;
});

input3.addEventListener('focus', function() {
    character.src = `/img/Сова пнг без фона/32.png`;
});

input3.addEventListener('blur', function() {
    character.src = "/img/Сова пнг без фона/1.png";
});

function checkPasswordComplexity(password) {
    const hasMinLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasUpper = /[A-ZА-Я]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    // Обновляем подсказки
    document.getElementById('length-hint').classList.toggle('valid', hasMinLength);
    document.getElementById('number-hint').classList.toggle('valid', hasNumber);
    document.getElementById('upper-hint').classList.toggle('valid', hasUpper);
    document.getElementById('special-hint').classList.toggle('valid', hasSpecial);

    // Рассчитываем сложность пароля (0-4)
    const strength = [hasMinLength, hasNumber, hasUpper, hasSpecial].filter(Boolean).length;
    document.getElementById('strengthBar').style.width = `${strength * 25}%`;

    return hasMinLength && hasNumber && hasUpper && hasSpecial;
}

function checkPasswordsMatch() {
    const password = input2.value;
    const confirmPassword = input3.value;
    const matchElement = document.getElementById('password-match');

    if (password && confirmPassword) {
        if (password !== confirmPassword) {
            matchElement.style.display = 'block';
            return false;
        } else {
            matchElement.style.display = 'none';
            return true;
        }
    }
    matchElement.style.display = 'none';
    return false;
}

function validateForm() {
    const usernameValid = input1.value.trim().length > 0;
    const passwordValid = checkPasswordComplexity(input2.value);
    const passwordsMatch = checkPasswordsMatch();

    registerButton.disabled = !(usernameValid && passwordValid && passwordsMatch);
}

// Слушатели событий
input1.addEventListener('input', validateForm);
input2.addEventListener('input', validateForm);
input3.addEventListener('input', validateForm);

async function register() {
    const username = input1.value.trim();
    const password = input2.value;
    const confirmPassword = input3.value;
    const message = document.getElementById("message");

    // Дополнительная проверка перед отправкой
    if (!checkPasswordComplexity(password)) {
        message.textContent = "Пароль не соответствует требованиям";
        message.style.color = "red";
        return;
    }

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                username: username,
                password: password,
                confirm_password: confirmPassword
            }),
            credentials: "include"
        });

        const result = await response.json();

        if (response.ok) {
            message.textContent = "Регистрация успешна! Перенаправление...";
            message.style.color = "green";

            // Проверяем авторизацию и перенаправляем
            const authCheck = await fetch("/api/check-auth", {
                credentials: "include"
            });

            if (authCheck.ok) {
                window.location.href = "/static/tasks.html";
            } else {
                window.location.href = "/static/login.html";
            }
        } else {
            message.textContent = result.detail || "Ошибка регистрации";
            message.style.color = "red";
        }
    } catch (error) {
        message.textContent = "Ошибка соединения с сервером";
        message.style.color = "red";

        console.error("Ошибка регистрации:", error);
    }
}

// Назначаем обработчик на кнопку
registerButton.addEventListener('click', register);