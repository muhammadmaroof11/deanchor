import time
from openai import OpenAI
from deanchor.prompts import STAGE1_SCHEMAS, STAGE2_PROMPTS
from deanchor.engine import validate_syntax

OPENROUTER_API_KEY = "YOUR_API_KEY_HERE"

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    default_headers={
        "HTTP-Referer": "https://deanchor.research.ai",
        "X-Title": "Deanchor Research"
    }
)

def query_model(model_id: str, prompt: str) -> str:
    for i in range(3):
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
            print(f"  Attempt {i+1} failed: {e}")
            time.sleep(3)
    return ""

def main():
    model_id = "nvidia/nemotron-nano-9b-v2:free"
    print(f"=== Testing Famous Free Model: {model_id} ===")
    
    sample_code = """
    function calculateTotal(items) {
        var total = 0;
        for(var i=0; i<items.length; i++) {
            total = total + items[i].price;
        }
        return total;
    }
    """
    
    print("\n1. Running Stage 1 Extraction...")
    s1_prompt = STAGE1_SCHEMAS["dev"].format(content=sample_code)
    s1_yaml = query_model(model_id, s1_prompt)
    print("Stage 1 Output:\n", s1_yaml[:300])
    
    print("\n2. Running Stage 2 Unanchored Synthesis...")
    s2_prompt = STAGE2_PROMPTS["dev"].format(schema=s1_yaml)
    s2_code = query_model(model_id, s2_prompt)
    print("Stage 2 Output:\n", s2_code[:300])
    
    valid, errors = validate_syntax(s2_code, "dev")
    print(f"\nSyntax Validation: Valid={valid}, Errors={errors}")

if __name__ == "__main__":
    main()
