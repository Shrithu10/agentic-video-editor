"""Analyzer Agent — deep content analysis."""
import asyncio
from typing import Dict, List
from .base import BaseAgent


class AnalyzerAgent(BaseAgent):
    name = "analyzer"
    label = "Analyzer"
    description = "Analyzes video content: speech, scenes, emotional beats"

    SYSTEM = """You are a video content analyst AI. Given speech segments and scene data,
identify the most important moments in the video.

Return JSON with:
- key_moments: list of {timestamp, type, importance (0-1), reason}
  types: "speech_peak", "scene_change", "emotional_beat", "filler", "silence_gap"
- highlight_segments: list of {start, end, score (0-1), reason}
- filler_segments: list of {start, end, reason}
- pacing_analysis: {overall, recommended_cuts, energy_curve}
- emotional_arc: list of {time_pct (0-1), intensity (0-1)}

Return ONLY valid JSON."""

    async def run(self, context: Dict) -> Dict:
        speech = context.get("speech_segments", [])
        silence = context.get("silence_segments", [])
        scenes = context.get("scene_timestamps", [])
        duration = context.get("duration", 60.0)
        plan = context.get("plan", {})

        await self._emit("active", f"Scanning {len(speech)} speech segments, {len(scenes)} scenes...")
        await asyncio.sleep(0.8)

        user_msg = f"""Video duration: {duration:.1f}s
Speech segments: {speech[:20]}
Silence segments: {silence[:20]}
Scene timestamps: {scenes[:20]}
Edit plan style: {plan.get('pacing', 'medium')} pacing

Identify key moments and segments to keep/cut."""

        result = await self.call_claude_json(self.SYSTEM, user_msg, max_tokens=2000)

        if result.get("parse_error") or result.get("mock"):
            result = self._analyze_locally(speech, silence, scenes, duration)

        await self._emit("complete",
                         f"Found {len(result.get('key_moments', []))} key moments, "
                         f"{len(result.get('highlight_segments', []))} highlights",
                         result)
        return result

    def _analyze_locally(self, speech: List[Dict], silence: List[Dict],
                          scenes: List[float], duration: float) -> Dict:
        """Local analysis when Claude unavailable."""
        key_moments = []

        # Scene changes are key moments
        for ts in scenes:
            key_moments.append({
                "timestamp": ts,
                "type": "scene_change",
                "importance": 0.7,
                "reason": "Scene transition detected"
            })

        # Long speech = important content
        for seg in speech:
            seg_dur = seg["end"] - seg["start"]
            if seg_dur > 3.0:
                key_moments.append({
                    "timestamp": seg["start"],
                    "type": "speech_peak",
                    "importance": min(1.0, seg_dur / 10),
                    "reason": f"Extended speech segment ({seg_dur:.1f}s)"
                })

        # Long silence = filler
        filler_segments = []
        for seg in silence:
            if seg["end"] - seg["start"] > 1.0:
                filler_segments.append({
                    "start": seg["start"],
                    "end": seg["end"],
                    "reason": "Long silence gap"
                })

        # Highlight best speech segments
        speech_sorted = sorted(speech, key=lambda x: x["end"] - x["start"], reverse=True)
        highlights = []
        for seg in speech_sorted[:8]:
            score = min(1.0, (seg["end"] - seg["start"]) / 8)
            highlights.append({
                "start": seg["start"],
                "end": seg["end"],
                "score": round(score, 2),
                "reason": "High-content speech segment"
            })

        # Emotional arc (synthetic bell curve)
        emotional_arc = []
        for i in range(11):
            t = i / 10
            # Bell-ish curve peaking at 60-70%
            intensity = 4 * t * (1 - t) * (0.5 + 0.5 * (t > 0.3 and t < 0.8))
            emotional_arc.append({"time_pct": t, "intensity": round(min(1.0, intensity), 2)})

        return {
            "key_moments": key_moments[:20],
            "highlight_segments": highlights,
            "filler_segments": filler_segments[:10],
            "pacing_analysis": {
                "overall": "medium",
                "recommended_cuts": len(filler_segments),
                "energy_curve": "builds-to-peak"
            },
            "emotional_arc": emotional_arc,
        }
