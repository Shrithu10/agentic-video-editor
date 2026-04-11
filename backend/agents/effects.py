"""Effects Agent — applies visual and audio effects."""
import asyncio
from typing import Dict, List
from .base import BaseAgent


class EffectsAgent(BaseAgent):
    name = "effects"
    label = "Effects"
    description = "Applies color grading, audio normalization, and visual effects"

    async def run(self, context: Dict) -> Dict:
        plan = context.get("plan", {})
        visual = plan.get("visual_settings", {})
        audio = plan.get("audio_settings", {})
        input_path = context.get("current_path", "")
        output_path = context.get("effects_output_path", "")

        await self._emit("active", "Applying color grading and audio normalization...")
        await asyncio.sleep(0.7)

        operations = []

        # Color grading
        if any([visual.get("brightness", 0) != 0,
                visual.get("contrast", 1) != 1,
                visual.get("saturation", 1) != 1,
                abs(visual.get("warmth", 0)) > 0.05]):
            operations.append({
                "type": "color",
                "description": f"Color grade: contrast={visual.get('contrast', 1):.2f}, "
                               f"saturation={visual.get('saturation', 1):.2f}",
                "params": {
                    "brightness": visual.get("brightness", 0),
                    "contrast": visual.get("contrast", 1),
                    "saturation": visual.get("saturation", 1),
                    "warmth": visual.get("warmth", 0),
                }
            })

        # Vignette
        if visual.get("vignette", 0) > 0.1:
            operations.append({
                "type": "vignette",
                "description": f"Cinematic vignette: strength={visual.get('vignette', 0.4):.2f}",
                "params": {"strength": visual.get("vignette", 0.4)}
            })

        # Audio
        if audio:
            operations.append({
                "type": "audio",
                "description": f"Audio: volume={audio.get('volume', 1.0):.1f}, "
                               f"denoise={audio.get('denoise', False)}, "
                               f"normalize={audio.get('normalize', False)}",
                "params": {
                    "volume": audio.get("volume", 1.0),
                    "denoise": audio.get("denoise", False),
                    "normalize": audio.get("normalize", False),
                }
            })

        # Fades
        if plan.get("fade_in", 0) > 0 or plan.get("fade_out", 0) > 0:
            operations.append({
                "type": "fade",
                "description": f"Fades: in={plan.get('fade_in', 0.5):.1f}s, "
                               f"out={plan.get('fade_out', 0.5):.1f}s",
                "params": {
                    "fade_in": plan.get("fade_in", 0.5),
                    "fade_out": plan.get("fade_out", 0.5),
                }
            })

        # Apply operations if we have paths
        applied = []
        if input_path and output_path:
            from processing.video import chain_operations
            ops_to_apply = [{"type": op["type"], "params": op["params"]} for op in operations]
            if ops_to_apply:
                ok, msg = chain_operations(input_path, output_path, ops_to_apply)
            else:
                import shutil
                shutil.copy2(input_path, output_path)
                ok = True
            applied = [op["description"] for op in operations]

        result = {
            "operations_planned": operations,
            "operations_applied": applied,
            "output_path": output_path,
            "effects_summary": ", ".join([op["description"] for op in operations]) or "No effects applied"
        }

        await self._emit("complete",
                         f"Applied {len(operations)} effects: {result['effects_summary'][:80]}",
                         result)
        return result
