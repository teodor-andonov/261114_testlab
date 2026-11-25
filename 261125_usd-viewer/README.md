# USD Viewer — 0.2.0-alpha.1

Standalone browser-only, read-only USD inspection prototype. Open or drag multiple local files; nothing is uploaded. No project database or backend.

- Left: searchable, collapsible render-object explorer with visibility and selection.
- Centre: orbit/pan/zoom, frame, picking, wireframe (CAD edges in BRep mode).
- Right: object identity, viewer hierarchy path, bounds and render statistics; exact CAD face/edge counts and volume for recovered BRep bodies.
- Ctrl/Cmd+K: searchable command palette (arrow keys, Enter), Ctrl/Cmd+O: append local files, F: frame all, Shift+F: frame selection, W: wire/CAD edges, G: grid, Delete: close selected file, Esc: clear selection. 1/2/3: draft/normal/high tessellation. Per-file preview modes via palette.
- Demo: generates native mesh-free USDA, then imports it through the same SMLib reader and tessellates it.

## Architecture

Ordinary USD/USDA/USDC/USDZ: Three.js USDLoader (r185). Native ASCII USDA containing BrepArray: SMLib WASM worker reconstructs the BRep with strict checking and tessellates the exact surfaces; arrays transfer to the Three.js viewport. SMLib outputs Z-up kernel geometry. Worker is terminated when each file preview completes. Files remain independent explorer groups in one scene; normal and high quality retessellate only BRep previews, preserving camera and same-mode selection. Geometry is displayed in metres (SMLib millimetre geometry converted to metres); no automatic layout or file translation. A background-only grid and scene-aware camera clipping improve depth precision. Viewer path is a rendered-object path, not guaranteed to be the original USD prim path.

The two modes deliberately remain separate: a BRep stage defaults to BRep-only preview so authored mesh copies do not double-render; use the command palette to inspect authored mesh geometry separately. Independent mesh geometry in mixed stages is not shown in BRep mode. Exact BRep import is limited to self-contained ASCII USDA (including ASCII .usd); binary/package BRep-only files require conversion. Ordinary USD rendering is a subset, not full OpenUSD composition/Hydra. No external layer resolution, texture/material fidelity, animation, or full raw prim/property inspection. Grayscale render materials replace authored materials. Bounds in viewport coordinates; volume and tolerance in kernel units.

The referenced USD_WebViewer uses an OpenUSD/Hydra WASM worker and Three.js. This implementation is independent and intentionally uses smaller dependencies; no copied reference source.

## Development
```
npm install
npm test
npm run dev
npm run build
npm run preview
```

Tests cover format detection and exact mesh-free BRep round trips. Testlab deployment builds this folder to build/ before gallery assembly. Chromium smoke tests exercise multi-file import, BRep quality changes and shortcuts.
