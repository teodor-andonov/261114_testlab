import * as T from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {USDLoader} from "three/addons/loaders/USDLoader.js";
import {detect} from "./format.js";
const $=id=>document.getElementById(id), viewport=$("viewport"), tree=$("tree"), details=$("details");
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));viewport.prepend(renderer.domElement);
const scene=new T.Scene(), camera=new T.PerspectiveCamera(45,1,.001,1e8);
camera.position.set(5,4,6);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new T.HemisphereLight(0xffffff,0x777777,2.3));const light=new T.DirectionalLight(0xffffff,2.4);light.position.set(5,8,3);scene.add(light);
const rim=new T.DirectionalLight(0xffffff,.8);rim.position.set(-5,2,-5);scene.add(rim);
let root=new T.Group(),grid,selected=null,wire=false,worker=null,revision=0,current=null,mode="",collapsed=new Set(),busy=false;
scene.add(root);
const css=k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim();
const color=k=>new T.Color(css(k));
const status=s=>$("status").textContent=s;
const renderable=o=>o.isMesh||o.isLine||o.isPoints;
const nodeChildren=o=>o.children.filter(c=>!c.userData.previewEdge);
const name=o=>o.name||o.type;
const kind=o=>o.userData.kind||(o.isMesh?"Mesh":o.isPoints?"Points":o.isLine?"Curve":o.isGroup?"Group":o.type);
const fmt=n=>Number.isFinite(n)?Number(n.toPrecision(6)).toLocaleString("en-GB",{maximumFractionDigits:9}):"—";
function dispose(o){const geometries=new Set(),materials=new Set();o.traverse(x=>{if(x.geometry)geometries.add(x.geometry);for(const m of Array.isArray(x.material)?x.material:[x.material])if(m)materials.add(m)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
function reset(){worker?.terminate();worker=null;revision++;busy=false;scene.remove(root);dispose(root);if(grid){scene.remove(grid);dispose(grid);grid=null;}root=new T.Group();scene.add(root);selected=null;collapsed.clear();$("stats").textContent="";tree.replaceChildren();details.replaceChildren();$("empty").hidden=true;return revision;}
function fail(message){busy=false;worker?.terminate();worker=null;status(message);$("empty").hidden=false;$("empty").querySelector("strong").textContent="Unable to preview";$("empty").querySelector("span").textContent=message;}
function updateTheme(){scene.background=color("--view");if(grid){grid.material.color.set(color("--grid"));}refreshMaterials();}
window.addEventListener("testlab:themechange",updateTheme);
new MutationObserver(updateTheme).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function material(){return new T.MeshStandardMaterial({color:color("--mesh"),roughness:.78,metalness:0,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});}
function isSelected(o){for(let p=o;p;p=p.parent)if(p===selected)return true;return false;}
function refreshMaterials(){root.traverse(o=>{if(!renderable(o)||!o.material)return;const c=isSelected(o)?color("--accent"):color(o.userData.previewEdge?"--grid-major":"--mesh");for(const m of Array.isArray(o.material)?o.material:[o.material]){m.color?.copy(c);if(o.isMesh)m.wireframe=wire&&!o.parent?.userData.brepBody;}if(o.userData.previewEdge)o.visible=wire;});}
function rebuildGrid(box){if(grid){scene.remove(grid);dispose(grid);}const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),extent=Math.max(size.x,size.y,size.z,1e-6),step=10**Math.floor(Math.log10(extent)),span=step*10;grid=new T.GridHelper(span,20,color("--grid-major"),color("--grid"));grid.position.set(center.x,box.min.y-extent*.006,center.z);scene.add(grid);}
function fit(target=root){target.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(target);if(box.isEmpty())return;const s=box.getBoundingSphere(new T.Sphere()),r=Math.max(s.radius,1e-7),fov=camera.fov*Math.PI/180,half=Math.min(fov/2,Math.atan(Math.tan(fov/2)*camera.aspect)),distance=r/Math.sin(half)*1.2,dir=camera.position.clone().sub(controls.target).normalize();if(!dir.lengthSq())dir.set(1,.8,1).normalize();camera.position.copy(s.center).addScaledVector(dir,distance);controls.target.copy(s.center);camera.near=Math.max(r*1e-5,1e-10);camera.far=Math.max(distance+r*100,camera.near*1000);camera.updateProjectionMatrix();controls.update();if(target===root)rebuildGrid(box);}
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport);resize();updateTheme();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
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
 add("Type",kind(o));const path=[];for(let p=o;p&&p!==root;p=p.parent)path.unshift(name(p));add("Viewer path","/"+path.join("/"));add("Visible",visible(o)?"Yes":"No");add("Source",mode==="brep"?"Exact BRep → tessellation":"USD render geometry");
 const box=new T.Box3().setFromObject(o);if(!box.isEmpty())add("Bounds (view)",box.getSize(new T.Vector3()).toArray().map(fmt).join(" × "));
 let vertices=0,triangles=0;o.traverse(x=>{if(x.isMesh){vertices+=x.geometry.attributes.position?.count||0;triangles+=(x.geometry.index?.count||x.geometry.attributes.position?.count||0)/3;}});
 add("Render vertices",fmt(vertices));add("Triangles",fmt(triangles));
 if(o.userData.brepBody){add("CAD faces",o.userData.faces);add("CAD edges",o.userData.edges);add("Volume (kernel units³)",fmt(o.userData.volume));add("Tolerance (kernel units)",fmt(o.userData.tolerance));}
 if(current?.format==="USDA"){add("Stage up axis",current.upAxis);add("Stage meters/unit",fmt(current.units));}
}
function summarize(){let count=0,triangles=0;root.traverse(o=>{if(o.isMesh){count++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;}});$("stats").textContent=count+" meshes · "+fmt(triangles)+" triangles";}
function finish(message){busy=false;$("empty").hidden=true;renderTree();inspect();summarize();fit();status(message);}
function addBody(body){const g=new T.Group();g.name=body.name;g.userData={brepBody:true,kind:body.kind,faces:body.faces,edges:body.edges,volume:body.volume,tolerance:body.tolerance};const geo=new T.BufferGeometry();geo.setAttribute("position",new T.BufferAttribute(body.corners,3));if(body.normals)geo.setAttribute("normal",new T.BufferAttribute(body.normals,3));else geo.computeVertexNormals();g.add(new T.Mesh(geo,material()));
 const edgeGeo=new T.BufferGeometry();edgeGeo.setAttribute("position",new T.BufferAttribute(body.lines,3));const edge=new T.LineSegments(edgeGeo,new T.LineBasicMaterial({color:color("--grid-major")}));edge.userData.previewEdge=true;edge.visible=wire;g.add(edge);root.add(g);}
function startBrep(demo=false){const id=reset();mode="brep";busy=true;root.rotation.x=-Math.PI/2;status("Loading SMLib WASM…");worker=new Worker(new URL("./brep.worker.js",import.meta.url),{type:"module"});
 worker.onmessage=({data:m})=>{if(id!==revision)return;if(m.type==="source"){const b=new TextEncoder().encode(m.text).buffer;current={...detect(b),bytes:b,name:"BRep demo.usda"};}else if(m.type==="body"){addBody(m.body);if(m.done===1){fit();renderTree();}$("stats").textContent=m.done+" / "+m.total+" bodies";status("Tessellating BReps "+m.done+" / "+m.total);}else if(m.type==="done"){worker?.terminate();worker=null;refreshMaterials();finish(m.count+" exact bodies tessellated · BRep preview mode");}else if(m.type==="error"){reset();fail("BRep import failed: "+m.message);}};
 worker.onerror=e=>{if(id===revision){reset();fail("BRep worker failed: "+e.message);}};worker.postMessage(demo?{demo:true}:{text:current.text});}
function startMesh(){reset();mode="mesh";busy=true;status("Reading USD render geometry…");
 try{const manager=new T.LoadingManager();manager.setURLModifier(url=>/^(blob:|data:)/.test(url)?url:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=");const model=new USDLoader(manager).parse(current.bytes);let count=0;model.traverse(o=>{if(!renderable(o))return;count++;const old=Array.isArray(o.material)?o.material:[o.material];o.material=o.isMesh?material():o.isPoints?new T.PointsMaterial({color:color("--mesh"),size:.01}):new T.LineBasicMaterial({color:color("--mesh")});for(const m of old)m?.dispose();});
 if(!count){dispose(model);throw new Error("No supported render geometry. Binary or packaged BRep-only stages require conversion to USDA.");}model.name=model.name||"Stage";root.add(model);refreshMaterials();finish(current.format+" · authored render geometry"+(current.brep?" (BReps not displayed in this mode)":""));}catch(e){fail(e.message);}}
async function openFile(file){if(!file)return;const id=reset();current=null;$("fileName").textContent=file.name;status("Reading local file…");try{const bytes=await file.arrayBuffer();if(id!==revision)return;current={...detect(bytes),bytes,name:file.name};if(current.brep)startBrep();else startMesh();}catch(e){if(id===revision)fail(e.message);}}
function demo(){current=null;$("fileName").textContent="BRep demo.usda";startBrep(true);}
$("file").onchange=e=>{openFile(e.target.files[0]);e.target.value="";};$("open").onclick=()=>$("file").click();$("demo").onclick=demo;$("search").oninput=renderTree;
$("fit").onclick=()=>fit();$("wire").onclick=()=>{wire=!wire;$("wire").setAttribute("aria-pressed",String(wire));refreshMaterials();};
let down;renderer.domElement.addEventListener("pointerdown",e=>{down=[e.clientX,e.clientY];});renderer.domElement.addEventListener("pointerup",e=>{if(!down||e.button!==0||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const b=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);const candidates=[];root.traverse(o=>{if(o.isMesh&&visible(o))candidates.push(o);});const hit=ray.intersectObjects(candidates,false)[0]?.object;select(hit?.parent?.userData.brepBody?hit.parent:hit||null);});
window.addEventListener("dragover",e=>{if(e.dataTransfer.types.includes("Files")){e.preventDefault();document.body.classList.add("dragging");}});window.addEventListener("dragleave",e=>{if(!e.relatedTarget)document.body.classList.remove("dragging");});window.addEventListener("drop",e=>{e.preventDefault();document.body.classList.remove("dragging");openFile(e.dataTransfer.files[0]);});
const commands=[["Open USD file",()=>$("file").click()],["Load mesh-free BRep demo",demo],["Preview exact BReps",()=>startBrep(),()=>current?.brep&&!busy],["Preview authored USD meshes",startMesh,()=>current&&!busy],["Frame all",()=>fit()],["Frame selection",()=>fit(selected),()=>selected],["Toggle wire / CAD edges",()=>$("wire").click()],["Show all objects",()=>{root.traverse(o=>{if(!o.userData.previewEdge)o.visible=true;});renderTree();inspect();}],["Clear selection",()=>select(null)]];
const palette=$("palette"),commandSearch=$("commandSearch");function renderCommands(){const q=commandSearch.value.toLowerCase();$("commandList").replaceChildren(...commands.filter(([title,run,enabled])=>title.toLowerCase().includes(q)&&(!enabled||enabled())).map(([title,run])=>{const b=el("button",null,title);b.onclick=()=>{palette.close();run();};return b;}));}
function showCommands(){commandSearch.value="";renderCommands();if(!palette.open)palette.showModal();commandSearch.focus();}
$("commands").onclick=showCommands;commandSearch.oninput=renderCommands;commandSearch.onkeydown=e=>{if(e.key==="Enter")$("commandList").querySelector("button")?.click();};
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();showCommands();}else if(!palette.open&&!["INPUT","TEXTAREA"].includes(e.target.tagName)&&e.key.toLowerCase()==="f")fit();});
