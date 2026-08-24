#!/bin/sh
# Updates the "leaderboards" field of leaderboards/leaderboards.v1.json from
# TeamMonumenta/monumenta-automation's leaderboards.yaml.
#
# Only the "leaderboards" field is replaced; everything else in the JSON
# (schemaVersion, "alias" object, ...) is preserved via jq.
#
# Usage:
#   ./scripts/update-leaderboards.sh
set -eu

URL="https://raw.githubusercontent.com/TeamMonumenta/monumenta-automation/master/leaderboards.yaml"

DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
FILE="$DIR/leaderboards/leaderboards.v1.json"

names=$(curl -fsSL "$URL" \
    | grep '^[[:space:]]*- ' \
    | sed 's/^[[:space:]]*-[[:space:]]*//' \
    | tr -d '\r' \
    | jq -Rs 'split("\n") | map(select(length > 0))')

count=$(printf '%s' "$names" | jq 'length')
if [ "$count" -eq 0 ]; then
    echo "No leaderboards extracted from $URL, not updating." >&2
    exit 1
fi

jq --argjson leaderboards "$names" '.leaderboards = $leaderboards' "$FILE" > "${FILE}.tmp"
mv "${FILE}.tmp" "$FILE"
echo "Updated ${FILE#${DIR}/}: $count leaderboards"
