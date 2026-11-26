// Read Maya display-layer and simple shader networks from the same .ma text.
// Display layers are NOT Maya DAG transform groups: each named displayLayer
// creates one flat Rhino layer. Only static RGB properties are evaluated.
import {scanMayaCommands,tokenizeMayaCommand} from "./maya-parser.js";

const clamp=x=>Math.min(255,Math.max(0,Math.round(Number(x)*255)));
const rgb=v=>v&&v.length>=3&&v.slice(0,3).every(x=>Number.isFinite(Number(x)))
  ? {r:clamp(v[0]),g:clamp(v[1]),b:clamp(v[2])}:null;
const shaderTypes=new Set([
  "lambert","phong","phongE","blinn","anisotropic",
  "surfaceShader","standardSurface","aiStandardSurface"
]);
function attrRef(ref){
  const point=ref.indexOf(".");
  return {node:point<0?ref:ref.slice(0,point),attr:point<0?"":ref.slice(point+1)};
}
function baseAttr(attr){return attr.replace(/\[.*$/,"");}
function graph(source){
  const nodes=new Map(),aliases=new Map(),connections=[];
  let current=null;
  function resolve(ref){
    if(!ref)return null;
    if(nodes.has(ref))return ref;
    const path=ref.startsWith("|")?ref:ref.includes("|")?"|"+ref:null;
    if(path&&nodes.has(path))return path;
    const short=ref.split("|").at(-1);
    const candidates=aliases.get(short);
    return candidates?.at(-1)||null;
  }
  for(const command of scanMayaCommands(source)){
    const t=tokenizeMayaCommand(command),op=t[0];
    if(op==="createNode"){
      const nameFlag=t.indexOf("-n"),parentFlag=t.indexOf("-p");
      const given=nameFlag>=0?t[nameFlag+1]:null;
      if(!given){current=null;continue;}
      const short=given.split("|").at(-1);
      const parent=parentFlag>=0?resolve(t[parentFlag+1]):null;
      const type=t[1];
      const dag=type==="transform"||type==="mesh";
      const id=dag?(parent||"")+"|"+short:short;
      current=id;
      nodes.set(id,{id,name:short,parent,type,attrs:new Map()});
      if(!aliases.has(short))aliases.set(short,[]);
      aliases.get(short).push(id);
      continue;
    }
    if(op==="select"){
      current=resolve(t.slice(1).filter(x=>!x.startsWith("-")).at(-1));
      continue;
    }
    if(op==="connectAttr"){
      const vals=t.slice(1).filter(x=>!x.startsWith("-"));
      if(vals.length>=2)connections.push([vals[0],vals[1]]);
      continue;
    }
    if(op!=="setAttr"||!current)continue;
    const at=t.findIndex((x,i)=>i>0&&(x.startsWith(".")||(!x.startsWith("-")&&x.includes("."))));
    if(at<0)continue;
    const ref=attrRef(t[at]);
    const node=nodes.get(ref.node?resolve(ref.node):current);
    if(!node)continue;
    const key=baseAttr(ref.attr);
    // Do not duplicate heavy geometry arrays in the appearance graph.
    if(node.type==="mesh"&&!/^(iog|instObjGroups|og|objectGroups|ovrgb|overrideColorRGB|ovcr|ovcg|ovcb|overrideColorR|overrideColorG|overrideColorB)$/.test(key))continue;
    const values=t.slice(at+1);
    if(values[0]==="-type")values.splice(0,2);
    if(values.length){node.attrs.set(key,values);if(ref.attr!==key)node.attrs.set(ref.attr,values);}
  }
  return {nodes,connections,resolve};
}
const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
function readNodeColor(node){
  if(!node)return null;
  const attrs=node.attrs;
  const isSurface=node.type==="standardSurface"||node.type==="aiStandardSurface";
  const key=isSurface?["bc","baseColor","base_color"]:node.type==="surfaceShader"
    ? ["oc","outColor"]:["c","color"];
  let values=null;
  for(const attr of key)if(attrs.has(attr)){values=attrs.get(attr);break;}
  if(!values){
    const components=isSurface?[["bcr","bcg","bcb"],["baseColorR","baseColorG","baseColorB"]]:
      [["cr","cg","cb"],["colorR","colorG","colorB"]];
    for(const names of components){
      if(!names.some(x=>attrs.has(x)))continue;
      values=names.map(x=>attrs.get(x)?.[0]??(isSurface?0.8:0.5));
      break;
    }
  }
  // No source RGB saved => no fabricated Maya material color.
  if(!values)return null;
  const result=rgb(values);
  if(result&&isSurface){
    const scalar=number(attrs.get("base")?.[0]??attrs.get("b")?.[0],1);
    result.r=Math.round(result.r*Math.max(0,Math.min(1,scalar)));
    result.g=Math.round(result.g*Math.max(0,Math.min(1,scalar)));
    result.b=Math.round(result.b*Math.max(0,Math.min(1,scalar)));
  }
  return result;
}
function readMaterialProperties(node){
  if(!node)return {};
  const attrs=node.attrs,values={};
  const get=(...keys)=>keys.map(k=>attrs.get(k)).find(v=>v?.length);
  const scalar=(...keys)=>{const x=get(...keys)?.[0];return x!==undefined&&Number.isFinite(Number(x))?Math.max(0,Math.min(1,Number(x))):undefined;};
  const average=v=>v?.length>=3&&v.slice(0,3).every(x=>Number.isFinite(Number(x)))?Math.max(0,Math.min(1,v.slice(0,3).reduce((s,x)=>s+Number(x),0)/3)):undefined;
  if(["standardSurface","aiStandardSurface"].includes(node.type)){
    const r=scalar("sr","specularRoughness","specular_roughness");
    const m=scalar("metalness","mt","metallic");
    const o=average(get("opacity","op"));
    if(r!==undefined)values.roughness=r;
    if(m!==undefined)values.metallic=m;
    if(o!==undefined)values.opacity=o;
  }else{
    const t=average(get("it","transparency","tr"));
    if(t!==undefined)values.opacity=1-t;
  }
  return values;
}
function readDisplayColor(node){
  if(!node)return null;
  const attrs=node.attrs;
  const array=attrs.get("ovrgb")||attrs.get("overrideColorRGB");
  if(array)return rgb(array);
  const keys=[["ovcr","ovcg","ovcb"],["overrideColorR","overrideColorG","overrideColorB"]];
  for(const names of keys){
    if(names.some(x=>attrs.has(x)))
      return rgb(names.map(x=>attrs.get(x)?.[0]??"0"));
  }
  return null; // Maya index colours are not RGB: use stable fallback.
}
function isObjectMember(sourceAttr,destAttr){
  const a=baseAttr(sourceAttr),b=baseAttr(destAttr);
  return /^(iog|instObjGroups|og|objectGroups)$/.test(a) &&
    /^(dsm|dagSetMembers)$/.test(b);
}
export function applyMayaAppearance(parsed,source){
  const {nodes,connections,resolve}=graph(source);
  const namedLayers=[...nodes.values()].filter(n=>n.type==="displayLayer"&&n.name!=="defaultLayer");
  const layerNameById=new Map(namedLayers.map(n=>[n.id,n.name]));
  const membership=new Map(),shaderByGroup=new Map(),groupByShape=new Map(),faceGroups=new Map();
  const textureTargets=new Set(),texturePaths=new Map();
  let componentAssignments=0;
  for(const [src,dst] of connections){
    const a=attrRef(src),b=attrRef(dst);
    const from=nodes.get(resolve(a.node)),to=nodes.get(resolve(b.node));
    if(!from||!to)continue;
    const aAttr=baseAttr(a.attr),bAttr=baseAttr(b.attr);
    // Typical display-layer wiring is layer.drawInfo -> shape/transform.drawOverride.
    if(from.type==="displayLayer"&&
       (aAttr==="di"||aAttr==="drawInfo")&&
       (bAttr==="do"||bAttr==="drawOverride")){
      membership.set(to.id,from.id);
    }
    // Also handle object-set style displayLayer.dagSetMembers connections.
    if(to.type==="displayLayer"&&isObjectMember(a.attr,b.attr))
      membership.set(from.id,to.id);
    if(to.type==="shadingEngine"&&
       (bAttr==="ss"||bAttr==="surfaceShader")&&shaderTypes.has(from.type))
      shaderByGroup.set(to.id,from.id);
    if(to.type==="shadingEngine"&&isObjectMember(a.attr,b.attr)&&from.type==="mesh"){
      // Standard .ma files connect objectGroups to shadingEngine and store
      // their face membership in the corresponding groupComponents attribute.
      const component=a.attr.match(/^(?:iog|instObjGroups)(?:\[\d+\])?\.(?:og|objectGroups)\[(\d+)\]/);
      if(component){
        const groupId=component[1];
        const key=[...from.attrs.keys()].find(k=>new RegExp("^(?:iog|instObjGroups)(?:\\[\\d+\\])?\\.(?:og|objectGroups)\\["+groupId+"\\]\\.(?:gcl|objectGrpCompList)$").test(k));
        const vals=from.attrs.get(key)||[],ranges=[];
        for(const v of vals){
          const m=v.match(/^f\[(\*|\d+)(?::(\d+))?\]$/);
          if(m)ranges.push(m[1]==="*"?[0,Infinity]:[Number(m[1]),Number(m[2]??m[1])]);
        }
        if(ranges.length){
          if(!faceGroups.has(from.id))faceGroups.set(from.id,[]);
          faceGroups.get(from.id).push({group:to.id,ranges});
        }else componentAssignments++;
      }else if(aAttr==="iog"||aAttr==="instObjGroups")groupByShape.set(from.id,to.id);
      else componentAssignments++;
    }
    if(shaderTypes.has(to.type)&&["c","color","bc","baseColor","base_color"].includes(bAttr)
       &&from.type==="file"){
      textureTargets.add(to.id);
      const path=from.attrs.get("ftn")?.[0]||from.attrs.get("fileTextureName")?.[0];
      if(path)texturePaths.set(to.id,path);
    }
  }
  const displayLayers=namedLayers.map(n=>({
    name:n.name,color:readDisplayColor(n),sourceId:n.id,
    visible:n.attrs.get("v")?.[0]!=="no"&&n.attrs.get("v")?.[0]!=="0"
  }));
  let textured=0,multi=0;
  const materialCache=new Map();
  function materialFor(groupId){
    if(materialCache.has(groupId))return materialCache.get(groupId);
    const shader=nodes.get(shaderByGroup.get(groupId));
    const result={
      materialName:shader?.name||null,
      materialColor:shader?readNodeColor(shader):null,
      materialProperties:readMaterialProperties(shader),
      materialTexture:shader?texturePaths.get(shader.id)||null:null,
      textureDriven:!!shader&&textureTargets.has(shader.id)
    };
    materialCache.set(groupId,result);return result;
  }
  const objects=parsed.objects.map(object=>{
    let node=nodes.get(object.path);
    let foundLayer=null;
    // A transform assigned to a display layer includes its mesh descendants.
    while(node){
      if(membership.has(node.id)){foundLayer=membership.get(node.id);break;}
      node=nodes.get(node.parent);
    }
    const layerName=layerNameById.get(foundLayer)||"Default";
    const material=materialFor(groupByShape.get(object.path));
    const groups=faceGroups.get(object.path);
    const faceMaterials=groups?.length&&object.faces?object.faces.map((_,i)=>{
      const id=object.sourceFaceIds?.[i]??i;
      let assigned=material;
      for(const g of groups)if(g.ranges.some(([a,b])=>id>=a&&id<=b))assigned=materialFor(g.group);
      return assigned;
    }):null;
    if(material.textureDriven||faceMaterials?.some(m=>m.textureDriven))textured++;
    if(faceMaterials&&new Set(faceMaterials).size>1)multi++;
    return {...object,
      layerName,layerColor:displayLayers.find(l=>l.name===layerName)?.color||null,
      ...material,faceMaterials
    };
  });
  const warnings=[...parsed.warnings];
  if(textured)warnings.push(textured+" objects use texture-driven colours; direct bitmap paths are preserved as references, not embedded images. Only supported primary UV mappings are imported; shader networks are not evaluated.");
  if(componentAssignments)warnings.push(componentAssignments+" face/component material connections could not be resolved; affected objects may have incomplete materials.");
  if(multi)warnings.push(multi+" multi-material meshes will be split by face material after subdivision.");
  return {...parsed,objects,displayLayers,warnings};
}
