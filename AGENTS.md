# Testlab agent guidance

## Purpose
Independent experiments published as static applications through GitHub Pages. Each prototype belongs in its own `YYMMDD_slug/` folder and is discovered from `prototype.json`.

## Runtime boundaries
- Browser-only client applications. Do not introduce application-owned servers, remote storage, authentication services or backend compute. An explicitly requested public third-party metadata API is allowed as an optional URL-enrichment feature; do not send the private bookmark database or notes.
- Build tools such as Vite, npm and GitHub Actions are allowed at development/deployment time; there must be no server process required at runtime.
- A prototype may use JavaScript, WebAssembly, browser Web Workers, Three.js and other browser-compatible libraries.
- Treat prototypes as independent. Do not impose shared frameworks or storage schemes on them.
- The gallery is an installable PWA; individual prototypes may opt in to their own offline support when required. Keep service workers scoped to their own folders and respect the shared GitHub Pages origin.

## Data and files
- Prefer user-controlled files: open/import using file pickers and save/export to the user's file system.
- Do not add persistent browser databases or model-data storage without a requirement. In-memory state is fine; Cache Storage for offline app assets is fine.
- Keep exported formats honest. Do not mislabel tessellated geometry as exact CAD B-rep or NURBS geometry.

## Changes and commits
- Before work, check for uncommitted work and commit it first when present. GitHub-API-only changes start from a committed branch, so there is no local worktree to reconcile.
- Commit the completed changes after work. One commit is normally enough; use multiple logical commits for larger work or when connector operations require it.
- Keep existing experiments and gallery functionality intact.
- Work on a development branch and squash-merge completed updates into `main` automatically, without asking the user for separate merge or publish approval. Delete merged development branches when the available tools permit it.
- Run fast automated checks (syntax, unit tests and production build) when available. Fix known failures before merging; do not wait for pending browser smoke tests or require manual browser verification as a release gate. Keep existing automated browser coverage and report its status.
- Publishing is part of completing an update: merging into `main` triggers GitHub Pages. Check the deployment for the exact merge SHA, diagnose and retry failures, and confirm the public `release.json` and prototype HTML match that SHA and expected app version before reporting publication as successful. Do not treat a merge or artifact upload as publication. If verification cannot finish in the current session, explicitly report the blocker and workflow link; never claim a pending deployment is live.
- The user performs manual browser and visual acceptance testing against the published prototype. Use their feedback for the next update; do not leave completed work in an open PR merely awaiting manual testing.

## Prototype versions and release reporting
- Give each independently deployed prototype its own explicit SemVer prerelease, e.g. `0.2.0-alpha.1`. This is **an app version**, not the gallery's version. Bump it for user-facing releases. Store the version in the prototype's `package.json` (or `prototype.json` when not using npm).
- **Every published prototype must display its app version and short deployed repository commit SHA in the bottom-right corner**, e.g. `v0.2.0-alpha.1 · 35edd43`. Generate the label in the shared site assembly from the prototype's version and actual checked-out Git HEAD; never hardcode a SHA or fetch a newer label into an older cached page. The gallery card continues to display version, Created and Updated from Git history. Shared infrastructure-only changes may retain app versions; the deployed SHA changes.
- Each prototype receives the gallery-wide theme switch and floating circular Home button at publication via `prototype-shell.js`/`.css`. Do not add duplicate Back/Home buttons or theme switches to the prototypes. Provide a local `testlab-theme.css` file with light/dark palette overrides so your prototype visibly supports both themes. The shared selection uses `testlab-theme` in localStorage and a `testlab:themechange` event.
- Avoid changing prototype storage or compute behaviour just to support the shared UI.
- **Default to one searchable command palette for operational actions**, rather than adding standalone toolbar buttons on each request. Only add visible action buttons when the user explicitly asks or a core form/accessibility function needs one. Prefer native inputs and compact layouts.
- At the end of every update, report the affected app version(s), short deployed repository commit SHA (matching the bottom-right label), and direct published URLs with a `?v=<SHA>` cache-busting query. Include the deployment workflow link and explicit verification result. If not live, distinguish intended release SHA from the currently verified published SHA.
- Prefer one release commit for related changes, or logical increments if connector operations require multiple commits. Treat the gallery's version and Git-history fields as publication metadata, not proof of a live deployment.

## Gallery ordering and migration
- Use the prototype's original start date in `YYMMDD_slug/`, not the migration date. For migrated repositories record `createdAt` (ISO-8601) in `prototype.json`; use the source repository creation timestamp when earlier history is unavailable.
- Keep newest-first ordering by creation date. Locally pinned apps appear first, also newest-first; pins are gallery preferences stored in `testlab-pinned-prototypes` in localStorage.
- For migrated PWAs assign unique manifest IDs and cache prefixes scoped to Testlab. Do not archive source repositories until the migrated app has been published and verified in a browser, including file handling and offline behavior where applicable.
