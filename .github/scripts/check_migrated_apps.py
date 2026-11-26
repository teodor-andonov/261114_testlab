#!/usr/bin/env python3
"""Run original migration regression tests and check all local PWA shell assets."""
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[2]
FOLDERS = ("261013_file-explorer", "261012_cad-graph", "261019_mindmap", "261012_svg-viewer")

def run(args, cwd=ROOT, **kwargs):
    subprocess.run(args, cwd=cwd, check=True, **kwargs)

def check_asset(folder, url):
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return
    assert not parsed.path.startswith("/"), f"{folder.name}: absolute asset {url}"
    target = (folder / unquote(parsed.path)).resolve()
    assert target.is_relative_to(folder), f"{folder.name}: asset escapes folder {url}"
    assert target.exists(), f"{folder.name}: missing asset {url}"

class Scripts(HTMLParser):
    def __init__(self, folder):
        super().__init__()
        self.folder = folder
        self.inline = None
        self.module = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            if attrs.get("src"):
                check_asset(self.folder, attrs["src"])
            elif attrs.get("type", "") in ("", "module", "text/javascript"):
                self.inline = []
                self.module = attrs.get("type") == "module"
        if tag == "link" and attrs.get("rel") in ("stylesheet", "manifest", "icon", "apple-touch-icon"):
            check_asset(self.folder, attrs["href"])
        if tag == "img" and attrs.get("src"):
            check_asset(self.folder, attrs["src"])
    def handle_data(self, data):
        if self.inline is not None:
            self.inline.append(data)
    def handle_endtag(self, tag):
        if tag == "script" and self.inline is not None:
            run(["node", "--input-type=" + ("module" if self.module else "commonjs"), "--check"],
                input="".join(self.inline), text=True)
            self.inline = None

run(["node", "--check", "site.js"])
for name in FOLDERS:
    folder = ROOT / name
    metadata = json.loads((folder / "prototype.json").read_text())
    assert metadata["createdAt"][:10].replace("-", "")[2:] == name[:6]
    manifest = json.loads((folder / "manifest.webmanifest").read_text())
    assert manifest["id"] == f"/261114_testlab/{name}/"
    assert manifest["scope"] == manifest["start_url"] == "./"
    for icon in manifest["icons"]:
        check_asset(folder, icon["src"])
    worker = (folder / "sw.js").read_text()
    assert "testlab-" in worker
    match = re.search(r"const (?:STATIC|SHELL|ASSETS)\s*=\s*\[(.*?)\]", worker, re.S)
    assert match, name
    for asset in re.findall(r"['\"]([^'\"]+)['\"]", match.group(1)):
        check_asset(folder, asset)
    Scripts(folder).feed((folder / "index.html").read_text())
    for js in folder.glob("*.js"):
        run(["node", "--input-type=module", "--check"], input=js.read_text(), text=True)
    tests = sorted(str(p.relative_to(folder)) for p in (folder / "tests").glob("*.test.mjs"))
    if tests:
        run(["node", "--test", *tests], cwd=folder)
    if name == "261012_cad-graph":
        run(["python3", "test_analyzer.py"], cwd=folder)
    print("Migration checks passed:", name, flush=True)
