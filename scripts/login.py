from fastapi import APIRouter, HTTPException, Form, Response, Request
from fastapi.responses import RedirectResponse, JSONResponse
from passlib.context import CryptContext
from scripts.Database import Database
import jwt
import datetime

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = Database()

SECRET_KEY = "секретный_ключ"
ALGORITHM = "HS256"

@router.post("/login")
async def login(request: Request, response: Response, username: str = Form(...), password: str = Form(...)):
    user = db.get_user(username)
    if not user or not pwd_context.verify(password, user["password"]):
        raise HTTPException(status_code=403, detail="Неверный логин или пароль")

    expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    token = jwt.encode({"sub": username, "exp": expiration}, SECRET_KEY, algorithm=ALGORITHM)

    response.set_cookie(
        key="user_token",
        value=token,
        httponly=True,
        max_age=3600,
        path="/",
        samesite="lax"
    )

    return {"status": "success", "redirect_to": "/static/tasks.html"}