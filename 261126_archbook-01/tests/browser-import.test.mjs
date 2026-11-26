import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Rhino worker uses browser module and bundled WASM URL',()=>{const src=readFileSync(new URL('../src/engine.worker.js',import.meta.url),'utf8');assert.match(src,/rhino3dm\/rhino3dm\.module\.js/);assert.match(src,/rhino3dm\/rhino3dm\.wasm\?url/);assert.doesNotMatch(src,/import\(['"]rhino3dm['"]\)/);});
