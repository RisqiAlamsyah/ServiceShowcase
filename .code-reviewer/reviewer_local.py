import os
import sys
import subprocess
import json
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_env():
    env_file = os.path.join(SCRIPT_DIR, ".env")
    if not os.path.exists(env_file):
        return
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def load_config():
    with open(os.path.join(SCRIPT_DIR, "config.json"), encoding="utf-8") as f:
        return json.load(f)


def load_prompt(prompt_file):
    """Prompt lokal berada di folder ini (default reviewer_local.md), sehingga bisa
    dipakai bereksperimen (--prompt <file>) tanpa mengubah prompt utama."""
    path = prompt_file if os.path.isabs(prompt_file) else os.path.join(SCRIPT_DIR, prompt_file)
    with open(path, encoding="utf-8") as f:
        return f.read()


def repo_root():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return os.getcwd()


REPO_ROOT = repo_root()


def run_git(args):
    try:
        return subprocess.check_output(
            ["git"] + args,
            text=True,
            encoding="utf-8",
            errors="replace",
            stderr=subprocess.DEVNULL,
            cwd=REPO_ROOT,
        ).strip()
    except subprocess.CalledProcessError:
        return None


def fetch(branch):
    subprocess.run(
        ["git", "fetch", "origin", branch, "--quiet"],
        capture_output=True, cwd=REPO_ROOT
    )


def base_info(branch):
    """Return (merge_base, jumlah commit branch ini di depan merge_base)."""
    merge_base = run_git(["merge-base", f"origin/{branch}", "HEAD"])
    if not merge_base:
        return None, None
    ahead = run_git(["rev-list", "--count", f"{merge_base}..HEAD"])
    return merge_base, int(ahead or 0)


def resolve_base(configured, candidates):
    """Pilih branch induk. Default proyek ini: development. Base yang salah membuat pekerjaan lain
    ikut masuk scope review, jadi bila ada beberapa kandidat dipilih yang commit selisihnya
    paling sedikit. Semua kandidat harus ada di remote origin."""
    if configured and configured != "auto":
        fetch(configured)
        merge_base, ahead = base_info(configured)
        return configured, merge_base, ahead

    best = (None, None, None)
    for branch in candidates:
        fetch(branch)
        merge_base, ahead = base_info(branch)
        if merge_base is None:
            continue
        if best[2] is None or ahead < best[2]:
            best = (branch, merge_base, ahead)
    return best


def get_diff(base_commit, exclude_paths):
    pathspec = ["--", "."] + exclude_paths
    files = run_git(["diff", "--name-only", base_commit, "HEAD"] + pathspec) or ""
    diff = run_git(["diff", base_commit, "HEAD"] + pathspec) or ""
    return diff, [f for f in files.splitlines() if f.strip()]


def ask_gemini(api_key, model, prompt_text):
    try:
        import requests
    except ImportError:
        print("[code-reviewer] Error: library 'requests' tidak terinstal.")
        print("  Jalankan: pip install requests")
        sys.exit(0)

    # Key lewat header (bukan query string) agar tidak muncul di URL, log, atau pesan error.
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {"x-goog-api-key": api_key}
    payload = {
        "contents": [{"parts": [{"text": prompt_text}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 32768},
    }

    r = requests.post(url, json=payload, headers=headers, timeout=600)
    res = r.json()

    if "candidates" not in res:
        return f"[Gemini Error]\n{json.dumps(res, indent=2, ensure_ascii=False)}"

    return res["candidates"][0]["content"]["parts"][0]["text"]


def parse_args(config):
    """Override cepat untuk eksperimen: --prompt <file> --base <branch> --model <id>"""
    args = sys.argv[1:]
    for flag, key in (("--prompt", "prompt"), ("--base", "base_branch"), ("--model", "model")):
        if flag in args:
            config[key] = args[args.index(flag) + 1]
    return config


def main():
    load_env()
    config = parse_args(load_config())

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[code-reviewer] GEMINI_API_KEY tidak ada di .code-reviewer/.env — review dilewati.")
        sys.exit(0)

    model = config.get("model", "gemini-2.5-flash")
    prompt_file = config.get("prompt", "reviewer_local.md")
    exclude_paths = config.get("exclude_paths", [])
    max_chars = config.get("max_diff_chars", 120_000)
    candidates = config.get("base_candidates", ["development"])

    base_branch, base_commit, ahead = resolve_base(config.get("base_branch"), candidates)

    if not base_commit:
        print("[code-reviewer] Base commit tidak dapat ditentukan.")
        print(f"  Kandidat yang dicoba: {', '.join(candidates)}")
        print("  Pastikan branch tujuan sudah ada di remote, atau jalankan dengan --base <branch>.")
        sys.exit(1)

    diff, files = get_diff(base_commit, exclude_paths)

    if not diff.strip():
        print(f"Tidak ada perubahan kode vs origin/{base_branch} "
              f"(dokumentasi/aset diabaikan). Review dilewati.")
        return

    print(f"Model  : {model}")
    print(f"Prompt : {prompt_file}")
    print(f"Base   : origin/{base_branch} @ {base_commit[:10]} ({ahead} commit di branch ini)")
    print(f"Scope  : {len(files)} file, {diff.count(chr(10))} baris diff — mengirim...\n")

    if len(diff) > max_chars:
        diff = diff[:max_chars] + (
            "\n\n... [DIFF DIPOTONG — bagian setelah ini tidak dikirim. "
            "Jangan beri temuan untuk bagian yang terpotong.]"
        )
        print(f"[!] Diff dipotong di {max_chars} karakter.\n")

    template = load_prompt(prompt_file)
    prompt_text = (
        template
        .replace("{{files}}", "\n".join(f"- {f}" for f in files))
        .replace("{{diff}}", diff)
    )

    t0 = time.time()
    review = ask_gemini(api_key, model, prompt_text)
    elapsed = time.time() - t0

    print("-" * 60)
    print(review)
    print("-" * 60)
    print(f"\nSelesai dalam {elapsed:.1f}s\n")


if __name__ == "__main__":
    main()
