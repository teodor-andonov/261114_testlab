// SMLib mesh normals belong to triangle corners, not shared vertices.
export function expandPreview(positions, indices, rawNormals) {
  const corners = new Float32Array(indices.length * 3);
  for (let i=0;i<indices.length;i++) {
    const v=indices[i]*3;
    corners[i*3]=positions[v];corners[i*3+1]=positions[v+1];corners[i*3+2]=positions[v+2];
  }
  let normals=null;
  if(rawNormals?.length===corners.length && rawNormals.every(Number.isFinite)){
    normals=new Float32Array(rawNormals);
    for(let i=0;i<normals.length;i+=3){
      const l=Math.hypot(normals[i],normals[i+1],normals[i+2]);
      if(l<1e-8){normals=null;break;}
      normals[i]/=l;normals[i+1]/=l;normals[i+2]/=l;
    }
  }
  return {corners,normals};
}

// Large models start with a responsive display mesh; explicit quality always wins.
export function resolveQuality(requested,count){return requested==="auto"?(count>=80?"draft":"standard"):requested;}
