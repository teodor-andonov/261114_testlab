// Geometry-only subset of Maya ASCII; does not execute Maya's dependency graph.
function* commands(text) {
  let buffer="",quote="",escaped=false,line=false,block=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(line){if(c==="\n"){line=false;buffer+=" ";}continue;}
    if(block){if(c==="*"&&n==="/"){block=false;i++;}continue;}
    if(quote){buffer+=c;if(escaped)escaped=false;else if(c==="\\")escaped=true;else if(c===quote)quote="";continue;}
    if(c==="/"&&n==="/"){line=true;i++;continue;}
    if(c==="/"&&n==="*"){block=true;i++;continue;}
    if(c==='"'||c==="'"){quote=c;buffer+=c;continue;}
    if(c===";"){if(buffer.trim())yield buffer.trim();buffer="";continue;}
    buffer+=c;
  }
  if(buffer.trim())yield buffer.trim();
}
function tokenize(text) {
  return (text.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s]+/g)||[])
    .map(s=>s.length>1 && (s[0]==='"'||s[0]==="'") && s.at(-1)===s[0]
      ? s.slice(1,-1).replace(/\\(["'\\])/g,"$1") : s);
}
const num=(s,def=0)=>s!==undefined&&s!==""&&Number.isFinite(Number(s))?Number(s):def;
const yes=s=>["yes","true","on","1"].includes(s);
const vector=(values,current)=>current.map((v,i)=>num(values[i],v));
const plus=(a,b)=>a.map((v,i)=>v+b[i]);
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function euler(point,angles,order=0){
  let p=point;
  for(const axis of [...(["XYZ","YZX","ZXY","XZY","YXZ","ZYX"][order]||"XYZ")].reverse()){
    const a=angles["XYZ".indexOf(axis)]*Math.PI/180,c=Math.cos(a),s=Math.sin(a),[x,y,z]=p;
    if(axis==="X")p=[x,y*c-z*s,y*s+z*c];
    if(axis==="Y")p=[x*c+z*s,y,-x*s+z*c];
    if(axis==="Z")p=[x*c-y*s,x*s+y*c,z];
  }
  return p;
}
function worldPoint(point,shape,nodes,axis){
  let p=point,parent=shape.parent,safety=0;
  while(parent&&safety++<100){
    const t=nodes.get(parent);
    if(!t||t.type!=="transform")break;
    p=minus(p,t.sp);
    p=p.map((v,i)=>v*t.s[i]);
    const [xy,xz,yz]=t.sh;
    p=[p[0]+xy*p[1]+xz*p[2],p[1]+yz*p[2],p[2]];
    p=minus(plus(plus(p,t.sp),t.spt),t.rp);
    p=euler(p,t.ra);
    p=euler(p,t.r,t.ro);
    p=plus(plus(plus(p,t.rp),t.rpt),t.t);
    if(!t.it)break;
    parent=t.parent;
  }
  return axis==="z"?p:[p[0],p[2]===0?0:-p[2],p[1]];
}
function facesFromValues(v){
  const faces=[];
  for(let i=0;i<v.length;){
    const key=v[i++];
    if(key==="f"){
      const n=num(v[i++],-1);
      if(!Number.isInteger(n)||n<3||i+n>v.length)break;
      faces.push({refs:v.slice(i,i+n).map(Number),hole:false,uvs:new Map()});i+=n;
    }else if(key==="h"){
      const n=num(v[i++],-1);
      if(n<0||i+n>v.length)break;
      if(faces.length)faces.at(-1).hole=true;
      i+=n;
    }else if(key==="mu"||key==="mc"){
      const set=num(v[i++],-1),n=num(v[i++],-1);
      if(n<0||i+n>v.length)break;
      if(key==="mu"&&faces.length)faces.at(-1).uvs.set(set,v.slice(i,i+n).map(Number));
      i+=n;
    }else if(["mf","mh","fc"].includes(key)){
      const n=num(v[i++],-1);
      if(n<0||i+n>v.length)break;
      if(key==="mf"&&faces.length)faces.at(-1).uvs.set(0,v.slice(i,i+n).map(Number));
      i+=n;
    }
  }
  return faces;
}
function nodeData(type,name,path,parent){
  return {type,name,path,parent,
    t:[0,0,0],r:[0,0,0],s:[1,1,1],ro:0,ra:[0,0,0],
    rp:[0,0,0],sp:[0,0,0],rpt:[0,0,0],spt:[0,0,0],sh:[0,0,0],it:true,
    vertices:[],offsets:[],edges:[],chunks:[],uvSets:new Map(),
    intermediate:false,preview:false,level:2,boundary:1,keepHard:false,
    creases:new Map(),vertexCreases:new Map()
  };
}
function components(values,label){
  const map=new Map(),start=values.indexOf(label);
  if(start<0)return map;
  const n=num(values[start+1]);
  for(let i=0;i<n;i++){
    const index=num(values[start+2+i*2],-1),weight=num(values[start+3+i*2]);
    if(Number.isInteger(index)&&index>=0&&weight>0)map.set(index,weight);
  }
  return map;
}
export function parseMayaAscii(source,options={}){
  if(typeof source!=="string")throw new TypeError("Expected Maya ASCII text");
  const nodes=new Map(),aliases=new Map(),links=new Map(),issues=new Map();
  let selected=null,unit="cm",axis="y",history=0;
  const report=s=>issues.set(s,(issues.get(s)||0)+1);
  const last=s=>s?.split("|").at(-1)||"";
  const resolve=ref=>{
    if(!ref)return null;
    const full=ref.startsWith("|")?ref:ref.includes("|")?"|"+ref:null;
    if(full&&nodes.has(full))return full;
    return aliases.get(last(ref))?.at(-1)||null;
  };
  for(const command of commands(source)){
    const t=tokenize(command),op=t[0];
    if(op==="currentUnit"){
      const i=t.findIndex(v=>v==="-l"||v==="-linear");
      if(i>=0)unit=t[i+1]||unit;
      continue;
    }
    if(op==="upAxis"){
      const i=t.findIndex(v=>v==="-ax"||v==="-axis");
      if(i>=0&&["y","z"].includes(t[i+1]?.toLowerCase()))axis=t[i+1].toLowerCase();
      continue;
    }
    if(op==="createNode"){
      const type=t[1],i=t.indexOf("-n"),j=t.indexOf("-p");
      if(type!=="mesh"&&type!=="transform"){
        if(/^(poly|blendShape|skinCluster|lattice|cluster|tweak)/.test(type||""))history++;
        selected=null;continue;
      }
      const name=i>=0?last(t[i+1]):null;
      if(!name){selected=null;continue;}
      const parent=j>=0?resolve(t[j+1]):null,path=(parent||"")+"|"+name;
      if(nodes.has(path)){report("identical DAG path collisions");selected=path;continue;}
      nodes.set(path,nodeData(type,name,path,parent));
      if(!aliases.has(name))aliases.set(name,[]);
      aliases.get(name).push(path);
      selected=path;continue;
    }
    if(op==="select"){
      selected=resolve(t.slice(1).filter(x=>!x.startsWith("-")).at(-1));continue;
    }
    if(op==="connectAttr"){
      const refs=t.slice(1).filter(x=>!x.startsWith("-"));
      if(refs.length>=2&&/\.(i|inMesh)$/.test(refs[1])){
        const to=resolve(refs[1].split(".")[0]),from=resolve(refs[0].split(".")[0]);
        if(to&&from)links.set(to,from);
      }
      continue;
    }
    if(op!=="setAttr"||!selected)continue;
    const at=t.findIndex((v,i)=>i>0&&(v.startsWith(".")||!v.startsWith("-")&&v.includes(".")));
    if(at<0)continue;
    const ref=t[at],dot=ref.indexOf("."),attr=ref.slice(dot+1);
    const uvAttr=attr.match(/^(?:uvst|uvSet)\[(\d+)\]\.(?:uvsp|uvSetPoints)\[(\d+)(?::\d+)?\]$/);
    if(uvAttr){
      const node=nodes.get(dot===0?selected:resolve(ref.slice(0,dot)));
      if(node?.type==="mesh"){
        const values=t.slice(at+1);if(values[0]==="-type")values.splice(0,2);
        const set=Number(uvAttr[1]),start=Number(uvAttr[2]),uv=node.uvSets.get(set)||[];
        for(let i=0;i+1<values.length;i+=2){
          const p=[Number(values[i]),Number(values[i+1])];
          if(p.every(Number.isFinite))uv[start+i/2]=p;
        }
        node.uvSets.set(set,uv);
      }
      continue;
    }
    const match=attr.match(/^([a-zA-Z]\w*)(?:\[(\d+)(?::\d+)?\])?$/);
    if(!match)continue;
    const node=nodes.get(dot===0?selected:resolve(ref.slice(0,dot)));
    if(!node)continue;
    const key=match[1],start=num(match[2]);
    const v=t.slice(at+1);
    if(v[0]==="-type")v.splice(0,2);
    if(node.type==="transform"){
      if(["t","translate"].includes(key))node.t=vector(v,node.t);
      else if(["r","rotate"].includes(key))node.r=vector(v,node.r);
      else if(["s","scale"].includes(key))node.s=vector(v,node.s);
      else if(["tx","ty","tz"].includes(key))node.t["xyz".indexOf(key[1])]=num(v[0]);
      else if(["rx","ry","rz"].includes(key))node.r["xyz".indexOf(key[1])]=num(v[0]);
      else if(["sx","sy","sz"].includes(key))node.s["xyz".indexOf(key[1])]=num(v[0],1);
      else if(key==="ro")node.ro=num(v[0]);
      else if(["rp","sp","rpt","spt","sh","ra"].includes(key))node[key]=vector(v,node[key]);
      else if(key==="it")node.it=yes(v[0]);
    }else if(node.type==="mesh"){
      if(key==="io")node.intermediate=yes(v[0]);
      else if(key==="dsm")node.preview=num(v[0])>0;
      else if(["lev","smoothLevel"].includes(key))node.level=Math.max(0,Math.min(5,Math.round(num(v[0],2))));
      else if(key==="bnr")node.boundary=num(v[0],1);
      else if(["khe","peh"].includes(key))node.keepHard ||= yes(v[0]);
      else if(["vt","pt","pnts"].includes(key)){
        const arr=key==="vt"?node.vertices:node.offsets;
        for(let i=0;i+2<v.length;i+=3)arr[start+i/3]=[num(v[i]),num(v[i+1]),num(v[i+2])];
      }else if(key==="ed"){
        for(let i=0;i+2<v.length;i+=3)node.edges[start+i/3]=[num(v[i]),num(v[i+1]),num(v[i+2])];
      }else if(key==="fc")node.chunks.push({start,faces:facesFromValues(v)});
      else if(["cd","cvd"].includes(key)){
        const entries=components(v,key==="cd"?"Edge":"Vertex");
        for(const [id,value] of entries)(key==="cd"?node.creases:node.vertexCreases).set(id,value);
      }
    }
  }
  const outputAxis=["y","z"].includes(options.upAxis)?options.upAxis:axis;
  const objects=[];
  for(const node of nodes.values()){
    if(node.type!=="mesh"||node.intermediate)continue;
    let geometry=node,link=links.get(node.path),guard=0;
    while(link&&guard++<30){
      const upstream=nodes.get(link);
      if(!upstream||upstream.type!=="mesh")break;
      if(upstream.vertices.length&&upstream.chunks.length){
        if(!geometry.vertices.length||!geometry.chunks.length)geometry=upstream;
        break;
      }
      link=links.get(link);
    }
    if(!geometry.vertices.length&&!geometry.chunks.length)continue;
    if(!geometry.vertices.length||!geometry.edges.length||!geometry.chunks.length){
      report("incomplete mesh records skipped");continue;
    }
    const positions=geometry.vertices.map((p,i)=>p?worldPoint(plus(p,geometry.offsets[i]||[0,0,0]),node,nodes,outputAxis):null);
    const raw=[];
    for(const chunk of geometry.chunks)chunk.faces.forEach((face,i)=>raw[chunk.start+i]=face);
    const faces=[],sourceFaceIds=[],faceUVs=[];
    const uvSet=geometry.uvSets.has(0)?0:geometry.uvSets.keys().next().value;
    const uvPoints=geometry.uvSets.get(uvSet);
    for(const [faceId,f] of raw.entries()){
      if(!f)continue;
      if(f.hole){report("faces with holes skipped");continue;}
      const ring=[];let end=null,valid=true;
      for(const id of f.refs){
        if(!Number.isInteger(id)){valid=false;break;}
        const e=geometry.edges[id>=0?id:-id-1];
        if(!e){valid=false;break;}
        const a=id>=0?e[0]:e[1],b=id>=0?e[1]:e[0];
        if(end!==null&&a!==end){valid=false;break;}
        ring.push(a);end=b;
      }
      if(!valid||ring.length<3||end!==ring[0]||new Set(ring).size!==ring.length||
        ring.some(i=>!Number.isInteger(i)||!positions[i])){report("malformed polygon faces skipped");continue;}
      const first=positions[ring[0]];let area=0;
      for(let i=1;i<ring.length-1;i++){
        const n=cross(minus(positions[ring[i]],first),minus(positions[ring[i+1]],first));
        area+=Math.hypot(...n);
      }
      if(area<1e-12){report("zero-area polygon faces skipped");continue;}
      faces.push(ring);sourceFaceIds.push(faceId);
      const uvIds=f.uvs.get(uvSet);
      const uv=uvIds?.map(i=>uvPoints?.[i]);
      faceUVs.push(uv?.length===ring.length&&uv.every(Boolean)?uv:null);
    }
    if(!faces.length){report("meshes without valid faces skipped");continue;}
    if(uvPoints&&faceUVs.some(x=>!x))report("meshes with incomplete primary UV mapping (unmapped faces retained)");
    const used=[...new Set(faces.flat())],remap=new Map(used.map((id,i)=>[id,i]));
    const edgeKey=(a,b)=>Math.min(a,b)+":"+Math.max(a,b);
    const creases=new Map(),vertexCreases=new Map();
    geometry.edges.forEach((e,i)=>{
      if(!e||!remap.has(e[0])||!remap.has(e[1]))return;
      const weight=geometry.creases.get(i)||((node.keepHard||geometry.keepHard)&&e[2]===0?1000:0);
      if(weight>0)creases.set(edgeKey(remap.get(e[0]),remap.get(e[1])),weight);
    });
    for(const [id,w] of geometry.vertexCreases)if(remap.has(id))vertexCreases.set(remap.get(id),w);
    objects.push({
      name:nodes.get(node.parent)?.name||node.name,
      path:node.path,vertices:used.map(id=>positions[id]),faces:faces.map(f=>f.map(id=>remap.get(id))),
      sourceFaceIds,faceUVs:faceUVs.some(Boolean)?faceUVs:null,
      edgeCreases:creases,vertexCreases,boundaryRule:node.boundary,
      smoothLevel:node.level,smoothPreview:node.preview,
      triangles:faces.filter(f=>f.length===3).length,
      quads:faces.filter(f=>f.length===4).length,
      ngons:faces.filter(f=>f.length>4).length
    });
  }
  const warnings=[...issues].map(([name,count])=>count+" "+name+".");
  if(history)warnings.push(history+" unsupported history/deformer nodes (cached geometry only).");
  return {objects,warnings,unit,upAxis:outputAxis,sourceUpAxis:axis,parsedNodes:nodes.size,historyNodes:history};
}

// Reuse the same Maya ASCII command scanner for display layers and shader links.
export {commands as scanMayaCommands, tokenize as tokenizeMayaCommand};
