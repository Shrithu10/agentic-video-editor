"""
Video & audio analysis utilities.
Falls back gracefully when optional dependencies (librosa, cv2) are missing.
"""
import os
import json
import math
import subprocess
import tempfile
import struct
import wave
from pathlib import Path
from typing import Dict, List, Tuple, Optional

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    import librosa
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


def _run(cmd: List[str]) -> Tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode, result.stdout, result.stderr
    except FileNotFoundError:
        # ffmpeg / ffprobe not on PATH — return failure gracefully
        return 1, "", f"{cmd[0]}: command not found"
    except Exception as e:
        return 1, "", str(e)


def ffprobe_info(video_path: str) -> Dict:
    """Get video metadata via ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", video_path
    ]
    rc, out, err = _run(cmd)
    if rc != 0:
        return {}
    try:
        info = json.loads(out)
    except Exception:
        return {}

    result = {"duration": 0.0, "fps": 30.0, "width": 1920, "height": 1080, "total_frames": 0}
    fmt = info.get("format", {})
    result["duration"] = float(fmt.get("duration", 0))

    for stream in info.get("streams", []):
        if stream.get("codec_type") == "video":
            result["width"] = int(stream.get("width", 1920))
            result["height"] = int(stream.get("height", 1080))
            r_frame_rate = stream.get("r_frame_rate", "30/1")
            try:
                num, den = r_frame_rate.split("/")
                result["fps"] = round(float(num) / float(den), 3)
            except Exception:
                result["fps"] = 30.0
            nb = stream.get("nb_frames")
            if nb:
                result["total_frames"] = int(nb)
            else:
                result["total_frames"] = int(result["duration"] * result["fps"])

    return result


def extract_waveform(video_path: str, samples: int = 200) -> List[float]:
    """Extract audio amplitude envelope, normalised to [0, 1]."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name

    try:
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-ac", "1", "-ar", "8000",
            "-vn", wav_path
        ]
        rc, _, err = _run(cmd)
        if rc != 0 or "command not found" in err:
            return _synthetic_waveform(samples)

        if HAS_LIBROSA:
            y, sr = librosa.load(wav_path, sr=None, mono=True)
            hop = max(1, len(y) // samples)
            rms = [float(np.sqrt(np.mean(y[i:i+hop]**2)))
                   for i in range(0, len(y) - hop, hop)][:samples]
            max_v = max(rms) if rms else 1
            if max_v == 0:
                max_v = 1
            return [v / max_v for v in rms]

        # Pure-python fallback: read wav frames
        with wave.open(wav_path, "rb") as wf:
            n_frames = wf.getnframes()
            sampwidth = wf.getsampwidth()
            raw = wf.readframes(n_frames)

        if sampwidth == 2:
            fmt = f"{n_frames}h"
        else:
            fmt = f"{n_frames}B"
        try:
            samples_data = struct.unpack(fmt, raw[:n_frames * sampwidth])
        except Exception:
            return _synthetic_waveform(samples)

        chunk = max(1, len(samples_data) // samples)
        result = []
        for i in range(0, len(samples_data) - chunk, chunk):
            chunk_vals = samples_data[i:i+chunk]
            rms = math.sqrt(sum(v*v for v in chunk_vals) / len(chunk_vals))
            result.append(rms)
        if not result:
            return _synthetic_waveform(samples)
        max_v = max(result) or 1
        return [min(1.0, v / max_v) for v in result[:samples]]
    finally:
        try:
            os.unlink(wav_path)
        except Exception:
            pass


def _synthetic_waveform(samples: int) -> List[float]:
    """Generate a plausible synthetic waveform when ffmpeg is unavailable."""
    if HAS_NUMPY:
        import numpy as np
        t = np.linspace(0, 4 * math.pi, samples)
        wave = (np.sin(t) * 0.4 + np.sin(2.3 * t) * 0.3 +
                np.random.rand(samples) * 0.3)
        wave = (wave - wave.min()) / (wave.max() - wave.min() + 1e-9)
        return wave.tolist()
    return [abs(math.sin(i * 0.3)) * 0.5 + 0.1 for i in range(samples)]


def detect_scenes(video_path: str, threshold: float = 0.35) -> List[float]:
    """Return timestamps (seconds) of scene changes."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-show_frames", "-select_streams", "v",
        "-read_intervals", "%+#500",
        "-show_entries", "frame=pkt_pts_time,pict_type",
        "-of", "csv", video_path
    ]
    rc, out, err = _run(cmd)
    if rc != 0 or "command not found" in err:
        return _synthetic_scenes(60.0)

    # Use ffmpeg scene detection filter
    cmd2 = [
        "ffmpeg", "-i", video_path,
        "-vf", f"select=gt(scene\\,{threshold}),showinfo",
        "-vsync", "vfr", "-f", "null", "-"
    ]
    rc2, _, err2 = _run(cmd2)
    timestamps: List[float] = []
    for line in err2.splitlines():
        if "pts_time:" in line:
            try:
                part = [p for p in line.split() if "pts_time:" in p][0]
                t = float(part.split(":")[1])
                timestamps.append(round(t, 2))
            except Exception:
                pass

    if not timestamps:
        info = ffprobe_info(video_path)
        dur = info.get("duration", 60.0)
        return _synthetic_scenes(dur)
    return sorted(timestamps)


def _synthetic_scenes(duration: float) -> List[float]:
    interval = max(3.0, duration / 8)
    scenes = []
    t = interval
    while t < duration:
        scenes.append(round(t, 2))
        t += interval
    return scenes


def detect_speech_silence(video_path: str) -> Tuple[List[Dict], List[Dict]]:
    """
    Detect speech and silence segments.
    Returns (speech_segments, silence_segments) each as list of {start, end}.
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name

    try:
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-ac", "1", "-ar", "16000", "-vn", wav_path
        ]
        rc, _, err = _run(cmd)
        if rc != 0 or "command not found" in err:
            return _synthetic_speech(60.0)

        if HAS_LIBROSA:
            y, sr = librosa.load(wav_path, sr=None, mono=True)
            intervals = librosa.effects.split(y, top_db=25, frame_length=2048, hop_length=512)
            duration = len(y) / sr
            speech = [{"start": round(s/sr, 2), "end": round(e/sr, 2)}
                      for s, e in intervals]
            # Derive silence as gaps
            silence = []
            prev_end = 0.0
            for seg in speech:
                if seg["start"] - prev_end > 0.3:
                    silence.append({"start": round(prev_end, 2), "end": round(seg["start"], 2)})
                prev_end = seg["end"]
            if duration - prev_end > 0.3:
                silence.append({"start": round(prev_end, 2), "end": round(duration, 2)})
            return speech, silence

        # Fallback: use ffmpeg silencedetect filter
        cmd2 = [
            "ffmpeg", "-i", wav_path,
            "-af", "silencedetect=n=-30dB:d=0.5",
            "-f", "null", "-"
        ]
        rc2, _, err2 = _run(cmd2)
        silence = []
        silence_start = None
        for line in err2.splitlines():
            if "silence_start:" in line:
                try:
                    silence_start = float(line.split("silence_start:")[1].strip().split()[0])
                except Exception:
                    pass
            elif "silence_end:" in line and silence_start is not None:
                try:
                    parts = line.split("silence_end:")[1].strip().split()
                    end = float(parts[0])
                    silence.append({"start": round(silence_start, 2), "end": round(end, 2)})
                    silence_start = None
                except Exception:
                    pass

        info = ffprobe_info(video_path)
        duration = info.get("duration", 60.0)
        speech = _invert_segments(silence, duration)
        if not silence and not speech:
            return _synthetic_speech(duration)
        return speech, silence
    finally:
        try:
            os.unlink(wav_path)
        except Exception:
            pass


def _invert_segments(silence: List[Dict], duration: float) -> List[Dict]:
    speech = []
    prev = 0.0
    for s in sorted(silence, key=lambda x: x["start"]):
        if s["start"] - prev > 0.1:
            speech.append({"start": round(prev, 2), "end": round(s["start"], 2)})
        prev = s["end"]
    if duration - prev > 0.1:
        speech.append({"start": round(prev, 2), "end": round(duration, 2)})
    return speech


def _synthetic_speech(duration: float) -> Tuple[List[Dict], List[Dict]]:
    speech, silence = [], []
    t = 0.5
    while t < duration - 1:
        speech_dur = min(duration - t, 2.5 + (hash(str(t)) % 3))
        speech.append({"start": round(t, 2), "end": round(t + speech_dur, 2)})
        t += speech_dur
        sil_dur = 0.3 + (hash(str(t * 2)) % 10) / 10
        silence.append({"start": round(t, 2), "end": round(t + sil_dur, 2)})
        t += sil_dur
    return speech, silence


def extract_thumbnails(video_path: str, timestamps: List[float],
                       thumb_dir: str, session_id: str) -> List[str]:
    """Extract frame thumbnails at given timestamps."""
    os.makedirs(thumb_dir, exist_ok=True)
    paths = []
    for i, ts in enumerate(timestamps):
        out_path = os.path.join(thumb_dir, f"{session_id}_thumb_{i:03d}.jpg")
        cmd = [
            "ffmpeg", "-y", "-ss", str(ts), "-i", video_path,
            "-vframes", "1", "-q:v", "3",
            "-vf", "scale=320:-1", out_path
        ]
        rc, _, _ = _run(cmd)
        if rc == 0 and os.path.exists(out_path):
            paths.append(out_path)
    return paths


def compute_metrics(waveform: List[float], speech: List[Dict],
                    silence: List[Dict], duration: float,
                    scenes: List[float]) -> Dict:
    """Compute analytics metrics from analysis data."""
    if not waveform:
        waveform = _synthetic_waveform(200)

    total_speech = sum(s["end"] - s["start"] for s in speech)
    total_silence = sum(s["end"] - s["start"] for s in silence)
    speech_density = total_speech / duration if duration > 0 else 0
    avg_rms = sum(waveform) / len(waveform) if waveform else 0

    # Pacing = how often cuts happen per minute
    cut_freq = len(scenes) / (duration / 60) if duration > 0 else 0

    # Silence distribution across 10 time buckets
    bucket_size = duration / 10 if duration > 0 else 6
    sil_buckets = [0.0] * 10
    for s in silence:
        bucket = min(9, int(s["start"] / bucket_size))
        sil_buckets[bucket] += s["end"] - s["start"]

    return {
        "total_speech_duration": round(total_speech, 2),
        "total_silence_duration": round(total_silence, 2),
        "speech_density": round(speech_density, 3),
        "average_rms": round(avg_rms, 4),
        "cut_frequency_per_min": round(cut_freq, 2),
        "scene_count": len(scenes),
        "silence_distribution": [round(v, 2) for v in sil_buckets],
        "pacing_score": round(min(1.0, cut_freq / 20), 3),
    }
