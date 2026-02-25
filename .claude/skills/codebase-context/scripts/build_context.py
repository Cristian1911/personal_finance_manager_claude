#!/usr/bin/env python3
"""Generate living project context artifacts for humans and agents."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple, TypedDict


IGNORE_DIRS = {
    ".git",
    ".next",
    ".turbo",
    ".cache",
    ".expo",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "pfm_pdf_parser.egg-info",
}

TEXT_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".sql",
    ".sh",
    ".css",
    ".scss",
    ".html",
}

SOURCE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".sql"}

LANGUAGE_BY_EXTENSION = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript/React",
    ".js": "JavaScript",
    ".jsx": "JavaScript/React",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".py": "Python",
    ".sql": "SQL",
    ".md": "Markdown",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".sh": "Shell",
    ".css": "CSS",
    ".scss": "SCSS",
    ".html": "HTML",
}

IMPORT_RE = re.compile(
    r"""(?:import\s+(?:.+?\s+from\s+)?|require\()\s*['"]([^'"]+)['"]"""
)


@dataclass
class Pattern:
    name: str
    description: str
    path_regex: re.Pattern[str] | None = None
    content_regex: re.Pattern[str] | None = None


class PatternSummary(TypedDict):
    name: str
    description: str
    matched_files: int
    examples: List[str]


DependencyEdge = TypedDict(
    "DependencyEdge",
    {"from": str, "to": str, "count": int},
)


class Totals(TypedDict):
    text_files_scanned: int
    languages: Dict[str, int]


class Commands(TypedDict):
    root_scripts: Dict[str, str]
    webapp_scripts: Dict[str, str]
    mobile_scripts: Dict[str, str]


class ProjectContext(TypedDict):
    generated_at_utc: str
    project_root: str
    technologies: List[str]
    totals: Totals
    top_level_directories: Dict[str, int]
    commands: Commands
    patterns: List[PatternSummary]
    entrypoints: List[str]
    dependency_edges: List[DependencyEdge]
    recent_changes: List[str]


PATTERNS = [
    Pattern(
        name="next-app-router",
        description="Next.js App Router pages/layouts",
        path_regex=re.compile(r"^webapp/src/app/.+\.(ts|tsx)$"),
    ),
    Pattern(
        name="server-actions",
        description="Server Action handlers under webapp/src/actions",
        path_regex=re.compile(r"^webapp/src/actions/.+\.ts$"),
    ),
    Pattern(
        name="zod-validators",
        description="Validation layer using Zod",
        path_regex=re.compile(r"/validators?/"),
        content_regex=re.compile(r"\bzod\b|\bz\.", re.IGNORECASE),
    ),
    Pattern(
        name="supabase-integration",
        description="Supabase clients/services in app code",
        path_regex=re.compile(r"supabase", re.IGNORECASE),
        content_regex=re.compile(r"\bsupabase\b", re.IGNORECASE),
    ),
    Pattern(
        name="repository-pattern",
        description="Repository pattern in mobile/lib/repositories",
        path_regex=re.compile(r"/repositories/"),
    ),
    Pattern(
        name="expo-router",
        description="Expo Router file-based routes",
        path_regex=re.compile(r"^mobile/app/.+\.(ts|tsx)$"),
    ),
    Pattern(
        name="fastapi-service",
        description="FastAPI service modules",
        path_regex=re.compile(r"^services/.+\.py$"),
        content_regex=re.compile(r"\bFastAPI\s*\("),
    ),
]


def iter_files(root: Path) -> Iterable[Path]:
    for current, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        current_path = Path(current)
        for name in files:
            path = current_path / name
            if path.suffix.lower() in TEXT_EXTENSIONS:
                yield path


def safe_read(path: Path, max_bytes: int = 300_000) -> str:
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as f:
            return f.read(max_bytes)
    except OSError:
        return ""


def detect_technologies(root: Path) -> List[str]:
    tech = []
    if (root / "webapp/next.config.ts").exists():
        tech.append("Next.js")
    if (root / "mobile/app.json").exists():
        tech.append("Expo/React Native")
    if (root / "services/pdf_parser/main.py").exists():
        tech.append("FastAPI")
    if (root / "supabase").exists():
        tech.append("Supabase")
    if (root / "pnpm-workspace.yaml").exists():
        tech.append("pnpm workspace")
    return tech


def read_package_scripts(package_json: Path) -> Dict[str, str]:
    if not package_json.exists():
        return {}
    try:
        data = json.loads(package_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    scripts = data.get("scripts")
    if isinstance(scripts, dict):
        return {str(k): str(v) for k, v in scripts.items()}
    return {}


def rel_top_level(path: Path, root: Path) -> str:
    rel = path.relative_to(root)
    return rel.parts[0] if len(rel.parts) > 1 else "(root)"


def detect_patterns(rel_path: str, content: str) -> List[str]:
    hits = []
    normalized = rel_path.replace("\\", "/")
    for pattern in PATTERNS:
        path_hit = bool(pattern.path_regex and pattern.path_regex.search(normalized))
        content_hit = bool(pattern.content_regex and pattern.content_regex.search(content))
        if path_hit or content_hit:
            hits.append(pattern.name)
    return hits


def resolve_relative_import(source_rel: Path, import_path: str) -> str | None:
    if not import_path.startswith("."):
        return None
    combined = Path(os.path.normpath((source_rel.parent / import_path).as_posix()))
    parts = combined.parts
    if not parts:
        return None
    return parts[0] if parts[0] != "." else None


def git_changed_files(root: Path) -> List[str]:
    try:
        out = subprocess.run(
            ["git", "status", "--short"],
            cwd=root,
            capture_output=True,
            check=False,
            text=True,
        )
    except OSError:
        return []
    if out.returncode != 0:
        return []
    changed = []
    for line in out.stdout.splitlines():
        if not line.strip():
            continue
        path = line[3:].strip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        changed.append(path)
    return changed[:100]


def build_context(project_root: Path) -> ProjectContext:
    files = list(iter_files(project_root))
    language_counter: Counter[str] = Counter()
    top_level_counter: Counter[str] = Counter()
    pattern_files: defaultdict[str, List[str]] = defaultdict(list)
    entrypoints: List[str] = []
    dependency_edges: Counter[Tuple[str, str]] = Counter()

    for file_path in files:
        rel = file_path.relative_to(project_root)
        rel_str = rel.as_posix()
        ext = file_path.suffix.lower()
        language = LANGUAGE_BY_EXTENSION.get(ext, f"Other({ext})")
        language_counter[language] += 1
        top_level_counter[rel_top_level(file_path, project_root)] += 1

        if re.search(r"(page|layout|route|main)\.(ts|tsx|py)$", rel_str):
            entrypoints.append(rel_str)

        content = safe_read(file_path)
        if ext in SOURCE_EXTENSIONS:
            for pat in detect_patterns(rel_str, content):
                if len(pattern_files[pat]) < 15:
                    pattern_files[pat].append(rel_str)

            source_group = rel.parts[0] if rel.parts else "."
            for imp in IMPORT_RE.findall(content):
                if imp.startswith("."):
                    target_group = resolve_relative_import(rel, imp)
                    if target_group and target_group != source_group:
                        dependency_edges[(source_group, target_group)] += 1
                elif imp.startswith("@/"):
                    dependency_edges[(source_group, source_group)] += 1
                elif imp.startswith("~"):
                    dependency_edges[(source_group, source_group)] += 1

    root_scripts = read_package_scripts(project_root / "package.json")
    web_scripts = read_package_scripts(project_root / "webapp/package.json")
    mobile_scripts = read_package_scripts(project_root / "mobile/package.json")

    patterns_summary: List[PatternSummary] = []
    lookup = {p.name: p.description for p in PATTERNS}
    for name, examples in sorted(pattern_files.items(), key=lambda x: len(x[1]), reverse=True):
        patterns_summary.append(
            {
                "name": name,
                "description": lookup.get(name, ""),
                "matched_files": len(examples),
                "examples": examples,
            }
        )

    dep_summary: List[DependencyEdge] = [
        {"from": src, "to": dst, "count": count}
        for (src, dst), count in dependency_edges.most_common(20)
    ]

    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "project_root": str(project_root),
        "technologies": detect_technologies(project_root),
        "totals": {
            "text_files_scanned": len(files),
            "languages": dict(language_counter.most_common()),
        },
        "top_level_directories": dict(top_level_counter.most_common()),
        "commands": {
            "root_scripts": root_scripts,
            "webapp_scripts": web_scripts,
            "mobile_scripts": mobile_scripts,
        },
        "patterns": patterns_summary,
        "entrypoints": sorted(entrypoints)[:120],
        "dependency_edges": dep_summary,
        "recent_changes": git_changed_files(project_root),
    }


def render_markdown(context: ProjectContext) -> str:
    totals = context["totals"]
    lang_items = totals["languages"]
    dir_items = context["top_level_directories"]

    lines = []
    lines.append("# PROJECT_CONTEXT")
    lines.append("")
    lines.append("Auto-generated project intelligence for fast onboarding and safe edits.")
    lines.append("")
    lines.append(f"- Generated (UTC): `{context['generated_at_utc']}`")
    lines.append(f"- Project root: `{context['project_root']}`")
    lines.append("")
    lines.append("## Stack Snapshot")
    for tech in context["technologies"]:
        lines.append(f"- {tech}")
    lines.append("")
    lines.append("## File/Lang Distribution")
    lines.append(f"- Text files scanned: {totals['text_files_scanned']}")
    for lang, count in list(lang_items.items())[:12]:
        lines.append(f"- {lang}: {count}")
    lines.append("")
    lines.append("## Top-level Areas")
    for area, count in list(dir_items.items())[:15]:
        lines.append(f"- {area}: {count} files")
    lines.append("")
    lines.append("## Key Commands")
    commands = context["commands"]
    for scope, scripts in commands.items():
        if not scripts:
            continue
        lines.append(f"### {scope}")
        for name, cmd in scripts.items():
            lines.append(f"- `{name}`: `{cmd}`")
    lines.append("")
    lines.append("## Patterns Detected")
    for pat in context["patterns"]:
        lines.append(
            f"- `{pat['name']}` ({pat['matched_files']} files): {pat['description']}"
        )
        for ex in pat["examples"][:3]:
            lines.append(f"  - e.g. `{ex}`")
    lines.append("")
    lines.append("## Entrypoints")
    for path in context["entrypoints"][:30]:
        lines.append(f"- `{path}`")
    lines.append("")
    lines.append("## Dependency Signals (Folder-level)")
    for edge in context["dependency_edges"][:20]:
        lines.append(f"- `{edge['from']}` -> `{edge['to']}` ({edge['count']})")
    lines.append("")
    lines.append("## Recent Changes (git status)")
    changed = context["recent_changes"]
    if changed:
        for path in changed[:30]:
            lines.append(f"- `{path}`")
    else:
        lines.append("- Working tree clean")
    lines.append("")
    lines.append("## Agent Playbook")
    lines.append("- Read this file first, then open only relevant folders/files.")
    lines.append("- Prefer paths listed under Patterns and Entrypoints for feature work.")
    lines.append("- Regenerate this file after non-trivial code changes.")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build living project context docs for agents."
    )
    parser.add_argument(
        "--project-root",
        default=".",
        help="Repository root to scan (default: current directory).",
    )
    parser.add_argument(
        "--output-dir",
        default="docs/agent",
        help="Output directory for generated artifacts.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.project_root).resolve()
    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = (root / output_dir).resolve()

    output_dir.mkdir(parents=True, exist_ok=True)
    context = build_context(root)

    json_path = output_dir / "project_context.json"
    md_path = output_dir / "PROJECT_CONTEXT.md"
    json_path.write_text(
        json.dumps(context, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    md_path.write_text(render_markdown(context), encoding="utf-8")

    print(f"Wrote {md_path}")
    print(f"Wrote {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
