#!/usr/bin/env python3
"""Check the actual public Pages response, not just the deployment result."""
import json
import os
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

expected = json.loads(Path("dist/release.json").read_text())
base = os.environ["PAGES_URL"].rstrip("/") + "/"
if not base.startswith("https://"):
    raise SystemExit("Missing HTTPS Pages URL")

class Identity(HTMLParser):
    def __init__(self):
        super().__init__()
        self.found = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "testlab-release-id" in (a.get("class") or "").split():
            self.found.append((a.get("data-version"), a.get("data-commit")))

def get(path):
    url = base + path + "?v=" + expected["commit"] + "&check=" + str(time.time_ns())
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "Testlab-release-verifier"})
    with urllib.request.urlopen(req, timeout=15) as response:
        return response.read().decode("utf-8")

for i in range(24):
    try:
        actual = json.loads(get("release.json"))
        if actual != expected:
            raise ValueError("Public manifest has a different release SHA or versions")
        for folder, version in expected["projects"].items():
            parser = Identity()
            parser.feed(get(folder + "/"))
            if parser.found != [(version or "unversioned", expected["commit"])]:
                raise ValueError(folder + " has a missing or stale release label: " + repr(parser.found))
        print("Verified public deployment:", expected["commit"], "|", len(expected["projects"]), "prototypes", flush=True)
        break
    except (OSError, ValueError) as error:
        print(f"Public release not verified ({i+1}/24): {error}", flush=True)
        time.sleep(5)
else:
    raise SystemExit("Live Pages release did not match the deployed commit.")
