"""Regenerate the Gemini summary of briefs that were saved without one.

    cd agent && ../envs/fingpt/bin/python resummarize.py            # every brief missing a summary
    cd agent && ../envs/fingpt/bin/python resummarize.py 2026-09-23 # just these

run_brief() keeps the engine output and leaves `summary` null when Gemini is unavailable, so the
brief is complete apart from its prose. This fills that in later, one call per brief, stopping at
the first failure — the free tier allows 20 generate calls a day and _summarize already retries
internally, so grinding away here is how you lose the rest of the day's quota.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import brief  # noqa: E402  (needs the key in the environment first)


def main(dates):
    paths = [brief.BRIEF_DIR / f"{d}.json" for d in dates] if dates else sorted(brief.BRIEF_DIR.glob("????-??-??.json"))
    todo = [p for p in paths if p.exists() and not json.loads(p.read_text()).get("summary")]
    if not todo:
        return print("no brief is missing a summary")

    for path in todo:
        b = json.loads(path.read_text())
        summary = asyncio.run(brief._summarize(b["items"]))
        if not summary:
            return print(f"{path.stem}: Gemini unavailable — stopping, the engine data is untouched")
        b["summary"] = summary
        tmp = path.with_suffix(".tmp")  # the UI re-reads this file every 30s; swap it in one step
        tmp.write_text(json.dumps(b, ensure_ascii=False, indent=1))
        os.replace(tmp, path)
        print(f"{path.stem}: {summary['zh']['overview'][:90]}…")


if __name__ == "__main__":
    main(sys.argv[1:])
