import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {chromium} from "playwright";
test("built viewer imports mesh-free BRep, selects and opens ordinary USDA", {timeout:180000}, async()=>{
 const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4181","--strictPort"],{stdio:"ignore"});
 let browser,page;const capture=[];
 try{
  for(let i=0;i<100;i++){try{if((await fetch("http://127.0.0.1:4181/")).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on("console",m=>capture.push(m.type()+": "+m.text()));
  page.on("pageerror",e=>capture.push("PAGE ERROR: "+e.stack));
  page.on("requestfailed",r=>capture.push("REQUEST FAILED: "+r.url()+" "+r.failure()?.errorText));
  page.on("response",r=>{if(r.status()>=400)capture.push(r.status()+" "+r.url());});
  await page.goto("http://127.0.0.1:4181/");
  await page.keyboard.press("Control+k");
  await page.locator("#commandSearch").fill("Load mesh-free BRep demo");
  await page.keyboard.press("Enter");
  await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("1 file(s) loaded"),{},{timeout:65000});
  assert.match(await page.locator("#stats").textContent(),/1 files/);
  assert.equal(await page.locator("#viewActions").count(),0);
  await page.locator(".tree-row .name").nth(1).click();
  assert.match(await page.locator("#details").innerText(),/CAD faces/);
  await page.keyboard.press("w");assert.match(await page.locator("#status").textContent(),/CAD edges on/);
  await page.keyboard.press("g");assert.match(await page.locator("#status").textContent(),/Grid hidden/);
  await page.keyboard.press("3");await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("Tessellation: high"),{},{timeout:65000});
  assert.match(await page.locator("#details").innerText(),/CAD faces/);assert.match(await page.locator("#details").innerText(),/high/);
  const triangle={name:"triangle.usda",mimeType:"text/plain",buffer:Buffer.from('#usda 1.0\n( defaultPrim = "World" )\ndef Xform "World" {\n def Mesh "Triangle" {\n int[] faceVertexCounts = [3]\n int[] faceVertexIndices = [0,1,2]\n point3f[] points = [(0,0,0),(1,0,0),(0,1,0)]\n uniform token subdivisionScheme = "none"\n }\n}')};
  await page.locator('#file').setInputFiles([triangle,{...triangle,name:'second.usda'}]);
  await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("2 file(s) loaded"));
  assert.match(await page.locator("#stats").innerText(),/3 files · 3 meshes/);
  assert.equal(await page.locator(".tree-row .name[title=\"triangle.usda\"]").count(),1);
  await page.locator(".tree-row .name[title=\"triangle.usda\"]").click();await page.keyboard.press("Delete");assert.match(await page.locator("#stats").innerText(),/2 files · 2 meshes/);
 }catch(e){console.error(capture.join("\n"));if(page)console.error("STATUS:",await page.locator("#status").textContent().catch(()=>""),"STATS:",await page.locator("#stats").textContent().catch(()=>""));throw e;}finally{await browser?.close();server.kill();}
});
