# USD Viewer — 0.1.0-alpha.1

Standalone browser-only, read-only USD inspection prototype. Open or drag a local file; nothing is uploaded. No project database or backend.

- Left: searchable, collapsible render-object explorer with visibility and selection.
- Centre: orbit/pan/zoom, frame, picking, wireframe (CAD edges in BRep mode).
- Right: object identity, viewer hierarchy path, bounds and render statistics; exact CAD face/edge counts and volume for recovered BRep bodies.
- Ctrl/Cmd+K: command palette, including switching preview modes. F frames the scene.
- Demo: generates native mesh-free USDA, then imports it through the same SMLib reader and tessellates it.

## Architecture

Ordinary USD/USDA/USDC/USDZ: Three.js USDLoader (r185). Native ASCII USDA containing BrepArray: SMLib WASM worker reconstructs the BRep with strict checking and tessellates the exact surfaces; arrays transfer to the Three.js viewport. SMLib outputs Z-up kernel geometry. Worker is terminated on file replacement and when done. Viewer path is a rendered-object path, not guaranteed to be the original USD prim path.

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

Tests cover format detection and exact mesh-free BRep round trips. Testlab deployment builds this folder to build/ before gallery assembly. Browser smoke testing is still required.
