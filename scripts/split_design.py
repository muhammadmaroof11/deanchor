import os
import re
from pathlib import Path

def split_subject(subj_dir):
    p = Path(subj_dir) / 'original.html'
    if not p.exists(): return
    
    html = p.read_text(encoding='utf-8')
    
    # Extract CSS
    style_match = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
    if style_match:
        css = style_match.group(1).strip()
        (Path(subj_dir) / 'style.css').write_text(css, encoding='utf-8')
        # Replace style block
        html = html[:style_match.start()] + '<link rel="stylesheet" href="style.css" />\n  <script src="main.js" defer></script>' + html[style_match.end():]

    # Extract JS
    script_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
    js = ''
    if script_match:
        js = script_match.group(1).strip()
        html = html[:script_match.start()] + html[script_match.end():]
        
    (Path(subj_dir) / 'main.js').write_text(js, encoding='utf-8')
    p.write_text(html, encoding='utf-8')

split_subject('experiments/design/subject_1')
split_subject('experiments/design/subject_2')
split_subject('experiments/design/subject_3')
print('Splitting done.')
