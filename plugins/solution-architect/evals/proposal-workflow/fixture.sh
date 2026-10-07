#!/usr/bin/env bash
# Seeds the empty workspace as the sin-kowa-mini lead folder with a finished
# workflow-mode estimate: BA package, architecture, estimate inputs and output.
set -euo pipefail
src="$(cd "$(dirname "$0")/../../skills/proposal/evals/fixtures/workflow-sin-kowa-mini" && pwd)"
cp "$src/requirements.json" "$src/ARCHITECTURE.md" "$src/estimation-inputs.json" "$src/estimation.json" "$src/measurements.jsonl" .
