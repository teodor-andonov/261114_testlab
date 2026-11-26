# Testlab

A gallery of independent, small web prototypes on GitHub Pages. The **Testlab landing page is the only PWA** currently shipped. Prototypes are ordinary web apps by default; they do not need manifests, service workers, install prompts, or a common framework.

## Layout

```text
index.html / site.css / site.js   # Installable gallery + theme toggle
manifest.webmanifest / sw.js       # Gallery-only offline shell
prototype-shell.js / .css           # Shared theme toggle + floating Home control
icons/                             # Gallery home-screen icon
.github/scripts/build_site.py     # Automatic prototype discovery
.github/workflows/deploy.yml      # GitHub Pages publication
YYMMDD_app-name/                  # Each independent web experiment
  index.html
  ...                              # Whatever this app needs
  prototype.json                   # Optional gallery metadata
  package.json                     # Version (or use prototype.json)
  testlab-theme.css                # Per-app light/dark palette
```

To add a prototype, create a folder matching `YYMMDD_app-name` with an `index.html`, and use relative file URLs. Optionally provide `prototype.json`. Set a SemVer version in `package.json` or `prototype.json`, and create `testlab-theme.css` for the app-specific light/dark colours. The site build inserts the two shared circular controls (theme and Home) into every published HTML page; keep duplicate navigation and version badges out of prototype source. The gallery cards display version, first Git commit time, and last Git update time for each folder. GitHub Actions uses full checkout history to calculate the timestamps. Pushing to `main` builds the catalog and deploys all folders.

## Install the gallery

Open https://teodor-andonov.github.io/261114_testlab/ in Chrome on Android and choose **Install**. Use the gallery to launch the contained prototypes. The gallery and every published prototype share the light/dark preference, following the device by default. The choice is stored as `testlab-theme`. The controls are injected at build time, so a prototype's independent `npm run dev` preview omits them; preview the assembled Testlab site to see the final shared UI.

## Scope and isolation

GitHub Pages serves this project at `https://teodor-andonov.github.io/261114_testlab/`, a **path on a shared GitHub Pages origin**, not a separate domain.

- Installed app identity: `/261114_testlab/` (manifest `id`).
- Manifest `start_url` and `scope`: `./` relative to the manifest in `/261114_testlab/`.
- Service worker registration: `./sw.js` with scope `./`; resolved scope is `/261114_testlab/`.
- Service worker fetch handler intercepts **only gallery shell files**, not any `YYMMDD_app-name/` assets.
- Cache prefix: `testlab-gallery-`; local theme preference key: `testlab-theme`.
- Other repositories (sibling URL paths) and their service-worker registrations are not modified.

The GitHub Pages **origin is shared** across project repositories. Browser storage APIs can be origin-wide; use namespaced keys and database names in each prototype. Linkbook still uses IndexedDB, but no longer installs as a separate PWA. Its old exact-scope worker is unregistered when Linkbook opens. An already installed Linkbook shortcut may need removal from the device.

## Local preview

```bash
python3 .github/scripts/build_site.py
python3 -m http.server 4173 --directory dist
```

Open http://localhost:4173/ . The hosted path resolves differently locally; use the published site to test the installed PWA. No backend is needed.

### Gallery preferences
Pin any card to keep it at the top of the gallery. Pins are saved in the current browser only; both pinned and unpinned groups are sorted newest-first by original prototype creation date.
