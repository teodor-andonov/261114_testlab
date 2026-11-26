import {decodeMayaBinary} from "./maya-binary.js";
import {parseMayaAscii} from "./maya-parser.js";
import {applyMayaAppearance} from "./maya-appearance.js";
self.onmessage=async ({data})=>{
  try{
    const binary=data.file.name.toLowerCase().endsWith(".mb");
    const result=binary?decodeMayaBinary(await data.file.arrayBuffer()):{source:await data.file.text(),warnings:[]};
    const parsed=applyMayaAppearance(parseMayaAscii(result.source,{upAxis:data.axis}),result.source);
    parsed.warnings.unshift(...result.warnings);
    self.postMessage({parsed,axis:data.axis});
  }catch(error){self.postMessage({error:error.message||String(error)});}
};
