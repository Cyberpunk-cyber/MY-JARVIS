from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.agent.loop import run_agent

app = FastAPI(
    title="AURA OS - AI Service",
    description="A voice-enabled personal AI command interface",
    version="0.1.0",
)

# Explicitly allowed exact origins
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://aura-os-gold.vercel.app",
    "https://aura-os-production-50b6.up.railway.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # This regex automatically matches ANY vercel.app subdomain (like your aura-h7jmypjpi-... preview link)
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    history: list | None = None


@app.post("/agent/chat")
def chat(req: ChatRequest):
    result = run_agent(
        organization_id="personal",
        user_message=req.message,
        conversation_history=req.history,
    )
    return result


@app.get("/health")
def health():
    return {"status": "ok"}