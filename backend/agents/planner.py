"""Planner Agent — converts user prompt into a structured edit plan."""
import asyncio
from typing import Dict
from .base import BaseAgent


class PlannerAgent(BaseAgent):
    name = "planner"
    label = "Planner"
    description = "Converts user prompt into a structured editing plan"

    SYSTEM = """You are a professional video editor AI. Given a user's editing prompt and video metadata,
produce a detailed, structured editing plan as JSON.

Your plan must include:
- summary: brief description of the edit style
- style_tags: list of style keywords (e.g. "cinematic", "fast-paced", "emotional")
- operations: ordered list of editing operations to perform
- audio_settings: volume, music_level, denoise, normalize
- visual_settings: brightness, contrast, saturation, warmth, vignette
- pacing: "slow" | "medium" | "fast" | "dynamic"
- keep_ratio: fraction of original content to keep (0.3-1.0)
- add_subtitles: boolean
- remove_filler_words: boolean
- highlight_emotional_parts: boolean
- fade_in: seconds
- fade_out: seconds
- reasoning: explanation of choices

Return ONLY valid JSON with exactly these fields."""

    async def run(self, context: Dict) -> Dict:
        prompt = context.get("prompt", "")
        duration = context.get("duration", 60.0)
        speech_density = context.get("speech_density", 0.7)
        scene_count = context.get("scene_count", 5)

        await self._emit("active", f"Analyzing prompt: '{prompt[:60]}...' " if len(prompt) > 60 else f"Analyzing: '{prompt}'")
        await asyncio.sleep(0.5)

        user_msg = f"""User prompt: "{prompt}"

Video metadata:
- Duration: {duration:.1f} seconds
- Speech density: {speech_density:.0%}
- Scene count: {scene_count}

Create a comprehensive editing plan."""

        result = await self.call_claude_json(self.SYSTEM, user_msg, max_tokens=1500)

        # Provide intelligent defaults if Claude is unavailable
        if result.get("parse_error") or result.get("mock"):
            result = self._default_plan(prompt, duration)

        await self._emit("complete", f"Plan ready: {result.get('summary', 'Edit plan created')}", result)
        return result

    def _default_plan(self, prompt: str, duration: float) -> Dict:
        prompt_lower = prompt.lower()
        is_cinematic = any(w in prompt_lower for w in ["cinematic", "film", "movie", "dramatic"])
        is_fast = any(w in prompt_lower for w in ["fast", "energetic", "dynamic", "quick"])
        is_emotional = any(w in prompt_lower for w in ["emotional", "touching", "feel", "heart"])

        return {
            "summary": f"{'Cinematic' if is_cinematic else 'Dynamic'} edit with {'emotional' if is_emotional else 'balanced'} pacing",
            "style_tags": (["cinematic", "dramatic"] if is_cinematic else []) +
                          (["fast-paced", "energetic"] if is_fast else ["balanced"]) +
                          (["emotional", "touching"] if is_emotional else []),
            "operations": [
                {"type": "cuts", "description": "Remove silence and filler sections"},
                {"type": "color", "description": "Apply color grading"},
                {"type": "audio", "description": "Normalize and clean audio"},
                {"type": "fade", "description": "Add smooth fade in/out"},
                {"type": "vignette", "description": "Add cinematic vignette"} if is_cinematic else None,
            ],
            "audio_settings": {
                "volume": 1.0,
                "music_level": 0.3 if is_emotional else 0.0,
                "denoise": True,
                "normalize": True,
            },
            "visual_settings": {
                "brightness": -0.05 if is_cinematic else 0.0,
                "contrast": 1.15 if is_cinematic else 1.05,
                "saturation": 0.85 if is_cinematic else 1.0,
                "warmth": 0.2 if is_emotional else 0.0,
                "vignette": 0.4 if is_cinematic else 0.0,
            },
            "pacing": "slow" if is_emotional else ("fast" if is_fast else "medium"),
            "keep_ratio": 0.7 if not is_fast else 0.5,
            "add_subtitles": False,
            "remove_filler_words": True,
            "highlight_emotional_parts": is_emotional,
            "fade_in": 0.8,
            "fade_out": 1.0,
            "reasoning": f"Applied {'cinematic' if is_cinematic else 'standard'} editing style based on prompt analysis.",
        }
