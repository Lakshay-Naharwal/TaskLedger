import gradio as gr
from api.main import app as fastapi_app

# Create a simple dummy Gradio interface so Hugging Face Spaces SDK is happy
with gr.Blocks() as demo:
    gr.Markdown("# TaskLedger API")
    gr.Markdown(
        "This is a headless FastAPI backend running inside a Gradio Space! "
        "The frontend application connects to this."
    )

# Mount the FastAPI app onto the Gradio app
# Gradio uses FastAPI under the hood, so this seamlessly exposes all your /api and /docs routes.
app = gr.mount_gradio_app(fastapi_app, demo, path="/")
