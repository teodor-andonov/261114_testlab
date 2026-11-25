import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {EditorState,Compartment} from "@codemirror/state";
import {EditorView,lineNumbers,keymap,highlightActiveLine} from "@codemirror/view";
import {javascript} from "@codemirror/lang-javascript";
import {oneDark} from "@codemirror/theme-one-dark";
import {defaultKeymap,history,historyKeymap,indentWithTab} from "@codemirror/commands";
import {DEMOS} from "./examples.js";
import {parameterEdit} from "./param-source.js";
const $=id=>document.getElementById(id);
let fileName="box.js", dirty=false,fileHandle=null, revision=0,active=null,pending=null,worker=null,timer=null,fitNext=true,output=null,controlsKey="",workerReady=false,watchdog=null,phase="",modelReady=false,exportIntent=null,outputMesh=null,operation=0,previewHasEdges=false;
const theme=new Compartment();
const light=()=>document.documentElement.dataset.theme==="light";
function status(msg,error=false){$("status").textContent=msg;$("status").classList.toggle("error",error);}
const editor=new EditorView({parent:$("editor"),state:EditorState.create({doc:DEMOS[0].source,extensions:[lineNumbers(),highlightActiveLine(),history(),javascript(),theme.of(light()?[]:oneDark),keymap.of([indentWithTab,...defaultKeymap,...historyKeymap]),EditorView.updateListener.of(u=>{if(u.docChanged){dirty=true;label();schedule();}})]})});
window.addEventListener("testlab:themechange",()=>editor.dispatch({effects:theme.reconfigure(light()?[]:oneDark)}));
function label(){$("name").textContent=fileName+(dirty?" •":"");}
function source(){return editor.state.doc.toString();}
function invalidate(){revision++;modelReady=false;output=null;outputMesh=null;exportIntent=null;$("export").disabled=true;$("usda").textContent="USDA not generated for this revision. Select USDA or Export to generate it.";return revision;}
function schedule(immediate=false,qualityOnly=false){
 const rev=qualityOnly?revision:invalidate();
 if(qualityOnly){modelReady=false;$("export").disabled=true;}
 clearTimeout(timer);pending=null;
 if(active?.type==="preview")worker?.postMessage({type:"cancel",id:active.id});
 timer=setTimeout(()=>{pending={id:++operation,rev,type:"preview",source:source(),quality:$("quality").value,includeEdges:$("mode").value==="edges"};pump();},immediate?0:350);
}
const logs=[];
function log(message,level="info"){
  const prefix=new Date().toISOString().slice(11,23);
  const text="["+prefix+"] "+(level==="info"?"":level.toUpperCase()+" ")+String(message);
  logs.push(text);if(logs.length>400)logs.splice(0,logs.length-400);
  const el=$("engineLog");const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<30;
  el.textContent=logs.join("\n");if(nearBottom)el.scrollTop=el.scrollHeight;
}
function arm(message,ms){
  phase=message;clearTimeout(watchdog);
  watchdog=setTimeout(()=>failWorker("Timed out after "+Math.round(ms/1000)+" seconds: "+phase+". Run again to restart."),ms);
}
function stopWorker(){
  clearTimeout(watchdog);worker?.terminate();worker=null;workerReady=false;active=null;modelReady=false;
}
function failWorker(message){
  log(message,"error");stopWorker();pending=null;output=null;exportIntent=null;$("export").disabled=true;
  $("stats").textContent="Current model failed; viewport may show previous successful build.";
  status(String(message).split("\n")[0],true);$("logPanel").open=true;
}
function requestUsd(downloadFile=false){
 if(downloadFile&&!modelReady)return;
 const includeMesh=$("mesh").checked;
 if(output!==null&&outputMesh===includeMesh){if(downloadFile)download(output,fileName.replace(/\.js$/i,"")+".usda","text/plain");else $("usda").textContent=output;return;}
 exportIntent={download:downloadFile||Boolean(exportIntent?.download),includeMesh,rev:revision};
 pump();
}
function pump(){
 if(active)return;
 if(!pending&&exportIntent&&modelReady){
  const intent=exportIntent;exportIntent=null;
  pending={id:++operation,rev:revision,type:"export",source:source(),includeMesh:intent.includeMesh,download:intent.download,name:fileName};
 }
 if(!pending)return;
 if(!worker){makeWorker();return;}
 if(!workerReady)return;
 const task=pending;pending=null;active=task;
 status(task.type==="export"?"Generating USDA…":"Running model…");log((task.type==="export"?"USDA export #":"Build #")+task.id+" started");
 arm("starting "+task.type,60000);
 try{worker.postMessage(task);}catch(e){failWorker(e.stack||e.message);}
}
function makeWorker(){
 status("Initializing SMLib WASM…");log("Creating module Web Worker");
 workerReady=false;
 try{
  const instance=new Worker(new URL("./worker.js",import.meta.url),{type:"module"});worker=instance;
  arm("loading the SMLib WebAssembly kernel",45000);
  instance.onmessage=({data})=>{
   if(worker!==instance)return;
   if(data.type==="log"){log(data.message,data.level);return;}
   if(data.type==="fatal"){failWorker(data.error);return;}
   if(data.type==="ready"){workerReady=true;clearTimeout(watchdog);log("Kernel ready; accepting builds");pump();return;}
   if(active?.id!==data.id)return;
   const task=active, current=task.rev===revision && (task.type==="export"||task.quality===$("quality").value);
   if(data.type==="progress"){log("#"+data.id+" · "+data.message+" ("+data.elapsed+" ms)");arm(data.message,60000);if(current)status(data.message+"…");return;}
   if(data.type==="model"){
    if(current){try{renderParams(data.params);task.first=true;task.bounds=data.bounds;task.actualQuality=data.quality;$("stats").textContent="0 / "+data.count+" objects · "+data.quality;}catch(e){failWorker(e.message);}}
    return;
   }
   if(data.type==="preview"){
    if(current){try{
     if(task.first){clearView();if(fitNext){fitBounds(task.bounds);fitNext=false;}task.first=false;}
     appendMeshes(data.meshes);$("stats").textContent=data.done+" / "+data.total+" objects · "+task.actualQuality;
    }catch(e){failWorker(e.stack||e.message);}}
    return;
   }
   if(data.type!=="result")return;
   clearTimeout(watchdog);active=null;
   if(current&&!data.cancelled){
    if(data.error){log(data.error,"error");status(data.error,true);$("logPanel").open=true;if(task.type==="preview"){modelReady=false;$("export").disabled=true;$("stats").textContent="Preview incomplete; rebuild to export.";}}
    else if(task.type==="preview"){
     modelReady=true;previewHasEdges=data.includeEdges;$("export").disabled=false;
     $("stats").textContent=data.count+" objects · "+data.faces+" faces · "+data.triangles.toLocaleString()+" triangles · "+data.hits+" cached";
     status("Ready · "+data.quality+" preview"+(task.quality==="auto"?" (auto)":""));
     log("Build #"+data.id+" complete · "+data.elapsed+" ms | model "+Math.round(data.modelMs)+" | tessellation "+Math.round(data.tessMs)+" | preview prep "+Math.round(data.prepMs)+" | edges "+Math.round(data.edgeMs)+" | cache "+Math.round(data.cacheMs)+" | first object "+Math.round(data.firstMs)+" ms | "+data.triangles+" triangles | "+data.hits+"/"+data.count+" cache hits");
     // Export is requested only by an explicit inspection/download action.
    }else if(task.includeMesh===$("mesh").checked){
     output=data.usda;outputMesh=task.includeMesh;
     if(!$("usda").hidden)$("usda").textContent=output;
     status("Ready · USDA round-trip checked");log("USDA export complete ("+data.elapsed+" ms)");
     if(task.download)download(output,task.name.replace(/\.js$/i,"")+".usda","text/plain");
    }
   }else log("Discarded superseded build #"+data.id);
   pump();
  };
  instance.onerror=e=>{if(worker===instance)failWorker("WASM worker failed: "+(e.message||"module loading error")+(e.filename?" at "+e.filename+":"+e.lineno:""));};
  instance.onmessageerror=()=>{if(worker===instance)failWorker("Cannot deserialize the worker response");};
 }catch(e){failWorker(e.stack||e.message);}
}
$("clearLog").onclick=()=>{logs.length=0;$("engineLog").textContent="";};
$("copyLog").onclick=async()=>{try{await navigator.clipboard.writeText(logs.join("\n"));}catch{download(logs.join("\n"),"usd-studio-engine.log","text/plain");}};
$("stop").onclick=()=>{clearTimeout(timer);pending=null;stopWorker();invalidate();status("Build stopped · Run to restart");log("Worker stopped by user","warn");};
const scene=new THREE.Scene();scene.background=new THREE.Color(0x252b30);const camera=new THREE.PerspectiveCamera(42,1,.01,100000);camera.up.set(0,0,1);camera.position.set(110,-150,110);
const renderer=new THREE.WebGLRenderer({canvas:$("canvas"),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xffffff,0x53616a,2.2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(100,-80,160);scene.add(sun);
const grid=new THREE.GridHelper(200,20,0x5c6469,0x39434a);grid.rotation.x=Math.PI/2;scene.add(grid);const group=new THREE.Group();scene.add(group);
let framePending=false;
function requestRender(){if(framePending)return;framePending=true;requestAnimationFrame(()=>{framePending=false;controls.update();renderer.render(scene,camera);});}
controls.addEventListener("change",requestRender);
function resize(){const el=$("viewport");if(!el.clientWidth||!el.clientHeight)return;renderer.setSize(el.clientWidth,el.clientHeight,false);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();requestRender();}
new ResizeObserver(resize).observe($("viewport"));requestRender();
function fit(){const box=new THREE.Box3().setFromObject(group);if(box.isEmpty())return;fitBox(box);}
function fitBounds(b){if(b)fitBox(new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max)));}
function fitBox(box){const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length();const dir=camera.position.clone().sub(controls.target).normalize();if(!dir.length())dir.set(1,-1,1).normalize();const distance=Math.max(size,1)*1.5/Math.min(1,camera.aspect);controls.target.copy(center);camera.position.copy(center).addScaledVector(dir,distance);camera.near=Math.max(distance/10000,.001);camera.far=Math.max(distance*100,1000);camera.updateProjectionMatrix();controls.update();grid.scale.setScalar(Math.max(size/130,.01));grid.position.set(center.x,center.y,box.min.z-.01);requestRender();}
function mode(){const wantEdges=$("mode").value==="edges";for(const m of group.children){m.material.wireframe=$("mode").value==="wire";if(m.children[0])m.children[0].visible=wantEdges;}requestRender();if(wantEdges&&(pending?.type==="preview"?!pending.includeEdges:active?.type==="preview"?!active.includeEdges:!previewHasEdges))schedule(true,true);}
function clearView(){previewHasEdges=false;for(const m of [...group.children]){m.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});group.remove(m);}requestRender();}
function appendMeshes(meshes){const colors=[0xb3c1d0,0xc1ac91,0x9fbab2,0xb9aed0];for(const m of meshes){const i=m.index;const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(m.corners,3));if(m.normals)g.setAttribute("normal",new THREE.BufferAttribute(m.normals,3));else g.computeVertexNormals();const obj=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:Array.isArray(m.color)&&m.color.length===3?new THREE.Color().setRGB(...m.color,THREE.SRGBColorSpace):typeof m.color==="string"?m.color:colors[i%colors.length],roughness:.82,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));obj.name=m.name || "Object "+(i+1);if(m.lines?.length){const edgeGeometry=new THREE.BufferGeometry();edgeGeometry.setAttribute("position",new THREE.BufferAttribute(m.lines,3));const edgeObj=new THREE.LineSegments(edgeGeometry,new THREE.LineBasicMaterial({color:0x36434d}));edgeObj.visible=$("mode").value==="edges";obj.add(edgeObj);}group.add(obj);obj.material.wireframe=$("mode").value==="wire";}requestRender();}
function renderParams(params){const key=JSON.stringify(Object.keys(params).map(k=>[k,typeof params[k]]));if(key===controlsKey&&$("params").contains(document.activeElement))return;controlsKey=key;$("params").replaceChildren();for(const [name,value] of Object.entries(params)){const row=document.createElement("label");row.className="param";const title=document.createElement("span");title.textContent=name;row.append(title);const field=document.createElement("input");field.type=typeof value==="boolean"?"checkbox":typeof value==="number"?"number":"text";field.setAttribute("aria-label",name);if(field.type==="checkbox")field.checked=value;else field.value=value;
function edit(v){try{const e=parameterEdit(source(),name,v);editor.dispatch({changes:{from:e.from,to:e.to,insert:e.insert}});}catch(e){status(e.message,true);}}
if(field.type==="number"){field.step="any";const slider=document.createElement("input");slider.type="range";const a=Math.max(Math.abs(value),1);slider.min=value>=0?"0":String(value-a*2);slider.max=String(Math.max(10,value+a*2));slider.step=Number.isInteger(value)?"1":"0.1";slider.value=value;slider.setAttribute("aria-label",name+" slider");slider.oninput=()=>{field.value=slider.value;};slider.onchange=()=>edit(Number(slider.value));field.onchange=()=>{if(field.value.trim()&&Number.isFinite(Number(field.value))){slider.value=field.value;edit(Number(field.value));}};row.append(slider,field);}else{row.append(document.createElement("span"),field);field.onchange=()=>edit(field.type==="checkbox"?field.checked:field.value);} $("params").append(row);}if(!Object.keys(params).length)$("params").textContent="No literal defaultParams values.";}
function replace(s,name,handle=null){editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:s}});fileName=name;fileHandle=handle;dirty=false;label();fitNext=true;tab(false);schedule(true);}
function safeReplace(){return !dirty||confirm("Discard unsaved source changes?");}
async function open(){if(!safeReplace())return;try{if(window.showOpenFilePicker){const [h]=await showOpenFilePicker({types:[{description:"JavaScript",accept:{"text/javascript":[".js"]}}]});const f=await h.getFile();replace(await f.text(),f.name,h);}else $("open").click();}catch(e){if(e.name!=="AbortError")status(e.message,true);}}
$("open").onchange=async()=>{const f=$("open").files[0];if(f)replace(await f.text(),f.name);$("open").value="";};
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function save(as=false){try{if(as)fileHandle=null;if(!fileHandle&&window.showSaveFilePicker)fileHandle=await showSaveFilePicker({suggestedName:fileName,types:[{description:"JavaScript",accept:{"text/javascript":[".js"]}}]});if(fileHandle){const w=await fileHandle.createWritable();await w.write(source());await w.close();fileName=fileHandle.name;}else download(source(),fileName,"text/javascript");dirty=false;label();}catch(e){if(e.name!=="AbortError")status(e.message,true);}}
function exportUsd(){requestUsd(true);}
function tab(usd){$("editor").hidden=usd;$("usda").hidden=!usd;$("jsTab").setAttribute("aria-pressed",String(!usd));$("usdTab").setAttribute("aria-pressed",String(usd));if(!usd)editor.requestMeasure();else if(output!==null)$("usda").textContent=output;else requestUsd(false);}
const commands=[["New model",()=>{if(safeReplace())replace(DEMOS[0].source,"untitled.js");}],["Open JavaScript",open],["Save JavaScript",()=>save()],["Save as",()=>save(true)],["Run model",()=>schedule(true)],["Fit view",fit],["Inspect USDA",()=>tab(true)],["Export USDA",exportUsd],["Restart CAD worker",()=>{stopWorker();log("Restarting CAD worker");schedule(true);}],["Copy engine log",()=>$("copyLog").click()],["Clear engine log",()=>$("clearLog").click()],...DEMOS.map(d=>["Demo: "+d.name,()=>{if(safeReplace())replace(d.source,d.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+".js");}])];
function palette(){const p=$("palette");if(p.open)return;$("search").value="";renderCommands();p.showModal();$("search").focus();}
function renderCommands(){const q=$("search").value.toLowerCase();$("items").replaceChildren(...commands.filter(([n])=>n.toLowerCase().includes(q)).map(([n,fn])=>{const b=document.createElement("button");b.textContent=n;b.disabled=n==="Export USDA"&&!modelReady;b.onclick=()=>{$("palette").close();fn();};return b;}));}
$("search").oninput=renderCommands;$("search").onkeydown=e=>{if(e.key==="Enter")$("items").querySelector("button:not(:disabled)")?.click();};
$("commands").onclick=palette;$("run").onclick=()=>schedule(true);$("fit").onclick=fit;$("mode").onchange=mode;$("quality").onchange=()=>schedule(true,true);$("mesh").onchange=()=>{output=null;outputMesh=null;$("usda").textContent="USDA options changed; regenerate on demand.";};$("export").onclick=exportUsd;$("jsTab").onclick=()=>tab(false);$("usdTab").onclick=()=>tab(true);
window.addEventListener("keydown",e=>{if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==="k"){e.preventDefault();palette();}else if(e.key==="Enter"){e.preventDefault();schedule(true);}else if(e.key.toLowerCase()==="s"){e.preventDefault();save(e.shiftKey);}}});window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
label();schedule(true);
