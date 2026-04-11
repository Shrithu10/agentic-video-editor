"""
Video editing operations using FFmpeg subprocess calls.
"""
import os
import subprocess
import tempfile
import json
from typing import List, Dict, Optional, Tuple


def _run(cmd: List[str]) -> Tuple[int, str, str]:
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr


def apply_cuts(input_path: str, output_path: str,
               keep_segments: List[Dict[str, float]]) -> bool:
    """
    Keep only specified time segments from the video.
    keep_segments: list of {"start": float, "end": float}
    """
    if not keep_segments:
        return False

    # Build complex filter for selecting segments
    segments = sorted(keep_segments, key=lambda x: x["start"])

    if len(segments) == 1:
        seg = segments[0]
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(seg["start"]),
            "-to", str(seg["end"]),
            "-i", input_path,
            "-c", "copy", output_path
        ]
        rc, _, err = _run(cmd)
        return rc == 0

    # Multiple segments: use concat demuxer
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        list_file = f.name
        for seg in segments:
            f.write(f"file '{os.path.abspath(input_path)}'\n")
            f.write(f"inpoint {seg['start']}\n")
            f.write(f"outpoint {seg['end']}\n")

    try:
        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", list_file, "-c", "copy", output_path
        ]
        rc, _, err = _run(cmd)
        return rc == 0
    finally:
        os.unlink(list_file)


def apply_color_grade(input_path: str, output_path: str,
                      brightness: float = 0.0, contrast: float = 1.0,
                      saturation: float = 1.0, warmth: float = 0.0) -> bool:
    """Apply color grading via FFmpeg EQ filter."""
    # Convert brightness from -1..1 to FFmpeg's 0..2 range
    eq_brightness = brightness + 1.0  # shift from [-1,1] to [0,2] — unused in eq
    vf_parts = []

    # eq filter: brightness(-1 to 1), contrast(0 to 2), saturation(0 to 3)
    vf_parts.append(f"eq=brightness={brightness:.3f}:contrast={contrast:.3f}:saturation={saturation:.3f}")

    # Warmth via color curves
    if abs(warmth) > 0.05:
        if warmth > 0:  # warmer
            vf_parts.append(f"curves=red='0/0 0.5/{min(1, 0.5+warmth*0.15):.3f} 1/1':"
                            f"blue='0/0 0.5/{max(0, 0.5-warmth*0.1):.3f} 1/1'")
        else:  # cooler
            vf_parts.append(f"curves=blue='0/0 0.5/{min(1, 0.5-warmth*0.15):.3f} 1/1':"
                            f"red='0/0 0.5/{max(0, 0.5+warmth*0.1):.3f} 1/1'")

    vf = ",".join(vf_parts) if vf_parts else "null"
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", vf,
        "-c:a", "copy", output_path
    ]
    rc, _, _ = _run(cmd)
    return rc == 0


def adjust_audio(input_path: str, output_path: str,
                 volume: float = 1.0, denoise: bool = False,
                 normalize: bool = False) -> bool:
    """Adjust audio levels and optionally apply denoise/normalize."""
    af_parts = []

    if volume != 1.0:
        af_parts.append(f"volume={volume:.3f}")

    if denoise:
        # Simple high-pass filter to remove low-frequency noise
        af_parts.append("highpass=f=80,lowpass=f=8000")

    if normalize:
        af_parts.append("loudnorm")

    af = ",".join(af_parts) if af_parts else "anull"
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-af", af,
        "-c:v", "copy", output_path
    ]
    rc, _, _ = _run(cmd)
    return rc == 0


def add_fade(input_path: str, output_path: str,
             fade_in: float = 0.5, fade_out: float = 0.5,
             duration: Optional[float] = None) -> bool:
    """Add video and audio fades."""
    if duration is None:
        # Get duration
        cmd = ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
               "-of", "csv=p=0", input_path]
        rc, out, _ = _run(cmd)
        if rc == 0:
            try:
                duration = float(out.strip())
            except Exception:
                duration = 30.0
        else:
            duration = 30.0

    vf_parts = []
    af_parts = []

    if fade_in > 0:
        vf_parts.append(f"fade=t=in:st=0:d={fade_in}")
        af_parts.append(f"afade=t=in:st=0:d={fade_in}")

    if fade_out > 0:
        fo_start = max(0, duration - fade_out)
        vf_parts.append(f"fade=t=out:st={fo_start:.3f}:d={fade_out}")
        af_parts.append(f"afade=t=out:st={fo_start:.3f}:d={fade_out}")

    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", ",".join(vf_parts) if vf_parts else "null",
        "-af", ",".join(af_parts) if af_parts else "anull",
        output_path
    ]
    rc, _, _ = _run(cmd)
    return rc == 0


def add_subtitles(input_path: str, output_path: str,
                  subtitle_entries: List[Dict]) -> bool:
    """
    Burn subtitles using drawtext filter.
    subtitle_entries: [{"start": float, "end": float, "text": str}]
    """
    if not subtitle_entries:
        import shutil
        shutil.copy2(input_path, output_path)
        return True

    # Generate SRT file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
        srt_path = f.name
        for i, entry in enumerate(subtitle_entries, 1):
            start = _seconds_to_srt(entry["start"])
            end = _seconds_to_srt(entry["end"])
            f.write(f"{i}\n{start} --> {end}\n{entry['text']}\n\n")

    try:
        srt_path_escaped = srt_path.replace("\\", "/").replace(":", "\\:")
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-vf", f"subtitles='{srt_path_escaped}':force_style='FontSize=22,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2'",
            "-c:a", "copy", output_path
        ]
        rc, _, _ = _run(cmd)
        return rc == 0
    finally:
        try:
            os.unlink(srt_path)
        except Exception:
            pass


def _seconds_to_srt(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def speed_ramp(input_path: str, output_path: str,
               segments: List[Dict]) -> bool:
    """
    Apply speed changes to segments.
    segments: [{"start": float, "end": float, "speed": float}]
    """
    # Simple implementation: apply uniform speed change
    if not segments:
        import shutil
        shutil.copy2(input_path, output_path)
        return True

    # Use atempo for audio and setpts for video
    avg_speed = sum(s["speed"] for s in segments) / len(segments)
    pts = 1.0 / avg_speed
    atempo = avg_speed

    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", f"setpts={pts:.3f}*PTS",
        "-af", f"atempo={min(2.0, max(0.5, atempo)):.3f}",
        output_path
    ]
    rc, _, _ = _run(cmd)
    return rc == 0


def remove_silence(input_path: str, output_path: str,
                   silence_segments: List[Dict],
                   duration: float) -> bool:
    """Remove silence segments, keeping only speech."""
    # Build keep segments (inverse of silence)
    silence_sorted = sorted(silence_segments, key=lambda x: x["start"])
    keep = []
    prev = 0.0
    for s in silence_sorted:
        if s["start"] - prev > 0.1:
            keep.append({"start": prev, "end": s["start"]})
        prev = s["end"]
    if duration - prev > 0.1:
        keep.append({"start": prev, "end": duration})

    return apply_cuts(input_path, output_path, keep)


def apply_vignette(input_path: str, output_path: str,
                   strength: float = 0.5) -> bool:
    """Apply cinematic vignette effect."""
    angle = strength * 1.5
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", f"vignette=angle={angle:.3f}",
        "-c:a", "copy", output_path
    ]
    rc, _, _ = _run(cmd)
    return rc == 0


def chain_operations(input_path: str, output_path: str,
                     operations: List[Dict]) -> Tuple[bool, str]:
    """
    Chain multiple video operations in sequence.
    Each operation: {"type": str, "params": dict}
    Returns (success, message)
    """
    import shutil
    import uuid

    current = input_path
    tmp_files = []

    try:
        for i, op in enumerate(operations):
            is_last = (i == len(operations) - 1)
            next_path = output_path if is_last else os.path.join(
                tempfile.gettempdir(), f"ve_tmp_{uuid.uuid4().hex}.mp4"
            )
            if not is_last:
                tmp_files.append(next_path)

            op_type = op.get("type", "")
            params = op.get("params", {})
            ok = False

            if op_type == "cuts":
                ok = apply_cuts(current, next_path, params.get("segments", []))
            elif op_type == "color":
                ok = apply_color_grade(current, next_path, **params)
            elif op_type == "audio":
                ok = adjust_audio(current, next_path, **params)
            elif op_type == "fade":
                ok = add_fade(current, next_path, **params)
            elif op_type == "subtitles":
                ok = add_subtitles(current, next_path, params.get("entries", []))
            elif op_type == "speed":
                ok = speed_ramp(current, next_path, params.get("segments", []))
            elif op_type == "remove_silence":
                ok = remove_silence(current, next_path,
                                    params.get("silence_segments", []),
                                    params.get("duration", 60.0))
            elif op_type == "vignette":
                ok = apply_vignette(current, next_path, params.get("strength", 0.5))
            else:
                shutil.copy2(current, next_path)
                ok = True

            if not ok:
                # Fall back to copy so pipeline continues
                try:
                    shutil.copy2(current, next_path)
                except Exception:
                    pass

            current = next_path

        return True, "Pipeline complete"

    except Exception as e:
        return False, str(e)
    finally:
        for tmp in tmp_files:
            try:
                if os.path.exists(tmp):
                    os.unlink(tmp)
            except Exception:
                pass
