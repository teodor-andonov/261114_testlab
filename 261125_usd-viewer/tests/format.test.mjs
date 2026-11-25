import test from "node:test";
import assert from "node:assert/strict";
import {detect} from "../format.js";
const buf=s=>new TextEncoder().encode(s).buffer;
test("recognizes exact USDA and metadata",()=>{const d=detect(buf('#usda 1.0\n( upAxis = "Z" metersPerUnit = 0.001 )\ndef BrepArray "body" {}'));assert.equal(d.brep,true);assert.equal(d.upAxis,"Z");assert.equal(d.units,.001);});
test("recognizes ordinary mesh and binary/package headers",()=>{assert.equal(detect(buf('#usda 1.0\ndef Mesh "x" {}')).brep,false);assert.equal(detect(buf("PXR-USDC")).format,"USDC");assert.equal(detect(buf("PK\u0003\u0004")).format,"USDZ");assert.throws(()=>detect(buf("junk")));});
