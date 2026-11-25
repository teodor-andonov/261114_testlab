import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {chromium} from "playwright";
test("built viewer imports mesh-free BRep, selects and opens ordinary USDA", {timeout:180000}, async()=>{
 const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview","--host","127.0.0.1","--port","4181","--strictPort"],{stdio:"ignore"});
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch("http://127.0.0.1:4181/")).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.goto("http://127.0.0.1:4181/");
  await page.locator("#demo").click();
  await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("exact bodies tessellated"),{},{timeout:120000});
  await page.locator(".tree-row .name").first().click();
  assert.match(await page.locator("#details").innerText(),/CAD faces/);
  await page.locator("#wire").click();assert.equal(await page.locator("#wire").getAttribute("aria-pressed"),"true");
  await page.locator("#file").setInputFiles({name:"triangle.usda",mimeType:"text/plain",buffer:Buffer.from('#usda 1.0\n( defaultPrim = "World" )\ndef Xform "World" {\n def Mesh "Triangle" {\n int[] faceVertexCounts = [3]\n int[] faceVertexIndices = [0,1,2]\n point3f[] points = [(0,0,0),(1,0,0),(0,1,0)]\n uniform token subdivisionScheme = "none"\n }\n}')});
  await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("authored render geometry"));
  assert.match(await page.locator("#stats").innerText(),/1 meshes/);
 }finally{await browser?.close();server.kill();}
});
