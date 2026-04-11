import aiosqlite
import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_PATH = os.getenv("DATABASE_URL", "./agentic_editor.db").replace("sqlite:///", "")


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                video_filename TEXT NOT NULL,
                video_path TEXT NOT NULL,
                prompt TEXT,
                status TEXT DEFAULT 'uploaded',
                output_path TEXT,
                version INTEGER DEFAULT 1,
                parent_session_id TEXT,
                duration REAL,
                thumbnail_path TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS agent_steps (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                agent_name TEXT NOT NULL,
                agent_label TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                input_data TEXT,
                output_data TEXT,
                error_message TEXT,
                started_at TEXT,
                completed_at TEXT,
                step_order INTEGER,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS video_analysis (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL UNIQUE,
                waveform_data TEXT,
                scene_timestamps TEXT,
                speech_segments TEXT,
                silence_segments TEXT,
                cut_points TEXT,
                duration REAL,
                fps REAL,
                width INTEGER,
                height INTEGER,
                total_frames INTEGER,
                audio_rms REAL,
                speech_density REAL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS edit_decisions (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                decision_type TEXT NOT NULL,
                description TEXT NOT NULL,
                parameters TEXT,
                agent_name TEXT,
                accepted INTEGER DEFAULT 1,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)
        await db.commit()


# ── Sessions ──────────────────────────────────────────────────────────────────

async def create_session(session_id: str, video_filename: str, video_path: str,
                         duration: Optional[float] = None,
                         thumbnail_path: Optional[str] = None) -> Dict:
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO sessions
               (id, created_at, updated_at, video_filename, video_path,
                status, duration, thumbnail_path)
               VALUES (?, ?, ?, ?, ?, 'uploaded', ?, ?)""",
            (session_id, now, now, video_filename, video_path, duration, thumbnail_path)
        )
        await db.commit()
    return await get_session(session_id)


async def update_session(session_id: str, **kwargs) -> None:
    kwargs["updated_at"] = datetime.utcnow().isoformat()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    values = list(kwargs.values()) + [session_id]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE sessions SET {sets} WHERE id = ?", values)
        await db.commit()


async def get_session(session_id: str) -> Optional[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def get_all_sessions() -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM sessions ORDER BY created_at DESC"
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


# ── Agent Steps ───────────────────────────────────────────────────────────────

async def create_agent_step(step_id: str, session_id: str, agent_name: str,
                             agent_label: str, step_order: int) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO agent_steps
               (id, session_id, agent_name, agent_label, status, step_order)
               VALUES (?, ?, ?, ?, 'pending', ?)""",
            (step_id, session_id, agent_name, agent_label, step_order)
        )
        await db.commit()


async def update_agent_step(step_id: str, **kwargs) -> None:
    if "input_data" in kwargs and isinstance(kwargs["input_data"], dict):
        kwargs["input_data"] = json.dumps(kwargs["input_data"])
    if "output_data" in kwargs and isinstance(kwargs["output_data"], dict):
        kwargs["output_data"] = json.dumps(kwargs["output_data"])
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    values = list(kwargs.values()) + [step_id]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE agent_steps SET {sets} WHERE id = ?", values)
        await db.commit()


async def get_session_steps(session_id: str) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM agent_steps WHERE session_id = ? ORDER BY step_order",
            (session_id,)
        ) as cur:
            rows = await cur.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                for field in ("input_data", "output_data"):
                    if d.get(field):
                        try:
                            d[field] = json.loads(d[field])
                        except Exception:
                            pass
                result.append(d)
            return result


# ── Video Analysis ────────────────────────────────────────────────────────────

async def save_analysis(analysis_id: str, session_id: str, data: Dict) -> None:
    for field in ("waveform_data", "scene_timestamps", "speech_segments",
                  "silence_segments", "cut_points"):
        if field in data and not isinstance(data[field], str):
            data[field] = json.dumps(data[field])
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT OR REPLACE INTO video_analysis
               (id, session_id, waveform_data, scene_timestamps,
                speech_segments, silence_segments, cut_points,
                duration, fps, width, height, total_frames,
                audio_rms, speech_density)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                analysis_id, session_id,
                data.get("waveform_data"), data.get("scene_timestamps"),
                data.get("speech_segments"), data.get("silence_segments"),
                data.get("cut_points"), data.get("duration"),
                data.get("fps"), data.get("width"), data.get("height"),
                data.get("total_frames"), data.get("audio_rms"),
                data.get("speech_density"),
            )
        )
        await db.commit()


async def get_analysis(session_id: str) -> Optional[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM video_analysis WHERE session_id = ?", (session_id,)
        ) as cur:
            row = await cur.fetchone()
            if not row:
                return None
            d = dict(row)
            for field in ("waveform_data", "scene_timestamps", "speech_segments",
                          "silence_segments", "cut_points"):
                if d.get(field):
                    try:
                        d[field] = json.loads(d[field])
                    except Exception:
                        pass
            return d


# ── Edit Decisions ────────────────────────────────────────────────────────────

async def save_edit_decision(dec_id: str, session_id: str, decision_type: str,
                              description: str, parameters: Dict,
                              agent_name: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO edit_decisions
               (id, session_id, decision_type, description, parameters,
                agent_name, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (dec_id, session_id, decision_type, description,
             json.dumps(parameters), agent_name,
             datetime.utcnow().isoformat())
        )
        await db.commit()


async def get_edit_decisions(session_id: str) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM edit_decisions WHERE session_id = ? ORDER BY timestamp",
            (session_id,)
        ) as cur:
            rows = await cur.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                if d.get("parameters"):
                    try:
                        d["parameters"] = json.loads(d["parameters"])
                    except Exception:
                        pass
                result.append(d)
            return result
