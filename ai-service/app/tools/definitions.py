"""
<<<<<<< HEAD
JARVIS tool definitions — OpenAI-compatible function schemas.
The LLM can call these when the user asks to open a website or check the weather.
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "open_website",
            "description": (
                "Open a website in the user's browser. Use this when the user asks to "
                "open, go to, visit, or navigate to a website or web page. "
                "Pass the full URL (e.g., 'https://www.youtube.com') or a recognizable "
                "domain (e.g., 'youtube.com'). The tool returns a client action that "
                "the frontend will execute to open the URL in a new tab of the browser "
                "currently running the app."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to open. Include the scheme (https://) if possible; the tool will normalize it.",
                    },
                    "label": {
                        "type": "string",
                        "description": "Human-friendly label for the link (e.g., 'YouTube'). Used in the UI fallback chip.",
                    },
                },
                "required": ["url"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": (
                "Get current weather for a location. Use this when the user asks about "
                "the weather, temperature, conditions, or forecast for a city or place. "
                "The location can be a city name (e.g., 'London'), a city with country "
                "('Paris, France'), or coordinates. Returns current temperature, "
                "feels-like, humidity, wind, and a human-readable condition."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "Location to get weather for (city name, 'city, country', or 'lat,lon').",
                    },
                },
                "required": ["location"],
                "additionalProperties": False,
            },
        },
    },
]
=======
JARVIS currently has no tools - pure conversational + problem-solving.
Kept as an empty list (not deleted) so adding tools back later is a
one-line change, same pattern as before.
"""

TOOLS = []
>>>>>>> ca262c362c049023e7358a9a8c480a5d2aacd364
