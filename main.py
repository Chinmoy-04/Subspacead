"""Entrypoint stub. Prefer scripts/, the API in server/ and the website in web/."""

def main() -> None:
    print("SubspaceAD reproduction. See README.md for usage.")
    print("  uv run python scripts/download_data.py")
    print("  uv run python scripts/run_benchmark.py --run-id main")
    print("  uv run uvicorn server.main:app --port 8000")
    print("  cd web && npm i && npm run sync-assets && npm run dev")


if __name__ == "__main__":
    main()
