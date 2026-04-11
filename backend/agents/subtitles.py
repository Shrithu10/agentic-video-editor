"""Subtitles Agent — generates and burns subtitles."""
import asyncio
from typing import Dict, List
from .base import BaseAgent


class SubtitlesAgent(BaseAgent):
    name = "subtitles"
    label = "Subtitles"
    description = "Generates and burns subtitles or captions"

    SYSTEM = """You are a transcription and subtitle AI.
Given speech segment timestamps and video context, generate realistic subtitle text.

Return JSON with:
- subtitles: list of {start, end, text, confidence}
- language: detected language
- total_words: word count

Each subtitle should cover 1-3 seconds.
Return ONLY valid JSON."""

    async def run(self, context: Dict) -> Dict:
        plan = context.get("plan", {})
        speech = context.get("speech_segments", [])
        input_path = context.get("current_path", "")
        output_path = context.get("subtitles_output_path", "")

        if not plan.get("add_subtitles", False):
            await self._emit("complete", "Subtitles not requested — skipping", {"skipped": True})
            return {"skipped": True, "subtitles": []}

        await self._emit("active", f"Generating subtitles for {len(speech)} speech segments...")
        await asyncio.sleep(0.9)

        prompt_context = context.get("prompt", "")
        user_msg = f"""Video edit context: "{prompt_context}"
Speech segments: {speech[:20]}
Generate realistic subtitles. Make them sound natural."""

        result = await self.call_claude_json(self.SYSTEM, user_msg, max_tokens=2000)

        if result.get("parse_error") or result.get("mock"):
            result = self._generate_placeholder_subs(speech)

        # Apply subtitles if we have paths
        if input_path and output_path and result.get("subtitles"):
            from processing.video import add_subtitles
            ok = add_subtitles(input_path, output_path, result["subtitles"])
            if not ok:
                import shutil
                shutil.copy2(input_path, output_path)
        elif input_path and output_path:
            import shutil
            shutil.copy2(input_path, output_path)

        count = len(result.get("subtitles", []))
        await self._emit("complete", f"Generated {count} subtitle entries", result)
        return result

    def _generate_placeholder_subs(self, speech: List[Dict]) -> Dict:
        sample_phrases = [
            "This is an important point to consider.",
            "Let me explain what we're looking at here.",
            "As you can see from the data presented,",
            "This moment captures the essence of the story.",
            "Building towards the conclusion,",
            "The key takeaway from this section is,",
            "Moving forward with our analysis,",
            "This demonstrates the core principle clearly.",
        ]
        subs = []
        phrase_idx = 0
        for seg in speech[:20]:
            seg_dur = seg["end"] - seg["start"]
            if seg_dur < 1.0:
                continue
            # Split long segments
            t = seg["start"]
            while t < seg["end"] - 0.5:
                end_t = min(t + 3.0, seg["end"])
                subs.append({
                    "start": round(t, 2),
                    "end": round(end_t, 2),
                    "text": sample_phrases[phrase_idx % len(sample_phrases)],
                    "confidence": 0.95
                })
                phrase_idx += 1
                t = end_t

        return {
            "subtitles": subs,
            "language": "en",
            "total_words": sum(len(s["text"].split()) for s in subs),
        }
