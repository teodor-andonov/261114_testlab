// One worker operation at a time. Retain requested file exports, but coalesce
// obsolete builds and preview conversions before they reach the kernel.
export function createJobQueue(send) {
  let active = null;
  let waiting = [];
  function pump() {
    if (active || !waiting.length) return;
    active = waiting.shift();
    send(active);
  }
  function enqueue(job) {
    if (job.type === "build") cancelStale();
    waiting.push(job);
    pump();
  }
  function cancelStale() {
    const cancelled = waiting.filter(job => job.type === "build" ||
      (job.type === "convert" && job.target === "viewer/mesh"));
    waiting = waiting.filter(job => !cancelled.includes(job));
    return cancelled;
  }
  function complete(id) {
    if (active?.id !== id) return false;
    active = null;
    pump();
    return true;
  }
  function reset() {
    const abandoned = [...(active ? [active] : []), ...waiting];
    active = null;
    waiting = [];
    return abandoned;
  }
  return { enqueue, complete, cancelStale, reset,
    get active() { return active; }, get waiting() { return [...waiting]; } };
}
