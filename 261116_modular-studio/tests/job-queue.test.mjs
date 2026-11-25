import test from "node:test";
import assert from "node:assert/strict";
import { createJobQueue } from "../job-queue.js";
test("rapid rebuilds only dispatch the active and latest build", () => {
  const sent = [];
  const q = createJobQueue(job => sent.push(job.id));
  q.enqueue({id:1,type:"build"});
  q.enqueue({id:2,type:"build"});
  q.enqueue({id:3,type:"build"});
  assert.deepEqual(sent,[1]);
  assert.deepEqual(q.waiting.map(j=>j.id),[3]);
  assert.equal(q.complete(99),false);
  q.complete(1);
  assert.deepEqual(sent,[1,3]);
  q.complete(3);
  assert.equal(q.active,null);
});
test("accepted exports retain order while stale previews and builds are dropped", () => {
  const sent=[];
  const q=createJobQueue(j=>sent.push(j.id));
  q.enqueue({id:1,type:"convert",target:"viewer/mesh"});
  q.enqueue({id:2,type:"convert",target:"step"});
  q.enqueue({id:3,type:"convert",target:"viewer/mesh"});
  q.enqueue({id:4,type:"build"});
  q.enqueue({id:5,type:"build"});
  q.complete(1);q.complete(2);q.complete(5);
  assert.deepEqual(sent,[1,2,5]);
});
test("cancel stale returns discarded pending jobs and reset clears active", () => {
  const q=createJobQueue(()=>{});
  q.enqueue({id:1,type:"convert",target:"stl"});
  q.enqueue({id:2,type:"build"});
  assert.deepEqual(q.cancelStale().map(j=>j.id),[2]);
  assert.deepEqual(q.reset().map(j=>j.id),[1]);
  assert.equal(q.active,null);
});
