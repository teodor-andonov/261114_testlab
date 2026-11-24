// Store only user-granted directory handles and navigation preferences, never note contents.
const DB='testlab-html-notes-folders-v1', STORE='workspace';
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function transaction(mode,fn){const db=await openDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);let result;const req=fn(tx.objectStore(STORE));req.onsuccess=()=>{result=req.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||req.error);tx.onabort=()=>reject(tx.error||new Error('Folder preferences transaction aborted'))})}finally{db.close()}}
export async function readWorkspace(){return (await transaction('readonly',s=>s.get('current')))||{roots:[],expanded:[],selected:null}}
export function writeWorkspace(data){return transaction('readwrite',s=>s.put(data,'current'))}
export async function permission(handle,mode='readwrite',ask=false){
 const options={mode};
 if(typeof handle.queryPermission!=='function')return true;
 if(await handle.queryPermission(options)==='granted')return true;
 if(!ask||typeof handle.requestPermission!=='function')return false;
 return await handle.requestPermission(options)==='granted';
}
export function noteName(input){
 let name=String(input??'').trim();
 if(!name||name==='.'||name==='..'||/[<>:"/\\|?*\u0000-\u001f]/.test(name)||/[. ]$/.test(name))throw new Error('Enter a valid filename (no slashes or special characters).');
 if(!/\.html?$/i.test(name))name+='.html';
 if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw new Error('This filename is reserved.');
 return name;
}
export async function createNoteHandle(directory,name,confirmReplace=()=>false){
 name=noteName(name);
 try{const existing=await directory.getFileHandle(name);return confirmReplace(name)?existing:null}
 catch(e){if(e.name!=='NotFoundError')throw e}
 return directory.getFileHandle(name,{create:true});
}
export async function writeNote(handle,text){const w=await handle.createWritable();try{await w.write(text);await w.close()}catch(e){try{await w.abort()}catch{}throw e}}
export function pathKey(root,path=[]){return JSON.stringify([root,...path])}
