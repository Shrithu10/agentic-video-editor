"""Cutter Agent — determines precise cut points."""
import asyncio
from typing import Dict, List
from .base import BaseAgent


class CutterAgent(BaseAgent):
    name = "cutter"
    label = "Cutter"
    description = "Determines precise cut points to keep only the best content"

    SYSTEM = """You are a professional video editor specializing in cutting.
Given analysis data and edit plan, determine the exact segments to KEEP.

Return JSON with:
- keep_segments: list of {start, end, reason} — segments to preserve
- removed_segments: list of {start, end, reason} — segments being cut
- total_kept_duration: estimated seconds
- cut_count: number of cuts made
- edit_summary: brief description of cutting decisions

Ensure keep_segments are non-overlapping, sorted by start time.
Return ONLY valid JSON."""

    async def run(self, context: Dict) -> Dict:
        analysis = context.get("analysis", {})
        plan = context.get("plan", {})
        duration = context.get("duration", 60.0)
        silence = context.get("silence_segments", [])
        speech = context.get("speech_segments", [])

        await self._emit("active", "Calculating optimal cut points...")
        await asyncio.sleep(0.6)

        keep_ratio = plan.get("keep_ratio", 0.7)
        pacing = plan.get("pacing", "medium")

        user_msg = f"""Duration: {duration:.1f}s, Target keep: {keep_ratio:.0%}
Pacing: {pacing}
Speech segments: {speech[:15]}
Silence segments: {silence[:15]}
Filler segments: {analysis.get('filler_segments', [])[:10]}
Highlight segments: {analysis.get('highlight_segments', [])[:8]}

Determine exact segments to keep. Remove fillers and long silences."""

        result = await self.call_claude_json(self.SYSTEM, user_msg, max_tokens=2000)

        if result.get("parse_error") or result.get("mock"):
            result = self._compute_cuts(speech, silence, analysis, duration, keep_ratio, pacing)

        await self._emit("complete",
                         f"Cut plan: keeping {result.get('total_kept_duration', 0):.0f}s "
                         f"({result.get('cut_count', 0)} cuts)",
                         result)
        return result

    def _compute_cuts(self, speech: List[Dict], silence: List[Dict],
                       analysis: Dict, duration: float,
                       keep_ratio: float, pacing: str) -> Dict:
        """Compute cuts locally."""
        # Start with all speech segments as keep candidates
        filler_ranges = {(f["start"], f["end"])
                         for f in analysis.get("filler_segments", [])}

        # Remove long silences (> 0.8s) and fillers
        silence_threshold = 0.5 if pacing == "fast" else 1.0

        keep = []
        for seg in speech:
            # Skip if it's a filler
            is_filler = any(
                fs <= seg["start"] and fe >= seg["end"]
                for fs, fe in filler_ranges
            )
            if not is_filler:
                keep.append({"start": seg["start"], "end": seg["end"],
                              "reason": "Speech content"})

        # Also include a portion of silence (breathing room)
        if pacing != "fast":
            for sil in silence:
                sil_dur = sil["end"] - sil["start"]
                if sil_dur <= silence_threshold:
                    keep.append({"start": sil["start"], "end": sil["end"],
                                 "reason": "Short natural pause"})

        # Sort and merge overlapping
        keep.sort(key=lambda x: x["start"])
        merged = []
        for seg in keep:
            if merged and seg["start"] <= merged[-1]["end"] + 0.1:
                merged[-1]["end"] = max(merged[-1]["end"], seg["end"])
            else:
                merged.append(dict(seg))

        # Compute removed
        removed = []
        prev = 0.0
        for seg in merged:
            if seg["start"] - prev > 0.1:
                removed.append({"start": round(prev, 2), "end": round(seg["start"], 2),
                                 "reason": "Silence/filler removed"})
            prev = seg["end"]
        if duration - prev > 0.1:
            removed.append({"start": round(prev, 2), "end": round(duration, 2),
                             "reason": "Tail removed"})

        total_kept = sum(s["end"] - s["start"] for s in merged)

        return {
            "keep_segments": [{"start": round(s["start"], 2), "end": round(s["end"], 2),
                                "reason": s["reason"]} for s in merged],
            "removed_segments": removed,
            "total_kept_duration": round(total_kept, 2),
            "cut_count": len(merged),
            "edit_summary": f"Kept {total_kept:.0f}s of {duration:.0f}s, removed {len(removed)} segments",
        }
