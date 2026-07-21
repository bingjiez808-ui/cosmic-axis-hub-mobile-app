#!/usr/bin/env python3
"""
Deterministic validator for daily-reading-v1 payloads.

Usage: python validate_daily_reading.py <payload.json>

Exit 0 = valid; non-zero = invalid, with reason on stderr. Never calls
the network. Never mutates the payload.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

FORBIDDEN = [
    r"成功率", r"好运概率", r"胜率", r"hit rate",
    r"必然", r"保证", r"一定会",
    r"幸运色", r"幸运数字", r"幸运方位",
    r"日干支", r"日盘", r"日 ?Nakshatra",
    r"陶白白",
]

EVIDENCE_PATTERNS = [
    re.compile(r"^daily\.transit_planets\[[a-z]+\]$"),
    re.compile(r"^daily\.transit_to_natal_aspects\[[a-z]+→[a-z]+,(conjunction|opposition|trine|square|sextile)\]$"),
    re.compile(r"^daily\.moon\.(phase|sign)$"),
    re.compile(r"^scores\.domains\[(study|career|love|wealth)\]$"),
    re.compile(r"^slower\.(vedic|bazi|ziwei)$"),
]


def ref_ok(ref: str) -> bool:
    return any(p.match(ref) for p in EVIDENCE_PATTERNS)


def fail(msg: str) -> None:
    print(f"INVALID: {msg}", file=sys.stderr)
    sys.exit(2)


def main(path: str) -> None:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("skill_version") != "daily-reading-v1":
        fail("skill_version must be 'daily-reading-v1'")
    for k in ("date", "timezone", "chart_reference", "one_line_theme",
              "four_domain_summary", "do_today", "observe_today",
              "counterconditions", "reflection_question", "confidence",
              "missing_facts"):
        if k not in data:
            fail(f"missing key: {k}")
    if not (2 <= len(data["do_today"]) <= 3):
        fail("do_today must have 2–3 items")
    if not (2 <= len(data["observe_today"]) <= 3):
        fail("observe_today must have 2–3 items")
    if len(data["counterconditions"]) < 1:
        fail("counterconditions must have at least one item")
    text_blob = json.dumps(data, ensure_ascii=False)
    for pat in FORBIDDEN:
        if re.search(pat, text_blob):
            fail(f"forbidden term found: {pat}")
    # evidence_refs whitelist
    def walk_refs(obj):
        if isinstance(obj, dict):
            if "evidence_refs" in obj and isinstance(obj["evidence_refs"], list):
                for r in obj["evidence_refs"]:
                    if not ref_ok(r):
                        fail(f"evidence_ref not in whitelist: {r}")
            for v in obj.values():
                walk_refs(v)
        elif isinstance(obj, list):
            for v in obj:
                walk_refs(v)
    walk_refs(data)
    # supportive/caution consensus rule
    for section in ("supportive_signals", "caution_signals"):
        for item in data.get(section, []):
            conf = item.get("confidence", "low")
            refs = item.get("evidence_refs", [])
            if conf in ("medium", "high") and len(set(refs)) < 2:
                if "单体系参考" not in item.get("text", ""):
                    fail(f"{section} '{item.get('text','')[:20]}' needs ≥2 refs OR '单体系参考' + confidence:low")
    print("OK")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: validate_daily_reading.py <payload.json>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1])
