import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.agent.loop import run_agent

app = FastAPI(title="JARVIS - AI Assistant", version="1.0.0")

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


@app.post("/agent/chat")
async def chat(req: ChatRequest):
    return run_agent(
        organization_id="personal",
        user_message=req.message,
        conversation_history=req.history,
    )
@app.post("/agent/chat")
async def chat(req: ChatRequest):
    return await run_agent(
        organization_id="personal",
        user_message=req.message,
        conversation_history=req.history,
    )