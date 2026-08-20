from setuptools import setup, find_packages

setup(
    name="deanchor",
    version="1.0.0",
    description="Deanchor Engine: Blank-Slate Context Decoupling for AI Code & UI Synthesis",
    author="Antigravity Team",
    packages=find_packages(),
    install_requires=[
        "llama-cpp-python",
        "pyyaml",
    ],
    entry_points={
        "console_scripts": [
            "deanchor=deanchor.cli:main",
        ],
    },
    python_requires=">=3.9",
)
