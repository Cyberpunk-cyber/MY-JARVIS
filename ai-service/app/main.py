import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.agent.loop import run_agent  # Ensure this supports streaming/yielding chunks

app = FastAPI(title="JARVIS - AI Assistant", version="1.0.0")

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://aura-os-gold.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    history: list | None = None


def generate_chat_stream(message: str, history: list | None):
    """Generator function that yields chunks as they arrive from the agent."""
    # If run_agent returns a generator/stream:
    for chunk in run_agent(
        organization_id="personal",
        user_message=message,
        conversation_history=history,
        stream=True,  # Enable streaming flag if your loop supports it
    ):
        # Format as Server-Sent Events (SSE) or simple raw text chunks
        yield f"data: {json.dumps({'text': chunk})}\n\n"


@app.post("/agent/chat")
async def chat_stream(req: ChatRequest):
    return StreamingResponse(
        generate_chat_stream(req.message, req.history),
        media_type="text/event-stream",
    )