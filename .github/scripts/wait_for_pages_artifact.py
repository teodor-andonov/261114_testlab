#!/usr/bin/env python3
"""GitHub's artifact upload API can finish before the REST list is consistent."""
import json
import os
import time
import urllib.request

url = f"{os.environ['GITHUB_API_URL']}/repos/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}/artifacts?name=github-pages"
headers = {"Authorization": "Bearer " + os.environ["GH_TOKEN"],
           "Accept": "application/vnd.github+json",
           "X-GitHub-Api-Version": "2022-11-28",
           "Cache-Control": "no-cache"}
for i in range(24):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=15) as response:
            items = json.load(response).get("artifacts", [])
        matches = [a for a in items if a["name"] == "github-pages" and not a["expired"] and a["size_in_bytes"] > 0]
        if len(matches) == 1:
            print("Pages artifact visible:", matches[0]["id"], flush=True)
            break
        if len(matches) > 1:
            raise SystemExit("Multiple Pages artifacts found; refusing ambiguous deployment.")
        print(f"Artifact not visible yet ({i+1}/24)", flush=True)
    except (OSError, ValueError) as error:
        print(f"Artifact lookup retry: {error}", flush=True)
    time.sleep(5)
else:
    raise SystemExit("Pages artifact did not become visible in REST API.")
