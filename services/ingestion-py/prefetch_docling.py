"""Pre-download Docling's model weights at Docker build time, so the deployed
container starts warm — no 30–60s model download on the first complex-layout
upload. Models cache under HF_HOME (set in the Dockerfile) and bake into the image.

If Docling changes this API, the build will fail here with a clear error — adjust
to the current Docling model-download entry point.
"""

from docling.utils.model_downloader import download_models

if __name__ == "__main__":
    path = download_models()
    print(f"Docling models downloaded to: {path}")
