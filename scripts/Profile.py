from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from scripts.Database import Database
import jwt
from fastapi import Request
from pydantic import BaseModel
import base64

router = APIRouter()

SECRET_KEY = "секретный_ключ"
ALGORITHM = "HS256"


class ProfileUpdate(BaseModel):
    username: str
    bio: str
    fav_lang: str
    city: str
    jms: str


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


@router.get("/profile/data")
async def get_profile_data(request: Request):
    username = get_current_user(request)
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT username, avatar, bio, fav_lang, jms, City 
            FROM users WHERE username = %s
        """, (username,))
        user = cursor.fetchone()
        cursor.close()

        if not user:
            return JSONResponse(
                content={"success": False, "message": "Пользователь не найден"},
                status_code=404
            )

        avatar_url = "/img/настройки/logo.png"
        if user["avatar"]:
            if isinstance(user["avatar"], bytes):
                avatar_url = f"data:image/png;base64,{base64.b64encode(user['avatar']).decode('utf-8')}"
            elif isinstance(user["avatar"], str):
                avatar_url = user["avatar"]

        jms_map = {"1": "junior", "2": "middle", "3": "senior"}
        user_jms = jms_map.get(str(user["jms"]), "junior")

        return {
            "success": True,
            "username": user["username"],
            "avatar": avatar_url,
            "bio": user["bio"] or "",
            "fav_lang": user["fav_lang"] or "",
            "jms": user_jms,
            "city": user["City"] or ""
        }
    except Exception as e:
        return JSONResponse(
            content={"success": False, "message": str(e)},
            status_code=500
        )


@router.post("/profile/update")
async def update_profile(
    request: Request,
    username: str = Form(...),
    bio: str = Form(...),
    fav_lang: str = Form(...),
    city: str = Form(...),
    level: str = Form(...)  # "junior", "middle", "senior"
):
    current_user = get_current_user(request)
    db = Database()
    try:
        cursor = db.connection.cursor(dictionary=True)
        level_map = {"junior": 1, "middle": 2, "senior": 3}
        jms = level_map.get(level, 1)

        cursor.execute("""
            UPDATE users 
            SET username = %s, bio = %s, fav_lang = %s, city = %s, jms = %s
            WHERE username = %s
        """, (username, bio, fav_lang, city, jms, current_user))

        db.connection.commit()
        cursor.close()

        return {"success": True, "message": "Данные обновлены"}
    except Exception as e:
        return JSONResponse(
            content={"success": False, "message": str(e)},
            status_code=500
        )


@router.post("/profile/update-avatar")
async def update_avatar(
        request: Request,
        avatar: UploadFile = File(...)
):
    username = get_current_user(request)
    db = Database()

    try:
        cursor = db.connection.cursor(dictionary=True)
        contents = await avatar.read()

        cursor.execute("""
            UPDATE users 
            SET avatar = %s
            WHERE username = %s
        """, (contents, username))

        db.connection.commit()

        # Получаем обновленный аватар для ответа
        cursor.execute("SELECT avatar FROM users WHERE username = %s", (username,))
        updated_user = cursor.fetchone()
        cursor.close()

        avatar_url = f"data:image/png;base64,{base64.b64encode(updated_user['avatar']).decode('utf-8')}"

        return {
            "success": True,
            "message": "Аватар обновлен",
            "avatar": avatar_url
        }
    except Exception as e:
        return JSONResponse(
            content={"success": False, "message": str(e)},
            status_code=500
        )

@router.post("/profile/delete-avatar")
async def delete_avatar(request: Request):
    username = get_current_user(request)
    db = Database()

    try:
        cursor = db.connection.cursor()
        cursor.execute("""
            UPDATE users 
            SET avatar = NULL
            WHERE username = %s
        """, (username,))
        db.connection.commit()
        cursor.close()

        return {"success": True, "message": "Аватар удален"}
    except Exception as e:
        return JSONResponse(
            content={"success": False, "message": str(e)},
            status_code=500
        )