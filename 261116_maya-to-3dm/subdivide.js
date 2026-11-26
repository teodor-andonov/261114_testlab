// Catmull-Clark polygon subdivision with Maya-style semi-sharp edge/vertex creases.
// This produces baked polygon geometry, not Rhino SubD objects.
const edgeKey=(a,b)=>Math.min(a,b)+":"+Math.max(a,b);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const multiply=(a,v)=>[a[0]*v,a[1]*v,a[2]*v];
const avg=points=>{
  let s=[0,0,0];for(const p of points)s=add(s,p);
  return multiply(s,1/Math.max(points.length,1));
};
const blend=(a,b,t)=>add(multiply(a,1-t),multiply(b,t));
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);

export function subdivideCage(input,levels=2,{maxFaces=800000}={}) {
  if(!Number.isInteger(levels)||levels<0||levels>5)throw new RangeError("Subdivision must be 0–5.");
  let mesh={...input,vertices:input.vertices,faces:input.faces,
    edgeCreases:new Map(input.edgeCreases||[]),
    vertexCreases:new Map(input.vertexCreases||[])};
  for(let step=0;step<levels;step++){
    let count=0;
    for(const f of mesh.faces)count+=f.length;
    if(count>maxFaces)throw new Error("Subdivision limit exceeded ("+count+" faces). Choose less detail.");
    const vertices=mesh.vertices,faces=mesh.faces;
    const incident=Array.from({length:vertices.length},()=>[]),
      touching=Array.from({length:vertices.length},()=>[]);
    const edges=new Map();
    for(let fi=0;fi<faces.length;fi++){
      const face=faces[fi];
      if(face.length<3)throw new Error("Polygon with fewer than three vertices.");
      for(let j=0;j<face.length;j++){
        const a=face[j],b=face[(j+1)%face.length];
        if(a===b||!finite3(vertices[a])||!finite3(vertices[b]))
          throw new Error("Malformed polygon topology.");
        incident[a].push(fi);
        const id=edgeKey(a,b);
        if(!edges.has(id))edges.set(id,{a:Math.min(a,b),b:Math.max(a,b),faces:[]});
        const edge=edges.get(id);
        edge.faces.push(fi);
      }
    }
    for(const edge of edges.values()){
      touching[edge.a].push(edge);
      touching[edge.b].push(edge);
      if(edge.faces.length>2)throw new Error("Non-manifold edge (more than two faces).");
      edge.weight=mesh.edgeCreases.get(edgeKey(edge.a,edge.b))||0;
      edge.boundary=edge.faces.length===1;
    }
    const facePts=faces.map(face=>avg(face.map(i=>vertices[i])));
    const newPoints=Array(vertices.length);
    // A Catmull-Clark smooth vertex plus crease, corner and border rules.
    for(let i=0;i<vertices.length;i++){
      const P=vertices[i],edgesAt=touching[i],faceIds=[...new Set(incident[i])];
      if(!edgesAt.length){newPoints[i]=P;continue;}
      const n=faceIds.length;
      const F=avg(faceIds.map(j=>facePts[j]));
      const R=avg(edgesAt.map(e=>multiply(add(vertices[e.a],vertices[e.b]),0.5)));
      const smooth=multiply(add(add(F,multiply(R,2)),multiply(P,n-3)),1/Math.max(n,1));
      const bordering=edgesAt.filter(e=>e.boundary);
      // Open mesh vertices are creased by default in Maya; for a 2-edge
      // corner with boundaryRule=1, keep it pinned exactly.
      if(bordering.length>=2 && mesh.boundaryRule===1 && edgesAt.length===2){
        newPoints[i]=P;continue;
      }
      const tagged=edgesAt.map(e=>({
        weight:e.boundary?100000:e.weight,
        point:vertices[e.a===i?e.b:e.a]
      })).filter(e=>e.weight>0).sort((a,b)=>b.weight-a.weight);
      let result=smooth;
      if(tagged.length>=3){
        result=blend(smooth,P,Math.min(1,tagged[2].weight));
      }else if(tagged.length===2){
        const crease=multiply(add(add(multiply(P,6),tagged[0].point),tagged[1].point),1/8);
        result=blend(smooth,crease,Math.min(1,tagged[1].weight));
      }
      const vertexWeight=mesh.vertexCreases.get(i)||0;
      if(vertexWeight>0)result=blend(result,P,Math.min(1,vertexWeight));
      newPoints[i]=result;
    }
    const indexFor=new Map(),nextCreases=new Map(),nextVertexCreases=new Map();
    for(let i=0;i<vertices.length;i++){
      const weight=(mesh.vertexCreases.get(i)||0)-1;
      if(weight>0)nextVertexCreases.set(i,weight);
    }
    for(const [id,edge] of edges){
      let smooth;
      if(edge.faces.length===2){
        smooth=multiply(add(add(vertices[edge.a],vertices[edge.b]),
          add(facePts[edge.faces[0]],facePts[edge.faces[1]])),0.25);
      }else smooth=multiply(add(vertices[edge.a],vertices[edge.b]),0.5);
      const sharp=multiply(add(vertices[edge.a],vertices[edge.b]),0.5);
      const position=blend(smooth,sharp,Math.min(1,edge.boundary?1:edge.weight));
      indexFor.set(id,newPoints.length);
      newPoints.push(position);
      const after=edge.boundary?100000:Math.max(0,edge.weight-1);
      if(after>0){
        nextCreases.set(edgeKey(edge.a,newPoints.length-1),after);
        nextCreases.set(edgeKey(edge.b,newPoints.length-1),after);
      }
    }
    const faceIndices=facePts.map(p=>{const i=newPoints.length;newPoints.push(p);return i;});
    const nextFaces=[],nextUVs=mesh.faceUVs?[]:null,nextMaterials=mesh.faceMaterials?[]:null;
    for(let i=0;i<faces.length;i++){
      const face=faces[i],c=faceIndices[i];
      for(let j=0;j<face.length;j++){
        const a=face[j],b=face[(j+1)%face.length],prev=face[(j+face.length-1)%face.length];
        nextFaces.push([a,indexFor.get(edgeKey(a,b)),c,indexFor.get(edgeKey(prev,a))]);
        if(nextMaterials)nextMaterials.push(mesh.faceMaterials[i]);
        if(nextUVs){
          const uv=mesh.faceUVs[i];
          const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
          const center=uv?[uv.reduce((s,p)=>s+p[0],0)/uv.length,uv.reduce((s,p)=>s+p[1],0)/uv.length]:null;
          nextUVs.push(uv?[uv[j],mid(uv[j],uv[(j+1)%uv.length]),center,mid(uv[(j+uv.length-1)%uv.length],uv[j])]:null);
        }
      }
    }
    mesh={...mesh,vertices:newPoints,faces:nextFaces,faceUVs:nextUVs,faceMaterials:nextMaterials,
      edgeCreases:nextCreases,vertexCreases:nextVertexCreases};
  }
  return mesh;
}

// Split after subdivision so material boundaries do not introduce artificial
// Catmull-Clark boundaries. Compact each output mesh independently.
function splitMaterials(mesh){
  if(!mesh.faceMaterials)return [mesh];
  const buckets=new Map();
  for(let i=0;i<mesh.faces.length;i++){
    const m=mesh.faceMaterials[i]||null;
    if(!buckets.has(m))buckets.set(m,[]);
    buckets.get(m).push(i);
  }
  if(buckets.size===1)return [{...mesh,...buckets.keys().next().value,faceMaterials:null}];
  const out=[];
  for(const [material,ids] of buckets){
    const vertices=[],map=new Map();
    const faces=ids.map(i=>mesh.faces[i].map(v=>{
      if(!map.has(v)){map.set(v,vertices.length);vertices.push(mesh.vertices[v]);}
      return map.get(v);
    }));
    out.push({...mesh,...material,name:mesh.name+" ["+(material?.materialName||"Unassigned")+"]",vertices,faces,
      faceUVs:mesh.faceUVs?ids.map(i=>mesh.faceUVs[i]):null,faceMaterials:null,
      edgeCreases:new Map(),vertexCreases:new Map()});
  }
  return out;
}
export function prepareMeshes(parsed,levels="maya") {
  const objects=[],warnings=[...parsed.warnings],failures=[];
  for(const object of parsed.objects){
    try {
      const appliedLevels=levels==="maya"?(object.smoothPreview?object.smoothLevel:0):Number(levels);
      const mesh=subdivideCage(object,appliedLevels);
      if(!mesh.faces.length)throw new Error("Mesh has no faces.");
      for(const part of splitMaterials(mesh))objects.push({...part,appliedLevels});
    }catch(error){
      failures.push({name:object.name,reason:error.message});
    }
  }
  if(failures.length)warnings.push(failures.length+" mesh(es) skipped: "+
    failures.slice(0,3).map(f=>f.name+" ("+f.reason+")").join("; ")+
    (failures.length>3?" …":""));
  return {...parsed,objects,warnings,failures,levels};
}
