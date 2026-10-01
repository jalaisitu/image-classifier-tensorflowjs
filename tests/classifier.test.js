import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FILE_BYTES, validateFile, validateDimensions, validatePredictions, formatScore, disposeModel, createModelLoader, withTimeout } from '../js/classifier.js';

test('supported images and file size boundary', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.doesNotThrow(() => validateFile({type, size: MAX_FILE_BYTES}));
  }
  assert.throws(() => validateFile({type: 'image/jpeg', size: MAX_FILE_BYTES + 1}), /too large/);
});
test('empty, missing and unsupported files are rejected', () => {
  assert.throws(() => validateFile(), /Choose an image/);
  assert.throws(() => validateFile({type:'image/png', size:0}), /empty/);
  for (const type of ['image/svg+xml','image/heic','text/html','']) {
    assert.throws(() => validateFile({type, size:100}), /JPG, PNG or WebP/);
  }
});
test('invalid and excessive decoded dimensions are rejected', () => {
  assert.throws(() => validateDimensions(0, 200), /decoded/);
  assert.throws(() => validateDimensions(6000, 4000), /20 megapixels/);
  assert.doesNotThrow(() => validateDimensions(5000, 4000));
});
test('a small nonzero score is not rounded to zero', () => {
  assert.equal(formatScore(0.0004), '<0.1%');
  assert.equal(formatScore(0.725), '72.5%');
  assert.equal(formatScore(0), '0.0%');
});
test('predictions are ordered and limited without mutating model output', () => {
  const original = [0.1,0.6,0.2,0.05].map((probability, i) => ({className:String(i), probability}));
  assert.deepEqual(validatePredictions(original).map(p=>p.probability),[0.6,0.2,0.1]);
  assert.equal(original[0].probability,0.1);
});
test('malformed model responses are rejected', () => {
  for (const predictions of [null, [], [null], [{className:'x',probability:NaN}], [{className:'x',probability:1.2}], [{className:'',probability:0.5}]]) {
    assert.throws(()=>validatePredictions(predictions),/invalid result/);
  }
});
test('concurrent and repeated calls load the model only once', async () => {
  let loads=0;
  const model = {};
  const getModel = createModelLoader(async()=>{loads++;return model;});
  const [a,b]=await Promise.all([getModel(), getModel()]);
  assert.equal(a,b);
  assert.equal(await getModel(),model);
  assert.equal(loads,1);
});
test('failed model downloads can be retried', async () => {
  let loads=0;
  const getModel=createModelLoader(async()=>{if(++loads===1)throw new Error('offline');return 'ready';});
  await assert.rejects(getModel(),/offline/);
  assert.equal(await getModel(),'ready');
  assert.equal(loads,2);
});
test('timeouts reject stalled work and dispose late results', async () => {
  let finish;
  let disposed=false;
  const pending=new Promise(resolve=>{finish=resolve;});
  await assert.rejects(withTimeout(pending,5,'too slow',disposeModel),/too slow/);
  finish({dispose(){disposed=true;}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(disposed,true);
});
test('timely results pass through and original failures are preserved', async () => {
  assert.equal(await withTimeout(Promise.resolve('ok'),100,'timeout'),'ok');
  await assert.rejects(withTimeout(Promise.reject(new Error('network error')),100,'timeout'),/network error/);
});
