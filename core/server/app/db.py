import sqlite3
from pathlib import Path


def get_db(db_path: str) -> sqlite3.Connection:
    """Return a sqlite3 connection to the given path.

    Rows are returned as dict-like sqlite3.Row objects.
    The caller is responsible for closing the connection.
    """
    if not db_path:
        raise ValueError('Database path is not configured')

    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn
