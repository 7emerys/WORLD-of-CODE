let codeEditor;
let currentTask;
let currentLanguage;

document.addEventListener('DOMContentLoaded', async function() {
    // Проверка авторизации
    const authResponse = await fetch('/api/check-auth', {
        credentials: 'include'
    });
    const authData = await authResponse.json();

    if (!authData.authenticated) {
        window.location.href = '/static/login.html';
        return;
    }

    // При получении задачи в interpretator.html:
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('task_id');
    const language = urlParams.get('lang'); // Добавляем параметр языка

    if (!taskId || !language) {
        alert('Задача/ЯП не выбраны');
        window.location.href = '/static/tasks.html';
        return;
    }

        try {
            // Загружаем тест-кейсы для выбранного языка
            const response = await fetch(`/api/tasks/${taskId}/test-cases?language=${encodeURIComponent(language)}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки задачи');
            }

            const data = await response.json();
            currentTask = data;
            currentLanguage = language;

            // Отображаем информацию о задаче
            displayTaskInfo();

            // Настройка редактора кода
            setupCodeEditor();

            // Обновляем отображение выбранного языка
            document.querySelector('.lang-name').textContent = language;

        } catch (error) {
            console.error('Ошибка загрузки задачи:', error);
            document.querySelector('.error-container').innerHTML = `
                <p class="test-failed">Ошибка: ${error.message}</p>
                <button onclick="window.location.href='/static/tasks.html'">Вернуться к задачам</button>
            `;
        }

        // Обработчик кнопки "Запустить"
        document.querySelector('.btn-start').addEventListener('click', executeCode);

        // Обработчик кнопки "Назад"
        document.querySelector('.btn-back').addEventListener('click', () => {
            window.location.href = '/static/tasks.html';
        });
    });

function displayTaskInfo() {
    const taskContainer = document.querySelector('.task-container');
    taskContainer.innerHTML = `
        <h2>${currentTask.title}</h2>
        <p><strong>Описание:</strong> ${currentTask.full_description}</p>
        ${currentTask.input_example ? `<p><strong>Пример ввода:</strong> ${currentTask.input_example}</p>` : ''}
        ${currentTask.output_example ? `<p><strong>Пример вывода:</strong> ${currentTask.output_example}</p>` : ''}
    `;
}

function setupCodeEditor() {
    const editor = document.getElementById('code-editor');

    // Определяем режим редактора в зависимости от языка
    const mode = {
        'Python': 'python',
        'JavaScript': 'javascript',
        'C++': 'text/x-c++src',
        'Java': 'text/x-java',
        'C#': 'text/x-csharp'
    }[currentLanguage] || 'python';

    codeEditor = CodeMirror.fromTextArea(editor, {
        lineNumbers: true,
        theme: 'dracula',
        mode: mode,
        indentUnit: 4,
        lineWrapping: true
    });

    // Установим начальный код в зависимости от языка
    const starterCode = {
        'Python': 'def solution():\n    # Ваш код здесь\n    pass',
        'JavaScript': 'function solution() {\n    // Ваш код здесь\n}',
        'C++': '#include <iostream>\n\nint main() {\n    // Ваш код здесь\n    return 0;\n}',
        'Java': 'public class Main {\n    public static void main(String[] args) {\n        // Ваш код здесь\n    }\n}',
        'C#': 'using System;\n\nclass Program {\n    static void Main(string[] args) {\n        // Ваш код здесь\n    }\n}'
    }[currentLanguage] || '';

    codeEditor.setValue(starterCode);
}

async function executeCode() {
    const code = codeEditor.getValue();

    try {
        document.querySelector('.error-container').innerHTML = '<p>Проверка кода...</p>';

        const response = await fetch('/api/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                task_id: currentTask.id,
                code: code,
                language: currentLanguage
            }),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Ошибка сервера');
        }

        const result = await response.json();
        checkTaskStatus(result.task_id);

    } catch (error) {
        console.error('Ошибка выполнения кода:', error);
        document.querySelector('.error-container').innerHTML = `
            <p class="test-failed">Ошибка: ${error.message}</p>
        `;
    }
}

async function checkTaskStatus(taskId) {
    const checkInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/task-status/${taskId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Ошибка проверки статуса');
            }

            const result = await response.json();

            if (result.status === 'completed') {
                clearInterval(checkInterval);
                displayResults(result);
                await saveSolution(result);
            } else if (result.status === 'error') {
                clearInterval(checkInterval);
                document.querySelector('.error-container').innerHTML = `
                    <p class="test-failed">Ошибка: ${result.message}</p>
                `;
            }
        } catch (error) {
            clearInterval(checkInterval);
            console.error('Ошибка проверки статуса:', error);
        }
    }, 1000);
}

function displayResults(result) {
    const solutionContainer = document.querySelector('.solution-container');
    const errorContainer = document.querySelector('.error-container');

    solutionContainer.innerHTML = '<h3>Результаты тестирования:</h3>';
    errorContainer.innerHTML = '';

    result.results.forEach((testCase, index) => {
        const testDiv = document.createElement('div');
        testDiv.className = testCase.passed ? 'test-passed' : 'test-failed';
        testDiv.innerHTML = `
            <p>Тест #${index + 1}: ${testCase.passed ? '✅' : '❌'}</p>
            ${testCase.input ? `<p>Ввод: ${testCase.input}</p>` : ''}
            <p>Ожидалось: ${testCase.expected}</p>
            <p>Получено: ${testCase.actual}</p>
        `;
        solutionContainer.appendChild(testDiv);

        if (!testCase.passed) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'test-failed';
            errorDiv.innerHTML = `<p>Тест #${index + 1} не пройден</p>`;
            errorContainer.appendChild(errorDiv);
        }
    });
}

async function saveSolution(result) {
    try {
        const response = await fetch('/api/save-solution', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                task_id: currentTask.id,
                language: currentLanguage,
                code: codeEditor.getValue(),
                test_results: result.results,
                is_solved: result.passed
            }),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Ошибка сохранения решения');
        }
    } catch (error) {
        console.error('Ошибка сохранения решения:', error);
    }
}

const editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
    mode: 'javascript',
    lineNumbers: true,
    styleActiveLine: true,
    matchBrackets: true,
    indentUnit: 4,
    lineWrapping: true,
    autoCloseBrackets: true,
});

const clearButton = document.getElementById('clear-btn');

// Исправленный обработчик с остановкой распространения события
clearButton.addEventListener('mousedown', function(e) {
    e.stopPropagation();
});

clearButton.addEventListener('click', function(e) {
    e.stopPropagation();
    editor.setValue('');
});

function styleBrackets() {
    const editorElement = document.querySelector('.CodeMirror');
    if (editorElement) {
        editorElement.style.setProperty('color', '#a9b3ac', 'important');
    }
}

const settingsBtn = document.getElementById('settings-btn');
const popupMenu = document.getElementById('popup-menu');

settingsBtn.addEventListener('click', function() {
    popupMenu.classList.toggle('active');
});

document.addEventListener('click', function(event) {
    if (!settingsBtn.contains(event.target) && !popupMenu.contains(event.target)) {
        popupMenu.classList.remove('active');
    }
});

styleBrackets();
