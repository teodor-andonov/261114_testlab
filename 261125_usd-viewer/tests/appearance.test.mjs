import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {captureMaterials,applyAppearance,materialInfo,randomColor} from "../appearance.js";
test("display modes preserve authored material arrays, values and texture",()=>{
 const tex=new T.Texture(),source=new T.MeshStandardMaterial({color:0x3377bb,roughness:.35,metalness:.65,map:tex}),other=new T.MeshStandardMaterial({color:0xffaa33});
 const mesh=new T.Mesh(new T.BoxGeometry(),[source,other]);
 captureMaterials(mesh,"USD loader");const opts={selected:false,accent:new T.Color(0x729af0),clay:new T.Color(0xaaaaaa),wire:false,seed:"part"};
 applyAppearance(mesh,{...opts,mode:"clay"});assert.equal(mesh.material.length,2);assert.equal(mesh.material[0].map,null);assert.equal(materialInfo(mesh)[0].hex,"#3377bb");
 applyAppearance(mesh,{...opts,mode:"material",selected:true});assert.equal(mesh.material[0].map,tex);assert.equal(mesh.material[0].roughness,.35);assert.equal(source.emissive.getHex(),0);
 applyAppearance(mesh,{...opts,mode:"random"});const rgb=mesh.material[0].color.getHex();applyAppearance(mesh,{...opts,mode:"material"});applyAppearance(mesh,{...opts,mode:"random"});assert.equal(mesh.material[0].color.getHex(),rgb);assert.notEqual(randomColor("part").getHex(),randomColor("other").getHex());
});
