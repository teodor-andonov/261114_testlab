# HTML Notes

Version 0.5.0-alpha.1. No backend, build step, account or document database. Open and save ordinary HTML files through Chromium File System Access; other browsers can select files/folders and download new copies. Folder handles, expanded paths and selected save folder are remembered in a namespaced IndexedDB store; no document contents or assets are stored there. Read-only fallback folders cannot be remembered. Ctrl+N creates a new note, Ctrl+S saves, Ctrl+Shift+S saves as, Ctrl+O opens, Ctrl+K opens the command palette. Type / in the visual editor for contextual insert and formatting commands; filter by typing, use Up/Down and Enter or Tab, Escape closes. Table insertion creates a 3-column, 2-row starter table without prompts; Tab moves between cells and adds a row at the end. Empty checklist items exit on Enter. Drag files into a note or paste image files. Ctrl+click a link or attachment to open/download it. Source mode edits only the semantic document body, not the binary payload. It includes syntax highlighting, line numbers, line/column indicator, two-space Tab indentation, inherited Enter indentation and a Format HTML command (Ctrl+Shift+F). Formatting is conservative: mixed inline text, raw script/style/pre text and unbalanced markup are left intact. The editor warns before applying unsupported custom source; imported HTML is still sanitized, and arbitrary scripts, styles and attributes outside explicit custom block templates are not retained or executed.

## Folder workflow

Add a folder using the folder icon. It opens immediately. Click a folder/subfolder to select it, or use its file-plus icon to name a new draft in that location. Ctrl+S creates the file directly there; existing notes save back to their original handle. Existing filenames require confirmation before replacement. Save As opens the system dialog, initially in the note folder where supported. The tree updates after a save while retaining expansion state and highlights the saved file. Remove a root using the × button; this forgets the folder without deleting anything on disk.

On reload, remembered folders with permission already granted open automatically. If permission is no longer granted, click the reconnect icon and approve read/write access; the stored handle cannot bypass browser consent. If a folder was deleted or moved, remove it and add the correct folder again. Chromium/Edge support direct read/write; other browsers fall back to file uploads and downloads.

## Custom blocks

Type /custom or /widget in the visual editor (or use the command palette), choose an example or enter your own HTML, CSS and inline JavaScript, set the height, and save. Existing custom blocks have Run/Stop, Edit and Remove controls. Static previews show automatically with scripts disabled. Clicking Run requires confirmation each time; Stop replaces the frame, resetting runtime state. The source editor exposes the canonical template, and standalone saved HTML renders the block with the same Run/Stop controls. Example blocks: SVG diagram, interactive counter, parametric facade with a slider, blank HTML.

Canonical form: `<template data-note-block="1" data-title="Example" data-height="240">...custom markup...</template>`. The template is inert, and only its payload is rendered in a sandboxed iframe with no same-origin privilege. Never inject a block into the editor DOM. The renderer strips nested frames, external scripts, meta/base/link elements and navigation attributes from the rendered copy; a frame-local CSP blocks ordinary network requests, external script/style sources, and forms. Activation permits inline scripts only, not access to the parent DOM or filesystem handles. This is not a hardened untrusted-code execution service: a script may navigate its own frame, consume CPU or memory, or exploit a browser vulnerability. Run trusted code only. CDN libraries, persistent widget state and note asset IDs inside blocks are not yet supported; use inline code and data URLs for block-local resources. Static preview and standalone rendering require the fixed viewer script; no custom block is automatically executed. 

## File layout

- Normal HTML head, offline document stylesheet, and semantic article with id html-notes-body.
- Body image and attachment elements reference an asset ID via data-asset.
- At the end: an inert application/json script block with an array of asset records (id, name, mime, base64 data). Each record is on its own line. Unreferenced assets are omitted on save.
- A short fixed viewer script resolves references to local Blob URLs when opened in a browser. Text remains readable with JavaScript disabled; embedded assets require that resolver. This script is not executed by the editor during import. External content is not requested by the editor; links require an explicit Ctrl+click. Non-raster assets are treated as downloads, never executed or rendered inline.
- Ordinary HTML can be imported as editable semantic content; original styles, scripts, arbitrary widgets and external or relative images are not preserved. Standard base64 raster images are converted to embedded asset records. This is a note editor, not a lossless web-page editor.

## Verification

JavaScript syntax, manifest JSON and local element cross-references checked; the viewer resolver was exercised with mocked image and arbitrary-file references and preserved bytes and download MIME. Interactive browser testing remains outstanding. Manual smoke test:

1. Open two different folders, expand subfolders, open a note.
2. Format headings, lists, tasks and tables; paste a raster image and attach a PDF or other file.
3. Toggle source: verify that only semantic HTML is shown, not base64.
4. Save as HTML, open the output directly in a browser and verify rendering and attachment downloads. Reopen it in the editor; confirm checked tasks, text and asset bytes survive.
5. Save back to the original, refresh folder tree, test unsaved-change prompts.
6. Install/open offline after a successful online visit; verify narrow/mobile layout and fallback pickers.
7. Open an HTML page containing a script and remote image, confirm neither executes nor requests remote content in the editor.
8. Insert a counter block, verify the count does not change until Run is approved, then test Stop, Edit, source-view round-trip, save/reopen, and standalone viewer. Verify the sandbox denies parent DOM access and ordinary external resource requests.

The initial editor uses browser contenteditable and execCommand for compact native editing; this deprecated API is a prototype choice and should be replaced if inconsistent editing behavior emerges. Very large embedded files use more RAM and approximately 33% more raw storage due to base64. Browser filesystem support and PWA installation vary by platform.
