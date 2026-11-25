// Inspect bytes, not the extension. Never treat a mesh as exact BRep.
export function detect(bytes){
 const prefix=new TextDecoder().decode(new Uint8Array(bytes,0,Math.min(16,bytes.byteLength)));
 if(prefix.startsWith("PXR-USDC"))return {format:"USDC"};
 if(prefix.startsWith("PK\u0003\u0004"))return {format:"USDZ"};
 const text=new TextDecoder().decode(bytes);
 if(!/^\s*#usda\b/.test(text))throw new Error("Not a recognized USD layer or USDZ archive.");
 return {format:"USDA",text,brep:/\b(?:def|over|class)\s+BrepArray\s+"/.test(text),upAxis:/\bupAxis\s*=\s*"Z"/.test(text)?"Z":"Y",units:Number(text.match(/\bmetersPerUnit\s*=\s*([\d.eE+-]+)/)?.[1]??0.01)};
}
