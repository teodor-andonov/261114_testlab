import { invariant, record, identifier } from '../src/core/json.js';
import { makeRegistry } from '../src/layouts/model.js';
import { makeContainer, makeContent, makeDocument } from '../src/core/model.js';
import { insertBlock } from '../src/core/operations.js';

function registerSmoke(registry){return registry.register("content",{id:"test-note",defaultData:{text:"",asset:null,target:null},defaultProperties:{tone:"plain"},properties:{tone:{type:"enum",options:["plain","accent"]}},validate({data,properties,path}){record(data,`${path}.data`);invariant(typeof data.text==="string",`${path}.data.text`,"expected text");for(const k of ["asset","target"])if(data[k]!==null)identifier(data[k],`${path}.data.${k}`);invariant(["plain","accent"].includes(properties.tone),`${path}.properties.tone`,"invalid tone")},references({data}){return {resources:data.asset===null?[]:[data.asset],blocks:data.target===null?[]:[data.target]}},remapReferences({data,properties},remap){return {data:{...data,target:data.target===null?null:remap(data.target)},properties}},renderPresentation({data}){return {tag:"p",text:data.text}},commands(ctx){return [{id:"test-note.append",run:()=>ctx.commit("Append text",p=>{p.data.text+="!"})}]}})}

function sequentialIds(prefix="id"){let n=0;return ()=>`${prefix}-${++n}`}

function sourceFixture(){const reg=registerSmoke(makeRegistry());const root=makeContainer({id:"root"});const doc=makeDocument({id:"sample",title:"Stage 01 source fixture",root});insertBlock(doc,reg,"root",makeContent(reg,"test-note",{id:"note",data:{text:"# Foundation",asset:null,target:null}}));insertBlock(doc,reg,"root",makeContainer({id:"nested",layout:{type:"grid",columns:2,rows:2,gap:8},extent:{x:{mode:"fixed",value:400},y:{mode:"fixed",value:300}}}));insertBlock(doc,reg,"nested",makeContent(reg,"test-note",{id:"second",data:{text:"Nested block",asset:null,target:"note"}}));return doc}

export { registerSmoke, sequentialIds, sourceFixture };
