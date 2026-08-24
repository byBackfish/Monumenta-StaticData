# Monumenta Static Data

Static JSON data consumed by MonumentaAddons.

## Files

- `splits/content-splits.v1.json`: Dynamic content split definitions for bosses, strikes, dungeons, raids, hunts, and SKR rooms.
- `skr/riddles.v1.json`: Dynamic SKR riddle locations and accepted riddle text variants.
- `tov/treasures-of-viridia.v1.json`: Known Treasures of Viridia candidate locations.
- `translator/glossary.v1.json`: Translator glossary of words that should never be translated (replaced with `__KEEP<index>__` before API calls).
- `leaderboards/leaderboards.v1.json`: Monumenta leaderboards for `/lb` tab completion, as a map of internal leaderboard name to its list of aliases. Regenerate the key set with `./scripts/update-leaderboards.sh` (jq merge; keeps existing aliases, adds new names with an empty list, drops removed names).
- `alerts/alerts.v1.json`: Chat alert definitions. Each alert has an id/displayName, the text to display when triggered, and a list of chat message triggers (compared against stripped chat messages).
