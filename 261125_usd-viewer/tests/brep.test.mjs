import test from "node:test";
import assert from "node:assert/strict";
import * as sm from "@classcad/smlibwasm";
import {readBreps,demoUsd} from "../brep.js";
test("mesh-free USDA is reconstructed and tessellated",()=>{const source=sm.scope(()=>sm.toUsd([sm.Box(10,20,30)],{mesh:false}));assert.match(source,/BrepArray/);let body;assert.equal(readBreps(source,b=>body=b),1);assert.equal(body.faces,6);assert.ok(Math.abs(body.volume-6000)<1e-5);assert.ok(body.corners.length>0);assert.equal(body.lines.length,72);});
test("curved demo round trip",()=>{let body;assert.equal(readBreps(demoUsd(),b=>body=b),1);assert.ok(body.faces>6);assert.ok(body.corners.length>0);});

test("quality presets alter tessellation tolerance without changing exact topology",()=>{const source=demoUsd(),bodies={};for(const q of ["draft","normal","high"])readBreps(source,b=>bodies[q]=b,q);assert.ok(bodies.draft.tolerance>bodies.normal.tolerance);assert.ok(bodies.normal.tolerance>bodies.high.tolerance);assert.equal(bodies.draft.faces,bodies.high.faces);assert.equal(bodies.draft.volume,bodies.high.volume);assert.ok(bodies.high.lines.length>bodies.draft.lines.length);});

test("colored native BRep retains its body color",()=>{let b;readBreps(demoUsd(),body=>b=body);assert.ok(b.color?.length>=3);assert.ok(Math.abs(b.color[0]-.28)<.01);assert.ok(Math.abs(b.color[2]-.72)<.01);});
