import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm";
import {parseMayaAscii} from "../maya-parser.js";
import {applyMayaAppearance} from "../maya-appearance.js";
import {prepareMeshes} from "../subdivide.js";
import {applyLayerMode} from "../layers.js";
import {buildMesh3dm} from "../rhino-core.js";
const source=[
  'createNode transform -n "Panel";',
  'createNode mesh -n "PanelShape" -p "Panel";',
  'setAttr ".vt[0:5]" -type "float3" 0 0 0 1 0 0 2 0 0 0 1 0 1 1 0 2 1 0;',
  'setAttr ".ed[0:6]" 0 1 1 1 4 1 4 3 1 3 0 1 1 2 1 2 5 1 5 4 1;',
  'setAttr ".uvst[0].uvsp[0:7]" -type "float2" 0 0 1 0 1 1 0 1 0.25 0 1 0 1 1 0.25 1;',
  'setAttr ".fc[0:1]" -type "polyFaces" f 4 0 1 2 3 mu 0 4 0 1 2 3 f 4 4 5 6 -2 mu 0 4 4 5 6 7;',
  'setAttr ".iog[0].og[0].gcl" -type "componentList" 1 "f[0]";',
  'setAttr ".iog[0].og[1].gcl" -type "componentList" 1 "f[1]";',
  'createNode lambert -n "Red";setAttr ".c" -type "float3" 1 0 0;',
  'createNode lambert -n "Blue";setAttr ".c" -type "float3" 0 0 1;',
  'createNode shadingEngine -n "RedSG";createNode shadingEngine -n "BlueSG";',
  'connectAttr "Red.oc" "RedSG.ss";connectAttr "Blue.oc" "BlueSG.ss";',
  'connectAttr "PanelShape.iog.og[0]" "RedSG.dsm" -na;',
  'connectAttr "PanelShape.iog.og[1]" "BlueSG.dsm" -na;'
].join("\n");
test("face material assignment is split only after subdivision and UVs propagate",()=>{
  const p=applyMayaAppearance(parseMayaAscii(source,{upAxis:"z"}),source);
  assert.equal(p.objects.length,1);
  assert.equal(p.objects[0].faceUVs.length,2);
  assert.deepEqual(p.objects[0].faceMaterials.map(m=>m.materialName),["Red","Blue"]);
  const model=prepareMeshes(p,1);
  assert.equal(model.objects.length,2);
  assert.deepEqual(model.objects.map(o=>o.materialName),["Red","Blue"]);
  assert.deepEqual(model.objects.map(o=>o.faces.length),[4,4]);
  assert.ok(model.objects.every(o=>o.faceUVs.length===4));
});
test("3DM preserves separate face material parts and mesh texture coordinates",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const parsed=applyMayaAppearance(parseMayaAscii(source,{upAxis:"z"}),source);
  const result=buildMesh3dm(applyLayerMode(prepareMeshes(parsed,0),"material"),rhino);
  assert.equal(result.exported,2);assert.equal(result.materials,2);
  const doc=rhino.File3dm.fromByteArray(result.bytes);
  try{
    for(let i=0;i<2;i++){
      const geom=doc.objects().get(i).geometry();
      assert.equal(geom.textureCoordinates().count,geom.vertices().count);
      assert.equal(geom.textureCoordinates().count,4);
    }
  }finally{doc.destroy();}
});
