import { invariant, identifier, freshId, uniqueId } from '../core/json.js';

function mimeType(value,path="mime"){invariant(typeof value==="string"&&/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(value),path,"expected lowercase MIME type without parameters");return value}

function bytesCopy(input){if(input instanceof ArrayBuffer)return new Uint8Array(input.slice(0));if(ArrayBuffer.isView(input))return new Uint8Array(input.buffer,input.byteOffset,input.byteLength).slice();throw new Error("resource: expected ArrayBuffer or typed array")}

function byteHash(bytes){let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return h>>>0}

function sameBytes(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i])}

class ResourceStore{
  #entries=new Map();
  #factory;
  constructor({idFactory=freshId}={}){this.#factory=idFactory}
  fork(){const next=new ResourceStore({idFactory:this.#factory});next.#entries=new Map(this.#entries);return next}
  has(id){return this.#entries.has(id)}
  info(id){return this.#entries.get(id)?.info}
  read(id){const entry=this.#entries.get(id);invariant(entry,`resources.${id}`,"missing binary resource");return entry.bytes.slice()}
  put(input,mime,{id}={}){mime=mimeType(mime);const bytes=bytesCopy(input),hash=byteHash(bytes);if(id!==undefined){identifier(id,"resource.id");const old=this.#entries.get(id);if(old){invariant(old.info.mime===mime&&old.hash===hash&&sameBytes(old.bytes,bytes),`resources.${id}`,"cannot replace immutable resource bytes");return old.info}}else{for(const entry of this.#entries.values()){if(entry.info.mime===mime&&entry.hash===hash&&sameBytes(entry.bytes,bytes))return entry.info}id=uniqueId(this.#factory,new Set(this.#entries.keys()),"resource.id")}const info=Object.freeze({id,mime,byteLength:bytes.byteLength});this.#entries.set(id,{info,bytes,hash});return info}
  get count(){return this.#entries.size}
}

class ObjectUrlPool{
  #read;#platform;#entries=new Map();#disposed=false;
  constructor(read,platform={create:(bytes,mime)=>URL.createObjectURL(new Blob([bytes],{type:mime})),revoke:url=>URL.revokeObjectURL(url)}){this.#read=read;this.#platform=platform}
  acquire(id){invariant(!this.#disposed,"resource URL","pool disposed");let e=this.#entries.get(id);if(!e){const {bytes,mime}=this.#read(id);e={url:this.#platform.create(bytes,mime),count:0};this.#entries.set(id,e)}e.count++;let released=false;return Object.freeze({url:e.url,release:()=>{if(released)return;released=true;if(this.#entries.get(id)!==e)return;if(--e.count===0){this.#entries.delete(id);this.#platform.revoke(e.url)}}})}
  dispose(){this.#disposed=true;for(const e of this.#entries.values())this.#platform.revoke(e.url);this.#entries.clear()}
}

export { mimeType, bytesCopy, byteHash, sameBytes, ResourceStore, ObjectUrlPool };
