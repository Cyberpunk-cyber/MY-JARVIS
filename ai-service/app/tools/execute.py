"""
JARVIS tool implementations — real logic behind the tool schemas.

Each tool returns a dict: {"text": str, "actions": list}
- `text` is a concise, spoken-friendly response for the LLM to incorporate.
- `actions` is a list of client-executable actions (e.g., open_url).

Both functions use httpx (already a dependency).
"""

import httpx
import urllib.parse
import re

# ── WMO weather code → (icon, label, short label) ──
# https://open-meteo.com/en/docs#weathercode
WMO_MAP = {
    0: ("☀️", "Clear sky", "Clear"),
    1: ("🌤️", "Mainly clear", "Mainly clear"),
    2: ("⛅", "Partly cloudy", "Partly cloudy"),
    3: ("☁️", "Overcast", "Overcast"),
    45: ("🌫️", "Fog", "Fog"),
    48: ("🌫️", "Depositing rime fog", "Fog"),
    51: ("🌦️", "Light drizzle", "Drizzle"),
    53: ("🌦️", "Moderate drizzle", "Drizzle"),
    55: ("🌧️", "Dense drizzle", "Drizzle"),
    56: ("🌧️", "Light freezing drizzle", "Freezing drizzle"),
    57: ("🌧️", "Dense freezing drizzle", "Freezing drizzle"),
    61: ("🌦️", "Slight rain", "Rain"),
    63: ("🌧️", "Moderate rain", "Rain"),
    65: ("🌧️", "Heavy rain", "Heavy rain"),
    66: ("🌧️", "Light freezing rain", "Freezing rain"),
    67: ("🌧️", "Heavy freezing rain", "Freezing rain"),
    71: ("🌨️", "Slight snow fall", "Snow"),
    73: ("🌨️", "Moderate snow fall", "Snow"),
    75: ("🌨️", "Heavy snow fall", "Heavy snow"),
    77: ("❄️", "Snow grains", "Snow grains"),
    80: ("🌦️", "Slight rain showers", "Showers"),
    81: ("🌦️", "Moderate rain showers", "Showers"),
    82: ("🌧️", "Violent rain showers", "Heavy showers"),
    85: ("🌨️", "Slight snow showers", "Snow showers"),
    86: ("🌨️", "Heavy snow showers", "Heavy snow showers"),
    95: ("⛈️", "Thunderstorm", "Thunderstorm"),
    96: ("⛈️", "Thunderstorm with slight hail", "Thunderstorm + hail"),
    99: ("⛈️", "Thunderstorm with heavy hail", "Thunderstorm + hail"),
}


def _wmo_info(code: int):
    return WMO_MAP.get(code, ("❓", "Unknown", "Unknown"))


def _normalize_url(url: str) -> str:
    """Prepend https:// if missing; validate scheme is http/https only."""
    url = url.strip()
    if not url:
        raise ValueError("Empty URL")

    # Check if it has a scheme
    parsed = urllib.parse.urlparse(url)
    if not parsed.scheme:
        # No scheme — prepend https://
        url = "https://" + url
        parsed = urllib.parse.urlparse(url)

    # Only allow http/https
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported URL scheme: {parsed.scheme}")

    # Reconstruct to ensure it's clean
    return urllib.parse.urlunparse(parsed)


def _extract_domain(url: str) -> str:
    """Extract a clean domain label from a URL."""
    parsed = urllib.parse.urlparse(url)
    domain = parsed.netloc.lower()
    # Remove www.
    if domain.startswith("www."):
        domain = domain[4:]
    # Remove port if present
    if ":" in domain:
        domain = domain.split(":")[0]
    return domain


async def get_weather(location: str) -> dict:
    """
    Fetch current weather for a location via Open-Meteo (free, no key).
    Returns {"text": str, "actions": []}
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Step 1: Geocode the location
        geo_url = "https://geocoding-api.open-meteo.com/v1/search"
        geo_params = {"name": location, "count": 1, "language": "en", "format": "json"}
        try:
            geo_resp = await client.get(geo_url, params=geo_params)
            geo_resp.raise_for_status()
            geo_data = geo_resp.json()
        except httpx.HTTPError as e:
            return {
                "text": f"Couldn't reach the geocoding service: {e}",
                "actions": [],
            }

        results = geo_data.get("results")
        if not results:
            return {
                "text": f"Couldn't find a location matching '{location}'. Try a city name like 'London' or 'Tokyo'.",
                "actions": [],
            }

        place = results[0]
        lat = place["latitude"]
        lon = place["longitude"]
        name = place.get("name", location)
        country = place.get("country", "")
        admin1 = place.get("admin1", "")
        display_name = ", ".join(filter(None, [name, admin1, country]))

        # Step 2: Fetch current weather
        wx_url = "https://api.open-meteo.com/v1/forecast"
        wx_params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code",
            "timezone": "auto",
        }
        try:
            wx_resp = await client.get(wx_url, params=wx_params)
            wx_resp.raise_for_status()
            wx_data = wx_resp.json()
        except httpx.HTTPError as e:
            return {
                "text": f"Couldn't fetch weather data: {e}",
                "actions": [],
            }

        current = wx_data.get("current", {})
        temp = current.get("temperature_2m")
        feels_like = current.get("apparent_temperature")
        humidity = current.get("relative_humidity_2m")
        wind_speed = current.get("wind_speed_10m")
        wind_dir = current.get("wind_direction_10m")
        weather_code = current.get("weather_code", 0)

        icon, label, short_label = _wmo_info(weather_code)

        # Wind direction → compass point
        def _wind_compass(deg):
            if deg is None:
                return ""
            dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
            idx = round(deg / 22.5) % 16
            return dirs[idx]

        wind_compass = _wind_compass(wind_dir)

        # Build spoken-friendly text
        parts = [f"{label} in {display_name}."]
        if temp is not None:
            parts.append(f"Temperature {temp:.0f}°C")
            if feels_like is not None and abs(feels_like - temp) > 1:
                parts.append(f"feels like {feels_like:.0f}°C")
        if humidity is not None:
            parts.append(f"humidity {humidity}%")
        if wind_speed is not None:
            wind_str = f"wind {wind_speed:.0f} km/h"
            if wind_compass:
                wind_str += f" from {wind_compass}"
            parts.append(wind_str)

        text = ". ".join(parts)

        return {
            "text": text,
            "actions": [
                {
                    "type": "weather_card",
                    "location": display_name,
                    "icon": icon,
                    "condition": label,
                    "temperature": temp,
                    "feels_like": feels_like,
                    "humidity": humidity,
                    "wind_speed": wind_speed,
                    "wind_direction": wind_compass,
                    "temperature_unit": wx_data.get("current_units", {}).get("temperature_2m", "°C"),
                    "wind_unit": wx_data.get("current_units", {}).get("wind_speed_10m", "km/h"),
                }
            ],
        }


async def open_website(url: str, label: str | None = None) -> dict:
    """
    Normalize and validate a URL, return a client action to open it.
    """
    try:
        norm_url = _normalize_url(url)
    except ValueError as e:
        return {"text": f"Invalid URL: {e}", "actions": []}

    final_label = label or _extract_domain(norm_url)

    return {
        "text": f"Opening {final_label} in a new tab.",
        "actions": [
            {
                "type": "open_url",
                "url": norm_url,
                "label": final_label,
            }
        ],
    }


TOOL_FUNCTIONS = {
    "get_weather": get_weather,
    "open_website": open_website,
}


async def run_tool(name: str, args: dict) -> dict:
    """Dispatch to the named tool, catch errors, return consistent shape."""
    fn = TOOL_FUNCTIONS.get(name)
    if not fn:
        return {"text": f"Unknown tool: {name}", "actions": []}
    try:
        return await fn(**args)
    except Exception as e:
        return {"text": f"Tool {name} error: {e}", "actions": []}