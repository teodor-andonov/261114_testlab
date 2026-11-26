import {decodeMayaBinary} from "./maya-binary.js";
import {parseMayaAscii} from "./maya-parser.js";
import {applyMayaAppearance} from "./maya-appearance.js";
self.onmessage=async ({data})=>{
  try{
    const binary=data.file.name.toLowerCase().endsWith(".mb");
    self.postMessage({stage:binary?"Reading binary file…":"Reading ASCII file…"});
    const result=binary?decodeMayaBinary(await data.file.arrayBuffer()):{source:await data.file.text(),warnings:[]};
    self.postMessage({stage:"Parsing geometry and materials…"});
    const parsed=applyMayaAppearance(parseMayaAscii(result.source,{upAxis:data.axis}),result.source);
    parsed.warnings.unshift(...result.warnings);
    if(binary&&result.decodedMeshes&&!parsed.objects.length)parsed.warnings.push("Decoded mesh records exist, but no visible static polygon mesh could be assembled. Intermediate/deformed meshes and history-only output are not evaluated.");
    self.postMessage({parsed,axis:data.axis});
  }catch(error){self.postMessage({error:error.message||String(error)});}
};
