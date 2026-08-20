import os
from pathlib import Path
import shutil

experiments_dir = Path('experiments')

# Mapping from user's preferred directory name to the condition directory our scripts expect
DIR_MAPPING = {
    'redesigned_by_gemini3.1_pro': 'condition_A',
    'redesigned_by_gemini3.1_pro_deanchor': 'condition_B'
}

def get_language_from_ext(ext):
    ext_map = {
        '.js': 'javascript', '.jsx': 'javascript',
        '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.java': 'java',
        '.go': 'go',
        '.c': 'c', '.cpp': 'cpp',
        '.rs': 'rust'
    }
    return ext_map.get(ext.lower(), '')

total_packed = 0

for mode_dir in experiments_dir.iterdir():
    if not mode_dir.is_dir():
        continue
        
    for subj_dir in mode_dir.iterdir():
        if not subj_dir.is_dir():
            continue
            
        for source_name, target_name in DIR_MAPPING.items():
            source_dir = subj_dir / source_name
            
            if source_dir.exists() and source_dir.is_dir():
                print(f"Packing {source_dir} -> {subj_dir / target_name / 'output.md'}")
                
                target_dir = subj_dir / target_name
                target_dir.mkdir(exist_ok=True)
                
                output_md = []
                
                # Prioritize README first
                readme_path = source_dir / 'README.md'
                if readme_path.exists():
                    output_md.append(readme_path.read_text(encoding='utf-8', errors='replace'))
                
                # Pack all other files as markdown code blocks
                for file_path in source_dir.rglob('*'):
                    if file_path.is_file() and file_path.name != 'README.md':
                        try:
                            content = file_path.read_text(encoding='utf-8', errors='replace')
                            lang = get_language_from_ext(file_path.suffix)
                            
                            # Add a header for the filename for clarity
                            output_md.append(f"### `{file_path.relative_to(source_dir)}`\n\n```{lang}\n{content}\n```")
                        except Exception as e:
                            print(f"Warning: Could not read {file_path}: {e}")
                
                # Write to output.md
                (target_dir / 'output.md').write_text("\n\n".join(output_md), encoding='utf-8')
                
                # Remove the raw folder to keep things clean
                shutil.rmtree(source_dir)
                total_packed += 1

print(f"Packaging complete. Packed {total_packed} folders.")
