import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse
from scripts.login import router as login_router
from scripts.register import router as register_router
from scripts.Profile import router as profile_router
from scripts.Tasks import router as tasks_router
from scripts.interpretator import router as interpretator_router
import jwt
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS настройки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "секретный_ключ"
ALGORITHM = "HS256"

# Подключаем API роуты
app.include_router(login_router, prefix="/api")
app.include_router(register_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(interpretator_router, prefix="/api")

# Настройка статики
static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
styles_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "styles"))
js_scripts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "JS_scripts"))

app.mount("/static", StaticFiles(directory=static_dir), name="static")
app.mount("/img", StaticFiles(directory="img"), name="img")
app.mount("/styles", StaticFiles(directory="styles"), name="styles")
app.mount("/JS_scripts", StaticFiles(directory="JS_scripts"), name="JS_scripts")


# Роут для проверки авторизации
@app.get("/api/check-auth")
async def check_auth(request: Request):
    token = request.cookies.get("user_token")
    if not token:
        return JSONResponse(
            content={"authenticated": False, "message": "Токен отсутствует"},
            status_code=403
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {"authenticated": True, "user": payload["sub"]}
    except jwt.ExpiredSignatureError:
        return JSONResponse(
            content={"authenticated": False, "message": "Токен истёк"},
            status_code=403
        )
    except jwt.InvalidTokenError:
        return JSONResponse(
            content={"authenticated": False, "message": "Неверный токен"},
            status_code=403
        )


# Главная страница
@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    # Проверяем авторизацию
    token = request.cookies.get("user_token")
    if token:
        try:
            jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            # Если авторизован - разрешаем доступ к главной странице
            with open(os.path.join(static_dir, "index.html")) as f:
                return HTMLResponse(content=f.read(), status_code=200)
        except:
            pass

    # Если не авторизован - показываем главную страницу без перенаправления
    with open(os.path.join(static_dir, "index.html")) as f:
        return HTMLResponse(content=f.read(), status_code=200)


# Для всех остальных HTML-страниц
@app.get("/{page_name}", response_class=HTMLResponse)
async def read_page(page_name: str):
    if not page_name.endswith(".html"):
        page_name += ".html"
    file_path = os.path.join(static_dir, page_name)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    return JSONResponse(status_code=404, content={"detail": "Not found"})