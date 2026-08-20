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

def query_with_retry(model_id: str, prompt: str) -> str:
    for attempt in range(5):
        try:
            res = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=2048
            )
            if res.choices and res.choices[0].message and res.choices[0].message.content:
                return res.choices[0].message.content.strip()
        except Exception as e:
            print(f"    [WARN {model_id}] Attempt {attempt+1} error: {e}. Retrying in 6s...")
            time.sleep(6)
    return ""

def test_models():
    target_models = [
        "google/gemma-4-31b-it:free",
        "z-ai/glm-5.2:free"
    ]
    
    sample_code = """
    function getUser(id) {
        if (!id) return null;
        return db.query("SELECT * FROM users WHERE id = " + id);
    }
    """
    
    for model_id in target_models:
        print(f"\n=== Testing Model: {model_id} ===")
        print("1. Running Stage 1 Extraction...")
        s1_prompt = STAGE1_SCHEMAS["dev"].format(content=sample_code)
        s1_yaml = query_with_retry(model_id, s1_prompt)
        print("Stage 1 Output:\n", s1_yaml[:300])
        
        if s1_yaml:
            print("\n2. Running Stage 2 Unanchored Synthesis...")
            s2_prompt = STAGE2_PROMPTS["dev"].format(schema=s1_yaml)
            s2_code = query_with_retry(model_id, s2_prompt)
            print("Stage 2 Output:\n", s2_code[:300])
            
            valid, errors = validate_syntax(s2_code, "dev")
            print(f"\nSyntax Validation: Valid={valid}, Errors={errors}")
        else:
            print("Stage 1 failed or returned empty due to rate limits.")

if __name__ == "__main__":
    test_models()
