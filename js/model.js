import {
  createModelLoader,
  disposeMobileNet,
  withTimeout,
} from './classifier.js';

const TENSORFLOW_URL =
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';

const MOBILENET_URL =
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js';

// Keep one request per library, including while a download is in progress.
const scriptRequests = new Map();

function loadScript(url, isReady) {
  if (isReady()) {
    return Promise.resolve();
  }
  if (scriptRequests.has(url)) {
    return scriptRequests.get(url);
  }

  const request = new Promise((resolve, reject) => {
    const script = document.createElement('script');

    function cleanup() {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    }

    function fail() {
      cleanup();
      script.remove();
      reject(new Error(
        'The AI library could not be downloaded. Check your internet connection and try again.'
      ));
    }

    const timer = setTimeout(fail, 30000);
    script.onload = () => {
      if (!isReady()) {
        fail();
        return;
      }
      cleanup();
      resolve();
    };
    script.onerror = fail;
    script.src = url;
    document.head.append(script);
  });

  scriptRequests.set(url, request);
  request.catch(() => scriptRequests.delete(url));
  return request;
}

let updateStatus = () => {};

const loadModel = createModelLoader(async () => {
  updateStatus('Downloading TensorFlow.js…');
  await loadScript(TENSORFLOW_URL, () => Boolean(window.tf));

  updateStatus('Preparing MobileNet…');
  await loadScript(MOBILENET_URL, () => Boolean(window.mobilenet));

  await withTimeout(
    window.tf.ready(),
    30000,
    'The browser could not initialize TensorFlow.js. Try another browser.'
  );

  updateStatus('Downloading the pretrained model. The first load may take a moment…');
  return withTimeout(
    window.mobilenet.load({ version: 1, alpha: 1.0 }),
    60000,
    'The model download took too long. Check your connection and try again.',
    disposeMobileNet
  );
});

export async function getModel(onStatus = () => {}) {
  updateStatus = onStatus;
  try {
    return await loadModel();
  } catch (error) {
    throw new Error(`Could not load the image model. ${error.message}`);
  } finally {
    updateStatus = () => {};
  }
}
