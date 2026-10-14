#!/usr/bin/env bash
# Seeds the workspace with Riverside Bakery's raw material: three emails and
# one call transcript, each holding one planted trap the graders look for.
set -euo pipefail
cp "$(cd "$(dirname "$0")" && pwd)"/inputs/*.txt .
