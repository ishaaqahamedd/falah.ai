"""Singleton GenAI client — import from here instead of creating per-module."""

import os
from google import genai

_client: genai.Client | None = None


def get_genai_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    return _client
