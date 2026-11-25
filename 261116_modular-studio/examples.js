// Bundled, read-only example sources; loading one copies its JavaScript into
// the editor. Nothing is persisted until the user explicitly saves a file.
const STUDIO_DEMOS = [
  {
    id: "box",
    title: "Parametric box",
    description: "Three dimensions. A small example of source-backed sliders and exact STEP / 3DM export.",
    filename: "box.js",
    source: `// 01 — PARAMETRIC BOX
// Edit the numbers here or use the parameter controls.
const defaultParams = {
  width: 60,
  depth: 40,
  height: 30,
};

const main = (replicad, params) => {
  const { width, depth, height } = params;
  return replicad.makeBaseBox(width, depth, height);
};
`,
  },
  {
    id: "booleans",
    title: "Boolean union + fillets",
    description: "Cut, fillet and union two bodies, then round the new joint edges. Toggle Union parts to inspect the originals.",
    filename: "boolean-fillets.js",
    source: `// 02 — BOOLEAN CUT + FILLET + UNION + JOINT FILLET
// Two intersecting solids can be fused into one connected solid.
// A second fillet rounds only the edges created where they join.
const defaultParams = {
  width: 80,
  depth: 50,
  height: 20,
  edgeRadius: 2,
  holeRadius: 10,
  overlap: 12,
  jointFillet: 1,
  unionParts: true,
};

const main = (replicad, params) => {
  const { width, depth, height, edgeRadius, holeRadius, overlap, jointFillet, unionParts } = params;

  // Keep fillets and hole radii within the body's dimensions.
  const fillet = Math.max(0.2, Math.min(edgeRadius, width / 5, depth / 5, height / 5));
  const hole = Math.max(1, Math.min(holeRadius, width / 3, depth / 3));

  // Base: fillet the plate, then subtract a through-hole.
  const plate = replicad.makeBaseBox(width, depth, height).fillet(fillet);
  const cutter = replicad.drawCircle(hole)
    .sketchOnPlane()
    .extrude(height + 4)
    .translateZ(-2);
  const drilledPlate = plate.cut(cutter);

  // Second rounded solid protrudes from one side of the plate.
  // Ensure a positive volume intersection, not just coplanar contact.
  const blockWidth = Math.max(12, width / 3);
  // Keep enough flat, overlapping area for the post-union blend.
  const intersection = Math.max(fillet * 3, Math.min(overlap, blockWidth * 0.75, width / 3));
  const block = replicad.makeBaseBox(blockWidth, depth / 2, height * 1.4)
    .fillet(Math.min(fillet, 3))
    .translate([
      width / 2 + blockWidth / 2 - intersection,
      0,
      height * 0.3,
    ]);

  // With union disabled, show the two parts before the final operations.
  if (!unionParts) {
    return [
      { name: "Drilled plate", shape: drilledPlate },
      { name: "Rounded block", shape: block },
    ];
  }

  // First fuse the exact B-reps; then round ONLY the new joint seams.
  const fused = drilledPlate.fuse(block);
  if (jointFillet <= 0) return fused;

  const seamX = width / 2 - intersection / 2;
  const seamY = depth / 4;
  const seamPointA = [seamX, seamY, height];
  const seamPointB = [seamX, -seamY, height];
  const selectJoint = (e) => e.inDirection("X").either([
    (edge) => edge.near(seamPointA, 0.05),
    (edge) => edge.near(seamPointB, 0.05),
  ]);
  const matchingEdges = fused.findEdges(selectJoint);
  const matches = matchingEdges.length;
  matchingEdges.forEach(edge => edge.delete());
  if (matches !== 2) {
    throw new Error("Could not identify the two new union edges. Adjust overlap or edgeRadius.");
  }
  // A small radius is more robust around the pre-existing edge fillets.
  const radius = Math.min(jointFillet, fillet * 0.6, intersection / 8);
  return fused.fillet(radius, selectJoint);
};
`,
  },
];


// Ordinary JavaScript files; no custom model language or hidden state.
const LOCAL_EXAMPLES = [
  {
    name: "Parametric pavilion",
    filename: "pavilion.js",
    source: `const defaultParams = {
  width: 60,
  depth: 42,
  height: 28,
  columnSize: 4,
  roofThickness: 3,
};

const main = (replicad, p) => {
  const w = p.width, d = p.depth, h = p.height;
  const c = Math.min(p.columnSize, w / 6, d / 6);
  const roof = replicad.makeBaseBox(w, d, p.roofThickness)
    .translateZ(h);
  const positions = [
    [-w / 2 + c / 2, -d / 2 + c / 2],
    [ w / 2 - c / 2, -d / 2 + c / 2],
    [-w / 2 + c / 2,  d / 2 - c / 2],
    [ w / 2 - c / 2,  d / 2 - c / 2],
  ];
  return [
    { name: "Canopy", shape: roof },
    ...positions.map(([x, y], i) => ({
      name: "Column " + (i + 1),
      shape: replicad.makeBaseBox(c, c, h).translate([x, y, 0]),
    })),
  ];
};`,
  },
  {
    name: "Rounded block",
    filename: "rounded-block.js",
    source: `const defaultParams = {
  width: 65,
  depth: 40,
  height: 26,
  radius: 4,
};

const main = (replicad, p) => {
  const radius = Math.min(p.radius, p.width / 4, p.depth / 4, p.height / 4);
  return replicad.makeBaseBox(p.width, p.depth, p.height).fillet(radius);
};`,
  },
  // Additional original examples are imported below.
];

export const EXAMPLES = [
  ...LOCAL_EXAMPLES,
  ...STUDIO_DEMOS.map(({ title, filename, source }) => ({ name: title, filename, source })),
  {
    name: "Perforated facade panel",
    filename: "perforated-panel.js",
    source: `// A grid of circular openings in a solid panel.
const defaultParams = {
  width: 90,
  height: 60,
  thickness: 4,
  columns: 5,
  rows: 3,
  holeRadius: 4,
};

const main = (replicad, p) => {
  const w = Math.max(1, p.width), h = Math.max(1, p.height);
  const t = Math.max(0.5, p.thickness);
  const cols = Math.max(1, Math.min(12, Math.round(p.columns)));
  const rows = Math.max(1, Math.min(12, Math.round(p.rows)));
  const dx = w / cols, dy = h / rows;
  const r = Math.max(0.1, Math.min(p.holeRadius, dx * 0.4, dy * 0.4));
  let panel = replicad.makeBaseBox(w, h, t);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cutter = replicad.drawCircle(r).sketchOnPlane().extrude(t + 2)
        .translate([-w / 2 + dx * (i + 0.5), -h / 2 + dy * (j + 0.5), -1]);
      panel = panel.cut(cutter);
    }
  }
  return panel;
};`,
  },
  {
    name: "Stepped tower",
    filename: "stepped-tower.js",
    source: `// A stack of individually named floor volumes.
const defaultParams = {
  width: 50,
  depth: 35,
  floors: 8,
  floorHeight: 5,
  setback: 1.5,
};

const main = (replicad, p) => {
  const n = Math.max(1, Math.min(80, Math.round(p.floors)));
  const h = Math.max(0.5, p.floorHeight);
  return Array.from({ length: n }, (_, i) => ({
    name: "Floor " + (i + 1),
    shape: replicad.makeBaseBox(
      Math.max(5, p.width - i * p.setback),
      Math.max(5, p.depth - i * p.setback),
      h,
    ).translateZ(i * h),
  }));
};`,
  },
];
