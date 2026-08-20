import os
from pathlib import Path
import shutil

design_dir = Path('experiments/design')

for subj in ['subject_1', 'subject_2', 'subject_3']:
    subj_path = design_dir / subj
    redesign_dir = subj_path / 'redesigned_by_gemini3.1_pro'
    
    if not redesign_dir.exists():
        continue
        
    cond_a_dir = subj_path / 'condition_A'
    cond_a_dir.mkdir(exist_ok=True)
    
    output_md = []
    
    # Pack README
    readme_path = redesign_dir / 'README.md'
    if readme_path.exists():
        output_md.append(readme_path.read_text(encoding='utf-8'))
        
    # Pack original.html
    html_path = redesign_dir / 'original.html'
    if html_path.exists():
        output_md.append("```html\n" + html_path.read_text(encoding='utf-8') + "\n```")
        
    # Pack style.css
    css_path = redesign_dir / 'style.css'
    if css_path.exists():
        output_md.append("```css\n" + css_path.read_text(encoding='utf-8') + "\n```")
        
    # Pack main.js
    js_path = redesign_dir / 'main.js'
    if js_path.exists():
        output_md.append("```javascript\n" + js_path.read_text(encoding='utf-8') + "\n```")
        
    # Write output.md
    (cond_a_dir / 'output.md').write_text("\n\n".join(output_md), encoding='utf-8')
    
    # Remove the old directory
    shutil.rmtree(redesign_dir)
    
print('Packaging complete.')
