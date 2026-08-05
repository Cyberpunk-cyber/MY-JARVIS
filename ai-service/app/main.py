from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.agent.loop import run_agent
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AURA OS - AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://aura-os-gold.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
class ChatRequest(BaseModel):
    message: str
    history: list | None = None


@app.post("/agent/chat")
def chat(req: ChatRequest):
    result = run_agent(organization_id="personal", user_message=req.message, conversation_history=req.history)
    return result


@app.get("/health")
def health():
    return {"status": "ok"}
