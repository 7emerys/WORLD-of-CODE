from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from scripts.Database import Database
import jwt
from pydantic import BaseModel
from datetime import datetime
import json
import mysql.connector
from mysql.connector import Error

router = APIRouter()

# Секретный ключ для JWT
SECRET_KEY = "секретный_ключ"
ALGORITHM = "HS256"

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
    full_description: str = ""
    input_example: str = ""
    output_example: str = ""


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

        # Запрос без BLOB-данных
        cursor.execute("""
            SELECT 
                id,
                title,
                short_description,
                full_description,
                input_example,
                output_example,
                difficulty,
                base_experience,
                logo_url
            FROM tasks
            ORDER BY difficulty, title
        """)

        tasks = cursor.fetchall()

        # Добавляем URL для логотипов
        for task in tasks:
            task['logo_url'] = f"/api/tasks/{task['id']}/logo"

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


@router.get("/tasks/{task_id}/logo")
async def get_task_logo(task_id: int, request: Request):
    get_current_user(request)  # Проверка авторизации
    db = Database()
    try:
        cursor = db.connection.cursor()
        cursor.execute("SELECT Logo_url FROM tasks WHERE id = %s", (task_id,))
        logo_data = cursor.fetchone()

        if not logo_data or not logo_data[0]:
            raise HTTPException(status_code=404)

        return Response(content=logo_data[0], media_type="image/png")
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if db.connection.is_connected():
            cursor.close()
            db.connection.close()


@router.get("/tasks/{task_id}/test-cases")
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

@router.get("/tasks/{task_id}")
async def get_task(task_id: int, request: Request):

    get_current_user(request)
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)
        cursor.execute("""SELECT title, full_description, input_example, output_example, difficulty FROM tasks WHERE id = %s """,
                       (task_id,))
        task = cursor.fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        return task
    except Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if db.connection.is_connected():
            cursor.close()
            db.connection.close()

@router.post("/save-selection")
async def save_user_selection(request: Request):
    try:

        username = get_current_user(request)
        data = await request.json()

        db = Database()
        cursor = db.connection.cursor()

        # Получаем user_id
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        user_id = user[0]

        # Сохраняем выбор языка и задачи
        cursor.execute("""
            INSERT INTO user_selections 
            (user_id, task_id, language, selected_at)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            language = VALUES(language),
            selected_at = VALUES(selected_at)
        """, (user_id, data['task_id'], data['language'], datetime.now()))

        db.connection.commit()

        return JSONResponse(content={"status": "success", "message": "Выбор сохранен"})

    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка при сохранении выбора: {e}")
        return JSONResponse(
            content={"status": "error", "message": str(e)},
            status_code=500
        )
    finally:
        if 'db' in locals() and db.connection.is_connected():
            cursor.close()
            db.connection.close()