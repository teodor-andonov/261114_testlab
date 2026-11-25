import test from "node:test";
import assert from "node:assert/strict";
import {USDLoader} from "three/addons/loaders/USDLoader.js";
test("ordinary USDA triangle is loaded",()=>{
 const source='#usda 1.0\n( defaultPrim = "World" )\ndef Xform "World" {\n def Mesh "Triangle" {\n int[] faceVertexCounts = [3]\n int[] faceVertexIndices = [0,1,2]\n point3f[] points = [(0,0,0),(1,0,0),(0,1,0)]\n uniform token subdivisionScheme = "none"\n }\n}';
 const model=new USDLoader().parse(source);let count=0;model.traverse(o=>{if(o.isMesh)count++;});assert.ok(count>0);
});
