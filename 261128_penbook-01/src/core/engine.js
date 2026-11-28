import { invariant, own, copyJson, snapshot, number, freshId, uniqueId } from './json.js';
import { Registry } from './registry.js';
import { ResourceStore, ObjectUrlPool } from '../resources/store.js';
import { indexBlocks, makeContent, makeContainer, validateDocument, effectiveProperties, effectiveCommon, effectiveModuleProperties } from './model.js';
import { getBlock, insertBlock, removeBlock, reparentBlock, duplicateBlock } from './operations.js';

class Transaction{
  #draft;#store;#registry;#factory;#active=true;
  constructor(doc,store,registry,factory){this.#draft=copyJson(doc);this.#store=store;this.#registry=registry;this.#factory=factory}
  #check(){invariant(this.#active,"transaction","transaction has ended")}
  get draft(){this.#check();return this.#draft}
  replaceSource(doc){this.#check();this.#draft=copyJson(doc)}
  block(id){return getBlock(this.draft,id).block}
  add(parentId,block,index){return insertBlock(this.draft,this.#registry,parentId,block,index)}
  addContent(parentId,type,options={},index){const id=options.id??uniqueId(this.#factory,new Set(indexBlocks(this.draft).keys()));return this.add(parentId,makeContent(this.#registry,type,{...options,id}),index)}
  addContainer(parentId,options={},index){const id=options.id??uniqueId(this.#factory,new Set(indexBlocks(this.draft).keys()));return this.add(parentId,makeContainer({...options,id}),index)}
  remove(id){return removeBlock(this.draft,id)}
  move(id,parentId,index,options){return reparentBlock(this.draft,this.#registry,id,parentId,index,options)}
  duplicate(id,options={}){return duplicateBlock(this.draft,this.#registry,id,{...options,idFactory:this.#factory})}
  importResource(input,mime,options){this.#check();const {id,mime:kind,byteLength}=this.#store.put(input,mime,options);this.#draft.resources[id]={mime:kind,byteLength};return id}
  removeResource(id){this.#check();invariant(own(this.#draft.resources,id),`resources.${id}`,"not in document");delete this.#draft.resources[id]}
  close(){this.#active=false}
}

class Engine{
  #registry;#store;#factory;#current;#past=[];#future=[];#saved;#known=new WeakSet();#busy=false;#disposed=false;#limit;#urls;
  constructor({document,registry,resources=new ResourceStore(),idFactory=freshId,historyLimit=100,urlPlatform}){
    invariant(registry instanceof Registry,"engine.registry","expected Registry");this.#registry=registry;this.#store=resources.fork();this.#factory=idFactory;this.#limit=number(historyLimit,"historyLimit",{integer:true,min:1,max:10000});this.#current=this.#prepare(document,this.#store);this.#saved=this.#current.document;this.#known.add(this.#saved);registry.seal();this.#urls=new ObjectUrlPool(id=>({bytes:this.readResource(id),mime:this.resourceInfo(id).mime}),urlPlatform)
  }
  #prepare(doc,store){const value=snapshot(doc);return Object.freeze({document:value,diagnostics:snapshot(validateDocument(value,this.#registry,store))})}
  #check(){invariant(!this.#disposed,"engine","disposed");invariant(!this.#busy,"engine","nested transaction or history mutation")}
  get document(){return this.#current.document}
  get diagnostics(){return this.#current.diagnostics}
  get dirty(){return this.document!==this.#saved}
  get canUndo(){return this.#past.length>0}
  get canRedo(){return this.#future.length>0}
  get undoLabel(){return this.#past.at(-1)?.label}
  get redoLabel(){return this.#future.at(-1)?.label}
  get resourceCount(){return this.#store.count}
  block(id){return getBlock(this.document,id).block}
  properties(id){return effectiveProperties(this.#registry,this.block(id))}
  common(id){return effectiveCommon(this.block(id))}
  resourceInfo(id){invariant(own(this.document.resources,id),`resources.${id}`,"not in current document");return this.#store.info(id)}
  readResource(id){this.resourceInfo(id);return this.#store.read(id)}
  acquireResourceUrl(id){invariant(!this.#disposed,"engine","disposed");this.resourceInfo(id);return this.#urls.acquire(id)}
  transact(label,change){this.#check();invariant(typeof label==="string"&&label.trim()&&typeof change==="function","transaction","label and synchronous callback required");this.#busy=true;let tx;try{const store=this.#store.fork();tx=new Transaction(this.document,store,this.#registry,this.#factory);const result=change(tx);if(result&&typeof result.then==="function"){result.catch?.(()=>{});throw new Error("transaction: asynchronous callbacks are not supported")}const next=this.#prepare(tx.draft,store);invariant(next.document.id===this.document.id,"document.id","identity cannot change in an edit");if(JSON.stringify(next.document)===JSON.stringify(this.document))return {changed:false,value:result,document:this.document};this.#past.push({label,state:this.#current});if(this.#past.length>this.#limit)this.#past.shift();this.#future=[];this.#current=next;this.#store=store;this.#known.add(next.document);return {changed:true,value:result,document:next.document}}finally{tx?.close();this.#busy=false}}
  undo(){this.#check();const item=this.#past.pop();if(!item)return false;this.#future.push({label:item.label,state:this.#current});this.#current=item.state;return true}
  redo(){this.#check();const item=this.#future.pop();if(!item)return false;this.#past.push({label:item.label,state:this.#current});this.#current=item.state;return true}
  markSaved(doc=this.document){this.#check();invariant(this.#known.has(doc),"save","expected a snapshot from this engine");this.#saved=doc}
  context(id){const initial=this.block(id);invariant(initial.kind==="content",`block.${id}`,"content context requires atomic block");const module=this.#registry.require("content",initial.type),engine=this;function current(){const b=engine.block(id);invariant(b.kind==="content"&&b.type===module.id,`block.${id}`,"content context is stale");return b}return Object.freeze({id,type:module.id,get data(){return current().data},get properties(){return effectiveModuleProperties(module,current())},get storedProperties(){return current().properties},resourceInfo:rid=>engine.resourceInfo(rid),readResource:rid=>engine.readResource(rid),acquireResourceUrl:rid=>engine.acquireResourceUrl(rid),commit(label,edit){current();invariant(typeof edit==="function","module.commit","expected callback");return engine.transact(label,tx=>{const block=tx.block(id),payload=copyJson({data:block.data,properties:block.properties});const result=edit(payload,{importResource:(...args)=>tx.importResource(...args)});if(result&&typeof result.then==="function")return result;block.data=payload.data;block.properties=payload.properties;return result})}})}
  dispose(){this.#check();this.#disposed=true;this.#urls.dispose();this.#past=[];this.#future=[];this.#store=new ResourceStore({idFactory:this.#factory})}
}

export { Transaction, Engine };
