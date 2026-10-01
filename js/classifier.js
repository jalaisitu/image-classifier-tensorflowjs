export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PIXELS = 20_000_000;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateFile(file) {
  if (!file) throw new Error('Choose an image first.');
  if (!TYPES.has(file.type)) throw new Error('Choose a JPG, PNG or WebP image. Convert HEIC images to JPG first.');
  if (file.size === 0) throw new Error('This file is empty. Choose another image.');
  if (file.size > MAX_FILE_BYTES) throw new Error('This image is too large. Choose a file up to 10 MB.');
}

export function validateDimensions(width, height) {
  if (!width || !height) throw new Error('This image could not be decoded. Try a different JPG, PNG or WebP file.');
  if (width * height > MAX_PIXELS) throw new Error('This image exceeds 20 megapixels. Resize it and try again.');
}

export function formatScore(probability) {
  if (probability > 0 && probability < 0.001) return '<0.1%';
  return `${(probability * 100).toFixed(1)}%`;
}

export function disposeModel(model) {
  // Pipeline disposal is asynchronous; cleanup must not leave an unhandled rejection.
  return Promise.resolve().then(() => model.dispose()).catch(console.error);
}

export function validatePredictions(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0 ||
      predictions.some(p => !p || typeof p.className !== 'string' || !p.className ||
        !Number.isFinite(p.probability) || p.probability < 0 || p.probability > 1)) {
    throw new Error('The model returned an invalid result. Please try again.');
  }
  return [...predictions].sort((a, b) => b.probability - a.probability).slice(0, 3);
}

// A timeout frees the interface. The underlying operation may finish later.
// Late model loads are disposed instead of being kept in memory.
export function withTimeout(promise, milliseconds, message, onLateResult = () => {}) {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => { expired = true; reject(new Error(message)); }, milliseconds);
    Promise.resolve(promise).then(value => {
      clearTimeout(timer);
      if (expired) onLateResult(value);
      else resolve(value);
    }, error => { clearTimeout(timer); if (!expired) reject(error); });
  });
}

// Reuse one model (or its in-flight promise); allow a fresh attempt after failure.
export function createModelLoader(load) {
  let modelPromise;
  return function getModel() {
    if (!modelPromise) {
      modelPromise = Promise.resolve().then(load).catch(error => {
        modelPromise = undefined;
        throw error;
      });
    }
    return modelPromise;
  };
}
