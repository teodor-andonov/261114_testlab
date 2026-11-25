import * as T from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {USDLoader} from "three/addons/loaders/USDLoader.js";
import {detect} from "./format.js";
import {QUALITY} from "./quality.js";
import {captureMaterials,applyAppearance,disposeAppearance,materialInfo,DISPLAY_MODES} from "./appearance.js";
import {installResizers} from "./sidebars.js";
const $=id=>document.getElementById(id), viewport=$("viewport"), tree=$("tree"), details=$("details");
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));viewport.prepend(renderer.domElement);
const scene=new T.Scene(), camera=new T.PerspectiveCamera(45,1,.001,1e8);
camera.position.set(5,4,6);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new T.HemisphereLight(0xffffff,0x777777,2.3));const light=new T.DirectionalLight(0xffffff,2.4);light.position.set(5,8,3);scene.add(light);
const rim=new T.DirectionalLight(0xffffff,.8);rim.position.set(-5,2,-5);scene.add(rim);
const root=new T.Group(),documents=[];
let grid,selected=null,wire=false,gridVisible=true,worker=null,collapsed=new Set(),busy=false,quality="normal",sceneSphere=null,displayMode="material",nextDocumentId=0;
scene.add(root);
const css=k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim();
const color=k=>new T.Color(css(k));
const status=s=>$("status").textContent=s;
const renderable=o=>o.isMesh||o.isLine||o.isPoints;
const nodeChildren=o=>o.userData.document?.mode==="brep"?(o.children[0]?.children||[]):o.children.filter(c=>!c.userData.previewEdge);
const name=o=>o.name||o.type;
const kind=o=>o.userData.kind||(o.isMesh?"Mesh":o.isPoints?"Points":o.isLine?"Curve":o.isGroup?"Group":o.type);
const fmt=n=>Number.isFinite(n)?Number(n.toPrecision(6)).toLocaleString("en-GB",{maximumFractionDigits:9}):"—";
function dispose(o){const geometries=new Set(),materials=new Set(),textures=new Set();o.traverse(x=>{if(x.geometry)geometries.add(x.geometry);disposeAppearance(x,materials,textures);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
function fileOf(o){for(let p=o;p&&p!==root;p=p.parent)if(p.userData.document)return p.userData.document;return null;}
function updateEmpty(){const empty=$("empty");empty.hidden=documents.length>0||busy; $("fileName").textContent=documents.length===1?documents[0].name:documents.length+" files";}
function updateTheme(){scene.background=color("--view");if(grid&&sceneSphere)rebuildGrid(new T.Box3().setFromObject(root));refreshMaterials();}
window.addEventListener("testlab:themechange",updateTheme);
new MutationObserver(updateTheme).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function material(){return new T.MeshStandardMaterial({color:color("--mesh"),roughness:.78,metalness:0,side:T.DoubleSide});}
function isSelected(o){for(let p=o;p;p=p.parent)if(p===selected)return true;return false;}
function refreshMaterials(){root.traverse(o=>{if(!renderable(o)||!o.material)return;if(o.userData.previewEdge){o.material.color.copy(color(isSelected(o)?"--accent":"--grid-major"));o.visible=wire;return;}const doc=fileOf(o);applyAppearance(o,{mode:displayMode,selected:isSelected(o),accent:color("--accent"),clay:color("--mesh"),wire:wire&&!o.parent?.userData.brepBody,seed:(doc?.id||0)+":"+childPath(o,doc?.group).join("/")});});$("viewLabel").textContent="Perspective · "+DISPLAY_MODES[displayMode];}
function rebuildGrid(box){if(grid){scene.remove(grid);dispose(grid);}const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),extent=Math.max(size.x,size.y,size.z,1e-6),step=10**Math.floor(Math.log10(extent)),span=step*10;grid=new T.GridHelper(span,20,color("--grid-major"),color("--grid"));grid.position.set(center.x,box.min.y-extent*.02,center.z);grid.renderOrder=-100;grid.material.depthWrite=false;grid.visible=gridVisible;scene.add(grid);}
function fit(target=root){target.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(target);if(box.isEmpty())return;const s=box.getBoundingSphere(new T.Sphere()),r=Math.max(s.radius,1e-7),fov=camera.fov*Math.PI/180,half=Math.min(fov/2,Math.atan(Math.tan(fov/2)*camera.aspect)),distance=r/Math.sin(half)*1.2,dir=camera.position.clone().sub(controls.target).normalize();if(!dir.lengthSq())dir.set(1,.8,1).normalize();camera.position.copy(s.center).addScaledVector(dir,distance);controls.target.copy(s.center);controls.update();if(target===root)updateBounds();updateClip();}
function updateBounds(){const box=new T.Box3().setFromObject(root);if(box.isEmpty()){sceneSphere=null;if(grid){scene.remove(grid);dispose(grid);grid=null;}return;}sceneSphere=box.getBoundingSphere(new T.Sphere());rebuildGrid(box);}
function updateClip(){if(!sceneSphere)return;const r=Math.max(sceneSphere.radius,1e-8),d=sceneSphere.center.clone().sub(camera.position).dot(camera.getWorldDirection(new T.Vector3())),near=Math.max(r*.0005,d-r*1.5,1e-10),far=Math.max(near*2,d+r*8);if(camera.near!==near||camera.far!==far){camera.near=near;camera.far=far;camera.updateProjectionMatrix();}}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport);installResizers(document.querySelector("main"));resize();updateTheme();
renderer.setAnimationLoop(()=>{controls.update();updateClip();renderer.render(scene,camera);});
function el(tag,cls,txt){const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;}
function select(o){selected=o;refreshMaterials();renderTree();inspect();}
function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
function renderTree(){const q=$("search").value.trim().toLowerCase(),frag=document.createDocumentFragment();
 const matches=o=>!q||name(o).toLowerCase().includes(q)||kind(o).toLowerCase().includes(q)||(!o.userData.brepBody&&nodeChildren(o).some(matches));
 function add(o,depth){if(!matches(o))return;const children=o.userData.brepBody?[]:nodeChildren(o),row=el("div","tree-row"+(o===selected?" selected":""));row.style.paddingLeft=(5+depth*13)+"px";row.setAttribute("role","treeitem");row.setAttribute("aria-selected",String(o===selected));if(children.length)row.setAttribute("aria-expanded",String(!collapsed.has(o)||!!q));
 const arrow=el("button","arrow",children.length?(collapsed.has(o)&&!q?"▸":"▾"):"·");arrow.disabled=!children.length;arrow.title="Expand / collapse";arrow.onclick=()=>{if(collapsed.has(o))collapsed.delete(o);else collapsed.add(o);renderTree();};
 const label=el("button","name",(o.userData.brepBody?"◇ ":o.isMesh?"△ ":"□ ")+name(o));label.title=name(o);label.onclick=()=>select(o);label.ondblclick=()=>fit(o);
 const type=el("span","type",kind(o));const eye=el("button","visibility",o.visible?"◉":"○");eye.title=o.visible?"Hide":"Show";eye.setAttribute("aria-label",eye.title+" "+name(o));eye.onclick=()=>{o.visible=!o.visible;renderTree();inspect();};
 row.append(arrow,label,type,eye);frag.append(row);if(!collapsed.has(o)||q)children.forEach(c=>add(c,depth+1));}
 root.children.forEach(o=>add(o,0));tree.replaceChildren(frag);}
function inspect(){details.replaceChildren();if(!selected){const p=el("p",null,"Select an object to inspect it.");details.append(p);return;}const o=selected;details.append(el("h3",null,name(o)));let dl=el("dl");details.append(dl);
 const add=(k,v)=>{dl.append(el("dt",null,k),el("dd",null,String(v)));};
 add("Type",kind(o));const path=[];for(let p=o;p&&p!==root;p=p.parent)if(p.parent?.userData.document?.mode!=="brep")path.unshift(name(p));add("Viewer path","/"+path.join("/"));add("Visible",visible(o)?"Yes":"No");const doc=fileOf(o);add("Source file",doc?.name||"—");add("Source",doc?.mode==="brep"?"Exact BRep → tessellation":"USD render geometry");
 const box=new T.Box3().setFromObject(o);if(!box.isEmpty())add("Bounds (m)",box.getSize(new T.Vector3()).toArray().map(fmt).join(" × "));
 let vertices=0,triangles=0;o.traverse(x=>{if(x.isMesh){vertices+=x.geometry.attributes.position?.count||0;triangles+=(x.geometry.index?.count||x.geometry.attributes.position?.count||0)/3;}});
 add("Render vertices",fmt(vertices));add("Triangles",fmt(triangles));
 if(o.userData.brepBody){add("CAD faces",o.userData.faces);add("CAD edges",o.userData.edges);add("Volume (kernel units³)",fmt(o.userData.volume));add("Tolerance (kernel units)",fmt(o.userData.tolerance));}
 const materials=materialInfo(o);if(materials.length){details.append(el("hr"),el("h3",null,"Materials"));for(const m of materials){const row=el("div","material-entry");const head=el("div","material-heading");if(m.hex){const swatch=el("span","material-swatch");swatch.style.background=m.hex;head.append(swatch);}head.append(el("span",null,m.name||"Surface material"));row.append(head);const props=el("dl");for(const [key,value] of [["Base color",m.hex],["Roughness",m.roughness],["Metalness",m.metalness],["Opacity",m.opacity],["Textures",m.textures?.length?m.textures.join(", "):null],["Source",m.source]])if(value!=null){props.append(el("dt",null,key),el("dd",null,typeof value==="number"?fmt(value):value));}row.append(props);details.append(row);}}
 if(doc?.format==="USDA"){add("Stage up axis",doc.upAxis);add("Stage meters/unit",fmt(doc.units));}if(doc?.mode==="brep")add("Preview quality",doc.quality);
}
function summarize(){let count=0,triangles=0;root.traverse(o=>{if(o.isMesh){count++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;}});$("stats").textContent=documents.length+" files · "+count+" meshes · "+fmt(triangles)+" triangles · "+quality;}
function finish(message,frame=false){busy=false;updateEmpty();refreshMaterials();renderTree();inspect();summarize();updateBounds();if(frame)fit();status(message);}
function addBody(target,body){const g=new T.Group();g.name=body.name;g.userData={brepBody:true,kind:body.kind,faces:body.faces,edges:body.edges,volume:body.volume,tolerance:body.tolerance};const geo=new T.BufferGeometry();geo.setAttribute("position",new T.BufferAttribute(body.corners,3));if(body.normals)geo.setAttribute("normal",new T.BufferAttribute(body.normals,3));else geo.computeVertexNormals();const mesh=new T.Mesh(geo,material());if(body.color?.length>=3){mesh.material.color.setRGB(body.color[0],body.color[1],body.color[2],T.SRGBColorSpace);if(body.color.length>3&&body.color[3]<1){mesh.material.opacity=body.color[3];mesh.material.transparent=true;}}captureMaterials(mesh,body.color?"BRep body color":"Viewer default");g.add(mesh);
 const edgeGeo=new T.BufferGeometry();edgeGeo.setAttribute("position",new T.BufferAttribute(body.lines,3));const edge=new T.LineSegments(edgeGeo,new T.LineBasicMaterial({color:color("--grid-major")}));edge.userData.previewEdge=true;edge.visible=wire;g.add(edge);target.add(g);}
function buildBrep(doc,demo=false){
 return new Promise((resolve,reject)=>{
  const target=new T.Group();target.rotation.x=-Math.PI/2;
  let timer,done=false;
  function close(error){if(done)return;done=true;clearTimeout(timer);worker?.terminate();worker=null;if(error){dispose(target);reject(error);}else resolve(target);}
  function arm(ms){clearTimeout(timer);timer=setTimeout(()=>close(new Error("BRep worker timed out")),ms);}
  try{worker=new Worker(new URL("./brep.worker.js",import.meta.url),{type:"module"});arm(45000);}
  catch(e){close(e);return;}
  worker.onmessage=({data:m})=>{try{
   if(m.type==="ready"){arm(180000);status("Reconstructing "+doc.name+"…");worker.postMessage({demo,text:doc.text,quality});}
   else if(m.type==="source"){const bytes=new TextEncoder().encode(m.text).buffer;Object.assign(doc,detect(bytes),{bytes});}
   else if(m.type==="body"){arm(180000);addBody(target,m.body);status(doc.name+" · tessellating "+m.done+" / "+m.total);}
   else if(m.type==="done"){doc.quality=quality;close();}
   else if(m.type==="error")close(new Error(m.message));
  }catch(e){close(e);}};
  worker.onerror=e=>close(new Error(e.message||"BRep worker failed"));
  worker.onmessageerror=()=>close(new Error("Invalid worker response"));
 });
}
function buildMesh(doc){
 const manager=new T.LoadingManager();manager.setURLModifier(url=>/^(blob:|data:)/.test(url)?url:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=");
 const model=new USDLoader(manager).parse(doc.bytes);let count=0;
 model.traverse(o=>{if(!renderable(o))return;count++;if(!o.material)o.material=o.isMesh?material():o.isPoints?new T.PointsMaterial({color:color("--mesh"),size:.01}):new T.LineBasicMaterial({color:color("--mesh")});captureMaterials(o,"USD loader");});
 if(!count){dispose(model);throw new Error("No supported render geometry. Binary or packaged BRep-only stages require conversion to USDA.");}model.name=model.name||"Stage";return model;
}
function childPath(o,ancestor){const path=[];for(let p=o;p&&p!==ancestor;p=p.parent){if(!p.parent)return null;path.unshift(p.parent.children.indexOf(p));}return path;}
function atPath(o,path){return path?.reduce((p,i)=>p?.children[i],o)||null;}
async function replacePreview(doc,mode,demo=false){
 const model=mode==="brep"?await buildBrep(doc,demo):buildMesh(doc);
 const old=doc.group.children[0];const path=old&&fileOf(selected)===doc&&selected!==doc.group?childPath(selected,old):null;
 if(old){old.traverse(o=>{const n=doc.mode===mode?atPath(model,childPath(o,old)):null;if(n&&!o.userData.previewEdge)n.visible=o.visible;if(collapsed.delete(o)&&n)collapsed.add(n);});doc.group.remove(old);dispose(old);}
 // Every file has a stable explorer root, with an internal axis/scale group.
 // SMLib uses millimetres; Three USDLoader outputs metres.
 if(mode==="brep")model.scale.setScalar(.001);
 doc.group.add(model);doc.previousMode=doc.mode;doc.mode=mode;
 if(path)selected=old&&doc.previousMode===mode?(atPath(model,path)||doc.group):doc.group;
}
async function openFiles(files,demo=false){
 if(busy||(!files.length&&!demo))return;
 busy=true;updateEmpty();const errors=[];let added=0;
 for(const file of demo?[{name:"BRep demo.usda"}]:files){
  const doc={id:++nextDocumentId,name:file.name,group:new T.Group()};
  doc.group.name=doc.name;doc.group.userData={document:doc,kind:"File"};
  try{status("Reading "+doc.name+"…");
   if(!demo){const bytes=await file.arrayBuffer();Object.assign(doc,detect(bytes),{bytes});}
   await replacePreview(doc,demo||doc.brep?"brep":"mesh",demo);
   documents.push(doc);root.add(doc.group);added++;renderTree();summarize();
  }catch(e){dispose(doc.group);errors.push(doc.name+": "+e.message);console.error(e);}
 }
 finish(errors.length?added+" loaded; "+errors.join(" · "):added+" file(s) loaded",added>0);
 if(errors.length)status(errors.join(" · "));
}
async function setQuality(next){if(busy||quality===next)return;quality=next;busy=true;const errors=[];for(const doc of documents.filter(d=>d.mode==="brep")){try{await replacePreview(doc,"brep");}catch(e){errors.push(doc.name+": "+e.message);}}
 finish(errors.length?errors.join(" · "):"Tessellation: "+quality+" · BRep previews updated");}
async function changeMode(mode){const doc=fileOf(selected)||(documents.length===1?documents[0]:null);if(!doc||busy)return;busy=true;try{await replacePreview(doc,mode);finish(mode==="brep"?"Exact BRep preview":"Authored USD mesh preview");}catch(e){finish("Preview failed: "+e.message);}}
function closeDocument(){const doc=fileOf(selected);if(!doc||busy)return;root.remove(doc.group);dispose(doc.group);documents.splice(documents.indexOf(doc),1);doc.group.traverse(o=>collapsed.delete(o));selected=null;finish("Closed "+doc.name);}
function clearScene(){if(busy)return;for(const doc of documents){root.remove(doc.group);dispose(doc.group);}documents.length=0;collapsed.clear();selected=null;finish("Ready");}
function setDisplayMode(mode){displayMode=mode;refreshMaterials();inspect();status("View mode: "+DISPLAY_MODES[mode]);}
function toggleWire(){wire=!wire;refreshMaterials();status(wire?"Wire / CAD edges on":"Wire / CAD edges off");}
function toggleGrid(){gridVisible=!gridVisible;if(grid)grid.visible=gridVisible;status(gridVisible?"Grid visible":"Grid hidden");}
function demo(){openFiles([],true);}
$("file").onchange=e=>{const files=Array.from(e.target.files);e.target.value="";openFiles(files);};$("search").oninput=renderTree;
let down;renderer.domElement.addEventListener("pointerdown",e=>{down=[e.clientX,e.clientY];});renderer.domElement.addEventListener("pointerup",e=>{if(!down||e.button!==0||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const b=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);const candidates=[];root.traverse(o=>{if(o.isMesh&&visible(o))candidates.push(o);});const hit=ray.intersectObjects(candidates,false)[0]?.object;select(hit?.parent?.userData.brepBody?hit.parent:hit||null);});
window.addEventListener("dragover",e=>{if(e.dataTransfer.types.includes("Files")){e.preventDefault();document.body.classList.add("dragging");}});window.addEventListener("dragleave",e=>{if(!e.relatedTarget)document.body.classList.remove("dragging");});window.addEventListener("drop",e=>{e.preventDefault();document.body.classList.remove("dragging");openFiles(Array.from(e.dataTransfer.files));});
const activeDoc=()=>fileOf(selected)||(documents.length===1?documents[0]:null);
const commands=[
 {title:"Open USD files",key:"Ctrl+O",run:()=>$("file").click(),enabled:()=>!busy},
 {title:"Load mesh-free BRep demo",key:"",run:demo,enabled:()=>!busy},
 {title:"Close selected file",key:"Delete",run:closeDocument,enabled:()=>!busy&&!!fileOf(selected)},
 {title:"Clear scene",key:"",run:clearScene,enabled:()=>!busy&&documents.length>0},
 {title:"Preview exact BReps",key:"",run:()=>changeMode("brep"),enabled:()=>!busy&&activeDoc()?.brep},
 {title:"Preview authored USD meshes",key:"",run:()=>changeMode("mesh"),enabled:()=>!busy&&!!activeDoc()},
 {title:"Frame all",key:"F",run:()=>fit()},
 {title:"Frame selection",key:"Shift+F",run:()=>fit(selected),enabled:()=>!!selected},
 {title:"Toggle wire / CAD edges",key:"W",run:toggleWire,checked:()=>wire},
 {title:"Toggle grid",key:"G",run:toggleGrid,checked:()=>gridVisible},
 ...Object.entries(DISPLAY_MODES).map(([mode,label],i)=>({title:"View: "+label,key:String(i+4),run:()=>setDisplayMode(mode),checked:()=>displayMode===mode})),
 ...Object.keys(QUALITY).map((q,i)=>({title:"Tessellation: "+q[0].toUpperCase()+q.slice(1),key:String(i+1),run:()=>setQuality(q),enabled:()=>!busy,checked:()=>quality===q})),
 {title:"Show all objects",key:"",run:()=>{root.traverse(o=>{if(!o.userData.previewEdge)o.visible=true;});renderTree();inspect();}},
 {title:"Clear selection",key:"Esc",run:()=>select(null)}
];
const palette=$("palette"),commandSearch=$("commandSearch");
let activeIndex=0;
function renderCommands(){const q=commandSearch.value.toLowerCase();activeIndex=0;$("commandList").replaceChildren(...commands.filter(c=>(c.title+" "+c.key).toLowerCase().includes(q)&&(!c.enabled||c.enabled())).map(c=>{const b=el("button","command");b.append(el("span",null,(c.checked?.()?"✓ ":"")+c.title),el("kbd",null,c.key));b.onclick=()=>{palette.close();c.run();};return b;}));highlightCommand();}
function highlightCommand(){const buttons=[...$("commandList").querySelectorAll("button")];buttons.forEach((b,i)=>b.classList.toggle("active",i===activeIndex));buttons[activeIndex]?.scrollIntoView({block:"nearest"});}
function showCommands(){commandSearch.value="";renderCommands();if(!palette.open)palette.showModal();commandSearch.focus();}
$("commands").onclick=showCommands;commandSearch.oninput=renderCommands;commandSearch.onkeydown=e=>{const buttons=[...$("commandList").querySelectorAll("button")];if(e.key==="Enter"){e.preventDefault();buttons[activeIndex]?.click();}else if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();activeIndex=Math.max(0,Math.min(buttons.length-1,activeIndex+(e.key==="ArrowDown"?1:-1)));highlightCommand();}};
document.addEventListener("keydown",e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if(palette.open)palette.close();else showCommands();return;}
 if(palette.open||(!e.ctrlKey&&!e.metaKey&&e.target.matches?.("input,textarea,[contenteditable]")))return;
 const key=e.key.toLowerCase(),combo=(e.ctrlKey||e.metaKey?"ctrl+":e.shiftKey?"shift+":"")+(key==="escape"?"esc":key);
 const command=commands.find(c=>c.key.toLowerCase()===combo&&(!c.enabled||c.enabled()));
 if(command){e.preventDefault();command.run();}
});
