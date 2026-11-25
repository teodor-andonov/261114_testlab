import { test, expect } from "@playwright/test";

async function command(page, name) {
  await page.getByRole("button", { name: /Commands/ }).click();
  await page.locator("#commandSearch").fill(name);
  await page.locator("#commandResults").getByRole("button", { name, exact:true }).click();
}
test("command palette is stable and keyboard navigation respects the focused box", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".dock-stack")).toHaveCount(5);
  await page.locator("canvas").evaluate(node => {
    window.viewerWasDetached = false;
    const observer = new MutationObserver(records => {
      for (const record of records) for (const removed of record.removedNodes)
        if (removed === node || removed.contains?.(node)) window.viewerWasDetached = true;
    });
    observer.observe(document.querySelector("#workspace"), { childList:true, subtree:true });
  });
  await page.locator(".dock-stack").filter({has:page.getByRole("tab",{name:"Editor",exact:true})})
    .getByRole("button",{name:"Maximise or restore this box"}).click();
  await expect(page.locator(".workspace")).toHaveClass(/is-maximized/);
  await page.keyboard.press("Control+k");
  await expect(page.locator("#commandSearch")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#commandPalette")).not.toBeVisible();
  await expect(page.locator(".workspace")).toHaveClass(/is-maximized/);
  await page.locator(".dock-stack.maximized .expand-btn").click();
  await expect(page.locator(".workspace")).not.toHaveClass(/is-maximized/);
  await page.locator("canvas").evaluate(node => { node.dataset.identity = "survives"; });
  await command(page, "Focus editor");
  await expect(page.locator("canvas")).toHaveAttribute("data-identity","survives");
  expect(await page.evaluate(() => window.viewerWasDetached)).toBe(false);
  expect(errors).toEqual([]);
});
test("all shipped demos build using real Replicad WASM; STEP export retains its button", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  for (const name of ["Parametric box","Boolean union + fillets","Perforated facade panel","Stepped tower","Rounded block","Parametric pavilion"]) {
    await command(page,"Demo: " + name);
    await expect(page.locator("#status")).toContainText("Model ready");
    await expect(page.locator(".viewer-placeholder")).toBeHidden();
  }
  await command(page,"Demo: Parametric box");
  await expect(page.locator("#status")).toContainText("Model ready");
  const step=page.locator('button[data-target="step"]');
  await step.evaluate(node => { node.dataset.identity = "survives"; });
  const downloaded = page.waitForEvent("download");
  await step.click();
  const download=await downloaded;
  expect(download.suggestedFilename()).toBe("box.step");
  await expect(step).toHaveAttribute("data-identity","survives");
  await expect(step).toHaveAttribute("aria-disabled","false");
  expect(errors).toEqual([]);
});
