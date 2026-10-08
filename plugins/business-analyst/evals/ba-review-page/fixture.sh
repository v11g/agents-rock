#!/usr/bin/env bash
# Seeds the empty workspace as the sin-kowa-mini lead from business-analyst
# 0.3.x being re-run: requirements.json written, validated and fresh-eyes
# reviewed, still holding two items the BA drafted (drafted() in
# review-fixture.mjs: workflow "Order to cash", feature "Invoice from packed
# quantities"); no md yet. The canonical pass fixture stays drafting-free.
set -euo pipefail
helper="$(cd "$(dirname "$0")/../../skills/business-analyst/scripts/test" && pwd)/review-fixture.mjs"
node --input-type=module -e "
import { drafted } from '$helper';
process.stdout.write(JSON.stringify(drafted(), null, 2) + '\n');
" > requirements.json
