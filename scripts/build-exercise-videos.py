#!/usr/bin/env python3
"""Build a looping demonstration mp4 from the three phase stills."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "exercises"
FFMPEG = "/Users/fmociulsky/Library/Python/3.14/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-x86_64-v7.1"
IDS = [
    "squat",
    "squat_box",
    "hinge",
    "glute_bridge",
    "hip_thrust",
    "lunge",
    "step_up",
    "press",
    "pushup",
    "row",
    "inverted_row",
    "pull",
    "ohp",
    "plank",
    "bird_dog",
    "carry",
    "push_iso",
    "pull_iso",
    "walk",
    "bike",
    "cond",
    "mobility",
    "balance",
    "generic",
]


def scale(label: str) -> str:
    return (
        f"[{label}]scale=960:720:force_original_aspect_ratio=decrease,"
        "pad=960:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p"
    )


def build(sex: str, exercise_id: str) -> None:
    folder = ROOT / sex
    frames = [folder / f"{exercise_id}-{i}.jpg" for i in range(3)]
    missing = [str(path) for path in frames if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing stills for {sex}/{exercise_id}: {missing}")

    out = folder / f"{exercise_id}.mp4"
    # Full rep: start → mid → end → mid (loops back to start).
    cmd = [
        FFMPEG,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-loop",
        "1",
        "-t",
        "0.7",
        "-i",
        str(frames[0]),
        "-loop",
        "1",
        "-t",
        "0.7",
        "-i",
        str(frames[1]),
        "-loop",
        "1",
        "-t",
        "0.9",
        "-i",
        str(frames[2]),
        "-loop",
        "1",
        "-t",
        "0.7",
        "-i",
        str(frames[1]),
        "-filter_complex",
        ";".join(
            [
                f"{scale('0:v')}[v0]",
                f"{scale('1:v')}[v1]",
                f"{scale('2:v')}[v2]",
                f"{scale('3:v')}[v3]",
                "[v0][v1]xfade=transition=fade:duration=0.25:offset=0.45[a]",
                "[a][v2]xfade=transition=fade:duration=0.25:offset=0.90[b]",
                "[b][v3]xfade=transition=fade:duration=0.25:offset=1.55[v]",
            ]
        ),
        "-map",
        "[v]",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "veryfast",
        "-crf",
        "26",
        "-movflags",
        "+faststart",
        str(out),
    ]
    subprocess.run(cmd, check=True)
    print(f"OK {sex}/{exercise_id}.mp4 ({out.stat().st_size} bytes)")


def main() -> int:
    for sex in ("male", "female"):
        for exercise_id in IDS:
            build(sex, exercise_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
