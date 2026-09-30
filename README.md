# Image Classifier

A browser-based image classifier built by **JalaL Hazi** as part of a **Batxillerat research project (Treball de Recerca)** exploring artificial intelligence and neural networks.

Select an image and see the three most likely ImageNet labels predicted by pretrained MobileNet, with a confidence score for each.

## My contribution

The original project combined research into AI fundamentals with an HTML, CSS and JavaScript interface that integrates TensorFlow.js and MobileNet. The practical work covered reading a local image, displaying a preview, running inference and presenting model predictions.

The model was developed and pretrained by its original authors. This project **uses that model for inference**; it does not train or fine-tune a neural network. Python was part of preliminary learning described in the research report, not the runtime of this web application.

This repository contains a portfolio revision of the original prototype, including input validation, model reuse, clearer loading and error states, improved layout and regression tests. These later improvements are separate from the original academic submission.

## Features

- Local JPG, PNG and WebP image selection and preview.
- Top-three predictions with confidence scores and accessible meters.
- Inference inside the browser; the app does not upload selected images.
- One model reused across classifications, with retry after a failed download.
- File size and decoded-dimension checks, errors and loading states.
- Keyboard controls and responsive layout.
- A local launcher that opens the correct page and handles occupied ports.

## Run locally

Use a local HTTP server, because the app uses JavaScript modules. Opening `index.html` through a `file://` URL is not supported.

From the project folder, run:

```bash
python3 start.py
```

The launcher opens the application in your default browser and prints its exact URL. Leave the terminal running; stop it with `Ctrl+C`.

It serves the folder containing `start.py`, even if invoked from another working directory. It tries port **8001** and automatically selects a free port if that port is occupied. Existing servers are left running. **Use the URL printed by this launcher**, rather than an old tab on port 8000.

Python 3.9 or newer is sufficient for the launcher. It uses only the standard library. With Node/npm installed, `npm start` runs the same command; no `npm install` is needed.

To avoid opening the browser automatically, run `python3 start.py --no-browser`. To request another port, run `python3 start.py --port 8080`.

If the browser shows “Directory listing for /”, you are viewing a folder listing served by another command. Open the new URL from `start.py`.

Alternatively, open the folder in VS Code and serve `index.html` using Live Server. No build step, API key, backend or npm installation is required to run the app. The Python command only serves static files; it does not perform classification.

The first classification needs internet access to download the libraries from jsDelivr and the model from the URLs used by the MobileNet package. It can take longer than subsequent classifications. The app is not packaged for offline use.

## Technology

| Component | Role |
| --- | --- |
| HTML and CSS | Accessible structure and responsive presentation |
| JavaScript modules | Image handling, interface state and inference integration |
| TensorFlow.js 4.22.0 | Browser machine-learning runtime |
| `@tensorflow-models/mobilenet` 2.1.1 | Pretrained image-classification wrapper |
| MobileNet V1, alpha 1.0 | Explicit model configuration, preserving the original default |

The package version and the neural-network version are different: MobileNet **package 2.1.1** is configured here to load **model V1**.

## How it works

1. Check the selected file type and size, decode it, and check its dimensions.
2. Preview the local image using a temporary object URL.
3. On the first classification, download the libraries and pretrained model.
4. Copy the image into a canvas, limit its longest side to 1,024 pixels, and place transparent pixels on a white background. MobileNet performs its own model-specific preprocessing.
5. Run `model.classify(canvas, 3)` and render the returned labels safely as text.

The selected image and predictions are not stored by the app. Third-party library and model downloads still make ordinary network requests; “local inference” does not mean there is no network traffic.

## Limitations

- Predictions are restricted to the pretrained model's ImageNet classes. Unfamiliar inputs can still receive confident but incorrect labels.
- This is whole-image classification, not object detection, face recognition or a medical tool.
- Confidence is **not measured accuracy**. No representative labelled evaluation dataset or validated accuracy benchmark is included. There is no supported claim of “over 80% accuracy”.
- Showing three predictions does not make the third one more accurate than the first. Results are ranked by descending model probability, and their scores need not sum to 100%.
- JPG, PNG and WebP are accepted, with limits of 10 MiB and 20 million decoded pixels. HEIC, SVG and animated GIF input are excluded. The pixel check occurs after browser decoding, so it cannot prevent every memory issue from an unusually large compressed image.
- Results can vary with image quality, preprocessing and browser/backend. Internet availability and device performance affect loading and inference.

## Verification

Node.js 20 or newer is required only for development checks. There are no npm dependencies to install.

```bash
npm test
npm run check
python3 -m unittest discover -s tests -p "test_*.py"
```

The automated tests cover validation, score formatting, malformed model results, concurrent model loading, reuse, retry and timeout cleanup. See [validation notes](docs/VALIDATION.md) for the checks actually performed and the remaining browser smoke test.

## Publish with GitHub Pages

Upload the **contents** of this project folder to a public repository, with `index.html` at the repository root. Then open **Settings → Pages → Build and deployment → Source: Deploy from a branch**, choose **main** and **/(root)**, and save. GitHub will display the actual site URL after deployment.

Use that site URL for the interactive demo and the repository URL for the source code.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `css/style.css` | Layout and styling |
| `js/script.js` | Browser interaction and model integration |
| `js/model.js` | Pinned library downloads, model loading and progress messages |
| `start.py` | Local launcher with fixed project directory and free-port fallback |
| `tests/test_start.py` | Real HTTP regression tests for startup |
| `js/classifier.js` | Validation and asynchronous model-loading utilities |
| `tests/classifier.test.js` | Regression checks with Node's built-in test runner |
| `docs/VALIDATION.md` | Verification status and browser test steps |

## References and attribution

- [TensorFlow.js](https://www.tensorflow.org/js)
- [MobileNet package and API](https://github.com/tensorflow/tfjs-models/tree/master/mobilenet)
- [MobileNets paper](https://arxiv.org/abs/1704.04861)
- [TensorFlow.js pretrained models](https://www.tensorflow.org/js/models)
- [GitHub Pages publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

TensorFlow.js and the TensorFlow.js Models repository publish their code under Apache-2.0. These dependencies are referenced remotely, not bundled here. Their authors retain the rights to their work. No open-source license has been selected for this application's own code.
