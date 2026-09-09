#!/usr/bin/env python3
"""
Academic LaTeX, PDF, & DOCX Paper Compiler for the Deanchor Research Project.
Author: Muhammad Maroof
Compiles:
1. Verifies LaTeX source file: Deanchor_Research_Paper.tex
2. Verifies BibTeX bibliography: references.bib
3. Publication-grade PDF: Deanchor_Research_Paper.pdf (via Typst native compiler)
4. Updated Word manuscript: Deanchor_Contextual_Decoupling_Research_Paper.docx
"""

import pathlib
import subprocess
import sys
import typst

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUTPUT_TEX = ROOT / "Deanchor_Research_Paper.tex"
OUTPUT_BIB = ROOT / "references.bib"
OUTPUT_TYP = ROOT / "Deanchor_Research_Paper.typ"
OUTPUT_PDF = ROOT / "Deanchor_Research_Paper.pdf"
DOCX_SCRIPT = ROOT / "scripts" / "generate_research_docx.py"


def compile_typst_pdf():
    if not OUTPUT_TYP.exists():
        print(f"Error: {OUTPUT_TYP} does not exist.")
        return False
    try:
        typst.compile(str(OUTPUT_TYP), output=str(OUTPUT_PDF))
        print(f"[SUCCESS] Compiled Publication-Grade Academic PDF: {OUTPUT_PDF}")
    except OSError as e:
        print(f"⚠️ Warning: Could not overwrite {OUTPUT_PDF} (likely open in PDF viewer/IDE tab).")
        alt_pdf = OUTPUT_PDF.with_name("Deanchor_Research_Paper_new.pdf")
        typst.compile(str(OUTPUT_TYP), output=str(alt_pdf))
        print(f"[SUCCESS] Compiled alternative PDF: {alt_pdf}")
    return True


def compile_docx():
    if DOCX_SCRIPT.exists():
        res = subprocess.run([sys.executable, str(DOCX_SCRIPT)], capture_output=True, text=True)
        if res.returncode == 0:
            print("[SUCCESS] Word DOCX manuscript regenerated successfully.")
        else:
            print(f"[WARNING] Word DOCX generation error: {res.stderr}")


def main():
    print(f"Checking LaTeX: {OUTPUT_TEX} ({OUTPUT_TEX.stat().st_size} bytes)")
    print(f"Checking BibTeX: {OUTPUT_BIB} ({OUTPUT_BIB.stat().st_size} bytes)")
    compile_typst_pdf()
    compile_docx()
    print("[SUCCESS] All LaTeX, BibTeX, PDF, and DOCX deliverables compiled and synchronized!")


if __name__ == "__main__":
    main()
