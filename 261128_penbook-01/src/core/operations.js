import { invariant, record, own, copyJson, number, freshId, uniqueId } from './json.js';
import { defaultPlacement } from '../layouts/model.js';
import { indexBlocks, walk, moduleReferences } from './model.js';

function getBlock(doc,id){const entry=indexBlocks(doc).get(id);invariant(entry,`block.${id}`,"block not found");return entry}

function destination(doc,id){const {block}=getBlock(doc,id);invariant(block.kind==="container",`block.${id}`,"destination is not a container");return block}

function positionIndex(index,length){return index===undefined?length:number(index,"index",{integer:true,min:0,max:length})}

function placed(registry,parent,block,{reset=false,placement:explicit}={}){const pos=copyJson(explicit??block.placement??defaultPlacement());const type=parent.layout.type;const layout=registry.require("layout",type);if(explicit===undefined&&(reset||!own(pos.byLayout,type)))pos.byLayout[type]=copyJson(layout.defaultPlacement(parent,block));return pos}

function insertBlock(doc,registry,parentId,block,index){const parent=destination(doc,parentId),item=copyJson(block);const used=indexBlocks(doc);walk(item,b=>invariant(!used.has(b.id),`block.${b.id}`,"ID already exists"));const i=positionIndex(index,parent.children.length);item.placement=placed(registry,parent,item);parent.children.splice(i,0,item);return item.id}

function removeBlock(doc,id){const {block,parent}=getBlock(doc,id);invariant(parent,`block.${id}`,"cannot remove root");parent.children.splice(parent.children.indexOf(block),1);return block}

function reparentBlock(doc,registry,id,parentId,index,options={}){const {block,parent}=getBlock(doc,id);invariant(parent,`block.${id}`,"cannot reparent root");const next=destination(doc,parentId);let cycle=false;walk(block,b=>{if(b.id===parentId)cycle=true});invariant(!cycle,`block.${id}`,"cannot reparent into its own subtree");const i=positionIndex(index,next.children.length-(next===parent?1:0));const pos=placed(registry,next,block,{reset:next!==parent,placement:options.placement});parent.children.splice(parent.children.indexOf(block),1);block.placement=pos;next.children.splice(i,0,block);return id}

function duplicateBlock(doc,registry,id,{parentId,index,idFactory=freshId}={}){const {block,parent}=getBlock(doc,id);invariant(parent,`block.${id}`,"cannot duplicate root");const target=destination(doc,parentId??parent.id),clone=copyJson(block),used=new Set(indexBlocks(doc).keys()),map=new Map();walk(clone,b=>{const old=b.id;b.id=uniqueId(idFactory,used);map.set(old,b.id)});walk(clone,b=>{if(b.kind!=="content")return;const module=registry.get("content",b.type);if(!module)return;const refs=moduleReferences(module,b);if(refs.blocks.some(ref=>map.has(ref))){invariant(module.remapReferences,`block.${b.id}`,"module must remap internal references when duplicating");const result=module.remapReferences({data:b.data,properties:b.properties},ref=>map.get(ref)??ref);record(result,`${b.id}.remapReferences`);b.data=copyJson(result.data);b.properties=copyJson(result.properties)}});if(target!==parent)clone.placement=placed(registry,target,clone,{reset:true});return insertBlock(doc,registry,target.id,clone,index??(target===parent?parent.children.indexOf(block)+1:undefined))}

export { getBlock, destination, positionIndex, placed, insertBlock, removeBlock, reparentBlock, duplicateBlock };
