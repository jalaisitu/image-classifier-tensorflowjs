import { validateFile, validateDimensions, validatePredictions, formatScore, disposeModel, createModelLoader, withTimeout } from './classifier.js';

const form = document.getElementById('upload-form');
const input = document.getElementById('imageInput');
const image = document.getElementById('uploadedImage');
const preview = document.getElementById('image-preview');
const filename = document.getElementById('image-name');
const classifyButton = document.getElementById('classifyButton');
const clearButton = document.getElementById('clearButton');
const status = document.getElementById('status');
const errorBox = document.getElementById('error');
const result = document.getElementById('result');
const list = document.getElementById('prediction-list');
let objectURL;
let selection = 0;
let imageReady = false;
let busy = false;
let inferencePending = false;

function updateControls() {
  input.disabled = busy;
  classifyButton.disabled = busy || inferencePending || !imageReady;
  clearButton.disabled = busy || !input.files.length;
  form.setAttribute('aria-busy', String(busy));
  classifyButton.textContent = busy ? 'Working…' : 'Classify image';
}

function clearResults() {
  list.replaceChildren();
  result.hidden = true;
  errorBox.hidden = true;
  errorBox.textContent = '';
}

function clearPreview() {
  imageReady = false;
  preview.hidden = true;
  image.removeAttribute('src');
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = undefined;
  filename.textContent = '';
}

function showError(error) {
  errorBox.textContent = error.message || 'Something went wrong. Please try again.';
  errorBox.hidden = false;
  status.textContent = 'Please check the message below.';
}

// Load the browser-compatible ONNX conversion of google/vit-base-patch16-224.
const getModel = createModelLoader(async () => {
  try {
    const { pipeline, env } = await withTimeout(
      import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'),
      30000,
      
    );
    env.allowLocalModels = false;
    return await withTimeout(
      pipeline('image-classification', 'Xenova/vit-base-patch16-224', {
        device: 'wasm',
        dtype: 'q8'
      }),
      300000,
      
      disposeModel
    );
  } catch (error) {
    throw new Error(`Could not load the image model. ${error.message}`);
  }
});

input.addEventListener('change', async () => {
  const current = ++selection;
  clearResults();
  clearPreview();
  updateControls();
  const file = input.files[0];
  if (!file) { status.textContent = 'Choose an image to get started.'; return; }
  try {
    validateFile(file);
    status.textContent = 'Reading your image…';
    objectURL = URL.createObjectURL(file);
    image.src = objectURL;
    await withTimeout(image.decode(), 15000, 'This image took too long to open. Try a smaller file.');
    if (current !== selection) return;
    validateDimensions(image.naturalWidth, image.naturalHeight);
    imageReady = true;
    preview.hidden = false;
    filename.textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight}`;
    status.textContent = 'Image ready. Select “Classify image” to see predictions.';
  } catch (error) {
    if (current !== selection) return;
    clearPreview();
    showError(error.name === 'EncodingError' ? new Error('This file could not be decoded. Try another JPG, PNG or WebP image.') : error);
  } finally {
    if (current === selection) updateControls();
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || inferencePending || !imageReady) return;
  busy = true;
  clearResults();
  updateControls();
  try {
    status.textContent = 'Preparing the model. The first download may take a moment…';
    const model = await getModel();
    status.textContent = 'Classifying your image in this browser…';
    // Snapshot the pixels so a late inference cannot read a different image.
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not read the image pixels.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    inferencePending = true;
    const classification = Promise.resolve().then(() => model(canvas.toDataURL('image/png'), { top_k: 3 }).then(predictions =>
      predictions.map(({ label, score }) => ({ className: label, probability: score }))
    )).finally(() => {
      inferencePending = false;
      updateControls();
    });
    const predictions = validatePredictions(await withTimeout(
      classification, 120000,
      'Classification took too long. Try a smaller image or reload the page.'
    ));
    for (const prediction of predictions) {
      const item = document.createElement('li');
      item.className = 'result-item';
      const heading = document.createElement('div');
      heading.className = 'prediction-heading';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = prediction.className;
      const score = document.createElement('span');
      score.className = 'percentage';
      score.textContent = formatScore(prediction.probability);
      const meter = document.createElement('meter');
      meter.min = 0; meter.max = 1; meter.value = prediction.probability;
      meter.setAttribute('aria-label', `${prediction.className}: ${formatScore(prediction.probability)} confidence`);
      heading.append(label, score);
      item.append(heading, meter);
      list.append(item);
    }
    result.hidden = false;
    status.textContent = 'Classification complete. You can choose another image.';
    result.focus();
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    updateControls();
  }
});

clearButton.addEventListener('click', () => {
  if (busy) return;
  selection++;
  input.value = '';
  clearPreview();
  clearResults();
  status.textContent = 'Choose an image to get started.';
  updateControls();
  input.focus();
});
