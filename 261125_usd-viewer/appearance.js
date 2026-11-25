import * as T from "three";
export const DISPLAY_MODES=Object.freeze({clay:"White / clay",material:"Material",random:"Random color",gray:"Grayscale"});
const list=m=>Array.isArray(m)?m:[m];
const sourceKey=new WeakMap();
export function captureMaterials(object,source){
 if(sourceKey.has(object)||!object.material)return;
 sourceKey.set(object,{original:object.material,source,display:null,mode:null});
}
export function randomColor(seed){
 let h=2166136261;for(const c of String(seed)){h=Math.imul(h^c.charCodeAt(0),16777619);}
 return new T.Color().setHSL((h>>>0)/4294967296,.46,.59);
}
function override(source,object,mode,clay,seed){
 const color=mode==="clay"?new T.Color(0xe4e4e4):mode==="random"?randomColor(seed):clay.clone();
 if(object.isMesh)return new T.MeshStandardMaterial({color,roughness:.82,metalness:0,side:source.side??T.DoubleSide});
 if(object.isPoints)return new T.PointsMaterial({color,size:source.size??.01,sizeAttenuation:source.sizeAttenuation??true});
 return new T.LineBasicMaterial({color});
}
export function applyAppearance(object,{mode,selected,accent,clay,wire,seed}){
 captureMaterials(object,"Viewer default");const data=sourceKey.get(object);if(!data)return;
 if(data.mode!==mode||!data.display){
  if(data.display)for(const m of list(data.display))m.dispose();
  const materials=list(data.original).map(s=>mode==="material"?s.clone():override(s,object,mode,clay,seed));
  data.display=Array.isArray(data.original)?materials:materials[0];data.mode=mode;object.material=data.display;
 }
 list(data.display).forEach((m,i)=>{
  const s=list(data.original)[i];
  if(m.color){const base=mode==="material"?(s.color||new T.Color(0xffffff)):mode==="clay"?new T.Color(0xe4e4e4):mode==="random"?randomColor(seed):clay;
   m.color.copy(base);if(selected&&!m.emissive)m.color.lerp(accent,.6);}
  if(m.emissive){m.emissive.copy(mode==="material"&&s.emissive?s.emissive:new T.Color(0));m.emissiveIntensity=mode==="material"?(s.emissiveIntensity??1):1;if(selected){m.emissive.lerp(accent,.75);m.emissiveIntensity=Math.max(m.emissiveIntensity,.7);}}
  if(object.isMesh&&m.wireframe!==wire){m.wireframe=wire;m.needsUpdate=true;}
 });
}
export function disposeAppearance(object,materials,textures){
 const d=sourceKey.get(object);
 for(const m of [...list(object.material),...(d?list(d.original):[])])if(m){
  materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);
 }
 sourceKey.delete(object);
}
export function materialInfo(object){
 const results=new Map();
 object.traverse(o=>{if(o.userData.previewEdge)return;const d=sourceKey.get(o);if(!d)return;
  for(const m of list(d.original)){
   const info={name:m.name||null,hex:m.color?"#"+m.color.getHexString():null,roughness:m.roughness??null,metalness:m.metalness??null,opacity:m.opacity??null,source:d.source,textures:["map","normalMap","roughnessMap","metalnessMap","aoMap","emissiveMap","alphaMap"].filter(k=>m[k]?.isTexture)};
   results.set(JSON.stringify(info),info);
  }
 });return [...results.values()];
}
