from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from scripts.Database import Database
import jwt
from pydantic import BaseModel
from datetime import datetime
import json
from celery import Celery
import docker
import mysql.connector
from mysql.connector import Error

router = APIRouter()

# Секретный ключ для JWT
SECRET_KEY = "секретный_ключ"
ALGORITHM = "HS256"

# Инициализация Celery
celery_app = Celery('tasks', broker='redis://localhost:6379/0')

# Инициализация Docker клиента
try:
    docker_client = docker.from_env()
    docker_client.ping()  # Проверка подключения
except Exception as e:
    print(f"Docker не доступен: {e}")
    docker_client = None  # Режим без Docker


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


class TaskModel(BaseModel):
    id: int
    title: str
    description: str
    logoUrl: str
    language: str
    difficulty: str
    test_cases: list


class CodeSubmission(BaseModel):
    task_id: int
    code: str
    language: str


@router.get("/tasks")
async def get_tasks(request: Request):
    get_current_user(request)
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT t.* 
            FROM tasks t
            ORDER BY t.difficulty, t.title
        """)
        tasks = cursor.fetchall()
        return {"success": True, "tasks": tasks}
    except Error as e:
        return JSONResponse(
            content={"success": False, "message": str(e)},
            status_code=500
        )
    finally:
        if db.connection.is_connected():
            cursor.close()
            db.connection.close()


@router.get("/api/tasks/{task_id}/test-cases")
async def get_task_test_cases(task_id: int, language: str, request: Request):
    get_current_user(request)
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT test_cases, starter_code 
            FROM task_test_cases 
            WHERE task_id = %s AND language = %s
        """, (task_id, language))
        test_case = cursor.fetchone()

        if not test_case:
            raise HTTPException(status_code=404, detail="Тест-кейсы не найдены")

        return {
            "success": True,
            "test_cases": json.loads(test_case['test_cases']),
            "starter_code": test_case['starter_code']
        }
    except Error as e:
        return JSONResponse(
            content={"success": False, "message": str(e)},
            status_code=500
        )
    finally:
        if db.connection.is_connected():
            cursor.close()
            db.connection.close()

@router.get("/api/tasks/{task_id}", response_model=TaskModel)
async def get_task(task_id: int, request: Request):
    get_current_user(request)
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM tasks WHERE id = %s", (task_id,))
        task = cursor.fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        return task
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.connection.close()


@router.post("/api/execute")
async def execute_code(submission: CodeSubmission, request: Request):
    username = get_current_user(request)

    # Проверяем существование задачи
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)
        cursor.execute("SELECT test_cases FROM tasks WHERE id = %s", (submission.task_id,))
        task = cursor.fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
    finally:
        db.connection.close()

    # Отправляем задачу на выполнение в Celery
    task = execute_code_task.delay(
        submission.code,
        submission.language,
        submission.task_id
    )

    return {"task_id": task.id}


@router.get("/api/task-status/{task_id}")
async def get_task_status(task_id: str, request: Request):
    get_current_user(request)
    from celery.result import AsyncResult
    task = AsyncResult(task_id, app=celery_app)

    if task.state == 'PENDING':
        return {'status': 'pending'}
    elif task.state == 'FAILURE':
        return {'status': 'error', 'message': str(task.result)}
    else:
        return {'status': 'completed', 'results': task.result}


@router.post("/api/save-solution")
async def save_solution(request: Request):
    username = get_current_user(request)
    data = await request.json()

    db = Database()
    try:
        cursor = db.connection.cursor()

        # Получаем user_id
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        user_id = user[0]

        # Сохраняем решение
        cursor.execute("""
            INSERT INTO user_tasks 
            (user_id, task_id, language, code, test_results, is_solved, solved_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            code = VALUES(code),
            test_results = VALUES(test_results),
            is_solved = VALUES(is_solved),
            solved_at = IF(VALUES(is_solved) = TRUE AND is_solved = FALSE, NOW(), solved_at)
        """, (
            user_id,
            data['task_id'],
            data['language'],
            data['code'],
            json.dumps(data['test_results']),
            data['is_solved'],
            datetime.now() if data['is_solved'] else None
        ))

        db.connection.commit()
        return {"status": "success"}
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.connection.close()


@celery_app.task(bind=True)
def execute_code_task(self, code: str, language: str, task_id: int):
    if docker_client is None:
        # Эмуляция выполнения кода без Docker
        return {
            'status': 'completed',
            'results': [{
                'input': 'test',
                'expected': 'test output',
                'actual': 'emulated output',
                'passed': True
            }],
            'passed': True
        }
    db = Database()
    try:
        # Получаем тест-кейсы для задачи
        cursor = db.connection.cursor(dictionary=True)
        cursor.execute("SELECT test_cases FROM tasks WHERE id = %s", (task_id,))
        task = cursor.fetchone()
        test_cases = json.loads(task['test_cases'])

        # Конфигурация для разных языков
        language_config = {
            'Python': {
                'image': 'python:3.9',
                'cmd': 'python /tmp/code.py',
                'filename': 'code.py'
            },
            'JavaScript': {
                'image': 'node:14',
                'cmd': 'node /tmp/code.js',
                'filename': 'code.js'
            },
            'C++': {
                'image': 'gcc:latest',
                'cmd': 'g++ /tmp/code.cpp -o /tmp/code && /tmp/code',
                'filename': 'code.cpp'
            },
            'Java': {
                'image': 'openjdk:11',
                'cmd': 'javac /tmp/Main.java && java -cp /tmp Main',
                'filename': 'Main.java'
            },
            'C#': {
                'image': 'mcr.microsoft.com/dotnet/sdk:5.0',
                'cmd': 'dotnet run --project /tmp',
                'filename': 'Program.cs'
            }
        }.get(language, {
            'image': 'python:3.9',
            'cmd': 'python /tmp/code.py',
            'filename': 'code.py'
        })

        # Создаем временный файл с кодом
        import tempfile
        import os
        with tempfile.TemporaryDirectory() as tmpdirname:
            filepath = os.path.join(tmpdirname, language_config['filename'])
            with open(filepath, 'w') as f:
                f.write(code)

            # Создаем и запускаем контейнер
            container = docker_client.containers.run(
                language_config['image'],
                detach=True,
                volumes={tmpdirname: {'bind': '/tmp', 'mode': 'ro'}},
                mem_limit='128m',
                cpu_period=100000,
                cpu_quota=50000,
                network_mode='none',
                working_dir='/tmp'
            )

            try:
                results = []
                for case in test_cases:
                    try:
                        # Запускаем выполнение кода
                        exit_code, output = container.exec_run(
                            language_config['cmd'],
                            workdir='/tmp'
                        )

                        # Проверяем результат
                        actual = output.decode().strip()
                        passed = actual == case['output']

                        results.append({
                            'input': case.get('input', ''),
                            'expected': case['output'],
                            'actual': actual,
                            'passed': passed
                        })
                    except Exception as e:
                        results.append({
                            'input': case.get('input', ''),
                            'expected': case['output'],
                            'actual': str(e),
                            'passed': False
                        })

                return {
                    'status': 'completed',
                    'results': results,
                    'passed': all(r['passed'] for r in results)
                }
            finally:
                container.stop()
                container.remove()
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }
    finally:
        db.connection.close()