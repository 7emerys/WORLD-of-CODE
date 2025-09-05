from fastapi import APIRouter, HTTPException, Form, Response
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
from scripts.Database import Database
import jwt
import datetime
import re

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = Database()

SECRET_KEY = "секретный_ключ"
ALGORITHM = "HS256"


def validate_password_complexity(password: str):
    """Проверяет сложность пароля"""
    if len(password) < 8:
        raise ValueError("Пароль должен содержать минимум 8 символов")
    if not re.search(r"\d", password):
        raise ValueError("Пароль должен содержать цифру")
    if not re.search(r"[A-ZА-Я]", password):
        raise ValueError("Пароль должен содержать заглавную букву")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise ValueError("Пароль должен содержать спецсимвол")


class RegistrationForm:
    def __init__(self, username: str = Form(...), password: str = Form(...), confirm_password: str = Form(...)):
        self.username = username
        self.password = password
        self.confirm_password = confirm_password


@router.post("/register")
async def register(
    response: Response,
    username: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...)
):
    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Пароли не совпадают")

    try:
        validate_password_complexity(password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if db.get_user(username):
        raise HTTPException(status_code=400, detail="Пользователь уже существует")

    hashed_password = pwd_context.hash(password)

    if not db.add_user(username, hashed_password):
        raise HTTPException(status_code=500, detail="Ошибка при создании пользователя")

    token = jwt.encode(
        {"sub": username, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)},
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    response.set_cookie(
        key="user_token",
        value=token,
        httponly=True,
        max_age=3600,
        path="/",
        samesite="lax"
    )

    return JSONResponse(content={"status": "success", "message": "Регистрация успешна"}, status_code=200)
