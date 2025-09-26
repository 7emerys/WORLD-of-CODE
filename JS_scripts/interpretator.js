let codeEditor;
let currentTask;
let currentLanguage;

document.addEventListener('DOMContentLoaded', async function() {
    console.log("Страница interpretator.html загружена");

    // Проверка авторизации
    try {
        const authResponse = await fetch('/api/check-auth', {
            credentials: 'include'
        });
        const authData = await authResponse.json();

        if (!authData.authenticated) {
            window.location.href = '/static/login.html';
            return;
        }
        console.log("Пользователь авторизован");
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        window.location.href = '/static/login.html';
        return;
    }

    // Получаем параметры из URL
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('task_id');
    const language = urlParams.get('lang');

    console.log("Параметры URL:", { taskId, language });

    if (!taskId || !language) {
        showError('Задача или язык программирования не выбраны');
        return;
    }

    // Устанавливаем язык и ID задачи
    currentLanguage = language;
    currentTask = { id: parseInt(taskId) };

    // Инициализируем страницу
    await initializePage();
});

async function initializePage() {
    console.log("Инициализация страницы для:", {
        task: currentTask.id,
        language: currentLanguage
    });

    try {
        // 1. Загружаем информацию о задаче из базы
        await loadTaskInfo();

        // 2. Обновляем отображение языка
        updateLanguageDisplay();

        // 3. Настраиваем редактор кода
        setupCodeEditor();

        // 4. Настраиваем обработчики событий
        setupEventListeners();

        console.log("Страница успешно инициализирована");
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Не удалось загрузить данные задачи');
    }
}

async function loadTaskInfo() {
    console.log("Диагностика загрузки задачи...");

    try {
        const url = `/api/tasks/${currentTask.id}`;
        console.log("URL запроса:", url);
        console.log("ID задачи:", currentTask.id);
        console.log("Куки:", document.cookie);

        const taskResponse = await fetch(url, {
            credentials: 'include'
        });

        console.log("Статус ответа:", taskResponse.status);
        console.log("OK?:", taskResponse.ok);
        console.log("Финальный URL:", taskResponse.url);

        if (!taskResponse.ok) {
            // Получим больше информации об ошибке
            const errorText = await taskResponse.text();
            console.error("Текст ошибки:", errorText);
            throw new Error(`Ошибка ${taskResponse.status}: ${errorText}`);
        }

        const taskData = await taskResponse.json();
        console.log("Полученные данные:", taskData);

        // Загружаем тест-кейсы для выбранного языка
        const testCasesResponse = await fetch(`/api/tasks/${currentTask.id}/test-cases?language=${encodeURIComponent(currentLanguage)}`, {
            credentials: 'include'
        });

        let testCasesData = { test_cases: [], starter_code: '' };

        if (testCasesResponse.ok) {
            testCasesData = await testCasesResponse.json();
            console.log("Данные тест-кейсов:", testCasesData);
        } else {
            console.warn("Тест-кейсы не загружены, используем заглушку");
        }

        // Формируем полный объект задачи
        currentTask = {
            id: currentTask.id,
            title: taskData.title || `Задача ${currentTask.id}`,
            full_description: taskData.full_description || taskData.description || 'Описание не доступно',
            short_description: taskData.short_description || '',
            input_example: taskData.input_example || 'Не указан',
            output_example: taskData.output_example || 'Не указан',
            difficulty: taskData.difficulty || 'Неизвестно',
            test_cases: testCasesData.test_cases || [],
            starter_code: testCasesData.starter_code || '',
            logo_url: taskData.logo_url || ''
        };

        console.log("Задача загружена:", currentTask);

        // Отображаем информацию
        displayTaskInfo();

    } catch (error) {
        console.error('Ошибка загрузки задачи:', error);
        // Используем заглушку если не удалось загрузить
        //useFallbackTaskInfo();
    }
}

function useFallbackTaskInfo() {
    console.log("Используем резервные данные задачи");

    const taskInfo = fallbackTasks[currentTask.id] || {
        title: `Задача ${currentTask.id}`,
        full_description: "Описание этой задачи будет добавлено позже.",
        input_example: "Пример ввода",
        output_example: "Пример вывода",
        difficulty: "Неизвестно"
    };

    currentTask = {
        ...currentTask,
        ...taskInfo,
        test_cases: [],
        starter_code: ''
    };

    displayTaskInfo();
}

function displayTaskInfo() {
    const taskContainer = document.querySelector('.task-container');
    if (!taskContainer) {
        console.error("Контейнер задачи не найден");
        return;
    }

    // Функция для форматирования текста с переносами
    const formatText = (text) => {
        if (!text) return '';
        return text.replace(/\n/g, '<br>');
    };

    taskContainer.innerHTML = `
        <div style="padding: 30px; height: 100%; overflow-y: auto; color: white;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: #BDEE60; font-size: 24px; margin: 0;">${currentTask.title}</h2>
                <span style="background: rgba(189, 238, 96, 0.2); padding: 5px 15px; border-radius: 15px; color: #BDEE60;">
                    Сложность: ${currentTask.difficulty}
                </span>
            </div>

            <div style="margin-bottom: 25px;">
                <h3 style="color: #BDEE60; margin-bottom: 10px; font-size: 18px;">📖 Описание задачи</h3>
                <p style="line-height: 1.6; font-size: 16px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
                    ${formatText(currentTask.full_description)}
                </p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                <div>
                    <h3 style="color: #BDEE60; margin-bottom: 10px; font-size: 18px;">📥 Пример ввода</h3>
                    <div style="background: rgba(189, 238, 96, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #BDEE60;">
                        <code style="font-family: 'Courier New', monospace; font-size: 14px; color: #BDEE60; white-space: pre-wrap;">
                            ${formatText(currentTask.input_example)}
                        </code>
                    </div>
                </div>

                <div>
                    <h3 style="color: #BDEE60; margin-bottom: 10px; font-size: 18px;">📤 Пример вывода</h3>
                    <div style="background: rgba(189, 238, 96, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #BDEE60;">
                        <code style="font-family: 'Courier New', monospace; font-size: 14px; color: #BDEE60; white-space: pre-wrap;">
                            ${formatText(currentTask.output_example)}
                        </code>
                    </div>
                </div>
            </div>

            ${currentTask.test_cases && currentTask.test_cases.length > 0 ? `
            <div style="margin-bottom: 20px;">
                <h3 style="color: #BDEE60; margin-bottom: 10px; font-size: 18px;">🧪 Тестовые случаи</h3>
                <p>Количество тестов: <strong>${currentTask.test_cases.length}</strong></p>
                <div style="margin-top: 10px;">
                    ${currentTask.test_cases.slice(0, 3).map((test, index) => `
                        <div style="background: rgba(0, 84, 54, 0.2); padding: 10px; border-radius: 5px; margin-bottom: 5px;">
                            <strong>Тест ${index + 1}:</strong>
                            ${test.input ? `Ввод: ${formatText(test.input)} → ` : ''}
                            Ожидаемый вывод: ${formatText(test.expected)}
                        </div>
                    `).join('')}
                    ${currentTask.test_cases.length > 3 ? `<p>... и еще ${currentTask.test_cases.length - 3} тестов</p>` : ''}
                </div>
            </div>
            ` : ''}

            <div style="margin-top: 30px; padding: 20px; background: rgba(0, 84, 54, 0.3); border-radius: 8px; border: 1px solid rgba(189, 238, 96, 0.3);">
                <h4 style="color: #BDEE60; margin-bottom: 10px;">📊 Информация</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <strong>ID задачи:</strong> ${currentTask.id}<br>
                        <strong>Язык программирования:</strong> ${currentLanguage}
                    </div>
                    <div>
                        <strong>Тестов:</strong> ${currentTask.test_cases.length}<br>
                        <strong>Статус:</strong> <span style="color: #BDEE60;">Готов к решению</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    console.log("Информация о задаче отображена");
}

function updateLanguageDisplay() {
    const langElement = document.querySelector('.lang-name');
    if (langElement) {
        langElement.textContent = getLanguageDisplayName(currentLanguage);
        console.log("Язык отображен:", currentLanguage);
    } else {
        console.error("Элемент для отображения языка не найден");
    }
}

function getLanguageDisplayName(lang) {
    const names = {
        'Python': 'Python',
        'JavaScript': 'JavaScript',
        'C++': 'C++',
        'Java': 'Java',
        'C#': 'C#'
    };
    return names[lang] || lang;
}

function setupCodeEditor() {
    const editorElement = document.getElementById('code-editor');
    if (!editorElement) {
        console.error("Элемент редактора кода не найден");
        return;
    }

    const mode = getCodeMirrorMode(currentLanguage);

    codeEditor = CodeMirror.fromTextArea(editorElement, {
        lineNumbers: true,
        theme: 'dracula',
        mode: mode,
        indentUnit: 4,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true
    });

    // Используем starter_code из базы или дефолтный
    const starterCode = currentTask.starter_code || getDefaultStarterCode(currentLanguage);
    codeEditor.setValue(starterCode);

    console.log("Редактор кода настроен для языка:", currentLanguage);
}

function getCodeMirrorMode(language) {
    const modes = {
        'Python': 'python',
        'JavaScript': 'javascript',
        'C++': 'text/x-c++src',
        'Java': 'text/x-java',
        'C#': 'text/x-csharp'
    };
    return modes[language] || 'python';
}

function getDefaultStarterCode(language) {
    const starters = {
        'Python': `# Решение задачи ${currentTask.id} - "${currentTask.title}"
# Язык: Python

def solution():
    # Ваш код здесь
    `,

        'JavaScript': `Решение задачи ${currentTask.id} - "${currentTask.title}"
Язык: JavaScript

function solution() {
     Ваш код здесь
    return null;
}`,

        'C++': `Решение задачи ${currentTask.id} - "${currentTask.title}"
Язык: C++

#include <iostream>
using namespace std;

int main() {
    Ваш код здесь

    return 0;
}`,

        'Java': `Решение задачи ${currentTask.id} - "${currentTask.title}"
Язык: Java

public class Main {
    public static void main(String[] args) {
        Ваш код здесь
    }
}`,

        'C#': `Решение задачи ${currentTask.id} - "${currentTask.title}"
Язык: C#

using System;

class Program {
    static void Main(string[] args) {
        Ваш код здесь
    }
}`
    };

    return starters[language] || `Решение задачи ${currentTask.id} - "${currentTask.title}"
Язык: ${language}

Ваш код здесь`;
}

// Остальные функции остаются без изменений
function setupEventListeners() {
    const startBtn = document.querySelector('.btn-start');
    if (startBtn) {
        startBtn.addEventListener('click', executeCode);
    }

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (codeEditor) {
                codeEditor.setValue(getDefaultStarterCode(currentLanguage));
                console.log("Редактор сброшен к стартовому коду");
            }
        });
    }

     // Кнопка полноэкранного режима
    const fullscreenBtn = document.getElementById('fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    // Настройки пользователя
    const settingsBtn = document.getElementById('settings-btn');
    const popupMenu = document.getElementById('popup-menu');

    if (settingsBtn && popupMenu) {
        settingsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            popupMenu.classList.toggle('active');
        });

        document.addEventListener('click', function(event) {
            if (!settingsBtn.contains(event.target) && !popupMenu.contains(event.target)) {
                popupMenu.classList.remove('active');
            }
        });
    }

    // Кнопка "Назад"
    const backBtn = document.querySelector('.btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = '/static/tasks.html';
        });
    }

}

// Функция полноэкранного режима
function toggleFullscreen() {
    const solutionContainer = document.querySelector('.solution-container');
    const sideColumn = document.querySelector('.side-column');
    const taskContainer = document.querySelector('.task-container');

    if (!solutionContainer.classList.contains('fullscreen')) {
        // Входим в полноэкранный режим
        solutionContainer.classList.add('fullscreen');
        solutionContainer.style.width = '100%';
        solutionContainer.style.height = '100%';
        solutionContainer.style.position = 'fixed';
        solutionContainer.style.top = '0';
        solutionContainer.style.left = '0';
        solutionContainer.style.zIndex = '10000';

        // Скрываем остальные элементы
        taskContainer.style.display = 'none';
        document.querySelector('.error-container').style.display = 'none';
        document.querySelector('.btn-all').style.display = 'none';

        // Обновляем размер редактора
        setTimeout(() => {
            if (codeEditor) {
                codeEditor.refresh();
                codeEditor.setSize('100%', 'calc(100% - 50px)');
            }
        }, 100);

        // Меняем иконку
        document.querySelector('#fullscreen i').className = 'fas fa-compress';
    } else {
        // Выходим из полноэкранного режима
        solutionContainer.classList.remove('fullscreen');
        solutionContainer.style.width = '';
        solutionContainer.style.height = '';
        solutionContainer.style.position = '';
        solutionContainer.style.top = '';
        solutionContainer.style.left = '';
        solutionContainer.style.zIndex = '';

        // Показываем остальные элементы
        taskContainer.style.display = '';
        document.querySelector('.error-container').style.display = '';
        document.querySelector('.btn-all').style.display = '';

        // Обновляем размер редактора
        setTimeout(() => {
            if (codeEditor) {
                codeEditor.refresh();
                codeEditor.setSize('100%', 'calc(100% - 50px)');
            }
        }, 100);

        // Меняем иконку
        document.querySelector('#fullscreen i').className = 'fas fa-expand';
    }
}

function showError(message) {
    const errorContainer = document.querySelector('.error-container');
    if (errorContainer) {
        errorContainer.innerHTML = `
            <div class="test-failed" style="padding: 20px;">
                <h3>Ошибка</h3>
                <p>${message}</p>
                <button class="btn-start" onclick="window.location.href='/static/tasks.html'"
                        style="margin-top: 15px; padding: 10px 20px; background: #BDEE60; color: black; border: none; border-radius: 5px; cursor: pointer;">
                    Вернуться к задачам
                </button>
            </div>
        `;
    }
}

async function executeCode() {
    console.log("Запуск проверки кода...");

    const errorContainer = document.querySelector('.error-container');
    if (errorContainer) {
        errorContainer.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <h3 style="color: #BDEE60;">Система проверки</h3>
                <p>Задача: <strong>${currentTask.title}</strong></p>
                <p>Язык: <strong>${currentLanguage}</strong></p>
                <p>ID: <strong>${currentTask.id}</strong></p>
                <p style="margin-top: 15px; color: #BDEE60;">Функция проверки будет доступна после настройки бэкенда</p>
            </div>
        `;
    }
}

console.log("interpretator.js загружен");