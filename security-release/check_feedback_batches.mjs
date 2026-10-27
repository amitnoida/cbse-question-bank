import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/question-feedback.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { fetchFeedbackInBatches } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
for (const n of [0, 1, 60, 61, 152, 153]) {
  const ids = Array.from({length:n}, (_,i)=>i+1), calls=[];
  const rows=await fetchFeedbackInBatches(ids,async batch=>{calls.push(batch);assert.ok(batch.length<=60);return batch;});
  assert.deepEqual(rows,ids);
  assert.equal(calls.length,Math.ceil(n/60));
}
assert.deepEqual(await fetchFeedbackInBatches([1,1,2],async b=>b),[1,2]);
await assert.rejects(()=>fetchFeedbackInBatches([1],async()=>{throw new Error('endpoint unavailable');}),/endpoint unavailable/);
console.log('PASS: empty, 1/60/61/152/153-question boundaries, deduplication and error propagation');
