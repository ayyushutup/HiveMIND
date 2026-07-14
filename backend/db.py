"""
db.py — HiveMind Persistent History (SQLite)
=============================================
Self-contained helper module that persists debate sessions to a local
SQLite database (hivemind_history.db in the project root).

Schema
------
sessions          — one row per debate session
speeches          — one row per agent speech (FK → sessions)
market_snapshots  — final TECH/CRYPTO/MACRO prices (FK → sessions)
agent_snapshots   — final sentiment + portfolio per agent (FK → sessions)

All functions are synchronous and thread-safe (SQLite WAL mode + check_same_thread=False).
"""

import sqlite3
import json
import os
import time
from datetime import datetime

# Resolve DB path relative to the project root (two levels up from backend/)
_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "hivemind_history.db")
_DB_PATH = os.path.abspath(_DB_PATH)


def _get_conn() -> sqlite3.Connection:
    """Return a new connection in WAL mode for concurrent reads."""
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't already exist. Idempotent — safe to call on every startup."""
    conn = _get_conn()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                world_event TEXT    NOT NULL,
                mode        TEXT    NOT NULL DEFAULT 'macro',
                winner      TEXT,
                started_at  TEXT    NOT NULL,
                ended_at    TEXT,
                speech_count INTEGER NOT NULL DEFAULT 0,
                status      TEXT    NOT NULL DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS speeches (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                agent       TEXT    NOT NULL,
                content     TEXT    NOT NULL,
                thought     TEXT,
                emotion     TEXT    NOT NULL DEFAULT 'neutral',
                asset_focus TEXT    NOT NULL DEFAULT 'MACRO',
                spoken_at   TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS market_snapshots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                asset       TEXT    NOT NULL,
                final_price REAL    NOT NULL,
                base_price  REAL    NOT NULL DEFAULT 100.0,
                pct_change  REAL    NOT NULL DEFAULT 0.0
            );

            CREATE TABLE IF NOT EXISTS agent_snapshots (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id      INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                agent           TEXT    NOT NULL,
                final_emotion   TEXT,
                intensity       REAL    DEFAULT 0.0,
                influence_score INTEGER DEFAULT 0,
                portfolio_cash  REAL    DEFAULT 100000.0,
                portfolio_pnl   REAL    DEFAULT 0.0
            );

            CREATE INDEX IF NOT EXISTS idx_speeches_session  ON speeches(session_id);
            CREATE INDEX IF NOT EXISTS idx_market_session    ON market_snapshots(session_id);
            CREATE INDEX IF NOT EXISTS idx_agent_session     ON agent_snapshots(session_id);
        """)
        conn.commit()
        print(f"[DB] Initialized at {_DB_PATH}")
    finally:
        conn.close()


def start_session(world_event: str, mode: str = "macro") -> int:
    """
    Open a new debate session and return its ID.

    Args:
        world_event: The triggering world event text.
        mode: 'macro' or 'red_team'.

    Returns:
        session_id (int)
    """
    conn = _get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO sessions (world_event, mode, started_at, status) VALUES (?, ?, ?, 'active')",
            (world_event[:2000], mode, _now())
        )
        conn.commit()
        session_id = cur.lastrowid
        print(f"[DB] Session {session_id} started — mode={mode}")
        return session_id
    finally:
        conn.close()


def record_speech(
    session_id: int,
    agent: str,
    content: str,
    thought: str = "",
    emotion: str = "neutral",
    asset_focus: str = "MACRO",
):
    """
    Persist a single agent speech and increment the session speech counter.

    Args:
        session_id:  The active session ID (from start_session).
        agent:       Agent name.
        content:     The speech text.
        thought:     Internal thought string (optional).
        emotion:     Agent emotion label.
        asset_focus: Asset the agent is focused on.
    """
    if session_id is None:
        return
    conn = _get_conn()
    try:
        conn.execute(
            """INSERT INTO speeches
               (session_id, agent, content, thought, emotion, asset_focus, spoken_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (session_id, agent, content[:4000], thought[:1000], emotion, asset_focus, _now())
        )
        conn.execute(
            "UPDATE sessions SET speech_count = speech_count + 1 WHERE id = ?",
            (session_id,)
        )
        conn.commit()
    finally:
        conn.close()


def end_session(
    session_id: int,
    winner: str | None,
    market_final: dict,   # {"TECH": {"price": 104.2, "pct_change": 4.2}, ...}
    agent_final: list,    # [{name, current_emotion, intensity, influence_score, portfolio: {cash, pnl}}, ...]
):
    """
    Close a session and persist final snapshots.

    Args:
        session_id:   The session to close.
        winner:       Winning agent name, or None.
        market_final: Dict of asset → {price, pct_change}.
        agent_final:  List of agent state dicts.
    """
    if session_id is None:
        return
    conn = _get_conn()
    try:
        conn.execute(
            "UPDATE sessions SET winner=?, ended_at=?, status='complete' WHERE id=?",
            (winner, _now(), session_id)
        )
        for asset, data in market_final.items():
            conn.execute(
                """INSERT INTO market_snapshots (session_id, asset, final_price, base_price, pct_change)
                   VALUES (?, ?, ?, 100.0, ?)""",
                (session_id, asset, data.get("price", 100.0), data.get("pct_change", 0.0))
            )
        for agent in agent_final:
            port = agent.get("portfolio", {})
            conn.execute(
                """INSERT INTO agent_snapshots
                   (session_id, agent, final_emotion, intensity, influence_score, portfolio_cash, portfolio_pnl)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    session_id,
                    agent.get("name", ""),
                    agent.get("current_emotion", "neutral"),
                    float(agent.get("intensity", 0.0)),
                    int(agent.get("influence_score", 0)),
                    float(port.get("cash", 100000.0)),
                    float(port.get("pnl", 0.0)),
                )
            )
        conn.commit()
        print(f"[DB] Session {session_id} closed — winner={winner}")
    finally:
        conn.close()


def get_sessions(limit: int = 50) -> list[dict]:
    """
    Return a list of past sessions, most recent first.

    Args:
        limit: Max number of sessions to return.

    Returns:
        List of session dicts with summary fields.
    """
    conn = _get_conn()
    try:
        rows = conn.execute(
            """SELECT id, world_event, mode, winner, started_at, ended_at,
                      speech_count, status
               FROM sessions
               ORDER BY id DESC
               LIMIT ?""",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_session_detail(session_id: int) -> dict | None:
    """
    Return full replay data for a single session.

    Returns:
        Dict with keys: session, speeches, market_snapshots, agent_snapshots.
        Returns None if session_id not found.
    """
    conn = _get_conn()
    try:
        session = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if not session:
            return None

        speeches = conn.execute(
            "SELECT * FROM speeches WHERE session_id = ? ORDER BY id ASC",
            (session_id,)
        ).fetchall()

        market = conn.execute(
            "SELECT * FROM market_snapshots WHERE session_id = ?",
            (session_id,)
        ).fetchall()

        agents = conn.execute(
            "SELECT * FROM agent_snapshots WHERE session_id = ? ORDER BY influence_score DESC",
            (session_id,)
        ).fetchall()

        return {
            "session": dict(session),
            "speeches": [dict(s) for s in speeches],
            "market_snapshots": [dict(m) for m in market],
            "agent_snapshots": [dict(a) for a in agents],
        }
    finally:
        conn.close()


def _now() -> str:
    """Return current UTC timestamp as ISO string."""
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
