from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from passlib.context import CryptContext
from scripts.Database import Database

router = APIRouter()

# Настройка хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Модель для валидации данных
class UserLogin(BaseModel):
    username: str
    password: str

# Инициализация базы данных
db = Database()

# Авторизация пользователя
@router.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    user = db.get_user(username)
    if not user or not pwd_context.verify(password, user["password"]):
        raise HTTPException(status_code=401, detail="Неправильный логин или пароль")
    return RedirectResponse(url="/", status_code=303)