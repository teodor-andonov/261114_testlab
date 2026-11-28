import { invariant, record, own, identifier, number, assertJson, copyJson, snapshot, freshId } from './json.js';
import { extent, defaultPlacement, placement } from '../layouts/model.js';
import { mimeType, ResourceStore } from '../resources/store.js';

function makeContainer({id=freshId(),common={},placement:pos=defaultPlacement(),layout={type:"flow",direction:"vertical",gap:8,padding:0},extent:dimensions={x:{mode:"fixed",value:800},y:{mode:"auto"}},appearance={},children=[]}={}){return copyJson({id,kind:"container",common,placement:pos,layout,extent:dimensions,appearance,children})}

function makeContent(registry,type,{id=freshId(),common={},placement:pos=defaultPlacement(),properties={},data}={}){const module=registry.require("content",type);return copyJson({id,kind:"content",type,common,placement:pos,properties,data:data===undefined?copyJson(module.defaultData):data})}

function makeDocument({id=freshId(),title="Untitled",metadata={},root,preset={view:"scroll",mode:"composition"},resources={}}={}){const r=copyJson(root??makeContainer());r.placement=null;return copyJson({format:"penbook",schemaVersion:1,id,title,metadata,root:r,preset,resources})}

function walk(root,visit,parent=null){visit(root,parent);if(root.kind==="container")for(const child of root.children)walk(child,visit,root)}

function indexBlocks(doc){const index=new Map();walk(doc.root,(block,parent)=>{invariant(!index.has(block.id),`block.${block.id}`,"duplicate block ID");index.set(block.id,{block,parent})});return index}

function effectiveProperties(registry,block){if(block.kind==="content")return snapshot({...registry.get("content",block.type)?.defaultProperties,...block.properties});return snapshot(block.appearance)}

function effectiveCommon(block){return snapshot({visible:true,locked:false,...block.common})}

function moduleReferences(module,block){if(!module?.references)return {resources:[],blocks:[]};const refs=module.references({data:block.data,properties:effectiveModuleProperties(module,block)})??{};record(refs,`${block.id}.references`);const result={resources:refs.resources??[],blocks:refs.blocks??[]};for(const [key,ids] of Object.entries(result)){invariant(Array.isArray(ids),`${block.id}.references.${key}`,"expected array");for(const id of ids)identifier(id,`${block.id}.references.${key}`)}return result}

function effectiveModuleProperties(module,block){return snapshot({...module.defaultProperties,...block.properties})}

function validateDocument(doc,registry,resources=new ResourceStore()){
  assertJson(doc);record(doc,"document");invariant(doc.format==="penbook","format","expected penbook");invariant(doc.schemaVersion===1,"schemaVersion","unsupported schema version");identifier(doc.id,"document.id");invariant(typeof doc.title==="string","title","expected text");record(doc.metadata,"metadata");if(own(doc.metadata,"tags"))invariant(Array.isArray(doc.metadata.tags)&&doc.metadata.tags.every(t=>typeof t==="string"),"metadata.tags","expected text tags");
  record(doc.preset,"preset");registry.require("view",doc.preset.view).validate?.(doc.preset,"preset");invariant(["composition","content"].includes(doc.preset.mode),"preset.mode","unsupported editing mode");record(doc.resources,"resources");
  for(const [id,meta] of Object.entries(doc.resources)){identifier(id,"resources.id");record(meta,`resources.${id}`);mimeType(meta.mime,`resources.${id}.mime`);number(meta.byteLength,`resources.${id}.byteLength`,{integer:true,min:0});const bytes=resources.info(id);invariant(bytes,`resources.${id}`,"missing binary payload");invariant(bytes.mime===meta.mime&&bytes.byteLength===meta.byteLength,`resources.${id}`,"binary metadata mismatch")}
  const ids=new Set(),references=[],diagnostics=[];
  function block(b,p,parent){record(b,p);identifier(b.id,`${p}.id`);invariant(!ids.has(b.id),`${p}.id`,`duplicate ID ${b.id}`);ids.add(b.id);record(b.common,`${p}.common`);if(own(b.common,"name"))invariant(typeof b.common.name==="string",`${p}.common.name`,"expected text");for(const key of ["visible","locked"])if(own(b.common,key))invariant(typeof b.common[key]==="boolean",`${p}.common.${key}`,"expected boolean");
    if(parent){placement(b.placement,`${p}.placement`,registry);registry.require("layout",parent.layout.type).validateChild(parent,b,`${p}.placement`)}else invariant(b.placement===null,`${p}.placement`,"root has no parent placement");
    if(b.kind==="container"){invariant(!own(b,"type")&&!own(b,"data")&&!own(b,"properties"),p,"container cannot own atomic content fields");record(b.layout,`${p}.layout`);const layout=registry.require("layout",b.layout.type);layout.validate(b.layout,`${p}.layout`);extent(b.extent,`${p}.extent`);if(["x","y"].some(k=>b.extent[k].mode==="unbounded"))invariant(b.layout.type==="freeform",`${p}.extent`,"unbounded extent requires freeform");record(b.appearance,`${p}.appearance`);if(own(b.appearance,"clip"))invariant(typeof b.appearance.clip==="boolean",`${p}.appearance.clip`,"expected boolean");for(const key of ["background","border"])if(own(b.appearance,key))invariant(typeof b.appearance[key]==="string",`${p}.appearance.${key}`,"expected CSS string");invariant(Array.isArray(b.children),`${p}.children`,"expected children array");b.children.forEach((c,i)=>block(c,`${p}.children[${i}]`,b))}
    else if(b.kind==="content"){invariant(!["children","layout","extent","appearance"].some(key=>own(b,key)),p,"atomic content cannot own composition children or container fields");identifier(b.type,`${p}.type`);record(b.properties,`${p}.properties`);invariant(own(b,"data"),`${p}.data`,"missing payload");const module=registry.get("content",b.type);if(module){module.validate({data:b.data,properties:effectiveModuleProperties(module,b),path:p});references.push({id:b.id,...moduleReferences(module,b)})}else diagnostics.push({code:"unsupported-content",blockId:b.id,type:b.type,message:`Unsupported content type: ${b.type}`})}
    else throw new Error(`${p}.kind: unsupported block kind`);
  }
  invariant(doc.root?.kind==="container","root","root must be a container");block(doc.root,"root",null);
  for(const refs of references){for(const id of refs.resources)invariant(own(doc.resources,id),`block.${refs.id}.resources.${id}`,"missing resource reference");for(const id of refs.blocks)invariant(ids.has(id),`block.${refs.id}.blocks.${id}`,"missing block reference")}
  return diagnostics
}

export { makeContainer, makeContent, makeDocument, walk, indexBlocks, effectiveProperties, effectiveCommon, moduleReferences, effectiveModuleProperties, validateDocument };
