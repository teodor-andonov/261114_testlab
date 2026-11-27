# Penbook A — structured native HTML

Version 0.1.0. Browser-only static prototype. No installation, backend, dependency, document database, own manifest or service worker. Serve this folder over HTTP (e.g. `python -m http.server`) and open `index.html`; use desktop Chromium for read/write file access. Open a demo from the selector, or open the actual HTML in `demos/` directly in a browser. Ctrl+K opens commands; Ctrl+S saves, Ctrl+Shift+S saves as, Ctrl+O opens, D enters drawing outside text editing. Use double click or Edit text for rich text; select containers in the outline; drag outline items onto containers to reparent; drag absolute blocks on canvas. Save As works with Chromium native picker; fallback downloads a copy.

## Authoritative format

The document is a native HTML tree rooted at `main[data-penbook][data-doc-id]`. Composable elements carry `data-block` and `data-id`; direct DOM children are the hierarchy, CSS is layout and styling, SVG is sketch/diagram geometry. The same live DOM in a script-disabled sandboxed iframe is the editing representation and serialization source. There is no composition JSON. Undo stores HTML snapshots. Editor-only selection, contenteditable and page visibility markers are stripped from serialization. Layout conversion stores prior free positions as small per-element metadata; ordering is row-major using 20px bands and IDs as tie-breakers. Flow to free without prior positions uses a simple grid. Layout conversion may clear authored child sizing and rotation in flow; undo restores the exact previous markup. Native stylesheet can be edited directly. Linked component content can be explicitly propagated from selected instance; CSS named classes are shared naturally. No implicit source-of-truth JSON.

A strict supported contract rejects missing/duplicate IDs, unexpected active elements/attributes and changes to the built-in runtime/security policy. Unknown safe blocks remain opaque. HTML parser repairs some malformed markup; this is not a full HTML validator. Arbitrary selectors, deeply nested non-block wrappers, complex positioning, CSS transforms and custom grid arrangements are not necessarily safely editable by inspector operations. Avoid authoring with reserved `data-pb-*` attributes. Source edits apply to the full document; large data URLs are currently visible in source. Embedding preserves the original file bytes in a data URL; deduplication is not implemented.

## Security

Author markup is loaded into an iframe with allow-same-origin but **without allow-scripts**. Widgets are native inert templates with static preview available in the separate widget dialog; Run explicitly enables scripts in a different iframe without same-origin privilege. Standalone documents contain the same opt-in runtime. CSP blocks ordinary network, forms, external scripts and nested frames in widget payloads; links/navigation and resource exhaustion are not comprehensively prevented. Only run trusted code. No physical-device or penetration testing performed. Imported arbitrary HTML without the supported root/runtime is rejected rather than rewritten.

## Demos

01 journal: three fixed pages, sketches, tags and image. 02 board: freeform arrangement, nested grid, diagram. 03 gallery: six embedded synthetic SVG images and native record cards. 04 mind map: semantic attached SVG edges, nested composition. 05 note: rich text, list, checkbox, link, table, sketch. 06 report: three pages, shared header content, named styles, nested grids. 07 slides: three 16:9 pages, linked headers, image/diagram. 08 website: responsive grid, repeated cards. 09 interactive: native slider/facade and counter templates. 10 sheet: fixed sheet and embedded external-view snapshot; refresh with architectural-view.svg fixture.

## Verification and limitations

See VERIFICATION.md. This is a first independent implementation, not a completed comparative experiment. No B implementation was inspected or modified. Version/commit labels and navigation dot are supplied by Testlab on publication. Branch remains unmerged for sequential integration.
