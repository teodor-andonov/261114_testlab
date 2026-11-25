import {PreviewCache} from "./preview-cache.js";
import {resolveQuality} from "./preview.js";
// Install diagnostics before starting the asynchronous WASM module import.
let engine, currentId = null;
const send = (type, fields={}) => self.postMessage({type,id:currentId,...fields});
const detail = value => {
  if(value instanceof Error) return value.stack || value.message;
  if(typeof value === "string") return value;
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
};
const log = (message,level="info") => send("log",{message,level});
for(const level of ["log","info","warn","error","debug"]){
  const original=console[level].bind(console);
  console[level]=(...args)=>{original(...args);log(args.map(detail).join(" "),level);};
}
self.addEventListener("unhandledrejection",e=>send("fatal",{error:detail(e.reason)}));
self.addEventListener("error",e=>send("fatal",{error:e.message||"Worker runtime error"}));
let retained=null,retainedSource=null,busy=false,cancelled=false,fingerprints=new WeakMap(),edgeCache=new WeakMap();
const cache=new PreviewCache();
const tick=()=>new Promise(r=>setTimeout(r,0));
self.onmessage=async({data})=>{
 if(data.type==="cancel"){if(currentId===data.id)cancelled=true;return;}
 if(busy){send("fatal",{error:"Worker received overlapping operations"});return;}
 currentId=data.id;busy=true;cancelled=false;
 const started=performance.now(),progress=message=>send("progress",{message,elapsed:Math.round(performance.now()-started)});
 try{
  if(!engine)throw new Error("Kernel not initialized");
  if(data.type==="export"){
   if(!retained||retainedSource!==data.source)throw new Error("Rebuild current source before exporting");
   const result=engine.checkedExport(retained.shapes,data.includeMesh,progress);
   send("result",{operation:"export",...result,elapsed:Math.round(performance.now()-started)});
   return;
  }
  if(retainedSource!==data.source||!retained){
   const next=engine.evaluate(data.source,progress);
   engine.disposeModel(retained);retained=next;retainedSource=data.source;fingerprints=new WeakMap();edgeCache=new WeakMap();
  }else progress("Reusing existing exact BRep model");
  const modelMs=performance.now()-started;
  const {shapes,params}=retained,quality=resolveQuality(data.quality,shapes.length);
  retained.bounds??=engine.boundsFor(shapes);
  send("model",{params,count:shapes.length,bounds:retained.bounds,quality});
  let hits=0,triangles=0,faces=0,edges=0,tessMs=0,prepMs=0,cacheMs=0,edgeMs=0,batch=[],firstMs=null;
  for(let i=0;i<shapes.length;i++){
   if(cancelled){send("result",{operation:"preview",cancelled:true});return;}
   const shape=shapes[i],t=performance.now();let bytes=fingerprints.get(shape);
   if(!bytes){bytes=engine.fingerprint(shape);fingerprints.set(shape,bytes);}
   let mesh=cache.get(bytes,quality);
   cacheMs+=performance.now()-t;
   if(mesh)hits++;
   else{const m=engine.meshShape(shape,quality,false);tessMs+=m.tessMs;prepMs+=m.prepMs;
    mesh={corners:m.corners,normals:m.normals,triangles:m.indices.length/3,faces:m.faces};
    const c=performance.now();cache.put(bytes,quality,mesh);cacheMs+=performance.now()-c;}
   let edgeData=null;
   if(data.includeEdges){const c=performance.now();let perShape=edgeCache.get(shape);if(!perShape){perShape=new Map();edgeCache.set(shape,perShape);}edgeData=perShape.get(quality);if(!edgeData){edgeData=engine.sampleEdges(shape,quality);perShape.set(quality,edgeData);}edgeMs+=performance.now()-c;}
   triangles+=mesh.triangles;faces+=mesh.faces;edges+=edgeData?.edges||0;
   // Cache only viewport attributes; edge sampling is optional and independent.
   batch.push({corners:mesh.corners,normals:mesh.normals,lines:edgeData?.lines||null,...engine.metadata(shape),index:i});
   if(i===0||batch.length>=8||i===shapes.length-1){
    if(firstMs===null)firstMs=performance.now()-started;
    send("preview",{meshes:batch,done:i+1,total:shapes.length});batch=[];
    progress("Tessellating "+(i+1)+"/"+shapes.length+" · "+hits+" cached · "+triangles+" triangles");
    await tick();
   }
  }
  send("result",{operation:"preview",count:shapes.length,quality,includeEdges:data.includeEdges,faces,edges,triangles,hits,modelMs,tessMs,prepMs,cacheMs,edgeMs,firstMs,elapsed:Math.round(performance.now()-started)});
 }catch(error){log(detail(error),"error");send("result",{error:String(error?.message||error)});}
 finally{currentId=null;busy=false;}
};
(async()=>{
  try{
    log("Worker started; loading SMLib WebAssembly module");
    const start=performance.now();
    engine=await import("./model.js");
    engine.installWarnings(message=>log(message,"warn"));
    log("SMLib WASM initialized in "+Math.round(performance.now()-start)+" ms");
    send("ready");
  }catch(error){send("fatal",{error:detail(error)});}
})();
