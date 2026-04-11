"""Base agent class with Claude API integration."""
import os
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Callable, Awaitable
import anthropic

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-6"


class BaseAgent:
    name: str = "base"
    label: str = "Base Agent"
    description: str = "Base agent"

    def __init__(self, on_status: Optional[Callable] = None):
        """
        on_status: async callback(agent_name, status, message, data)
        """
        self.on_status = on_status
        self.client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

    async def _emit(self, status: str, message: str, data: Any = None):
        if self.on_status:
            await self.on_status(self.name, status, message, data or {})

    async def call_claude(self, system: str, user: str,
                          max_tokens: int = 2048) -> str:
        """Call Claude and return text response."""
        if not self.client:
            return json.dumps({"error": "No API key configured", "mock": True})

        try:
            msg = await self.client.messages.create(
                model=MODEL,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}]
            )
            return msg.content[0].text
        except Exception as e:
            return json.dumps({"error": str(e), "mock": True})

    async def call_claude_json(self, system: str, user: str,
                               max_tokens: int = 2048) -> Dict:
        """Call Claude and parse JSON from response."""
        raw = await self.call_claude(system, user + "\n\nRespond ONLY with valid JSON.", max_tokens)
        # Extract JSON block if wrapped in markdown
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        try:
            return json.loads(raw)
        except Exception:
            return {"raw": raw, "parse_error": True}

    async def run(self, context: Dict) -> Dict:
        raise NotImplementedError
