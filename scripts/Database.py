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
            self.create_tables()
        except Error as e:
            print(f"Ошибка подключения к базе данных: {e}")
            raise

    def create_tables(self):
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS  users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    avatar LONGBLOB,
                    bio TEXT,
                    fav_lang VARCHAR(50),
                    jms INT DEFAULT "1",
                    level_progress INT DEFAULT 1, -- Шкала в достижениях написать
                    score_progress INT DEFAULT 0, -- Прогресс до следующего уровня (0-1000) написать
                    experience INT DEFAULT 0, -- Общее количество опыта написать
                    city VARCHAR(100)
                )
            """)

            # Таблица задач
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    short_description TEXT,
                    full_description TEXT,
                    input_example TEXT,
                    output_example TEXT,
                    logo_url LONGBLOB,
                    difficulty ENUM('easy', 'medium', 'hard') NOT NULL,
                    base_experience INT -- DEFAULT 100 Базовый опыт за решение
                )
            """)

            # Таблица пользовательских решений
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_tasks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    task_id INT NOT NULL,
                    language VARCHAR(50) NOT NULL,
                    code TEXT,
                    test_results JSON,
                    is_solved BOOLEAN DEFAULT FALSE,
                    solved_at TIMESTAMP NULL,
                    execution_time INT, -- Время выполнения в секундах
                    attempts INT DEFAULT 1,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
                )
            """)

            # Таблица с информацией о прохождении тестов пользовательских решений
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS task_test_cases (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    task_id INT NOT NULL,
                    language ENUM('Python', 'JavaScript', 'C++', 'Java', 'C#') NOT NULL,
                    test_cases JSON NOT NULL,
                    starter_code TEXT, -- Стартовый код для редактора
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    UNIQUE KEY (task_id, language) -- Одна запись на язык для задачи
                )
            """)

            # Таблица достижений
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS achievements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    type ENUM('streak', 'tasks', 'learning', 'medal') NOT NULL,
                    subtype VARCHAR(50), -- Для медалей: gold/silver/bronze
                    value INT NOT NULL, -- Количество (дней, задач и т.д.)
                    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            # Таблица статистики
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_stats (
                    user_id INT PRIMARY KEY,
                    total_tasks_solved INT DEFAULT 0,
                    perfect_solutions INT DEFAULT 0, -- Решения с первой попытки
                    avg_execution_time INT, -- Среднее время решения в секундах
                    favorite_language VARCHAR(50),
                    last_solved_date DATE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            self.connection.commit()
            cursor.close()
        except Error as e:
            print(f"Ошибка при создании таблицы: {e}")

    def add_user(self, username: str, password: str) -> bool:
        try:
            # Валидация длины имени пользователя
            if len(username) < 4 or len(username) > 20:
                raise ValueError("Имя пользователя должно быть от 4 до 20 символов")

            # Валидация пароля
            if len(password) < 8:
                raise ValueError("Пароль должен содержать минимум 8 символов")

            cursor = self.connection.cursor()
            cursor.execute(
                "INSERT INTO users (username, password) VALUES (%s, %s)",
                (username, password)
            )
            self.connection.commit()
            return True
        except ValueError as ve:
            print(f"Ошибка валидации: {ve}")
            return False
        except Error as e:
            print(f"Ошибка базы данных: {e}")
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

    def get_user_info(self, username: str):
        try:
            cursor = self.connection.cursor(dictionary=True)
            cursor.execute("""
                SELECT username, avatar, bio, fav_lang, jms, City 
                FROM users WHERE username = %s
            """, (username,))
            user = cursor.fetchone()
            cursor.close()
            return user
        except Error as e:
            print(f"Ошибка при получении пользователя: {e}")
            return None

    def __del__(self):
        if hasattr(self, 'connection') and self.connection.is_connected():
            self.connection.close()