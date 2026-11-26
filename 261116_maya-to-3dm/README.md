# Maya → Rhino · Geometry Converter

Browser-only Autodesk Maya ASCII (.ma) → Rhino 3DM converter.
Version **0.5.0-alpha.1**.

## Layers and colours

- **Only Maya displayLayer nodes become Rhino layers.** Maya DAG transform
  groups and individual mesh objects no longer create layers.
- Assignment follows connections from a display layer's `drawInfo` to a mesh
  or ancestor transform's `drawOverride` (and compatible objectSet membership).
- Objects without a recognised display-layer assignment go to one **Default**
  layer. Empty explicitly named Maya display layers may also be included.
- If a Maya display layer carries an explicit RGB override (`ovrgb`,
  `overrideColorRGB`), it becomes the Rhino layer colour.
- When no RGB is available, a stable pseudo-random colour derived from the
  layer name is assigned. No colours change between repeated imports.
- Shader RGB is collected through a mesh's `instObjGroups` → shadingEngine
  `dagSetMembers` and the shader's `outColor` → shadingEngine
  `surfaceShader` connections. Basic Maya lambert, phong, blinn, surfaceShader,
  standardSurface and Arnold aiStandardSurface colours are supported.
- Rhino objects receive **material assignments and display RGB** when a
  supported explicit shader colour is available, independently of layer colour.
  Materials with the same name and colour are deduplicated.
- Unsupported texture networks, face-level materials, procedurally computed
  colours, and external renderer features cannot be evaluated from static
  Maya ASCII alone. Shader RGB can differ from colour-managed Maya viewport output.

## Layer source selector

- **Materials (default)**: one Rhino layer per assigned Maya shader/material (for example Brick, Glazing, Steel). Unresolved materials share one **Unassigned** layer rather than object-by-object layers. Material RGB sets layer colour when available, otherwise the stable seeded palette is used.
- **Maya display layers**: the earlier behaviour. Only Maya displayLayer definitions become Rhino layers, with unassigned objects on Default.
- Switching the selector updates the preview and layer visibility panel. Export always uses the selected layer mode. Original baked geometry and Rhino object materials are unchanged.

## Maya groups → Rhino groups

- **Preserve Maya groups** defaults on, independently of the layer source.
- Maya ancestor transforms above an individual mesh transform become native Rhino groups. Geometry is placed in every ancestor group, preserving practical selection relationships.
- Rhino groups are **flat, not nested**. Full-path names such as Building::East and Building::West avoid collisions; shared memberships represent the ancestry.
- Only groups containing exported meshes are included. Visible-only exports remove excluded meshes from group memberships too.

## Workflow

1. Open or drop a Maya ASCII file into the local-only browser UI.
2. Inspect the subdivided meshes with the shaded preview, optional grid and edges.
3. The layer panel shows Maya display layers (not transform groups). Toggle
   visibility, use All/None or search by name.
4. Choose Smooth As Maya (default) or override subdivision 0–3.
5. Export Rhino 3DM. Export is performed in a cancellable Web Worker with
   per-object progress and 3DM read-back verification.

Hiding a layer only changes the preview unless **Only export visible** is checked.

## Limitations

- Only static polygon geometry stored in .ma is read. Maya construction history,
  deformers, smooth-preview networks, external references and texture computations
  are not evaluated. For exact visual output bake meshes in Maya.
- The output comprises baked polygon meshes, real Rhino display layers and
  basic RGB materials. No native Rhino SubD objects.
- Not every Maya .ma serialisation connects display layers in an identical way.
  Unrecognised memberships are safely assigned to Default instead of
  inventing an object-per-layer hierarchy.
- Binary .mb import is experimental: FOR4/FOR8 indexed static MESH records, common transforms, basic shader connections and linear units are decoded locally. History-only meshes and unsupported record layouts are reported; no Maya runtime, scripts, server, or uploads. Choose the up axis manually if necessary. The supported primary UV layout is decoded; binary face/component material lists are not yet decoded.

## Development

Run npm install, npm test, npm run dev, or npm run build.

## Experimental binary and material import (0.6)

Both file formats are parsed in a dedicated Web Worker. The decoder emits data-only ASCII commands to reuse the existing tested geometry pipeline. Format research: [MayaSceneKit](https://github.com/yamahigashi/MayaSceneKit) (MIT). This is not a full Maya scene evaluator. Unresolved or omitted mesh records are reported. Static shader transparency/opacity, roughness and metallic values are mapped where present; direct bitmap filenames are stored as external references only (no images fetched or embedded). Common primary UV coordinates are exported as Rhino mesh UVs; subdivision uses approximate face-varying interpolation, not Maya’s exact UV subdivision rules. Common ASCII face-component material assignments split the baked mesh by material after subdivision. Unsupported or incomplete assignments are reported. Named shaders without saved RGB become actual Rhino materials with default colour.
