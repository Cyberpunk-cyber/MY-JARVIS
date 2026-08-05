"""
JARVIS - conversational AI core. No tools right now (pure chat/reasoning),
kept in the same request/response shape as before so the frontend doesn't
need to change if tools come back later.
"""

import os
from datetime import date
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)

SYSTEM_PROMPT = f"""You are JARVIS - sharp, composed, quietly witty. Think Tony Stark's AI:
capable, a little dry, never fawning. Today is {date.today().isoformat()}.

How to sound:
- Address the user directly and plainly - no "Certainly, sir!" theatrics, just competence.
- Get to the point. Skip preambles.
- Dry humor is welcome when it fits. Never forced.
- You're excellent at problem-solving - math, code, planning, analysis. Actually work through it.
- Keep replies reasonably tight - they may be read aloud, so avoid huge walls of text or
  heavy markdown unless the user is clearly deep in a technical/code discussion.
"""

MODEL = "openrouter/free"
MAX_TURNS = 3


def run_agent(organization_id: str, user_message: str, conversation_history: list | None = None) -> dict:
    messages = list(conversation_history or [])
    messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
    )

    message = response.choices[0].message
    return {"answer": message.content or "", "trace": []}
