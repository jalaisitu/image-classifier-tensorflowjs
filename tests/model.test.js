import test from 'node:test';
import assert from 'node:assert/strict';
import { getModel } from '../js/model.js';

test('library failure can be retried; successful libraries and model are reused', async () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  let libraryRequests = 0;
  let modelLoads = 0;
  let removedScripts = 0;
  const model = { classify() {}, model: { dispose() {} } };
  const statuses = [];

  globalThis.window = {};
  globalThis.document = {
    createElement() {
      return { remove() { removedScripts++; } };
    },
    head: {
      append(script) {
        libraryRequests++;
        queueMicrotask(() => {
          if (libraryRequests === 1) {
            script.onerror();
          } else {
            if (script.src.includes('@tensorflow/tfjs')) {
              window.tf = { ready: async () => {} };
            } else {
              window.mobilenet = {
                load: async config => {
                  assert.deepEqual(config, { version: 1, alpha: 1.0 });
                  modelLoads++;
                  return model;
                },
              };
            }
            script.onload();
          }
        });
      },
    },
  };

  try {
    await assert.rejects(getModel(), /library could not be downloaded/);
    assert.equal(removedScripts, 1);
    assert.equal(await getModel(message => statuses.push(message)), model);
    assert.equal(await getModel(), model);
    assert.equal(modelLoads, 1);
    assert.equal(libraryRequests, 3);
    assert.ok(statuses.some(message => message.includes('pretrained model')));
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});
