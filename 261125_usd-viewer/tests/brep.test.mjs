import test from "node:test";
import assert from "node:assert/strict";
import * as sm from "@classcad/smlibwasm";
import {readBreps,demoUsd} from "../brep.js";
test("mesh-free USDA is reconstructed and tessellated",()=>{const source=sm.scope(()=>sm.toUsd([sm.Box(10,20,30)],{mesh:false}));assert.match(source,/BrepArray/);let body;assert.equal(readBreps(source,b=>body=b),1);assert.equal(body.faces,6);assert.ok(Math.abs(body.volume-6000)<1e-5);assert.ok(body.corners.length>0);assert.equal(body.lines.length,72);});
test("curved demo round trip",()=>{let body;assert.equal(readBreps(demoUsd(),b=>body=b),1);assert.ok(body.faces>6);assert.ok(body.corners.length>0);});
