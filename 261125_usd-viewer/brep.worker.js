let engine;
const send=(type,fields={})=>self.postMessage({type,...fields});
const report=e=>send("error",{message:e?.stack||e?.message||String(e)});
self.addEventListener("unhandledrejection",e=>report(e.reason));
self.addEventListener("error",e=>report(e.error||e.message));
self.addEventListener("message",({data})=>{
 try{
  if(!engine)throw new Error("Kernel not initialized");
  const text=data.demo?engine.demoUsd():data.text;
  if(data.demo)send("source",{text});
  const count=engine.readBreps(text,(body,done,total)=>send("body",{body,done,total}));
  send("done",{count});
 }catch(e){report(e);}
});
(async()=>{try{engine=await import("./brep.js");send("ready");}catch(e){report(e);}})();
