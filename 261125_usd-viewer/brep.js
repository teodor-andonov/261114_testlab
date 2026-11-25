import * as sm from "@classcad/smlibwasm";
import {QUALITY} from "./quality.js";
// Kernel reconstructs exact CAD topology; only render arrays leave the worker.
export function readBreps(text,emit=()=>{},quality="normal"){
 const q=QUALITY[quality];if(!q)throw new Error("Unknown tessellation quality");
 return sm.scope(()=>{
  const result=sm.fromUsd(text,{strict:true,check:true});
  const shapes=Array.isArray(result)?result.flat(Infinity):[result];
  if(!shapes.length||shapes.some(s=>!(s instanceof sm.Part||s instanceof sm.Shell)))throw new Error("No supported BRep bodies recovered.");
  for(let i=0;i<shapes.length;i++){
   const s=shapes[i], tolerance=Math.max(1e-8,s.bbox().diagonal*q.relative);
   const mesh=sm.tessellate(s,tolerance,q.angle);
   const positions=new Float32Array(mesh.vertices),indices=new Uint32Array(mesh.triangles);
   if(!positions.length||!indices.length||positions.length%3||indices.length%3||!positions.every(Number.isFinite)||!indices.every(n=>n<positions.length/3))throw new Error("Invalid BRep tessellation for body "+(i+1));
   const corners=new Float32Array(indices.length*3);
   for(let j=0;j<indices.length;j++)corners.set(positions.subarray(indices[j]*3,indices[j]*3+3),j*3);
   const normals=mesh.normals?.length===corners.length&&mesh.normals.every(Number.isFinite)?new Float32Array(mesh.normals):null;
   const edges=s.edges(), lines=[];
   for(const e of edges){if(e.isSeam)continue;try{const n=e.geomType==="line"?1:q.segments;let a=e.pointAt(0);for(let j=1;j<=n;j++){const b=e.pointAt(j/n),p=[a.x,a.y,a.z,b.x,b.y,b.z];if(p.every(Number.isFinite))lines.push(...p);a=b;}}catch{}}
   emit({name:s.name||"Body "+(i+1),kind:s instanceof sm.Part?"BRep solid":"BRep shell",faces:s.faces().length,edges:edges.length,volume:s instanceof sm.Part?s.volume:null,tolerance,color:s.color?Array.from(s.color):null,corners,normals,lines:new Float32Array(lines)},i+1,shapes.length);
  }
  return shapes.length;
 });
}
export function demoUsd(){return sm.scope(()=>sm.toUsd([(()=>{const p=sm.Box(80,60,14);return p.fillet(p.edges().parallelTo(sm.Z),4).cut(sm.Cylinder(9,30)).named("Filleted plate").colored([0.28,0.53,0.72]);})()],{mesh:false,materials:true}));}
