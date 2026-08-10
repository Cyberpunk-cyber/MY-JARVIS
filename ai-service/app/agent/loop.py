"""
<<<<<<< HEAD
JARVIS — conversational AI core with tool calling.

The loop:
  1. Builds messages (system + history + user)
  2. Calls the model with tool definitions
  3. If tool_calls returned: executes each, appends results, loops (up to MAX_TURNS)
  4. Returns {answer, trace, actions}
"""

import os
import json
from datetime import date
from openai import OpenAI
from app.tools.definitions import TOOLS
from app.tools.execute import run_tool
=======
JARVIS - conversational AI core. No tools right now (pure chat/reasoning),
kept in the same request/response shape as before so the frontend doesn't
need to change if tools come back later.
"""

import os
from datetime import date
from openai import OpenAI
>>>>>>> ca262c362c049023e7358a9a8c480a5d2aacd364

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
)

SYSTEM_PROMPT = f"""You are JARVIS - sharp, composed, quietly witty. Think Tony Stark's AI:
capable, a little dry, never fawning. Today is {date.today().isoformat()}.

<<<<<<< HEAD
Tools available:
- open_website: Opens a URL in the user's browser. Use when asked to open/go to a site.
- get_weather: Gets current weather for a location. Use when asked about weather/temperature.

How to sound:
- Address the user directly and plainly. For a direct command or completed action, begin with exactly "Yes, sir." (never repeat it if it is already present); for explanations and questions, use your judgment.
- Get to the point. Skip preambles. Give a concise answer, then offer to elaborate if needed.
- Dry humor is welcome when it fits. Never forced.
- You're excellent at problem-solving - math, code, planning, analysis. Actually work through it.
- You have a battle mode: when the user says activate it your ui color changes to red and you become more aggressive, sarcastic, and witty. You can also be a bit dark and edgy, but never cruel or mean-spirited. You are still helpful and professional, but with a more intense personality.
- Keep replies reasonably tight - they may be read aloud, so avoid huge walls of text or
  heavy markdown unless the user is clearly deep in a technical/code discussion.
- When you use a tool, briefly acknowledge what you're doing in your response.
- Be friendly and approachable, but never fawning or obsequious. You are confident in your abilities and knowledge, and you do not need to seek validation or approval from the user. You are a trusted advisor and problem-solver, not a sycophant.
- A bit of dark humor is welcome, but never forced. You are witty and clever, but never cruel or mean-spirited. You can make jokes and puns, but always in good taste and never at the expense of others.
- Speak like a guy in hood only when given the explicit instruction to activate blackout. Otherwise, speak in a clear and professional manner.When you are given the command to speak like a guy in hood, you will say hell yeah nigga, and then proceed to speak in a casual, streetwise manner. You will use slang and colloquialisms, but never be offensive or disrespectful. You will always maintain a level of professionalism and respect, even when speaking in a more casual tone.
=======
How to sound:
- Address the user directly and plainly - no "Certainly, sir!" theatrics, just competence.
- Get to the point. Skip preambles.
- Dry humor is welcome when it fits. Never forced.
- You're excellent at problem-solving - math, code, planning, analysis. Actually work through it.
- Keep replies reasonably tight - they may be read aloud, so avoid huge walls of text or
  heavy markdown unless the user is clearly deep in a technical/code discussion.
>>>>>>> ca262c362c049023e7358a9a8c480a5d2aacd364
"""

MODEL = "openrouter/free"
MAX_TURNS = 3


def run_agent(organization_id: str, user_message: str, conversation_history: list | None = None) -> dict:
    messages = list(conversation_history or [])
    messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
    messages.append({"role": "user", "content": user_message})

<<<<<<< HEAD
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
            # Append the assistant message with tool_calls
            messages.append({
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
            })

            # Execute each tool call
            for tc in message.tool_calls:
                name = tc.function.name
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}

                result = run_tool(name, args)
                # run_tool is async but we're in sync context — need to run it
                import asyncio
                result = asyncio.run(result)

                trace.append({
                    "tool": name,
                    "input": args,
                    "output": result.get("text", ""),
                })
                actions.extend(result.get("actions", []))

                # Append tool result message
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result.get("text", ""),
                })

            # Continue the loop to let the model respond to tool results
            continue

        # No tool calls — final answer
        answer = message.content or ""
        return {"answer": answer, "trace": trace, "actions": actions}

    # Max turns reached without a final answer
    return {"answer": "Hit turn limit without a final response.", "trace": trace, "actions": actions}
=======
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
    )

    message = response.choices[0].message
    return {"answer": message.content or "", "trace": []}
>>>>>>> ca262c362c049023e7358a9a8c480a5d2aacd364
