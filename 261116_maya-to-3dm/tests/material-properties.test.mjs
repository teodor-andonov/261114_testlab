import test from "node:test";
import assert from "node:assert/strict";
import {applyMayaAppearance} from "../maya-appearance.js";
import {buildMesh3dm} from "../rhino-core.js";
import initRhino from "rhino3dm";
const base={unit:"cm",warnings:[],objects:[{name:"Panel",path:"|Panel|PanelShape",vertices:[[0,0,0],[1,0,0],[1,1,0],[0,1,0]],faces:[[0,1,2,3]]}]};
test("saved PBR properties and bitmap filename are extracted",()=>{
  const result=applyMayaAppearance(base,'createNode transform -n "Panel";createNode mesh -n "PanelShape" -p "Panel";createNode standardSurface -n "Paint";setAttr ".bc" -type "float3" 0.5 0.4 0.3;setAttr ".sr" 0.25;setAttr ".metalness" 0.75;setAttr ".opacity" -type "float3" 0.8 0.8 0.8;createNode file -n "Tex";setAttr ".ftn" -type "string" "paint.png";createNode shadingEngine -n "SG";connectAttr "Tex.oc" "Paint.bc";connectAttr "Paint.oc" "SG.ss";connectAttr "PanelShape.iog" "SG.dsm";');
  const o=result.objects[0];assert.equal(o.materialProperties.roughness,0.25);assert.equal(o.materialProperties.metallic,0.75);assert.ok(Math.abs(o.materialProperties.opacity-0.8)<1e-8);assert.equal(o.materialTexture,"paint.png");
});
test("Rhino 3DM roundtrip preserves native PBR parameters and named default material",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const a={...base.objects[0],layerName:"Default",materialName:"Paint",materialColor:{r:128,g:100,b:70},materialProperties:{roughness:0.25,metallic:0.75,opacity:0.8}};
  const b={...a,name:"DefaultPaint",materialName:"No RGB",materialColor:null,materialProperties:{}};
  const result=buildMesh3dm({...base,objects:[a,b]},rhino);
  assert.equal(result.exported,2);assert.equal(result.materials,2);
  const doc=rhino.File3dm.fromByteArray(result.bytes);
  try{const p=doc.materials().get(0).physicallyBased();assert.ok(p.supported);assert.ok(Math.abs(p.roughness-0.25)<1e-6);assert.ok(Math.abs(p.metallic-0.75)<1e-6);assert.ok(Math.abs(p.opacity-0.8)<1e-6);assert.equal(doc.materials().get(1).name,"No RGB");}finally{doc.destroy();}
});
