import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from scripts.login import router as login_router
from scripts.registry import router as register_router

app = FastAPI()

# Абсолютный путь к папке static
static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Подключение маршрутов
app.include_router(login_router)
app.include_router(register_router)
