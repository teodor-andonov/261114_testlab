import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {prepareMeshes} from "./subdivide.js";
import {exportMesh3dm} from "./rhino-export.js";
import {layerCatalog,layerColor,objectLayerKey,visibleOnLayer,applyLayerMode} from "./layers.js";

const $=id=>document.getElementById(id);
const canvas=$("viewport");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setClearColor(0x000000,0);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.45;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(42,1,0.001,1000000);
camera.up.set(0,0,1);
camera.position.set(5,-7,5);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
controls.dampingFactor=0.075;
controls.screenSpacePanning=true;
controls.zoomSpeed=0.85;
scene.add(new THREE.HemisphereLight(0xf1f7ff,0x344351,2.45));
function light(color,intensity,position){
  const lamp=new THREE.DirectionalLight(color,intensity);
  lamp.position.set(...position);
  scene.add(lamp);
}
light(0xffffff,2.5,[8,-11,18]);
light(0xaed8ec,0.95,[-9,5,8]);
light(0xffe6ce,0.45,[1,10,3]);
const modelGroup=new THREE.Group();
scene.add(modelGroup);
let groundGrid=null;
let currentFile=null,currentName="maya-geometry.ma",parsed=null,baked=null;
let layers=[],expanded=new Set(),visibility=new Map(),layerGroups=new Map();
let exportController=null,importWorker=null;

function safeText(el,value){el.textContent=String(value);}
function status(message,kind="ok"){
  safeText($("status"),message);
  $("status").dataset.kind=kind;
}
function disposeGeometry(root){
  root.traverse(node=>{
    node.geometry?.dispose();
    if(Array.isArray(node.material))node.material.forEach(m=>m.dispose());
    else node.material?.dispose();
  });
}
function clearGeometry(){
  disposeGeometry(modelGroup);
  modelGroup.clear();
  layerGroups.clear();
  if(groundGrid){
    scene.remove(groundGrid);
    groundGrid.geometry.dispose();
    groundGrid.material.dispose();
    groundGrid=null;
  }
}
function addMesh(object){
  const key=objectLayerKey(object);
  let group=layerGroups.get(key);
  if(!group){
    group=new THREE.Group();
    group.name=key;
    modelGroup.add(group);
    layerGroups.set(key,group);
  }
  const indices=[];
  for(const polygon of object.faces)
    for(let i=1;i<polygon.length-1;i++)
      indices.push(polygon[0],polygon[i],polygon[i+1]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(object.vertices.flat(),3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const rgb=object.materialColor||object.layerColor||layerColor(key);
  const color=new THREE.Color("rgb("+rgb.r+","+rgb.g+","+rgb.b+")");
  const material=new THREE.MeshStandardMaterial({
    color,metalness:object.materialProperties?.metallic??0,roughness:object.materialProperties?.roughness??0.82,side:THREE.DoubleSide,
    opacity:object.materialProperties?.opacity??1,transparent:(object.materialProperties?.opacity??1)<1,
    flatShading:false
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=object.name;
  group.add(mesh);
  if($("wireframe").checked){
    const edgeSet=new Set(),segments=[];
    for(const polygon of object.faces){
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i],b=polygon[(i+1)%polygon.length];
        const id=Math.min(a,b)+":"+Math.max(a,b);
        if(edgeSet.has(id))continue;
        edgeSet.add(id);
        segments.push(...object.vertices[a],...object.vertices[b]);
      }
    }
    if(segments.length){
      const wires=new THREE.BufferGeometry();
      wires.setAttribute("position",new THREE.Float32BufferAttribute(segments,3));
      const lines=new THREE.LineSegments(wires,new THREE.LineBasicMaterial({
        color:0x192934,transparent:true,opacity:0.37,depthWrite:false
      }));
      lines.renderOrder=2;
      group.add(lines);
    }
  }
}
function getVisibleBounds(){
  const bounds=new THREE.Box3();
  for(const group of layerGroups.values()){
    if(!group.visible)continue;
    for(const child of group.children)if(child.isMesh)bounds.expandByObject(child);
  }
  return bounds.isEmpty()?null:bounds;
}
function resetGrid(){
  if(groundGrid){
    scene.remove(groundGrid);
    groundGrid.geometry.dispose();groundGrid.material.dispose();
    groundGrid=null;
  }
  const bounds=getVisibleBounds();
  if(!bounds||!$("grid-toggle").checked)return;
  const size=bounds.getSize(new THREE.Vector3());
  const extent=Math.max(size.x,size.y,size.z,1);
  const spacing=Math.pow(10,Math.floor(Math.log10(extent/12)));
  const gridSize=Math.max(spacing*20,extent*1.25);
  const divisions=Math.max(8,Math.round(gridSize/spacing));
  groundGrid=new THREE.GridHelper(gridSize,divisions,0x6f8595,0x536b7a);
  groundGrid.rotation.x=Math.PI/2;
  const centre=bounds.getCenter(new THREE.Vector3());
  groundGrid.position.set(centre.x,centre.y,bounds.min.z-Math.max(extent*0.015,0.001));
  groundGrid.material.transparent=true;
  groundGrid.material.opacity=0.18;
  groundGrid.renderOrder=-1;
  scene.add(groundGrid);
}
function fitView(){
  const bounds=getVisibleBounds();
  if(!bounds)return;
  const center=bounds.getCenter(new THREE.Vector3());
  const dims=bounds.getSize(new THREE.Vector3());
  const radius=Math.max(dims.length()*0.5,0.001);
  const dist=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov*0.5))*1.20;
  camera.position.copy(center).add(new THREE.Vector3(0.8,-1,0.7).normalize().multiplyScalar(dist));
  camera.near=Math.max(radius/10000,0.00001);
  camera.far=Math.max(radius*3000,100);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}
function renderObjects({fit=true}={}){
  clearGeometry();
  if(!baked)return;
  for(const object of baked.objects)addMesh(object);
  applyVisibility();
  if(fit)fitView();
}
function applyVisibility(){
  for(const [key,group] of layerGroups)
    group.visible=visibleOnLayer(key,visibility);
  const visibleCount=baked?.objects.filter(o=>visibleOnLayer(objectLayerKey(o),visibility)).length||0;
  safeText($("scene-info"),baked?
    visibleCount+" / "+baked.objects.length+" meshes visible · "+baked.unit:"No geometry loaded");
  $("export-button").disabled=!baked?.objects.length||(!visibleCount&&$("export-visible").checked);
  if(exportController)$("export-button").disabled=false;
  resetGrid();
}
function renderLayerTree(){
  const host=$("layer-list");
  host.replaceChildren();
  if(!layers.length){
    const empty=document.createElement("p");empty.className="quiet";
    empty.textContent="Maya transform groups will appear here.";
    host.append(empty);return;
  }
  const filter=$("layer-filter").value.trim().toLowerCase();
  const showing=new Set();
  if(filter){
    for(const layer of layers){
      if(!layer.name.toLowerCase().includes(filter))continue;
      let key=layer.id;
      while(key){
        showing.add(key);
        key=layers.find(x=>x.id===key)?.parent||null;
      }
    }
  }
  for(const layer of layers){
    if(filter&&!showing.has(layer.id))continue;
    if(!filter){
      let p=layer.parent,collapsed=false;
      while(p){
        if(!expanded.has(p)){collapsed=true;break;}
        p=layers.find(x=>x.id===p)?.parent||null;
      }
      if(collapsed)continue;
    }
    const row=document.createElement("div");
    row.className="layer-row";
    if(!visibleOnLayer(layer.id,visibility))row.classList.add("is-hidden");
    row.style.paddingLeft=(5+layer.depth*14)+"px";
    const expand=document.createElement("button");
    expand.className="layer-chevron has-none";
    expand.type="button";
    expand.textContent=expanded.has(layer.id)?"▾":"▸";
    expand.title=expanded.has(layer.id)?"Collapse group":"Expand group";
    expand.setAttribute("aria-label",expand.title+": "+layer.name);
    expand.addEventListener("click",()=>{
      if(expanded.has(layer.id))expanded.delete(layer.id);else expanded.add(layer.id);
      renderLayerTree();
    });
    const toggle=document.createElement("button");
    toggle.className="layer-eye";
    toggle.type="button";
    const on=visibleOnLayer(layer.id,visibility);
    toggle.textContent=on?"◉":"○";
    toggle.setAttribute("aria-pressed",String(on));
    toggle.title=(on?"Hide ":"Show ")+layer.name;
    toggle.setAttribute("aria-label",toggle.title);
    toggle.addEventListener("click",()=>{
      const show=!visibleOnLayer(layer.id,visibility);
      // Re-enabling a group also re-enables its descendant visibility.
      for(const item of layers)if(item.id===layer.id||item.id.startsWith(layer.id+"|"))
        visibility.set(item.id,show);
      applyVisibility();renderLayerTree();
    });
    const dot=document.createElement("span");dot.className="layer-color";
    dot.style.background="rgb("+layer.color.r+","+layer.color.g+","+layer.color.b+")";
    const label=document.createElement("span");
    label.className="layer-title";label.textContent=layer.name;label.title=layer.id;
    const number=document.createElement("span");
    number.className="layer-number";number.textContent=layer.count;
    row.append(expand,toggle,dot,label,number);
    host.append(row);
  }
  if(!host.children.length){
    const msg=document.createElement("p");msg.className="quiet";
    msg.textContent="No matching groups.";host.append(msg);
  }
}
function renderMeshDetails(){
  $("objects").replaceChildren();
  for(const object of baked.objects){
    const key=objectLayerKey(object),rgb=object.materialColor||object.layerColor||layerColor(key);
    const row=document.createElement("div");row.className="object-item";
    const dot=document.createElement("span");dot.className="mesh-dot";
    dot.style.background="rgb("+rgb.r+","+rgb.g+","+rgb.b+")";
    const details=document.createElement("div");
    const name=document.createElement("div");name.className="object-name";
    name.textContent=object.name;name.title=object.path;
    const stat=document.createElement("div");stat.className="subtle";
    stat.textContent=object.vertices.length+" vertices · "+object.faces.length+" faces"+(object.materialName?" · "+object.materialName:"");
    details.append(name,stat);
    const chip=document.createElement("span");chip.className="chip";
    chip.textContent=object.appliedLevels+"× smooth";
    row.append(dot,details,chip);
    $("objects").append(row);
  }
  safeText($("geometry-count"),baked.objects.length);
}
function renderNotices(){
  const notices=baked?.warnings||[];
  $("notice-panel").hidden=!notices.length;
  safeText($("notice-count"),notices.length);
  $("warnings").replaceChildren();
  for(const message of notices){
    const p=document.createElement("p");p.textContent=message;
    $("warnings").append(p);
  }
}
function showResults(){
  const objects=baked.objects;
  safeText($("object-count"),objects.length);
  safeText($("face-count"),objects.reduce((sum,o)=>sum+o.faces.length,0).toLocaleString());
  safeText($("layer-count"),layers.length);
  safeText($("unit-label"),baked.unit);
  $("empty").hidden=objects.length>0;
  renderMeshDetails();
  renderLayerTree();
  renderNotices();
  applyVisibility();
  const materialCount=new Set(objects.map(o=>o.materialName).filter(Boolean)).size;
  status(objects.length?"Ready to export · "+objects.length+" meshes · "+materialCount+" materials":
    "No supported polygon geometry in this file.",objects.length?"ok":"warning");
}
function rebuild(){
  if(!parsed)return;
  baked=applyLayerMode(prepareMeshes(parsed,$("detail").value),$("layer-source").value);
  layers=layerCatalog(baked.objects,baked.displayLayers||[]);
  const saved=new Map(visibility);
  visibility=new Map(layers.map(l=>[l.id,saved.has(l.id)?saved.get(l.id):l.visible]));
  // Opening a file shows one level of hierarchy without flooding the sidebar.
  if(!expanded.size)expanded=new Set(layers.filter(l=>l.depth===0).map(l=>l.id));
  renderObjects();
  showResults();
}
function refreshAxis(){if(currentFile)openFile(currentFile);}
async function openFile(file){
  if(!file)return;
  if(!/\.(ma|mb)$/i.test(file.name)){status("Choose a Maya .ma or .mb file.","error");return;}
  if(exportController)exportController.abort();
  importWorker?.terminate();
  currentFile=file;parsed=null;baked=null;layers=[];clearGeometry();
  currentName=file.name;
  safeText($("file-name"),file.name);
  safeText($("file-info"),(file.size/1024/1024).toFixed(2)+" MB · Maya "+(/\.mb$/i.test(file.name)?"Binary (experimental)":"ASCII"));
  status("Reading geometry locally…","pending");
  $("export-button").disabled=true;
  visibility=new Map();expanded=new Set();
  const worker=new Worker(new URL("./import.worker.js",import.meta.url),{type:"module"});
  importWorker=worker;
  function fail(message){
    if(importWorker!==worker)return;
    worker.terminate();importWorker=null;
    $("empty").hidden=false;status(message,"error");
  }
  worker.onerror=e=>fail(e.message||"Import worker failed");
  worker.onmessage=({data})=>{
    if(importWorker!==worker)return;
    if(data.error){fail(data.error);return;}
    worker.terminate();importWorker=null;
    parsed=data.parsed;
    try{rebuild();}catch(e){parsed=null;baked=null;clearGeometry();$("empty").hidden=false;status(e.message||String(e),"error");}
  };
  worker.postMessage({file,axis:$("axis").value});
}
function download(data,filename){
  const url=URL.createObjectURL(new Blob([data],{type:"application/octet-stream"}));
  const a=document.createElement("a");a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function exportCurrent(){
  const button=$("export-button");
  if(exportController){exportController.abort();return;}
  if(!baked?.objects.length)return;
  const objects=$("export-visible").checked?
    baked.objects.filter(o=>visibleOnLayer(objectLayerKey(o),visibility)):
    baked.objects;
  if(!objects.length){status("No visible meshes to export.","warning");return;}
  const controller=new AbortController();
  exportController=controller;
  button.disabled=false;button.textContent="Cancel export";
  status("Starting Rhino export…","pending");
  try{
    const result=await exportMesh3dm({...baked,objects,exportGroups:$("export-groups").checked},{
      signal:controller.signal,
      onProgress:(done,total)=>status("Writing mesh "+done+" / "+total+"…","pending")
    });
    download(result.bytes,currentName.replace(/\.(ma|mb)$/i,"")+".3dm");
    status("Exported "+result.exported+" meshes · "+result.layers+" Rhino layers · "+result.groups+" groups · "+result.materials+" materials"+
      (result.skipped.length?" · "+result.skipped.length+" skipped":""),result.skipped.length?"warning":"ok");
    if(result.skipped.length){baked.warnings.push(...result.skipped);renderNotices();}
  }catch(error){
    status(error.name==="AbortError"?"Export cancelled.":error.message||String(error),
      error.name==="AbortError"?"warning":"error");
  }finally{
    if(exportController===controller)exportController=null;
    button.textContent="Export .3dm";
    applyVisibility();
  }
}
$("file-input").addEventListener("change",event=>{
  openFile(event.target.files?.[0]);event.target.value="";
});
const drop=$("drop-target");
for(const event of ["dragenter","dragover"])drop.addEventListener(event,e=>{
  e.preventDefault();drop.classList.add("dragging");
});
for(const event of ["dragleave","drop"])drop.addEventListener(event,e=>{
  e.preventDefault();drop.classList.remove("dragging");
});
drop.addEventListener("drop",e=>openFile(e.dataTransfer.files?.[0]));
$("wireframe").addEventListener("change",()=>renderObjects({fit:false}));
$("grid-toggle").addEventListener("change",resetGrid);
$("detail").addEventListener("change",rebuild);
$("layer-source").addEventListener("change",()=>{visibility=new Map();expanded=new Set();rebuild();});
$("axis").addEventListener("change",refreshAxis);
$("layer-filter").addEventListener("input",renderLayerTree);
$("export-visible").addEventListener("change",applyVisibility);
$("fit-button").addEventListener("click",fitView);
$("show-all").addEventListener("click",()=>{
  for(const layer of layers)visibility.set(layer.id,true);
  applyVisibility();renderLayerTree();
});
$("hide-all").addEventListener("click",()=>{
  for(const layer of layers)visibility.set(layer.id,false);
  applyVisibility();renderLayerTree();
});
$("export-button").addEventListener("click",exportCurrent);
new ResizeObserver(()=>{
  const {width,height}=canvas.getBoundingClientRect();
  if(!width||!height)return;
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
}).observe(canvas);
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();
