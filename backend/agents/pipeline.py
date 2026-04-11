"""
Agent Pipeline Orchestrator.
Runs all agents in sequence, emitting WebSocket events for each step.
"""
import os
import uuid
import asyncio
import shutil
from datetime import datetime
from typing import Dict, Callable, Awaitable, Optional

from agents import (PlannerAgent, AnalyzerAgent, CutterAgent,
                    EffectsAgent, SubtitlesAgent, MusicAgent, CriticAgent)
from models.database import (
    update_session, update_agent_step, get_session_steps,
    save_edit_decision
)


AGENT_ORDER = [
    ("planner",   "Planner",   PlannerAgent),
    ("analyzer",  "Analyzer",  AnalyzerAgent),
    ("cutter",    "Cutter",    CutterAgent),
    ("effects",   "Effects",   EffectsAgent),
    ("subtitles", "Subtitles", SubtitlesAgent),
    ("music",     "Music",     MusicAgent),
    ("critic",    "Critic",    CriticAgent),
]


class AgentPipeline:
    def __init__(self, session_id: str, ws_emit: Callable):
        self.session_id = session_id
        self.ws_emit = ws_emit          # async(event_type, data)
        self.context: Dict = {}
        self.step_ids: Dict[str, str] = {}

    async def _on_agent_status(self, agent_name: str, status: str,
                                message: str, data: Dict):
        step_id = self.step_ids.get(agent_name)
        if step_id:
            updates: Dict = {"status": status}
            if status == "active":
                updates["started_at"] = datetime.utcnow().isoformat()
            elif status in ("complete", "failed"):
                updates["completed_at"] = datetime.utcnow().isoformat()
                updates["output_data"] = data
            await update_agent_step(step_id, **updates)

        await self.ws_emit("agent_update", {
            "session_id": self.session_id,
            "agent": agent_name,
            "status": status,
            "message": message,
            "data": data,
        })

    async def run(self, prompt: str, video_path: str, analysis: Dict,
                  output_dir: str) -> Dict:
        """Run the full agent pipeline."""
        steps = await get_session_steps(self.session_id)
        self.step_ids = {s["agent_name"]: s["id"] for s in steps}

        duration = analysis.get("duration", 60.0)
        speech = analysis.get("speech_segments") or []
        silence = analysis.get("silence_segments") or []
        scenes = analysis.get("scene_timestamps") or []
        speech_density = analysis.get("speech_density", 0.7)

        # ── 1. Planner ────────────────────────────────────────────────────────
        planner = PlannerAgent(on_status=self._on_agent_status)
        plan = await planner.run({
            "prompt": prompt,
            "duration": duration,
            "speech_density": speech_density,
            "scene_count": len(scenes),
        })
        self.context["plan"] = plan

        # ── 2. Analyzer ───────────────────────────────────────────────────────
        analyzer = AnalyzerAgent(on_status=self._on_agent_status)
        analysis_result = await analyzer.run({
            "speech_segments": speech,
            "silence_segments": silence,
            "scene_timestamps": scenes,
            "duration": duration,
            "plan": plan,
        })
        self.context["analysis"] = analysis_result

        # ── 3. Cutter ─────────────────────────────────────────────────────────
        cutter = CutterAgent(on_status=self._on_agent_status)
        cut_results = await cutter.run({
            "analysis": analysis_result,
            "plan": plan,
            "duration": duration,
            "speech_segments": speech,
            "silence_segments": silence,
        })
        self.context["cut_results"] = cut_results

        # Build intermediate paths
        session_out_dir = os.path.join(output_dir, self.session_id)
        os.makedirs(session_out_dir, exist_ok=True)

        after_cuts = os.path.join(session_out_dir, "01_cuts.mp4")
        after_effects = os.path.join(session_out_dir, "02_effects.mp4")
        after_subs = os.path.join(session_out_dir, "03_subtitles.mp4")
        final_output = os.path.join(session_out_dir, "final.mp4")

        # Apply cuts
        keep_segments = cut_results.get("keep_segments", [])
        if keep_segments:
            from processing.video import apply_cuts
            ok = apply_cuts(video_path, after_cuts, keep_segments)
            if not ok:
                shutil.copy2(video_path, after_cuts)
        else:
            shutil.copy2(video_path, after_cuts)

        # ── 4. Effects ────────────────────────────────────────────────────────
        effects_agent = EffectsAgent(on_status=self._on_agent_status)
        effects_result = await effects_agent.run({
            "plan": plan,
            "current_path": after_cuts,
            "effects_output_path": after_effects,
        })
        self.context["effects_results"] = effects_result

        # ── 5. Subtitles ──────────────────────────────────────────────────────
        subs_agent = SubtitlesAgent(on_status=self._on_agent_status)
        subs_result = await subs_agent.run({
            "plan": plan,
            "prompt": prompt,
            "speech_segments": speech,
            "current_path": after_effects,
            "subtitles_output_path": after_subs,
        })
        self.context["subs_results"] = subs_result

        # If subtitles were skipped, copy forward
        if subs_result.get("skipped"):
            shutil.copy2(after_effects, after_subs)

        # ── 6. Music ──────────────────────────────────────────────────────────
        music_agent = MusicAgent(on_status=self._on_agent_status)
        music_result = await music_agent.run({
            "plan": plan,
            "prompt": prompt,
        })
        self.context["music_results"] = music_result

        # Finalise — copy last stage to final
        shutil.copy2(after_subs, final_output)

        # ── 7. Critic ─────────────────────────────────────────────────────────
        critic = CriticAgent(on_status=self._on_agent_status)
        review = await critic.run({
            "plan": plan,
            "prompt": prompt,
            "duration": duration,
            "cut_results": cut_results,
            "effects_results": effects_result,
        })
        self.context["review"] = review

        # Save edit decisions to DB
        for dec in cut_results.get("keep_segments", [])[:5]:
            await save_edit_decision(
                str(uuid.uuid4()), self.session_id,
                "cut", dec.get("reason", "Keep segment"),
                dec, "cutter"
            )
        for op in effects_result.get("operations_planned", []):
            await save_edit_decision(
                str(uuid.uuid4()), self.session_id,
                "effect", op.get("description", ""),
                op.get("params", {}), "effects"
            )

        return {
            "final_path": final_output,
            "plan": plan,
            "analysis": analysis_result,
            "cuts": cut_results,
            "effects": effects_result,
            "subtitles": subs_result,
            "music": music_result,
            "review": review,
        }
