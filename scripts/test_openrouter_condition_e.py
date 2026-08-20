import time
from openai import OpenAI
from deanchor.prompts import STAGE1_SCHEMAS, STAGE2_PROMPTS
from deanchor.engine import validate_syntax

import os
from dotenv import load_dotenv
load_dotenv()

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    default_headers={
        "HTTP-Referer": "https://deanchor.research.ai",
        "X-Title": "Deanchor Research"
    }
)

def query_openrouter(model_id: str, prompt: str, system_prompt: str = "") -> str:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    for attempt in range(3):
        try:
            res = client.chat.completions.create(
                model=model_id,
                messages=messages,
                temperature=0.2,
                max_tokens=2048
            )
            content = res.choices[0].message.content
            if content:
                return content.strip()
        except Exception as e:
            print(f"  Attempt {attempt+1} failed: {e}. Retrying in 3s...")
            time.sleep(3)
    return ""

def test_openrouter_deanchor():
    model_id = "nvidia/nemotron-3-ultra-550b-a55b:free"
    print(f"=== Testing OpenRouter Deanchor Pipeline on 550B Model: {model_id} ===")
    
    sample_code = """
    <div style="background:#fff; padding:20px; width:220px;" class="sidebar-container">
      <h3>User Profile</h3>
      <ul>
        <li>Name: Alice</li>
        <li>Role: Administrator</li>
        <li>Status: Active</li>
      </ul>
      <button onclick="editProfile()">Edit</button>
    </div>
    """
    
    print("\n--- Running Stage 1 Extraction ---")
    stage1_prompt = STAGE1_SCHEMAS["design"].format(content=sample_code)
    stage1_output = query_openrouter(model_id, stage1_prompt)
    print("Stage 1 Output:\n", stage1_output[:300])
    
    print("\n--- Running Stage 2 Unanchored Synthesis ---")
    stage2_prompt = STAGE2_PROMPTS["design"].format(schema=stage1_output)
    stage2_output = query_openrouter(model_id, stage2_prompt)
    print("Stage 2 Output:\n", stage2_output[:300])
    
    valid, errors = validate_syntax(stage2_output, "design")
    print(f"\nSyntax Validation: Valid={valid}, Errors={errors}")

if __name__ == "__main__":
    test_openrouter_deanchor()
