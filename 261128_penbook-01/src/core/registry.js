import { invariant, record, identifier, own, snapshot } from './json.js';

class Registry{
  #groups=new Map([["content",new Map()],["layout",new Map()],["view",new Map()],["format",new Map()]]);
  #sealed=false;
  #group(kind){const group=this.#groups.get(kind);invariant(group,`registry.${kind}`,"unknown registry");return group}
  register(kind,definition){invariant(!this.#sealed,"registry","registration is closed");const group=this.#group(kind);record(definition,"module");const id=identifier(definition.id,"module.id");invariant(!group.has(id),`registry.${kind}.${id}`,"duplicate registration");const d={...definition};if(kind==="content"){invariant(typeof d.validate==="function",id,"content validator required");invariant(own(d,"defaultData"),id,"defaultData required");d.defaultData=snapshot(d.defaultData);d.defaultProperties=snapshot(record(d.defaultProperties??{},`${id}.defaultProperties`));d.properties=snapshot(record(d.properties??{},`${id}.properties`));for(const key of ["references","remapReferences","mount","update","unmount","renderPresentation","commands"]){if(d[key]!==undefined)invariant(typeof d[key]==="function",`${id}.${key}`,"expected callback")}}if(kind==="layout"){for(const key of ["validate","validatePlacement","validateChild","defaultPlacement"])invariant(typeof d[key]==="function",`${id}.${key}`,"layout callback required")}if(kind==="view"&&d.validate!==undefined)invariant(typeof d.validate==="function",`${id}.validate`,"expected callback");if(kind==="format")for(const key of ["encode","decode"])invariant(typeof d[key]==="function",`${id}.${key}`,"format callback required");group.set(id,Object.freeze(d));return this}
  get(kind,id){return this.#group(kind).get(id)}
  require(kind,id){const value=this.get(kind,id);invariant(value,`registry.${kind}.${id}`,"unsupported type");return value}
  list(kind){return [...this.#group(kind).values()]}
  seal(){this.#sealed=true;return this}
}

export { Registry };
