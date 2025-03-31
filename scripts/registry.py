from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from passlib.context import CryptContext
from scripts.Database import Database

router = APIRouter()

# Настройка хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Модель для валидации данных
class UserRegister(BaseModel):
    username: str
    password: str

# Инициализация базы данных
db = Database()

# Регистрация пользователя
@router.post("/register")
async def register(username: str = Form(...), password: str = Form(...)):
    hashed_password = pwd_context.hash(password)
    if db.get_user(username):
        raise HTTPException(status_code=400, detail="Такой пользователь уже зарегистрирован")
    if not db.add_user(username, hashed_password):
        raise HTTPException(status_code=400, detail="Не удалось зарегистрировать пользователя")
    return RedirectResponse(url="/login", status_code=303)