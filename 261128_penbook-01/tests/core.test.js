import test from 'node:test';
import { cases, equal } from './cases.js';
import { sourceFixture } from './smoke-module.js';
import { readFile } from 'node:fs/promises';
for (const [name, run] of cases()) test(name, run);
test('checked-in source fixture matches its generator', async () => {
  equal(JSON.parse(await readFile(new URL('./fixtures/source-only.json', import.meta.url), 'utf8')), sourceFixture());
});
