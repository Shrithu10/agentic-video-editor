"""Critic Agent — reviews the edit and suggests improvements."""
import asyncio
from typing import Dict
from .base import BaseAgent


class CriticAgent(BaseAgent):
    name = "critic"
    label = "Critic"
    description = "Reviews the edit quality and suggests improvements"

    SYSTEM = """You are a senior video editor and critic AI.
Review the completed video edit and provide quality feedback.

Return JSON with:
- overall_score: 0-10
- quality_assessment: brief summary
- strengths: list of what works well
- improvements: list of specific improvements with priority (high/medium/low)
- pacing_score: 0-10
- audio_score: 0-10
- visual_score: 0-10
- suggestions: list of {type, description, action} — actionable next steps
- re_edit_recommended: boolean

Return ONLY valid JSON."""

    async def run(self, context: Dict) -> Dict:
        plan = context.get("plan", {})
        cuts = context.get("cut_results", {})
        effects = context.get("effects_results", {})
        duration = context.get("duration", 60.0)
        prompt = context.get("prompt", "")

        await self._emit("active", "Reviewing edit quality and generating report...")
        await asyncio.sleep(0.8)

        kept_duration = cuts.get("total_kept_duration", duration * 0.7)
        cut_count = cuts.get("cut_count", 5)
        effects_applied = effects.get("effects_summary", "None")

        user_msg = f"""Original prompt: "{prompt}"
Original duration: {duration:.1f}s → Kept: {kept_duration:.1f}s
Cuts made: {cut_count}
Effects applied: {effects_applied}
Style requested: {plan.get('summary', 'Standard edit')}

Evaluate this edit. Score it and suggest improvements."""

        result = await self.call_claude_json(self.SYSTEM, user_msg, max_tokens=1500)

        if result.get("parse_error") or result.get("mock"):
            result = self._generate_review(plan, cuts, effects, duration)

        await self._emit("complete",
                         f"Review complete: {result.get('overall_score', 0)}/10 — "
                         f"{result.get('quality_assessment', 'Edit reviewed')}",
                         result)
        return result

    def _generate_review(self, plan, cuts, effects, duration) -> Dict:
        kept = cuts.get("total_kept_duration", duration * 0.7)
        cut_count = cuts.get("cut_count", 5)
        keep_ratio = kept / duration if duration > 0 else 0.7

        # Score based on various factors
        pacing_score = 7.5 if 0.4 < keep_ratio < 0.85 else 6.0
        audio_score = 8.0 if effects.get("operations_applied") else 6.5
        visual_score = 7.5

        overall = round((pacing_score + audio_score + visual_score) / 3, 1)

        improvements = []
        if keep_ratio > 0.85:
            improvements.append({
                "priority": "medium",
                "text": "Consider tighter cuts — current keep ratio is high"
            })
        if keep_ratio < 0.4:
            improvements.append({
                "priority": "high",
                "text": "Aggressive cuts may have removed important content"
            })

        return {
            "overall_score": overall,
            "quality_assessment": f"Solid edit with {cut_count} cuts, keeping {kept:.0f}s of {duration:.0f}s",
            "strengths": [
                "Clean cut transitions",
                "Consistent audio levels",
                "Appropriate pacing for style",
            ],
            "improvements": improvements or [
                {"priority": "low", "text": "Consider adding transitions between cuts"},
                {"priority": "low", "text": "Optional: background music could enhance mood"},
            ],
            "pacing_score": pacing_score,
            "audio_score": audio_score,
            "visual_score": visual_score,
            "suggestions": [
                {
                    "type": "pacing",
                    "description": "Add J-cuts for smoother transitions",
                    "action": "Apply overlap editing at cut points"
                },
                {
                    "type": "visual",
                    "description": "Increase contrast slightly for more visual punch",
                    "action": "Adjust eq contrast to 1.2"
                }
            ],
            "re_edit_recommended": overall < 6.0,
        }
