from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class EditRequest(BaseModel):
    session_id: str
    prompt: str
    settings: Optional[Dict[str, Any]] = {}


class ManualEditRequest(BaseModel):
    session_id: str
    edits: List[Dict[str, Any]]


class AcceptSuggestionRequest(BaseModel):
    session_id: str
    decision_id: str
    accepted: bool


class AgentStepOut(BaseModel):
    id: str
    agent_name: str
    agent_label: str
    status: str
    input_data: Optional[Any] = None
    output_data: Optional[Any] = None
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    step_order: int


class SessionOut(BaseModel):
    id: str
    created_at: str
    updated_at: str
    video_filename: str
    video_path: str
    prompt: Optional[str] = None
    status: str
    output_path: Optional[str] = None
    version: int
    duration: Optional[float] = None
    thumbnail_path: Optional[str] = None
    steps: Optional[List[AgentStepOut]] = None


class AnalysisOut(BaseModel):
    session_id: str
    waveform_data: Optional[List[float]] = None
    scene_timestamps: Optional[List[float]] = None
    speech_segments: Optional[List[Dict]] = None
    silence_segments: Optional[List[Dict]] = None
    cut_points: Optional[List[float]] = None
    duration: Optional[float] = None
    fps: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    total_frames: Optional[int] = None
    audio_rms: Optional[float] = None
    speech_density: Optional[float] = None
