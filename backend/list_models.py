from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client()
for model in client.models.list():
    print(f"Model: {model.name}")
