#!/usr/bin/env python3
"""Checks that run against docs alone, before any code exists.

Run locally with:  python3 scripts/check_docs.py

1. Every relative Markdown link points at a file that exists.
2. Every heading anchor referenced by a link exists in the target file.
3. Secret-valued keys in .env.example are left empty.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Keys that must never carry a value in .env.example. Non-secret defaults
# (ports, localhost URLs) are fine and deliberately excluded.
SECRET_KEYS = [
    "ASSEMBLYAI_API_KEY",
    "LLM_API_KEY",
    "TTS_API_KEY",
    "DEVICE_SHARED_SECRET",
]

LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def slugify(heading: str) -> str:
    """Approximate GitHub's heading-to-anchor conversion."""
    s = heading.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"[\s_]+", "-", s).strip("-")


def anchors_in(path: Path) -> set[str]:
    return {
        slugify(m.group(1))
        for m in re.finditer(r"^#{1,6}\s+(.*)$", path.read_text(), re.MULTILINE)
    }


def check_links() -> list[str]:
    problems, count = [], 0
    for md in sorted(ROOT.rglob("*.md")):
        if ".git/" in str(md):
            continue
        rel = md.relative_to(ROOT)
        for m in LINK.finditer(md.read_text()):
            link = m.group(1)
            if link.startswith(("http://", "https://", "mailto:")):
                continue
            path_part, _, anchor = link.partition("#")
            if not path_part:
                target = md  # pure anchor, same file
            else:
                target = (md.parent / path_part).resolve()
                count += 1
                if not target.exists():
                    problems.append(f"{rel}: broken link -> {link}")
                    continue
            if anchor and target.suffix == ".md" and anchor not in anchors_in(target):
                problems.append(f"{rel}: missing anchor -> {link}")
    print(f"  checked {count} relative links")
    return problems


def check_env_example() -> list[str]:
    example = ROOT / ".env.example"
    if not example.exists():
        return [".env.example is missing"]
    problems = []
    for line in example.read_text().splitlines():
        key, sep, value = line.partition("=")
        if sep and key.strip() in SECRET_KEYS and value.strip():
            problems.append(f".env.example: {key.strip()} must be empty, found a value")
    print(f"  checked {len(SECRET_KEYS)} secret keys in .env.example")
    return problems


def main() -> int:
    print("Checking docs...")
    problems = check_links() + check_env_example()
    if problems:
        print("\nFAILED:")
        for p in problems:
            print(f"  {p}")
        return 1
    print("\nAll docs checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
