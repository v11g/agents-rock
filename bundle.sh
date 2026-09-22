#!/usr/bin/env bash
set -euo pipefail

usage() { echo "usage: ./bundle.sh <plugin-name>"; exit 1; }
[ $# -eq 1 ] || usage
plugin="$1"
src="plugins/$plugin"
[ -d "$src" ] || { echo "error: $src not found"; exit 1; }

mkdir -p build
out="build/$plugin.zip"
rm -f "$out"
(cd plugins && zip -r "../$out" "$plugin" \
  -x "*/node_modules/*" -x "*/.git/*" -x "*.zip" -x "*/evals/results/*")
echo "built $out"
unzip -l "$out" | head -20
