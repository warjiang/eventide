import logging
import json
import os
from typing import List, Optional

import psycopg2
from dotenv import load_dotenv

from models import Session

logger = logging.getLogger("playground.store")

# Load environment variables (useful for local development with .env)
# The .env is located at the project root which is two directories up from playground/backend
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

class SessionStore:
    def __init__(self):
        # PG_CONN='postgres://postgres:password@host:port/app?sslmode=disable'
        self.conn_str = os.getenv("PG_CONN")
        if not self.conn_str:
            logger.warning("PG_CONN environment variable is not set. Session storage may fail.")
        
        self._init_db()

    def _get_connection(self):
        if not self.conn_str:
            raise ValueError("Database connection string PG_CONN is missing.")
        return psycopg2.connect(self.conn_str)

    def _init_db(self):
        if not self.conn_str:
            return
            
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        CREATE TABLE IF NOT EXISTS sessions (
                            session_id TEXT PRIMARY KEY,
                            created_at DOUBLE PRECISION,
                            data TEXT
                        )
                    ''')
                conn.commit()
        except Exception as e:
            logger.error("Failed to initialize PostgreSQL database: %s", e)

    def save(self, session: Session):
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        INSERT INTO sessions (session_id, created_at, data)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (session_id) DO UPDATE SET
                            created_at = EXCLUDED.created_at,
                            data = EXCLUDED.data
                    ''', (session.session_id, session.created_at, session.model_dump_json()))
                conn.commit()
        except Exception as e:
            logger.error("Failed to save session to PostgreSQL: %s", e)

    def get(self, session_id: str) -> Optional[Session]:
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        SELECT data FROM sessions WHERE session_id = %s
                    ''', (session_id,))
                    row = cursor.fetchone()
                    if row:
                        return Session.model_validate_json(row[0])
                    return None
        except Exception as e:
            logger.error("Failed to fetch session from PostgreSQL: %s", e)
            return None

    def get_all(self) -> List[Session]:
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        SELECT data FROM sessions ORDER BY created_at DESC
                    ''')
                    return [Session.model_validate_json(row[0]) for row in cursor.fetchall()]
        except Exception as e:
            logger.error("Failed to fetch all sessions from PostgreSQL: %s", e)
            return []

    def delete(self, session_id: str):
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute('''
                        DELETE FROM sessions WHERE session_id = %s
                    ''', (session_id,))
                conn.commit()
        except Exception as e:
            logger.error("Failed to delete session from PostgreSQL: %s", e)
