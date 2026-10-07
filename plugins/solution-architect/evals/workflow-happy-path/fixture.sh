#!/usr/bin/env bash
# Seeds the empty workspace as the sin-kowa-mini lead folder: the BA package
# plus the architecture document.
set -euo pipefail
src="$(cd "$(dirname "$0")/../../skills/estimate/evals/fixtures/workflow-sin-kowa-mini" && pwd)"
cp "$src/requirements.json" "$src/requirements.md" "$src/ARCHITECTURE.md" .
