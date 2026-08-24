#!/bin/sh
# Updates the "leaderboards" map of leaderboards/leaderboards.v1.json from
# TeamMonumenta/monumenta-automation's leaderboards.yaml.
#
# The map is keyed by leaderboard name with the alias list as value. Only the
# set of keys is refreshed: aliases of existing entries are preserved, new
# names start with an empty list, removed names are dropped.
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

jq --argjson names "$names" '
    . as $root
    | .leaderboards = (
        $names
        | map({key: ., value: ($root.leaderboards[.] // [])})
        | from_entries
      )
' "$FILE" > "${FILE}.tmp"
mv "${FILE}.tmp" "$FILE"
echo "Updated ${FILE#${DIR}/}: $count leaderboards"
