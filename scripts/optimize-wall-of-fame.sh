#!/usr/bin/env bash
# Wall of Fame: PNGs in originals/ → optimierte WebP + index.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/wall-of-fame/originals"
OUT="$ROOT/assets/wall-of-fame"
MAGICK="${MAGICK:-magick}"

if ! command -v "$MAGICK" >/dev/null 2>&1; then
  echo "ImageMagick (magick) nicht gefunden." >&2
  exit 1
fi

mkdir -p "$SRC" "$OUT"

shopt -s nullglob
for f in "$SRC"/*.png "$SRC"/*.PNG "$SRC"/*.jpg "$SRC"/*.jpeg; do
  base="$(basename "$f")"
  base="${base%.*}"
  echo "→ $base.webp"
  "$MAGICK" "$f" -resize 240x240^ -gravity center -extent 240x240 -strip \
    -quality 82 -define webp:method=6 "$OUT/${base}.webp"
done

python3 - "$OUT" <<'PY'
import json, pathlib, sys
out = pathlib.Path(sys.argv[1])
handles = sorted(p.stem for p in out.glob("*.webp"))
(out / "index.json").write_text(json.dumps(handles, indent=2) + "\n", encoding="utf-8")
print(f"index.json: {len(handles)} Einträge")
PY

du -sh "$OUT"/*.webp 2>/dev/null | tail -1 || true
echo "Fertig."
