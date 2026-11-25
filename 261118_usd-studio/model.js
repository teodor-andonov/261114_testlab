import * as sm from "@classcad/smlibwasm";
import {locateParameter} from "./param-source.js";
import {expandPreview} from "./preview.js";

export function installWarnings(handler){sm.setWarningHandler?.(handler);}
export function normalizeShapes(result){
 const shapes=Array.isArray(result)?result.flat(Infinity):[result];
 if(!shapes.length||shapes.some(s=>!(s instanceof sm.Part||s instanceof sm.Shell)))throw new Error("main must return an SMLib Part, Shell, or array of them. Meshes are not CAD B-reps.");
 return shapes;
}
export const QUALITY={draft:{relative:.005,angle:25,segments:24},standard:{relative:.001,angle:20,segments:48},high:{relative:.00025,angle:12,segments:64},ultra:{relative:.00005,angle:8,segments:96},legacy:{absolute:.01,segments:64}};
export function evaluate(source,progress=()=>{}){
 return sm.scope(()=>{
  progress("Evaluating JavaScript source");
  const model=new Function("sm",source+"\n;return {main:typeof main==='function'?main:null,params:typeof defaultParams==='undefined'?{}:defaultParams};")(sm);
  if(!model.main)throw new Error("Define main(sm, params).");
  if(!model.params||typeof model.params!=="object"||Array.isArray(model.params))throw new Error("defaultParams must be an object.");
  const params=Object.fromEntries(Object.entries(model.params).filter(([key,value])=>{
   if(!["number","boolean","string"].includes(typeof value)||(typeof value==="number"&&!Number.isFinite(value)))return false;
   try{locateParameter(source,key);return true;}catch{return false;}
  }));
  progress("Running main(sm, params) — SMLib modelling");
  const shapes=normalizeShapes(model.main(sm,{...model.params}));
  progress("Created "+shapes.length+" B-rep object(s)");
  return {shapes,params};
 });
}
export function disposeModel(model){for(const s of new Set(model?.shapes||[]))s.dispose();}
export function boundsFor(shapes){return sm.scope(()=>{
 let box=shapes[0].bbox();for(let i=1;i<shapes.length;i++)box=box.union(shapes[i].bbox());
 return {min:[box.min.x,box.min.y,box.min.z],max:[box.max.x,box.max.y,box.max.z]};
});}
export function meshShape(shape,quality="standard",includeEdges=true){
 return sm.scope(()=>{
  const q=QUALITY[quality];if(!q)throw new Error("Unknown preview quality");
  const start=performance.now();
  const tolerance=q.absolute??Math.max(1e-8,shape.bbox().diagonal*q.relative);
  const mesh=q.angle===undefined?sm.tessellate(shape,tolerance):sm.tessellate(shape,tolerance,q.angle);
  const positions=new Float32Array(mesh.vertices),indices=new Uint32Array(mesh.triangles);
  if(!positions.length||!indices.length||positions.length%3||indices.length%3||!positions.every(Number.isFinite)||!indices.every(x=>x<positions.length/3))throw new Error("Invalid preview tessellation");
  const tessMs=performance.now()-start;
  const prepStart=performance.now();
  const {corners,normals}=expandPreview(positions,indices,mesh.normals);
  if(!normals)console.warn("Kernel provided no usable corner normals; using flat preview shading.");
  const edgeData=includeEdges?sampleEdges(shape,quality):{lines:null,edges:0};
  return {positions,indices,corners,normals,...edgeData,faces:shape.faces().length,tolerance,tessMs,prepMs:performance.now()-prepStart};
 });
}
export function sampleEdges(shape,quality="standard"){
 return sm.scope(()=>{
  const q=QUALITY[quality];if(!q)throw new Error("Unknown preview quality");
  const edges=shape.edges(),lines=[];
  for(const edge of edges){
   if(edge.isSeam)continue;
   try{
    const n=edge.geomType==="line"?1:q.segments;
    let prev=edge.pointAt(0);
    for(let j=1;j<=n;j++){const next=edge.pointAt(j/n),seg=[prev.x,prev.y,prev.z,next.x,next.y,next.z];if(seg.every(Number.isFinite))lines.push(...seg);prev=next;}
   }catch(error){console.warn("Preview edge sampling failed: "+error.message);}
  }
  return {lines:new Float32Array(lines),edges:edges.length};
 });
}
export function metadata(shape){return {name:shape.name||null,color:shape.color?Array.from(shape.color):null};}
export function fingerprint(shape){return sm.scope(()=>new Uint8Array(sm.toSmb(shape)));}
export function serialize(shapes,includeMesh=false){return sm.scope(()=>{
 const usda=sm.toUsd(shapes,{mesh:Boolean(includeMesh),materials:true});
 if(!usda.startsWith("#usda")||!/BrepArray/i.test(usda))throw new Error("Exporter did not produce a USD BRep stage; refusing mesh-only output.");
 return usda;
});}
export function roundTrip(usda){return sm.scope(()=>normalizeShapes(sm.fromUsd(usda,{strict:true,check:true})).map(s=>({...metadata(s),volume:s instanceof sm.Part?s.volume:null,faces:s.faces().length,edges:s.edges().length})));}
export function checkedExport(shapes,includeMesh,progress=()=>{}){
 progress("Serializing native USDA"+(includeMesh?" with preview meshes":" (BRep only)"));
 const usda=serialize(shapes,includeMesh);
 progress("Serialized "+new TextEncoder().encode(usda).length+" bytes of USDA");
 progress("Reopening USDA with strict topology validation");
 const checked=roundTrip(usda);
 if(checked.length!==shapes.length)throw new Error("USDA round-trip changed the object count.");
 const names=new Map(checked.filter(s=>s.name).map(s=>[s.name,s]));
 for(let i=0;i<shapes.length;i++){
  const shape=shapes[i], volume=shape instanceof sm.Part?shape.volume:null;
  const recovered=shape.name&&names.has(shape.name)?names.get(shape.name):checked[i];
  if(volume!==null&&(!Number.isFinite(recovered.volume)||Math.abs(recovered.volume-volume)>Math.max(1e-5,Math.abs(volume)*1e-5)))throw new Error("USDA round-trip volume mismatch on object "+(i+1));
 }
 progress("Round-trip validation passed");
 return {usda,checked};
}
// Compatibility helper used only by headless tests, not interactive builds.
export function build(source,includeMesh=false,progress=()=>{}){
 const model=evaluate(source,progress);
 try{
  const meshes=model.shapes.map(shape=>({...meshShape(shape),...metadata(shape),volume:shape instanceof sm.Part?shape.volume:null}));
  return {params:model.params,meshes,usda:serialize(model.shapes,includeMesh)};
 }finally{disposeModel(model);}
}
