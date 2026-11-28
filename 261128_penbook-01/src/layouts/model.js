import { invariant, record, number, own } from '../core/json.js';
import { Registry } from '../core/registry.js';

function axis(value,path,modes){record(value,path);invariant(modes.includes(value.mode),`${path}.mode`,"unsupported sizing mode");if(value.mode==="fixed")number(value.value,`${path}.value`,{min:Number.EPSILON});else invariant(!own(value,"value"),`${path}.value`,"only fixed sizing has a value")}

function extent(value,path){record(value,path);for(const key of ["x","y"])axis(value[key],`${path}.${key}`,["fixed","auto","available","unbounded"])}

function defaultPlacement(){return {drawOrder:0,size:{x:{mode:"fit"},y:{mode:"fit"}},byLayout:{}}}

function placement(value,path,registry){record(value,path);number(value.drawOrder,`${path}.drawOrder`,{integer:true});record(value.size,`${path}.size`);for(const key of ["x","y"])axis(value.size[key],`${path}.size.${key}`,["fixed","fit","fill"]);record(value.byLayout,`${path}.byLayout`);for(const [id,p] of Object.entries(value.byLayout))registry.require("layout",id).validatePlacement(p,`${path}.byLayout.${id}`)}

function spacing(layout,path){for(const key of ["gap","padding"]){if(own(layout,key))number(layout[key],`${path}.${key}`,{min:0})}if(own(layout,"align"))invariant(["start","center","end","stretch"].includes(layout.align),`${path}.align`,"unsupported alignment")}

function installSpatial(registry){
  registry.register("layout",{id:"freeform",validate(l,p){spacing(l,p)},validatePlacement(v,p){record(v,p);number(v.x,`${p}.x`);number(v.y,`${p}.y`);if(own(v,"rotation"))number(v.rotation,`${p}.rotation`)},validateChild(parent,child,p){invariant(own(child.placement.byLayout,"freeform"),p,"missing freeform placement")},defaultPlacement(){return {x:0,y:0}}});
  registry.register("layout",{id:"flow",validate(l,p){spacing(l,p);invariant(["vertical","horizontal"].includes(l.direction),`${p}.direction`,"expected vertical or horizontal")},validatePlacement(v,p){record(v,p)},validateChild(){},defaultPlacement(){return {}}});
  registry.register("layout",{id:"grid",validate(l,p){spacing(l,p);for(const k of ["columns","rows"])number(l[k],`${p}.${k}`,{integer:true,min:1,max:10000})},validatePlacement(v,p){record(v,p);for(const k of ["column","row","columnSpan","rowSpan"])number(v[k],`${p}.${k}`,{integer:true,min:1,max:10000})},validateChild(parent,child,p){const v=child.placement.byLayout.grid;invariant(v,p,"missing grid placement");invariant(v.column+v.columnSpan-1<=parent.layout.columns&&v.row+v.rowSpan-1<=parent.layout.rows,p,"grid span exceeds active grid")},defaultPlacement(){return {column:1,row:1,columnSpan:1,rowSpan:1}}});
  for(const id of ["scroll","canvas","paged"])registry.register("view",{id});
  return registry
}

function makeRegistry(){return installSpatial(new Registry())}

export { axis, extent, defaultPlacement, placement, spacing, installSpatial, makeRegistry };
