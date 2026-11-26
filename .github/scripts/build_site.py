#!/usr/bin/env python3
"""Assemble the Testlab gallery and inject the shared prototype shell."""
import json
from html import escape
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "dist"
PATTERN = re.compile(r"^(\d{6})_([a-z0-9][a-z0-9-]*)$")


def git_dates(folder):
    """Earliest/latest committed change to this prototype, in ISO-8601."""
    result = subprocess.run(
        ["git", "log", "--format=%cI", "--", folder],
        cwd=ROOT, capture_output=True, text=True, check=False
    )
    times = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return (times[-1], times[0]) if times else (None, None)


def version_of(folder, metadata):
    package_file = folder / "package.json"
    if package_file.is_file():
        try:
            value = json.loads(package_file.read_text(encoding="utf-8")).get("version")
            if isinstance(value, str) and value.strip():
                return value.strip()
        except (OSError, ValueError):
            pass
    value = metadata.get("version")
    return value.strip() if isinstance(value, str) and value.strip() else None


def inject_shell(index_file, folder_name, has_theme, version, commit):
    """Inject shared controls and the identity of the actual built release."""
    markup = index_file.read_text(encoding="utf-8")
    if "</head>" not in markup or "</body>" not in markup:
        raise ValueError(f"Prototype {folder_name} must have closing head and body tags")
    boot = """<script>
(() => {
  let preference = null;
  try { preference = localStorage.getItem('testlab-theme'); } catch {}
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme =
    preference === 'light' || preference === 'dark'
      ? preference : (systemDark ? 'dark' : 'light');
})();
</script>"""
    def relative(path):
        return os.path.relpath(path, index_file.parent).replace(os.sep, "/")
    css = f'<link rel="stylesheet" href="{relative(OUTPUT / "prototype-shell.css")}">'
    if has_theme:
        css += f'<link rel="stylesheet" href="{relative(OUTPUT / folder_name / "testlab-theme.css")}">'
    markup = markup.replace("</head>", boot + "\n" + css + "\n</head>", 1)
    version_label = escape(version or "unversioned", quote=True)
    sha = escape(commit, quote=True)
    badge = (f'<span class="testlab-release-id" data-version="{version_label}" data-commit="{sha}" '
             f'title="App version {version_label}; deployed repository commit {sha}">'
             f'v{version_label} · {sha[:7]}</span>')
    markup = markup.replace("</body>", badge + f'\n<script defer src="{relative(OUTPUT / "prototype-shell.js")}"></script>\n</body>', 1)
    index_file.write_text(markup, encoding="utf-8")


def main():
    subprocess.run([sys.executable, str(ROOT / '.github/scripts/check_migrated_apps.py')], cwd=ROOT, check=True)
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    for name in ("index.html", "site.css", "site.js", "manifest.webmanifest", "sw.js",
                 "prototype-shell.css", "prototype-shell.js"):
        shutil.copy2(ROOT / name, OUTPUT / name)
    shutil.copytree(ROOT / "icons", OUTPUT / "icons")
    (OUTPUT / ".nojekyll").touch()
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    projects = []
    for folder in sorted(ROOT.iterdir(), reverse=True):
        match = PATTERN.fullmatch(folder.name)
        if not folder.is_dir() or not match or not (folder / "index.html").is_file():
            continue
        info_file = folder / "prototype.json"
        info = json.loads(info_file.read_text(encoding="utf-8")) if info_file.is_file() else {}
        title = str(info.get("title") or match.group(2).replace("-", " ").title())[:100]
        created, updated = git_dates(folder.name)
        # Migrated apps retain their original repository creation date.
        created = info.get('createdAt') or created
        version = version_of(folder, info)
        projects.append({
            "folder": folder.name,
            "date": match.group(1),
            "title": title,
            "description": str(info.get("description") or "Standalone prototype")[:360],
            "category": str(info.get("category") or "Web app")[:40],
            "status": str(info.get("status") or "Prototype")[:40],
            "monogram": str(info.get("monogram") or title[:2]).upper()[:4],
            "tags": [str(tag)[:45] for tag in info.get("tags", []) if isinstance(tag, str)][:8],
            "createdAt": created,
            "updatedAt": updated,
            "version": version,
            "commit": commit,
        })
        # Built prototypes publish compiled assets; plain prototypes publish source.
        source = folder / "build" if (folder / "build" / "index.html").is_file() else folder
        target = OUTPUT / folder.name
        shutil.copytree(source, target, ignore=shutil.ignore_patterns(
            "node_modules", ".git", ".DS_Store", "tests", "__pycache__"))
        app_theme = folder / "testlab-theme.css"
        if app_theme.is_file():
            shutil.copy2(app_theme, target / "testlab-theme.css")
        for page in target.rglob("*.html"):
            if "assets" not in page.relative_to(target).parts:
                inject_shell(page, folder.name, app_theme.is_file(), version, commit)

    projects.sort(key=lambda p: (p["date"], p["createdAt"] or "", p["folder"]), reverse=True)
    (OUTPUT / "catalog.json").write_text(
        json.dumps({"commit": commit, "projects": projects}, indent=2) + "\n", encoding="utf-8"
    )
    (OUTPUT / "release.json").write_text(
        json.dumps({"commit": commit, "projects": {p["folder"]: p["version"] for p in projects}}, indent=2) + "\n", encoding="utf-8")
    print("Built Testlab:", len(projects), "prototype(s)")
    for project in projects:
        print(" -", project["folder"], project["version"],
              project["createdAt"], project["updatedAt"])


if __name__ == "__main__":
    main()
