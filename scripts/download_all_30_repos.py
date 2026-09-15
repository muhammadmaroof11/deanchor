#!/usr/bin/env python3
"""
download_all_30_repos.py
────────────────────────
Downloads and extracts the complete authentic GitHub repositories for all 30
Deanchor-Bench-30 benchmark projects.

For each repository:
- Downloads full repository archive (.zip) from GitHub with streaming chunk progress
- Extracts all files, test suites, dependencies, and directories into:
    datasets/deanchor_bench_30/<project_id>/repo/
- Updates meta.json with repo statistics (total files, test files, root files)
- Skips already ingested repositories for fast, incremental execution
"""

import os
import sys
import io
import json
import time
import shutil
import zipfile
import pathlib
import urllib.request
import urllib.error

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATASETS_DIR = ROOT / "datasets" / "deanchor_bench_30"
REGISTRY_FILE = DATASETS_DIR / "registry.json"

LOCAL_COPIES = {
    "algo_01_orderbook": ROOT / "experiments" / "realworld" / "perf_orderbook",
    "micro_01_webhook_dispatcher": ROOT / "experiments" / "realworld" / "dev_webhook",
    "sec_01_jwt_auth": ROOT / "experiments" / "realworld" / "sec_auth",
    "ui_01_portfolio": ROOT / "experiments" / "realworld" / "design_portfolio",
}


def download_repo_zip(repo_origin: str) -> bytes:
    """Download repository zip archive with chunked streaming."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeanchorBenchmark/2.0"
    }

    # Try main first, then master
    for branch in ["main", "master"]:
        url = f"https://codeload.github.com/{repo_origin}/zip/refs/heads/{branch}"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as resp:
                buf = io.BytesIO()
                total = 0
                last_report = 0
                while True:
                    chunk = resp.read(1024 * 512) # 512KB chunks
                    if not chunk:
                        break
                    buf.write(chunk)
                    total += len(chunk)
                    if total - last_report >= 5 * 1024 * 1024:
                        print(f"    ... {total / (1024 * 1024):.1f} MB downloaded", flush=True)
                        last_report = total

                data = buf.getvalue()
                if len(data) > 100:
                    return data
        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f"    [HTTP {e.code}] for {branch} on {repo_origin}", flush=True)
        except Exception:
            pass

    # Try query GitHub API for default branch
    try:
        api_url = f"https://api.github.com/repos/{repo_origin}"
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            meta = json.loads(resp.read().decode("utf-8"))
            def_branch = meta.get("default_branch", "main")
            url = f"https://codeload.github.com/{repo_origin}/zip/refs/heads/{def_branch}"
            req2 = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req2, timeout=120) as resp2:
                buf = io.BytesIO()
                while True:
                    chunk = resp2.read(1024 * 512)
                    if not chunk:
                        break
                    buf.write(chunk)
                return buf.getvalue()
    except Exception as e:
        print(f"    [API ERROR] {repo_origin}: {e}", flush=True)

    raise RuntimeError(f"Could not download repository archive for {repo_origin}")


def extract_zip_to_dir(zip_bytes: bytes, target_dir: pathlib.Path):
    """Extract zip archive stripping the top-level repository folder."""
    target_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        namelist = zf.namelist()
        if not namelist:
            return
        root_prefix = namelist[0].split("/")[0] + "/"
        for member in namelist:
            if member == root_prefix or member == root_prefix.rstrip("/"):
                continue
            if not member.startswith(root_prefix):
                rel_path = member
            else:
                rel_path = member[len(root_prefix):]
            if not rel_path:
                continue

            out_path = target_dir / rel_path
            if member.endswith("/"):
                out_path.mkdir(parents=True, exist_ok=True)
            else:
                out_path.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as src, open(out_path, "wb") as dst:
                    dst.write(src.read())


def copy_local_repo(source_dir: pathlib.Path, target_dir: pathlib.Path):
    """Copy local full repository extraction."""
    target_dir.mkdir(parents=True, exist_ok=True)

    for item in source_dir.iterdir():
        if item.name in [".git", "condition_B", "condition_C", "condition_D", "condition_E", "__pycache__"]:
            continue
        dest = target_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest, ignore=shutil.ignore_patterns(".git", "__pycache__"), dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest)


def is_already_ingested(target_dir: pathlib.Path) -> bool:
    """Check if repository is already fully extracted with substantial files."""
    if not target_dir.exists() or not target_dir.is_dir():
        return False
    try:
        files = [f for f in target_dir.iterdir() if f.is_file()]
        return len(files) >= 3
    except Exception:
        return False


def main():
    if not REGISTRY_FILE.exists():
        print(f"Registry file not found at {REGISTRY_FILE}", flush=True)
        sys.exit(1)

    registry = json.loads(REGISTRY_FILE.read_text(encoding="utf-8"))
    print("=" * 78, flush=True)
    print(f" DEANCHOR BENCHMARK: Ingesting Full GitHub Repositories for All {len(registry)} Targets", flush=True)
    print("=" * 78, flush=True)

    successful = 0
    failed = []

    for idx, project in enumerate(registry, 1):
        pid = project["id"]
        repo = project.get("repo_origin")
        target_repo_dir = DATASETS_DIR / pid / "repo"

        print(f"\n[{idx}/{len(registry)}] {pid} ({project['name']})", flush=True)
        print(f"  • Upstream Repo : {repo}", flush=True)
        print(f"  • Target Path   : {target_repo_dir.relative_to(ROOT)}", flush=True)

        # Check if already ingested
        if is_already_ingested(target_repo_dir):
            file_count = sum(1 for f in target_repo_dir.rglob("*") if f.is_file())
            print(f"  ✓ Already fully ingested ({file_count} files on disk). Skipping.", flush=True)
            successful += 1
            continue

        # Check local verified clone
        if pid in LOCAL_COPIES and LOCAL_COPIES[pid].exists():
            print(f"  • Ingesting from verified local clone ({LOCAL_COPIES[pid].name})...", flush=True)
            copy_local_repo(LOCAL_COPIES[pid], target_repo_dir)
            files = list(target_repo_dir.rglob("*"))
            file_count = sum(1 for f in files if f.is_file())
            print(f"  ✓ Ingested {file_count} files across full repository tree.", flush=True)
            successful += 1
            continue

        if not repo or "/" not in repo:
            print(f"  ✗ Skipping: Invalid repo origin '{repo}'", flush=True)
            failed.append((pid, "Invalid repo origin"))
            continue

        try:
            print(f"  • Downloading full repository archive from GitHub...", flush=True)
            t0 = time.time()
            zip_data = download_repo_zip(repo)
            elapsed = time.time() - t0
            print(f"  • Downloaded {len(zip_data) / 1024 / 1024:.2f} MB in {elapsed:.1f}s. Extracting...", flush=True)
            extract_zip_to_dir(zip_data, target_repo_dir)

            files = list(target_repo_dir.rglob("*"))
            file_count = sum(1 for f in files if f.is_file())
            dir_count = sum(1 for f in files if f.is_dir())
            test_files = [f.name for f in files if f.is_file() and ("test" in f.name.lower() or "spec" in f.name.lower())]

            print(f"  ✓ Complete repository ingested: {file_count} files, {dir_count} directories.", flush=True)
            if test_files:
                print(f"  ✓ Found {len(test_files)} test suite files (e.g., {', '.join(test_files[:3])}).", flush=True)

            # Update meta.json
            meta_path = DATASETS_DIR / pid / "meta.json"
            if meta_path.exists():
                try:
                    meta_data = json.loads(meta_path.read_text(encoding="utf-8"))
                    meta_data["full_repo_ingested"] = True
                    meta_data["repo_total_files"] = file_count
                    meta_data["repo_total_dirs"] = dir_count
                    meta_data["repo_test_files_count"] = len(test_files)
                    meta_path.write_text(json.dumps(meta_data, indent=2), encoding="utf-8")
                except Exception:
                    pass

            successful += 1
            time.sleep(1.0)
        except Exception as e:
            print(f"  ✗ Ingestion failed: {e}", flush=True)
            failed.append((pid, str(e)))

    print("\n" + "=" * 78, flush=True)
    print(f" SUMMARY: Successfully Ingested {successful}/{len(registry)} Full GitHub Repositories.", flush=True)
    if failed:
        print(f" Failures ({len(failed)}):", flush=True)
        for pid, err in failed:
            print(f"  - {pid}: {err}", flush=True)
    print("=" * 78, flush=True)


if __name__ == "__main__":
    main()
