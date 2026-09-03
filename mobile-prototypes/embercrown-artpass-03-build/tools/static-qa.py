#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
index = (root / "index.html").read_text(encoding="utf-8")
game = (root / "game.js").read_text(encoding="utf-8")
styles = (root / "styles.css").read_text(encoding="utf-8")

ids = re.findall(r'\bid="([^"]+)"', index)
duplicates = sorted({value for value in ids if ids.count(value) > 1})
script_sources = re.findall(r'<script[^>]+src="([^"]+)"', index)
external_scripts = [src for src in script_sources if src.startswith(("http://", "https://"))]
required = [
    "vendor/babylon-9.23.0.js",
    "vendor/babylonjs.loaders-9.23.0.min.js",
    "assets/models/Knight.glb",
    "assets/models/Skeleton_Minion.glb",
    "assets/models/Skeleton_Rogue.glb",
    "assets/models/Skeleton_Warrior.glb",
    "assets/textures/knight_embercrown.png",
    "assets/textures/skeleton_ash_oath.png",
    "assets/textures/crown_runes.png",
]
missing = [item for item in required if not (root / item).exists()]

safe_guard = "let stamp = -Infinity;"
unsafe_guard = "let stamp = 0;"
checks = {
    "duplicate_ids": duplicates,
    "external_script_dependencies": external_scripts,
    "missing_runtime_files": missing,
    "first_tap_guard_safe": game.count(safe_guard) == 1 and unsafe_guard not in game,
    "combo_timing_table": "COMBO_STEPS" in game and "spec.hit" in game,
    "boss_phase_2_and_3": "beginBossPhase" in game and "bossPhase" in game,
    "dedicated_enemy_models": all(name in game for name in ("Skeleton_Minion.glb", "Skeleton_Rogue.glb")),
    "mobile_start_handlers": all(name in game for name in ("pointerup", "touchend", "click")),
    "qa_api_present": "__EMBER_QA__" in game and all(name in game for name in ("clearWights", "setBossRatio", "damageBoss")),
    "reduced_motion": "prefers-reduced-motion" in styles,
}
checks["passed"] = not duplicates and not external_scripts and not missing and all(
    value is True
    for key, value in checks.items()
    if key not in {"duplicate_ids", "external_script_dependencies", "missing_runtime_files", "passed"}
)
print(json.dumps(checks, ensure_ascii=False, indent=2))
if not checks["passed"]:
    raise SystemExit(1)
