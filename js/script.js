import {
  validateFile,
  validateDimensions,
  validatePredictions,
  formatScore,
  withTimeout,
} from './classifier.js';
import { getModel } from './model.js';

// Page elements
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

// Current selection and processing state
let objectURL;
let selection = 0;
let imageReady = false;
let busy = false;
let inferencePending = false;

function setStatus(message) {
  status.textContent = message;
}

function updateControls() {
  input.disabled = busy;
  classifyButton.disabled = busy || inferencePending || !imageReady;
  clearButton.disabled = busy || !input.files.length;
  classifyButton.textContent = busy ? 'Working…' : 'Classify image';
  form.setAttribute('aria-busy', String(busy));
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
  filename.textContent = '';

  if (objectURL) {
    URL.revokeObjectURL(objectURL);
    objectURL = undefined;
  }
}

function showError(error) {
  errorBox.textContent = error.message || 'Something went wrong. Please try again.';
  errorBox.hidden = false;
  setStatus('Please check the message below.');
}

// A snapshot prevents a late inference from reading a new selection.
function createImageSnapshot() {
  const canvas = document.createElement('canvas');
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, 1024 / longestSide);

  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('This browser could not read the image pixels.');
  }

  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
}

function renderPredictions(predictions) {
  list.replaceChildren();

  for (const prediction of predictions) {
    const item = document.createElement('li');
    item.className = 'result-item';

    const heading = document.createElement('div');
    heading.className = 'prediction-heading';

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = prediction.className;

    const scoreText = formatScore(prediction.probability);
    const score = document.createElement('span');
    score.className = 'percentage';
    score.textContent = scoreText;

    const meter = document.createElement('meter');
    meter.min = 0;
    meter.max = 1;
    meter.value = prediction.probability;
    meter.setAttribute(
      'aria-label',
      `${prediction.className}: ${scoreText} confidence`
    );

    heading.append(label, score);
    item.append(heading, meter);
    list.append(item);
  }

  result.hidden = false;
  result.focus();
}

async function handleImageSelection() {
  const currentSelection = ++selection;
  const file = input.files[0];

  clearResults();
  clearPreview();
  updateControls();

  if (!file) {
    setStatus('Choose an image to get started.');
    return;
  }

  try {
    validateFile(file);
    setStatus('Reading your image…');
    objectURL = URL.createObjectURL(file);
    image.src = objectURL;

    await withTimeout(
      image.decode(),
      15000,
      'This image took too long to open. Try a smaller file.'
    );

    if (currentSelection !== selection) {
      return;
    }

    validateDimensions(image.naturalWidth, image.naturalHeight);
    imageReady = true;
    preview.hidden = false;
    filename.textContent =
      `${file.name} · ${image.naturalWidth} × ${image.naturalHeight}`;
    setStatus('Image ready. Select “Classify image” to see predictions.');
  } catch (error) {
    if (currentSelection !== selection) {
      return;
    }

    clearPreview();

    if (error.name === 'EncodingError') {
      showError(new Error(
        'This file could not be decoded. Try another JPG, PNG or WebP image.'
      ));
    } else {
      showError(error);
    }
  } finally {
    if (currentSelection === selection) {
      updateControls();
    }
  }
}

async function handleClassification(event) {
  event.preventDefault();

  if (busy || inferencePending || !imageReady) {
    return;
  }

  busy = true;
  clearResults();
  updateControls();

  try {
    setStatus('Preparing the model…');
    const model = await getModel(setStatus);
    const snapshot = createImageSnapshot();

    setStatus('Classifying your image in this browser…');
    inferencePending = true;

    const classification = Promise.resolve()
      .then(() => model.classify(snapshot, 3))
      .finally(() => {
        inferencePending = false;
        updateControls();
      });

    const predictions = await withTimeout(
      classification,
      30000,
      'Classification took too long. Try a smaller image or reload the page.'
    );

    renderPredictions(validatePredictions(predictions));
    setStatus('Classification complete. You can choose another image.');
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    updateControls();
  }
}

function handleClear() {
  if (busy) {
    return;
  }

  selection++;
  input.value = '';
  clearPreview();
  clearResults();
  setStatus('Choose an image to get started.');
  updateControls();
  input.focus();
}

input.addEventListener('change', handleImageSelection);
form.addEventListener('submit', handleClassification);
clearButton.addEventListener('click', handleClear);
