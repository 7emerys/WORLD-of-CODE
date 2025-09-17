const character = document.getElementById('character');
const input1 = document.getElementById('input1');
const input2 = document.getElementById('input2');
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

input2.addEventListener('input', function() {
    character.src = `/img/Сова пнг без фона/32.png`;
});

input2.addEventListener('focus', function() {
    character.src = `/img/Сова пнг без фона/32.png`;
});

input2.addEventListener('blur', function() {
    character.src = "/img/Сова пнг без фона/1.png";
});

async function login() {
    const formData = new URLSearchParams();
    formData.append('username', document.getElementById('input1').value);
    formData.append('password', document.getElementById('input2').value);

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
            credentials: 'include'
        });

        if (response.ok) {
            // Проверяем авторизацию после успешного входа
            const authCheck = await fetch('/api/check-auth', {
                credentials: 'include'
            });

            if (authCheck.ok) {
                window.location.href = '/static/tasks.html';
            } else {
                document.getElementById('message').textContent = 'Ошибка проверки авторизации';
            }
        } else {
            const error = await response.json();
            document.getElementById('message').textContent = error.detail || 'Ошибка входа';
        }
    } catch (e) {
        document.getElementById('message').textContent = 'Ошибка соединения';
    }
}