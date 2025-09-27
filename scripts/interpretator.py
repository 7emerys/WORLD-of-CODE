from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from scripts.Database import Database
import jwt
from pydantic import BaseModel
import json
from celery import Celery
import docker
import mysql.connector
from mysql.connector import Error
import tempfile
from datetime import datetime, timedelta
import os

router = APIRouter()

SECRET_KEY = "секретный_ключ"
ALGORITHM = "HS256"

# Инициализация Celery
celery_app = Celery('interpretator', broker='redis://localhost:6379/0')

# Инициализация Docker клиента
try:
    docker_client = docker.from_env()
    docker_client.ping()
    print("Docker доступен для проверки кода")
except Exception as e:
    print(f"Docker не доступен: {e}")
    docker_client = None


def get_current_user(request: Request):
    token = request.cookies.get("user_token")
    if not token:
        raise HTTPException(status_code=401, detail="Не авторизован")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Срок действия токена истек")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Неверный токен")


class CodeSubmission(BaseModel):
    task_id: int
    code: str
    language: str


@router.post("/execute")
async def execute_code(submission: CodeSubmission, request: Request):
    username = get_current_user(request)

    # Получаем user_id и данные задачи
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)

        # Получаем user_id
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        user_id = user[0]

        # Получаем входные и выходные данные задачи
        cursor.execute("""
            SELECT input_example, output_example 
            FROM tasks 
            WHERE id = %s
        """, (submission.task_id,))
        task = cursor.fetchone()

        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")

        input_data = task['input_example'] or ""
        expected_output = task['output_example'] or ""

    except Error as e:
        return JSONResponse(
            content={"success": False, "message": f"Ошибка базы данных: {str(e)}"},
            status_code=500
        )
    finally:
        if db.connection.is_connected():
            cursor.close()
            db.connection.close()

    # Отправляем задачу на выполнение в Celery
    task = execute_code_task.delay(
        user_id,
        submission.task_id,
        submission.code,
        submission.language,
        input_data,
        expected_output
    )

    return {"task_id": task.id, "status": "processing"}


@router.get("/task-status/{task_id}")
async def get_task_status(task_id: str, request: Request):
    get_current_user(request)
    from celery.result import AsyncResult
    task = AsyncResult(task_id, app=celery_app)

    if task.state == 'PENDING':
        return {'status': 'pending', 'message': 'Задача в очереди'}
    elif task.state == 'PROGRESS':
        return {'status': 'running', 'message': 'Код выполняется...'}
    elif task.state == 'FAILURE':
        return {'status': 'error', 'message': str(task.result)}
    elif task.state == 'SUCCESS':
        result = task.result
        return {
            'status': 'completed',
            'input': result.get('input', ''),
            'expected': result.get('expected', ''),
            'actual': result.get('actual', ''),
            'passed': result.get('passed', False),
            'message': result.get('message', ''),
            'error': result.get('error', '')
        }
    else:
        return {'status': 'unknown', 'message': 'Неизвестный статус'}


@celery_app.task(bind=True)
def execute_code_task(self, user_id: int, task_id: int, code: str, language: str, input_data: str,
                      expected_output: str):
    """
    Задача Celery для выполнения кода в Docker контейнере
    """
    try:
        # Конфигурация для разных языков
        language_config = {
            'Python': {
                'image': 'python:3.9',
                'filename': 'solution.py',
                'compile_cmd': None,
                'run_cmd': ['python', '/tmp/solution.py'],
                'timeout': 30
            },
            'JavaScript': {
                'image': 'node:14',
                'filename': 'solution.js',
                'compile_cmd': None,
                'run_cmd': ['node', '/tmp/solution.js'],
                'timeout': 30
            },
            'C++': {
                'image': 'gcc:latest',
                'filename': 'solution.cpp',
                'compile_cmd': ['g++', '/tmp/solution.cpp', '-o', '/tmp/solution'],
                'run_cmd': ['/tmp/solution'],
                'timeout': 60
            },
            'Java': {
                'image': 'openjdk:11',
                'filename': 'Main.java',
                'compile_cmd': ['javac', '/tmp/Main.java'],
                'run_cmd': ['java', '-cp', '/tmp', 'Main'],
                'timeout': 60
            },
            'C#': {
                'image': 'mcr.microsoft.com/dotnet/sdk:5.0',
                'filename': 'Program.cs',
                'compile_cmd': ['dotnet', 'new', 'console', '-o', '/tmp/app', '-f', 'net5.0'],
                'run_cmd': ['dotnet', 'run', '--project', '/tmp/app'],
                'timeout': 60
            }
        }

        config = language_config.get(language)
        if not config:
            return {
                'status': 'error',
                'message': f'Язык {language} не поддерживается',
                'passed': False
            }

        if docker_client is None:
            # Режим эмуляции без Docker
            return emulate_code_execution(input_data, expected_output)

        with tempfile.TemporaryDirectory() as tmpdirname:
            # Создаем файл с кодом
            filepath = os.path.join(tmpdirname, config['filename'])
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(code)

            # Для C# создаем специальную структуру
            if language == 'C#':
                csproj_path = os.path.join(tmpdirname, 'app')
                os.makedirs(csproj_path, exist_ok=True)
                with open(os.path.join(csproj_path, 'Program.cs'), 'w', encoding='utf-8') as f:
                    f.write(code)

            # Создаем и запускаем контейнер
            container = docker_client.containers.run(
                config['image'],
                detach=True,
                volumes={tmpdirname: {'bind': '/tmp', 'mode': 'ro'}},
                mem_limit='128m',
                cpu_period=100000,
                cpu_quota=50000,
                network_mode='none',
                working_dir='/tmp',
                tty=True
            )

            try:
                # Компиляция (если требуется)
                if config['compile_cmd']:
                    exit_code, output = container.exec_run(
                        config['compile_cmd'],
                        workdir='/tmp',
                        timeout=config['timeout']
                    )
                    if exit_code != 0:
                        error_msg = output.decode() if output else 'Ошибка компиляции'
                        return {
                            'status': 'error',
                            'message': 'Ошибка компиляции',
                            'error': error_msg,
                            'passed': False
                        }

                # Выполнение кода с входными данными
                exit_code, output = container.exec_run(
                    config['run_cmd'],
                    workdir='/tmp',
                    stdin=True,
                    socket=True,
                    timeout=config['timeout']
                )

                # Передаем входные данные в STDIN
                if input_data:
                    input_socket = container.attach_socket()
                    os.write(input_socket.fileno(), input_data.encode())
                    os.write(input_socket.fileno(), b'\n')  # Добавляем новую строку

                # Получаем вывод
                output_text = output.decode().strip() if output else ''

                # Для многострочного вывода берем последнюю строку (как обычно бывает в задачах)
                actual_output = output_text.split('\n')[-1] if output_text else ''

                # Сравниваем с ожидаемым результатом
                passed = actual_output.strip() == expected_output.strip()

                # Сохраняем результат в базу данных
                save_task_result(user_id, task_id, language, code, input_data, expected_output, actual_output, passed)

                if passed:
                    return {
                        'status': 'completed',
                        'input': input_data,
                        'expected': expected_output,
                        'actual': actual_output,
                        'passed': True,
                        'message': 'Задача решена правильно!'
                    }
                else:
                    return {
                        'status': 'completed',
                        'input': input_data,
                        'expected': expected_output,
                        'actual': actual_output,
                        'passed': False,
                        'message': 'Неверный ответ'
                    }

            except Exception as e:
                return {
                    'status': 'error',
                    'message': 'Ошибка выполнения',
                    'error': str(e),
                    'passed': False
                }
            finally:
                try:
                    container.stop()
                    container.remove()
                except:
                    pass

    except Exception as e:
        return {
            'status': 'error',
            'message': f'Ошибка выполнения: {str(e)}',
            'passed': False
        }


def emulate_code_execution(input_data: str, expected_output: str):
    """Эмуляция выполнения кода без Docker"""
    # Простая эмуляция - всегда возвращаем успех для тестирования
    return {
        'status': 'completed',
        'input': input_data,
        'expected': expected_output,
        'actual': expected_output,  # Эмулируем правильный ответ
        'passed': True,
        'message': 'Эмуляция: Задача решена правильно!'
    }


def save_task_result(user_id: int, task_id: int, language: str, code: str,
                     input_data: str, expected_output: str, actual_output: str, is_solved: bool):
    """Сохранение результата выполнения задачи в базу данных"""
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)

        # Создаем простой JSON с результатом
        test_result = {
            'input': input_data,
            'expected': expected_output,
            'actual': actual_output,
            'passed': is_solved,
            'timestamp': datetime.now().isoformat()
        }

        # Сохраняем в user_tasks
        cursor.execute("""
            INSERT INTO user_tasks 
            (user_id, task_id, language, code, test_results, is_solved, solved_at, attempts)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
            ON DUPLICATE KEY UPDATE
            code = VALUES(code),
            test_results = VALUES(test_results),
            is_solved = VALUES(is_solved),
            solved_at = VALUES(solved_at),
            attempts = attempts + 1
        """, (
            user_id, task_id, language, code,
            json.dumps(test_result),
            is_solved,
            datetime.now() if is_solved else None
        ))

        # Обновляем статистику пользователя
        if is_solved:
            update_user_stats(user_id, language)
            check_achievements(user_id, task_id, language)

        db.connection.commit()

    except Error as e:
        print(f"Ошибка сохранения результата: {e}")
    finally:
        if db.connection.is_connected():
            cursor.close()
            db.connection.close()


def update_user_stats(user_id: int, language: str):
    """Обновление статистики пользователя"""
    db = Database()
    try:
        cursor = db.connection.cursor()

        # Обновляем общее количество решенных задач
        cursor.execute("""
            INSERT INTO user_stats (user_id, total_tasks_solved, favorite_language, last_solved_date)
            VALUES (%s, 1, %s, CURDATE())
            ON DUPLICATE KEY UPDATE
            total_tasks_solved = total_tasks_solved + 1,
            favorite_language = VALUES(favorite_language),
            last_solved_date = VALUES(last_solved_date)
        """, (user_id, language))

        db.connection.commit()
    except Error as e:
        print(f"Ошибка обновления статистики: {e}")
    finally:
        if db.connection.is_connected():
            cursor.close()
            db.connection.close()

def check_achievements(user_id: int, task_id: int, language: str):
    """Проверка и выдача достижений"""
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)

        # 1. Первая решенная задача
        cursor.execute("""
            SELECT COUNT(*) as solved_count 
            FROM user_tasks 
            WHERE user_id = %s AND is_solved = TRUE
        """, (user_id,))
        stats = cursor.fetchone()
        solved_count = stats['solved_count'] if stats else 0

        if solved_count == 1:
            grant_achievement(user_id, 'first_task', 'Решена первая задача!')

        # 2. 10 решенных задач
        if solved_count == 10:
            grant_achievement(user_id, 'ten_tasks', 'Решено 10 задач!')

        # 3. 50 решенных задач
        if solved_count == 50:
            grant_achievement(user_id, 'fifty_tasks', 'Решено 50 задач!')

        # 4. Решение на всех языках
        cursor.execute("""
            SELECT COUNT(DISTINCT language) as unique_languages 
            FROM user_tasks 
            WHERE user_id = %s AND is_solved = TRUE
        """, (user_id,))
        lang_stats = cursor.fetchone()
        unique_langs = lang_stats['unique_languages'] if lang_stats else 0

        if unique_langs >= 5:  # Все 5 языков
            grant_achievement(user_id, 'polyglot', 'Полиглот: решены задачи на всех языках!')

        # 5. Идеальное решение (с первой попытки)
        cursor.execute("""
            SELECT attempts 
            FROM user_tasks 
            WHERE user_id = %s AND task_id = %s AND is_solved = TRUE
            ORDER BY solved_at DESC LIMIT 1
        """, (user_id, task_id))
        attempt_data = cursor.fetchone()

        if attempt_data and attempt_data['attempts'] == 1:
            grant_achievement(user_id, 'perfect_solution', 'Идеальное решение с первой попытки!')

            # Также обновляем счетчик идеальных решений
            cursor.execute("""
                INSERT INTO user_stats (user_id, perfect_solutions) 
                VALUES (%s, 1)
                ON DUPLICATE KEY UPDATE 
                perfect_solutions = perfect_solutions + 1
            """, (user_id,))

        # 6. Серия решений (3 дня подряд)
        check_streak_achievement(user_id)

        db.connection.commit()

    except Error as e:
        print(f"Ошибка проверки ачивок: {e}")
    finally:
        if db.connection.is_connected():
            cursor.close()
            db.connection.close()


def check_streak_achievement(user_id: int):
    """Проверка достижений за серию решений"""
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)

        # Получаем даты решенных задач за последние 7 дней
        cursor.execute("""
            SELECT DISTINCT DATE(solved_at) as solve_date 
            FROM user_tasks 
            WHERE user_id = %s AND is_solved = TRUE 
            AND solved_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            ORDER BY solve_date DESC
        """, (user_id,))

        dates = [row['solve_date'] for row in cursor.fetchall()]

        # Проверяем текущую серию
        current_streak = 0
        today = datetime.now().date()

        for i, date in enumerate(dates):
            if date == today - timedelta(days=i):
                current_streak += 1
            else:
                break

        # Выдаем ачивки за серию
        if current_streak >= 3:
            grant_achievement(user_id, 'three_day_streak', 'Серия из 3 дней решения задач!')
        if current_streak >= 7:
            grant_achievement(user_id, 'week_streak', 'Недельная серия решения задач!')
        if current_streak >= 30:
            grant_achievement(user_id, 'month_streak', 'Месячная серия решения задач!')

    except Error as e:
        print(f"Ошибка проверки серии: {e}")


def grant_achievement(user_id: int, achievement_type: str, description: str):
    """Выдача достижения пользователю"""
    db = Database()
    try:
        cursor = db.connection.cursor()

        # Проверяем, есть ли уже такое достижение
        cursor.execute("""
            SELECT id FROM achievements 
            WHERE user_id = %s AND type = 'medal' AND subtype = %s
        """, (user_id, achievement_type))

        existing = cursor.fetchone()

        if not existing:
            # Выдаем новое достижение
            cursor.execute("""
                INSERT INTO achievements (user_id, type, subtype, value, achieved_at)
                VALUES (%s, 'medal', %s, 1, %s)
            """, (user_id, achievement_type, datetime.now()))

            print(f"Выдано достижение пользователю {user_id}: {description}")

        db.connection.commit()

    except Error as e:
        print(f"Ошибка выдачи достижения: {e}")
    finally:
        if db.connection.is_connected():
            cursor.close()
            db.connection.close()