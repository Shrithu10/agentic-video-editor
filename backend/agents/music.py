"""Music Agent — recommends and applies background music."""
import asyncio
from typing import Dict
from .base import BaseAgent


class MusicAgent(BaseAgent):
    name = "music"
    label = "Music"
    description = "Recommends and applies background music to match the mood"

    SYSTEM = """You are a music supervisor for video editing.
Given the video's style and mood, recommend background music.

Return JSON with:
- recommended_tracks: list of {title, artist, genre, mood, tempo_bpm, reason}
- selected_track: the best choice {title, artist, genre}
- music_level: 0.0-1.0 mixing level
- apply_music: boolean (only true if music_level > 0.1)
- mood_tags: list of mood descriptors
- timing_suggestion: "throughout" | "intro_outro" | "emotional_parts"

Return ONLY valid JSON."""

    GENRE_MAP = {
        "cinematic": {"genre": "Orchestral/Cinematic", "tempo": 72, "mood": "epic"},
        "emotional": {"genre": "Ambient/Emotional", "tempo": 60, "mood": "touching"},
        "fast": {"genre": "Electronic/EDM", "tempo": 128, "mood": "energetic"},
        "inspiring": {"genre": "Uplifting Pop", "tempo": 95, "mood": "inspiring"},
        "corporate": {"genre": "Corporate/Ambient", "tempo": 85, "mood": "professional"},
    }

    async def run(self, context: Dict) -> Dict:
        plan = context.get("plan", {})
        music_level = plan.get("audio_settings", {}).get("music_level", 0.0)

        if music_level < 0.1:
            await self._emit("complete", "No background music needed for this style", {
                "apply_music": False, "music_level": 0.0
            })
            return {"apply_music": False, "music_level": 0.0}

        await self._emit("active", f"Selecting background music (level: {music_level:.0%})...")
        await asyncio.sleep(0.6)

        style_tags = plan.get("style_tags", [])
        pacing = plan.get("pacing", "medium")
        prompt = context.get("prompt", "")

        user_msg = f"""Style tags: {style_tags}
Pacing: {pacing}
Music level: {music_level}
Edit prompt: "{prompt}"

Recommend the best background music tracks."""

        result = await self.call_claude_json(self.SYSTEM, user_msg, max_tokens=1000)

        if result.get("parse_error") or result.get("mock"):
            result = self._recommend_music(style_tags, pacing, music_level)

        await self._emit("complete",
                         f"Music: {result.get('selected_track', {}).get('title', 'None')} "
                         f"({result.get('selected_track', {}).get('genre', '')})",
                         result)
        return result

    def _recommend_music(self, style_tags, pacing, music_level) -> Dict:
        # Match style to music
        genre_info = {"genre": "Ambient", "tempo": 80, "mood": "neutral"}
        for tag in style_tags:
            for key, info in self.GENRE_MAP.items():
                if key in tag.lower():
                    genre_info = info
                    break

        tracks = [
            {
                "title": "Eternal Horizons",
                "artist": "Cinematic Orchestra",
                "genre": genre_info["genre"],
                "mood": genre_info["mood"],
                "tempo_bpm": genre_info["tempo"],
                "reason": "Matches the emotional tone and pacing"
            },
            {
                "title": "Rising Momentum",
                "artist": "Ambient Collective",
                "genre": genre_info["genre"],
                "mood": "building",
                "tempo_bpm": genre_info["tempo"] + 10,
                "reason": "Supports narrative progression"
            },
        ]

        return {
            "recommended_tracks": tracks,
            "selected_track": tracks[0],
            "music_level": music_level,
            "apply_music": True,
            "mood_tags": [genre_info["mood"], pacing],
            "timing_suggestion": "throughout",
        }
