import test from "node:test";
import assert from "node:assert/strict";
import {decodeMayaBinary} from "../maya-binary.js";
import {parseMayaAscii} from "../maya-parser.js";
import {applyMayaAppearance} from "../maya-appearance.js";
const z=s=>Buffer.from(s+"\0");
const n=v=>{const b=Buffer.alloc(4);b.writeUInt32BE(v>>>0);return b;};
const f=v=>{const b=Buffer.alloc(4);b.writeFloatBE(v);return b;};
const d=v=>{const b=Buffer.alloc(8);b.writeDoubleBE(v);return b;};
const arr=(a,fn=n)=>Buffer.concat([n(a.length),...a.map(fn)]);
function chunk(tag,body,wide=true,align=8){
  const h=Buffer.alloc(wide?16:8);h.write(tag);if(wide)h.writeBigUInt64BE(BigInt(body.length),8);else h.writeUInt32BE(body.length,4);
  return Buffer.concat([h,body,Buffer.alloc((align-body.length%align)%align)]);
}
function fixture(wide){
  const c=(t,b)=>chunk(t,b,wide,wide?8:4);
  const g=(name,...children)=>chunk(wide?"FOR8":"FOR4",Buffer.concat([Buffer.from(name),...children]),wide,4);
  const node=(name,parent="")=>c("CREA",Buffer.concat([Buffer.from([4]),z(name),...(parent?[z(parent)]:[]),Buffer.alloc(16)]));
  const m=Buffer.concat([z("o"),Buffer.from([0x20]),arr([0,0,0,1,0,0,1,1,0,0,1,0],f),arr([0,1,1,2,2,3,3,0]),arr([0,1,2,0x60000003])]);
  const attr=(name,values,tag="DBL3",fn=d)=>c(tag,Buffer.concat([z(name),Buffer.from([0x20]),...values.map(fn)]));
  const conn=(a,b)=>c("CWFL",Buffer.concat([Buffer.from([0]),z(a),z(b)]));
  return g("Maya",g("HEAD",c("LUNI",Buffer.from("cm"))),g("XFRM",node("Panel"),attr("t",[2,0,0])),g("DMSH",node("PanelShape","Panel"),c("MESH",m)),g("RLAM",node("Paint"),attr("c",[0.25,0.5,0.75],"FLT3",f),attr("it",[0.2,0.2,0.2],"FLT3",f)),g("SHAD",node("PaintSG")),g("CONN",conn("Paint.oc","PaintSG.ss"),conn("PanelShape.iog","PaintSG.dsm")));
}
for(const wide of [false,true])test((wide?"FOR8":"FOR4")+" static mesh, transform and material",()=>{
  const r=decodeMayaBinary(fixture(wide));
  assert.equal(r.decodedMeshes,1);
  const p=applyMayaAppearance(parseMayaAscii(r.source,{upAxis:"z"}),r.source);
  assert.equal(p.objects.length,1);
  assert.deepEqual(p.objects[0].vertices[0],[2,0,0]);
  assert.equal(p.objects[0].faces.length,1);
  assert.equal(p.objects[0].materialName,"Paint");
  assert.deepEqual(p.objects[0].materialColor,{r:64,g:128,b:191});
  assert.ok(Math.abs(p.objects[0].materialProperties.opacity-0.8)<1e-6);
});
test("rejects truncated binary data",()=>assert.throws(()=>decodeMayaBinary(fixture(true).subarray(0,40)),/bounds/));
test("rejects non-Maya data",()=>assert.throws(()=>decodeMayaBinary(Buffer.from("not a file")),/IFF/));
