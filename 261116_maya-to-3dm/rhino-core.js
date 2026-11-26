// Write baked polygon meshes on Maya's actual display layers.
// Use saved shader RGB as real Rhino materials and object display colours.
import {layerCatalog,objectLayerKey,groupCatalog,objectGroupPaths} from "./layers.js";

const unitNames={
  mm:"Millimeters",millimeter:"Millimeters",millimeters:"Millimeters",
  cm:"Centimeters",centimeter:"Centimeters",centimeters:"Centimeters",
  m:"Meters",meter:"Meters",meters:"Meters",km:"Kilometers",
  in:"Inches",inch:"Inches",ft:"Feet",foot:"Feet",yd:"Yards"
};
function populate(mesh,object,triangles=false){
  const vertices=mesh.vertices();
  for(const p of object.vertices){
    if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))
      throw new Error("Non-finite vertex coordinates");
    vertices.add(p[0],p[1],p[2]);
  }
  const faces=mesh.faces();
  for(const polygon of object.faces){
    if(!Array.isArray(polygon)||polygon.length<3)continue;
    if(polygon.some(i=>!Number.isInteger(i)||i<0||i>=object.vertices.length))
      throw new Error("Face references an invalid vertex");
    if(!triangles&&polygon.length===4)faces.addQuadFace(...polygon);
    else if(!triangles&&polygon.length===3)faces.addTriFace(...polygon);
    else for(let i=1;i<polygon.length-1;i++)
      faces.addTriFace(polygon[0],polygon[i],polygon[i+1]);
  }
  mesh.normals().computeNormals();
  mesh.compact();
}
const validColor=c=>c&&["r","g","b"].every(k=>Number.isFinite(c[k])&&c[k]>=0&&c[k]<=255);
export function createMesh3dmSession(meta,rhino){
  const doc=new rhino.File3dm();
  doc.applicationName="Testlab Maya Mesh Converter";
  doc.settings().modelUnitSystem=rhino.UnitSystem[unitNames[meta.unit]||"Centimeters"];
  const layers=new Map(),materials=new Map(),groupIndices=new Map(),skipped=[];
  let exported=0,closed=false;
  try{
    for(const item of layerCatalog(meta.objects||[],meta.displayLayers||[])){
      const layer=new rhino.Layer();
      try{
        layer.name=item.name;
        layer.color={...item.color,a:255};
        layer.visible=item.visible!==false;
        const index=doc.layers().add(layer);
        if(!Number.isInteger(index)||index<0)throw new Error("Cannot create Rhino layer "+item.name);
        layers.set(item.id,index);
      }finally{layer.destroy?.();}
    }
    if(meta.exportGroups!==false){
      for(const item of groupCatalog(meta.objects||[])){
        const group=new rhino.Group();
        try{
          group.name=item.name;
          const index=doc.groups().count;
          doc.groups().add(group);
          if(doc.groups().count!==index+1)
            throw new Error("Cannot create Rhino group "+item.name);
          groupIndices.set(item.id,index);
        }finally{group.destroy?.();}
      }
    }
  }catch(error){doc.destroy();throw error;}
  function materialIndexFor(object){
    if(!object.materialName)return null;
    const rgb=validColor(object.materialColor)?object.materialColor:null;
    const props=object.materialProperties||{};
    const key=JSON.stringify([object.materialName,rgb,props,object.materialTexture]);
    if(materials.has(key))return materials.get(key);
    const mat=new rhino.Material();
    try{
      mat.name=object.materialName;
      if(rgb)mat.diffuseColor={...rgb,a:255};
      if(Number.isFinite(props.opacity))mat.transparency=1-props.opacity;
      if([props.roughness,props.metallic].some(Number.isFinite)){
        mat.toPhysicallyBased();
        const pbr=mat.physicallyBased();
        try{
          if(rgb)pbr.baseColor={r:rgb.r/255,g:rgb.g/255,b:rgb.b/255,a:1};
          if(Number.isFinite(props.roughness))pbr.roughness=props.roughness;
          if(Number.isFinite(props.metallic))pbr.metallic=props.metallic;
          if(Number.isFinite(props.opacity))pbr.opacity=props.opacity;
        }finally{pbr.destroy?.();}
      }
      // Preserve path only: do not fetch or embed external image data.
      if(object.materialTexture)mat.setBitmapTextureFilename(object.materialTexture);
      const index=doc.materials().count;
      doc.materials().add(mat);
      if(doc.materials().count!==index+1)
        throw new Error("Could not insert Rhino material "+object.materialName);
      materials.set(key,index);
      return index;
    }finally{mat.destroy?.();}
  }
  return {
    addObject(object){
      if(closed)throw new Error("Export session already completed");
      const layerIndex=layers.get(objectLayerKey(object));
      if(layerIndex===undefined){
        skipped.push(object.name+": missing display layer");return false;
      }
      let failure="Invalid mesh geometry";
      for(const triangulate of [false,true]){
        const mesh=new rhino.Mesh();
        try{
          populate(mesh,object,triangulate);
          if(!mesh.isValid)continue;
          const attrs=new rhino.ObjectAttributes();
          attrs.name=object.name;
          attrs.layerIndex=layerIndex;
          for(const groupPath of objectGroupPaths(object)){
            const groupIndex=groupIndices.get(groupPath);
            if(groupIndex!==undefined)attrs.addToGroup(groupIndex);
          }
          const index=materialIndexFor(object);
          if(index!==null){
            attrs.materialIndex=index;
            attrs.materialSource=rhino.ObjectMaterialSource.MaterialFromObject;
            if(validColor(object.materialColor)){
              attrs.objectColor={...object.materialColor,a:255};
              attrs.colorSource=rhino.ObjectColorSource.ColorFromObject;
            }else attrs.colorSource=rhino.ObjectColorSource.ColorFromLayer;
          }else{
            attrs.colorSource=rhino.ObjectColorSource.ColorFromLayer;
          }
          const id=doc.objects().add(mesh,attrs);
          if(!id)throw new Error("Rhino could not add mesh");
          exported++;return true;
        }catch(error){failure=error.message||String(error);}
        finally{mesh.destroy?.();}
      }
      skipped.push(object.name+": "+failure);
      return false;
    },
    finish(){
      if(closed)throw new Error("Export session already completed");
      if(!exported)throw new Error("No valid Rhino meshes to export");
      const bytes=doc.toByteArray();
      if(!bytes||bytes.byteLength<100)throw new Error("Empty Rhino 3DM output");
      const loaded=rhino.File3dm.fromByteArray(bytes);
      if(!loaded)throw new Error("3DM read-back failed");
      try{
        if(loaded.objects().count!==exported||loaded.layers().count!==layers.size||
           loaded.groups().count!==groupIndices.size)
          throw new Error("Incomplete geometry, layers or groups after 3DM read-back");
      }finally{loaded.destroy();}
      return {bytes,exported,skipped:[...skipped],layers:layers.size,materials:materials.size,groups:groupIndices.size};
    },
    dispose(){if(!closed){closed=true;doc.destroy();}}
  };
}
export function buildMesh3dm(model,rhino){
  if(!model?.objects?.length)throw new Error("There is no geometry to export");
  const session=createMesh3dmSession(model,rhino);
  try{
    for(const object of model.objects)session.addObject(object);
    return session.finish();
  }finally{session.dispose();}
}
