

function invariant(ok,path,message){if(!ok)throw new Error(`${path}: ${message}`)}

function record(value,path){invariant(value!==null&&typeof value==="object"&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null),path,"expected a plain object");return value}

function own(obj,key){return Object.hasOwn(obj,key)}

function identifier(value,path){invariant(typeof value==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value)&&!["constructor","prototype","__proto__"].includes(value),path,"invalid identifier");return value}

function number(value,path,{integer=false,min=-Infinity,max=Infinity}={}){invariant(typeof value==="number"&&Number.isFinite(value)&&(!integer||Number.isSafeInteger(value))&&value>=min&&value<=max,path,"invalid numeric value");return value}

function assertJson(value,path="$",seen=new Set(),depth=0){invariant(depth<=160,path,"JSON nesting limit exceeded");if(value===null||typeof value==="string"||typeof value==="boolean")return;if(typeof value==="number"){number(value,path);return}invariant(typeof value==="object",path,"not JSON data");invariant(!seen.has(value),path,"cyclic or shared object; JSON must be a tree");seen.add(value);if(Array.isArray(value)){invariant(Reflect.ownKeys(value).length===value.length+1,path,"sparse or decorated array");for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));invariant(d&&"value" in d&&d.enumerable,`${path}[${i}]`,"invalid array entry");assertJson(d.value,`${path}[${i}]`,seen,depth+1)}return}record(value,path);for(const key of Reflect.ownKeys(value)){invariant(typeof key==="string"&&!["__proto__","constructor","prototype"].includes(key),path,"unsafe or non-string key");const d=Object.getOwnPropertyDescriptor(value,key);invariant(d.enumerable&&"value" in d,`${path}.${key}`,"expected enumerable data property");assertJson(d.value,`${path}.${key}`,seen,depth+1)}}

function copyJson(value){assertJson(value);return JSON.parse(JSON.stringify(value))}

function freezeJson(value){if(value!==null&&typeof value==="object"&&!Object.isFrozen(value)){for(const item of Object.values(value))freezeJson(item);Object.freeze(value)}return value}

function snapshot(value){return freezeJson(copyJson(value))}

function freshId(){invariant(typeof globalThis.crypto?.randomUUID==="function","id","crypto.randomUUID unavailable; supply an ID factory");return globalThis.crypto.randomUUID()}

function uniqueId(factory,used,path="id"){for(let i=0;i<128;i++){const id=identifier(factory(),path);if(!used.has(id)){used.add(id);return id}}throw new Error(`${path}: ID factory exhausted collision retries`)}

export { invariant, record, own, identifier, number, assertJson, copyJson, freezeJson, snapshot, freshId, uniqueId };
