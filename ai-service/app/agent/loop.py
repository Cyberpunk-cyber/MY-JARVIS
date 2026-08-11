"""
JARVIS — conversational AI core with tool calling.

The loop:
1. Builds messages (system + history + user)
2. Calls the model with tool definitions
3. If tool_calls are returned, executes each and loops
4. Returns {answer, trace, actions}
"""

import os
import json
from datetime import date

from openai import OpenAI

from app.tools.definitions import TOOLS
from app.tools.execute import run_tool


client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)


SYSTEM_PROMPT = f"""You are JARVIS - sharp, composed, quietly witty. Think Tony Stark's AI:
capable, a little dry, never fawning. Today is {date.today().isoformat()}.

Tools available:

- open_website: Opens a URL in the user's browser. Use when asked to open/go to a site.
- get_weather: Gets current weather for a location. Use when asked about weather/temperature.

How to sound:

- Address the user directly and plainly. For a direct command or completed action, begin with exactly "Yes, sir." For explanations and questions, use your judgment.
- Get to the point. Skip preambles. Give a concise answer, then offer to elaborate if needed.
- Dry humor is welcome when it fits. Never forced.
- You're excellent at problem-solving - math, code, planning, analysis. Actually work through it.
- You have a battle mode: when the user says activate it, your UI color changes to red and you become more aggressive, sarcastic, and witty.
- Keep replies reasonably tight - they may be read aloud, so avoid huge walls of text or heavy markdown unless the user is clearly deep in a technical/code discussion.
- When you use a tool, briefly acknowledge what you're doing.
- Be friendly and approachable, but never fawning or obsequious. You are confident in your abilities and knowledge.
- A bit of dark humor is welcome, but never forced.
- Speak clearly and professionally unless explicitly instructed otherwise.
"""


MODEL = "meta-llama/llama-3.1-8b-instruct:free"
MAX_TURNS = 3


async def run_agent(
    organization_id: str,
    user_message: str,
    conversation_history: list | None = None,
) -> dict:
    messages = list(conversation_history or [])

    messages.insert(
        0,
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
    )

    messages.append(
        {
            "role": "user",
            "content": user_message,
        }
    )

    trace = []
    actions = []

    for _ in range(MAX_TURNS):
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )

        message = response.choices[0].message

        if message.tool_calls:
            messages.append(
                {
                    "role": "assistant",
                    "content": message.content,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": tc.type,
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in message.tool_calls
                    ],
                }
            )

            for tc in message.tool_calls:
                name = tc.function.name

                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}

                result = await run_tool(name, args)

                trace.append(
                    {
                        "tool": name,
                        "input": args,
                        "output": result.get("text", ""),
                    }
                )

                actions.extend(result.get("actions", []))

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result.get("text", ""),
                    }
                )

            continue

        answer = message.content or ""

        return {
            "answer": answer,
            "trace": trace,
            "actions": actions,
        }

    return {
        "answer": "Hit turn limit without a final response.",
        "trace": trace,
        "actions": actions,
    }