import mysql.connector
from mysql.connector import Error

class Database:
    def __init__(self):
        try:
            self.connection = mysql.connector.connect(
                host="localhost",
                user="root",
                password="7emerys_admin",
                database="world_of_code"
            )
            self.create_users_table()
        except Error as e:
            print(f"Ошибка подключения к базе данных: {e}")
            raise

    def create_users_table(self):
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL
                )
            """)
            self.connection.commit()
            cursor.close()
        except Error as e:
            print(f"Ошибка при создании таблицы: {e}")

    def add_user(self, username: str, password: str):
        try:
            cursor = self.connection.cursor()
            cursor.execute(
                "INSERT INTO users (username, password) VALUES (%s, %s)",
                (username, password)
            )
            self.connection.commit()
            cursor.close()
            return True
        except Error as e:
            print(f"Ошибка при добавлении пользователя: {e}")
            return False

    def get_user(self, username: str):
        try:
            cursor = self.connection.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            cursor.close()
            return user
        except Error as e:
            print(f"Ошибка при получении пользователя: {e}")
            return None

    def __del__(self):
        if hasattr(self, 'connection') and self.connection.is_connected():
            self.connection.close()