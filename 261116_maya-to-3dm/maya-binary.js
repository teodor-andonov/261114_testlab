// Experimental static Maya Binary decoder. No MEL execution, external files or network.
// Format observations: MayaSceneKit (MIT), https://github.com/yamahigashi/MayaSceneKit
// Only indexed MESH records and the explicitly listed node/attribute encodings are supported.
const forms={XFRM:"transform",DMSH:"mesh",RLAM:"lambert",RPHO:"phong",RBLN:"blinn",SHAD:"shadingEngine",RTFT:"file",DSPL:"displayLayer"};
const decode=new TextDecoder();
const quote=s=>JSON.stringify(s);
const validName=s=>typeof s==="string"&&s.length>0&&s.length<4096&&!/[\x00-\x20\x7f"\\;]/.test(s);
function cstr(bytes,p,end){
  let j=p;while(j<end&&bytes[j]!==0)j++;
  if(j===end)return null;
  return [decode.decode(bytes.subarray(p,j)),j+1];
}
export function decodeMayaBinary(buffer){
  const b=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),d=new DataView(b.buffer,b.byteOffset,b.byteLength);
  const tag=p=>String.fromCharCode(b[p],b[p+1],b[p+2],b[p+3]);
  const header=tag(0);if(!["FOR4","FOR8"].includes(header))throw new Error("Not a supported Maya Binary IFF container.");
  const nodes=[],connections=[],warnings=[],missing=[],unknown=new Set();
  let unit="cm",meshRecords=0,decodedMeshes=0,axis="y",chunks=0,uvMeshes=0;
  const u32=p=>d.getUint32(p,false);
  function readMesh(p,end,node){
    const attr=cstr(b,p,end);if(!attr||b[attr[1]]!==0x20)throw new Error("Unrecognised MESH encoding");
    p=attr[1]+1;
    const readArray=(width,read)=>{
      if(p+4>end)throw new Error("Truncated mesh array");
      const count=u32(p);p+=4;
      if(count>Math.floor((end-p)/width))throw new Error("Invalid mesh array length");
      const out=new Array(count);for(let i=0;i<count;i++,p+=width)out[i]=read(p);
      return out;
    };
    const vt=readArray(4,i=>d.getFloat32(i,false)),ed=readArray(4,u32),words=readArray(4,u32);
    if(!vt.length||vt.length%3||!ed.length||ed.length%2||!words.length)throw new Error("Unsupported indexed mesh layout");
    if(vt.some(x=>!Number.isFinite(x))||ed.some(x=>x>=vt.length/3))throw new Error("Invalid mesh vertices or edges");
    const faces=[];let ring=[];
    for(const w of words){
      const flag=w>>>24,id=w&0xffffff;
      if(id>=ed.length/2||![0,0x60,0x80,0xe0].includes(flag))throw new Error("Unsupported polygon edge flag");
      ring.push(flag&0x80?-id-1:id);
      if(flag&0x60){if(ring.length<3)throw new Error("Invalid polygon");faces.push(ring);ring=[];}
    }
    if(ring.length||!faces.length)throw new Error("Unterminated polygons");
    // Decode the primary UV set when the indexed payload has the known trailer layout.
    function uvAt(start){
      let k=start;
      if(k+8>end)return null;
      k+=4;const sets=u32(k);k+=4;
      if(sets<1||sets>16||k+4>end)return null;
      const set=u32(k);k+=4;
      const nm=cstr(b,k,end);if(!nm||nm[0].length>128)return null;k=nm[1];
      if(k+4>end)return null;
      const count=u32(k);k+=4;
      if(!count||count%2||count>(end-k)/4)return null;
      const uv=[];for(let i=0;i<count;i++,k+=4){const v=d.getFloat32(k,false);if(!Number.isFinite(v))return null;uv.push(v);}
      if(k+4>end||u32(k)!==words.length)return null;k+=4;
      if(words.length>(end-k)/4)return null;
      const indices=[];for(let i=0;i<words.length;i++,k+=4){const id=u32(k);if(id>=count/2)return null;indices.push(id);}
      return {set,uv,indices};
    }
    let uvs=uvAt(p);
    if(!uvs&&p+4<=end){
      const normalCount=u32(p),next=p+4+normalCount*4;
      if(normalCount&&normalCount%3===0&&next+12<=end&&u32(next)===0&&u32(next+8)===0)uvs=uvAt(next+12);
    }
    // Emit bounded command batches, reusing the tested ASCII topology and transform pipeline.
    const out=[];
    if(uvs){
      uvMeshes++;
      for(let i=0;i<uvs.uv.length/2;i+=250){
        const n=Math.min(i+250,uvs.uv.length/2);
        out.push('setAttr ".uvst['+uvs.set+'].uvsp['+i+':'+(n-1)+']" -type "float2" '+uvs.uv.slice(i*2,n*2).join(" ")+';');
      }
      let k=0;for(const face of faces){face.uv=uvs.indices.slice(k,k+face.length);k+=face.length;}
    }
    for(let i=0;i<vt.length/3;i+=166){
      const n=Math.min(i+166,vt.length/3);
      out.push('setAttr ".vt['+i+':'+(n-1)+']" '+vt.slice(i*3,n*3).join(" ")+';');
    }
    for(let i=0;i<ed.length/2;i+=166){
      const n=Math.min(i+166,ed.length/2),values=[];
      for(let j=i;j<n;j++)values.push(ed[j*2],ed[j*2+1],1);
      out.push('setAttr ".ed['+i+':'+(n-1)+']" '+values.join(" ")+';');
    }
    for(let i=0;i<faces.length;i+=500){
      const n=Math.min(i+500,faces.length);
      out.push('setAttr ".fc['+i+':'+(n-1)+']" -type "polyFaces" '+faces.slice(i,n).map(f=>"f "+f.length+" "+f.join(" ")+(f.uv?" mu "+uvs.set+" "+f.uv.length+" "+f.uv.join(" "):"")).join(" ")+';');
    }
    node.geometry.push(...out);
    decodedMeshes++;
  }
  function readAttr(t,p,end,node){
    const a=cstr(b,p,end);if(!a)return;const name=a[0];p=a[1]+1;
    if(!/^[A-Za-z]\w*(?:\[\d+\])?(?:\.[A-Za-z]\w*(?:\[\d+\])?)*$/.test(name)||p>end)return;
    const n=end-p,values=[];
    if(["DBLE","DBL2","DBL3","CMPD"].includes(t)&&[8,16,24].includes(n)){
      for(let i=p;i<end;i+=8)values.push(d.getFloat64(i,false));
    }else if(["FLT2","FLT3","FLTE"].includes(t)&&[4,8,12].includes(n)){
      for(let i=p;i<end;i+=4)values.push(d.getFloat32(i,false));
    }else if(t==="STR "){
      const str=cstr(b,p,end);if(str)node.attrs.set(name,{str:str[0]});return;
    }else return;
    if(values.every(Number.isFinite)){
      if((node.type==="transform")&&/^(r|ra|rx|ry|rz|rotate|rotateAxis|rotateX|rotateY|rotateZ)$/.test(name))
        for(let i=0;i<values.length;i++)values[i]*=180/Math.PI;
      node.attrs.set(name,{values});
    }
  }
  function walk(start,end,wide,form,depth=0){
    if(depth>64)throw new Error("Maya Binary nesting exceeds safety limit");
    let p=start,node=null;
    while(p+(wide?16:8)<=end){
      if(++chunks>10000000)throw new Error("Maya Binary chunk limit exceeded");
      const t=tag(p),h=wide?16:8,l=wide?Number(d.getBigUint64(p+8,false)):u32(p+4),q=p+h,z=q+l;
      if(!Number.isSafeInteger(l)||z>end)throw new Error("Invalid Maya Binary chunk bounds: "+t);
      if(/^(FOR|LIS|CAT)[48]$/.test(t)){
        if(l<4)throw new Error("Truncated Maya Binary group");
        const f=tag(q);walk(q+4,z,t.endsWith("8"),f,depth+1);
      }else if(t==="CREA"){
        const bodyEnd=z-q>=18?z-16:z;
        let pos=q;while(pos<Math.min(q+4,bodyEnd)&&(b[pos]<32||b[pos]>126))pos++;
        const nm=cstr(b,pos,bodyEnd),pa=nm&&cstr(b,nm[1],bodyEnd);
        if(nm&&validName(nm[0])){
          const type=forms[form];
          if(type){node={type,name:nm[0],parent:pa&&validName(pa[0])?pa[0]:null,attrs:new Map(),geometry:[]};nodes.push(node);}
          else {unknown.add(form);node=null;}
        }
      }else if(form==="SLCT"&&t==="SLCT"){
        const name=decode.decode(b.subarray(q,z)).replace(/^:/,"");
        const type=name==="initialShadingGroup"||name==="initialParticleSE"?"shadingEngine":name==="lambert1"?"lambert":name==="standardSurface1"?"standardSurface":null;
        node=nodes.find(n=>n.name===name)||null;
        if(!node&&type){node={type,name,parent:null,attrs:new Map(),geometry:[]};nodes.push(node);}
      }else if(t==="CWFL"){
        const a=cstr(b,q+1,z),c=a&&cstr(b,a[1],z);
        if(a&&c&&validName(a[0])&&validName(c[0]))connections.push([a[0].replace(/^:/,""),c[0].replace(/^:/,"")]);
      }else if(form==="HEAD"&&t==="LUNI"){const u=decode.decode(b.subarray(q,z)).replace(/\0/g,"");if(/^(mm|cm|m|km|in|ft|yd)$/.test(u))unit=u;}
      else if(form==="HEAD"&&t==="AUNI"){/* binary transform angles are radians */}
      else if(form==="HEAD"&&["AXIS","UPAX"].includes(t)){const a=decode.decode(b.subarray(q,z)).toLowerCase();if(a==="z"||a==="y")axis=a;}
      else if(t==="MESH"){
        meshRecords++;
        if(node?.type==="mesh"){try{readMesh(q,z,node);}catch(e){missing.push(node.name+": "+e.message);}}
        else missing.push("MESH record without a supported mesh node");
      }else if(node)readAttr(t,q,z,node);
      const alignment=wide&&form!=="Maya"?8:4;
      p=z+(alignment-l%alignment)%alignment;
    }
    if(p<end&&end-p>=8)throw new Error("Truncated Maya Binary chunk header");
  }
  walk(0,b.length,header==="FOR8","",0);
  // The built-in shading group may not have an explicit CREA record.
  const knownNames=new Set(nodes.map(n=>n.name));
  for(const [src,dst] of connections){
    for(const ref of [src,dst]){
      const name=ref.split(".")[0];
      if(!knownNames.has(name)){
        const type=name==="initialShadingGroup"?"shadingEngine":name==="lambert1"?"lambert":name==="standardSurface1"?"standardSurface":null;
        if(type){nodes.push({type,name,parent:null,attrs:new Map(),geometry:[]});knownNames.add(name);}
      }
    }
  }
  const out=['currentUnit -l '+unit+' -a deg;','upAxis -ax '+axis+';'];
  for(const n of nodes){
    out.push("createNode "+n.type+" -n "+quote(n.name)+(n.parent?" -p "+quote(n.parent):"")+";");
    for(const [key,a] of n.attrs){
      const v=a.values;
      if(v&&((n.type==="mesh"&&["io","khe","peh"].includes(key))||(n.type==="transform"&&key==="it")||(["transform","mesh","displayLayer"].includes(n.type)&&key==="v")))out.push("setAttr "+quote("."+key)+" "+(v[0]?"yes":"no")+";");
      else if(v)out.push("setAttr "+quote("."+key)+" "+v.join(" ")+";");
      else if(a.str!==undefined)out.push("setAttr "+quote("."+key)+' -type "string" '+quote(a.str)+";");
    }
    for(const line of n.geometry)out.push(line);
  }
  for(const [a,c] of connections)out.push("connectAttr "+quote(a)+" "+quote(c)+";");
  const absent=nodes.filter(n=>n.type==="mesh"&&!n.geometry.length&&!n.attrs.get("io")?.values?.[0]).length;
  warnings.push("Experimental Maya Binary: "+decodedMeshes+" indexed mesh record(s) decoded; "+meshRecords+" encountered. Construction history, external references and unknown node types are not evaluated.");
  if(absent)warnings.push(absent+" mesh node(s) have no decoded baked geometry; conversion may be incomplete.");
  if(missing.length)warnings.push(...missing.slice(0,20));
  if(unknown.size)warnings.push("Unsupported binary node forms: "+[...unknown].slice(0,30).join(", ")+".");
  warnings.push("Binary UV sets decoded on "+uvMeshes+" mesh record(s). Other UV layouts, face material components, hard-edge flags and source up-axis metadata are not fully decoded. Check the Up setting and geometry before export.");
  return {source:out.join("\n"),warnings,decodedMeshes,meshRecords};
}
