import sys
import json
import pathlib

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

p = pathlib.Path("results/live_end_to_end_results.json")
if not p.exists():
    print("No results file found.")
    exit(0)

data = json.loads(p.read_text(encoding="utf-8"))

print("\n" + "═"*95)
print("             DEANCHOR: COMPLETE LIVE HARDWARE INFERENCE BENCHMARK RESULTS              ")
print("═"*95)
print(f"{'Model & Subject':<42} | {'Cond D AST':<11} | {'Cond E AST':<11} | {'Noise Red.':<11} | {'GPU tok/s':<10}")
print("─"*95)

for k, v in data.items():
    if "local" not in k:
        continue
    cond_d = v.get("condition_D", {})
    cond_e = v.get("condition_E", {})
    d_ast = cond_d.get("ast_divergence", 0.0)
    e_ast = cond_e.get("ast_divergence", 0.0)
    noise = cond_e.get("noise_filtered_pct", 0.0)
    speed = cond_e.get("speed_tok_s", 0.0)
    
    clean_k = k.replace("local_", "").replace("realworld_", "rw_").replace("design_", "des_")
    print(f"{clean_k:<42} | {d_ast:<11.4f} | {e_ast:<11.4f} | {noise:<10.1f}% | {speed:<9.1f}")

print("═"*95 + "\n")
