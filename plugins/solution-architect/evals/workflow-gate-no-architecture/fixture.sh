#!/usr/bin/env bash
# Seeds the empty workspace as the sin-kowa-mini lead folder without
# ARCHITECTURE.md, so workflow mode must stop at its first gate.
set -euo pipefail
src="$(cd "$(dirname "$0")/../../skills/estimate/evals/fixtures/workflow-sin-kowa-mini" && pwd)"
cp "$src/requirements.json" "$src/requirements.md" .
