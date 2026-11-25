import {readBreps,demoUsd} from "./brep.js";
self.onmessage=({data})=>{
 try{
  const text=data.demo?demoUsd():data.text;
  if(data.demo)self.postMessage({type:"source",text});
  const count=readBreps(text,(body,done,total)=>self.postMessage({type:"body",body,done,total},[body.corners.buffer,body.lines.buffer,...(body.normals?[body.normals.buffer]:[])]));
  self.postMessage({type:"done",count});
 }catch(e){self.postMessage({type:"error",message:e?.message||String(e)});}
};
