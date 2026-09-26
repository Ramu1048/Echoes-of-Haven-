"""
db.py -- Echoes of Haven
Single shared SQLite connection factory.
All modules import get_connection() from here.
"""

import sqlite3
import os

DB_PATH = os.environ.get("HAVEN_DB", "haven.db")


def get_connection() -> sqlite3.Connection:
    """Return a connection to the shared SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn
