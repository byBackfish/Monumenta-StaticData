# Monumenta Static Data

Static JSON data consumed by MonumentaAddons.

## Files

- `splits/content-splits.v1.json`: Dynamic content split definitions for bosses, strikes, dungeons, raids, hunts, and SKR rooms.
- `skr/riddles.v1.json`: Dynamic SKR riddle locations and accepted riddle text variants.
- `tov/treasures-of-viridia.v1.json`: Known Treasures of Viridia candidate locations.
- `translator/glossary.v1.json`: Translator glossary of words that should never be translated (replaced with `__KEEP<index>__` before API calls).
- `leaderboards/leaderboards.v1.json`: Monumenta leaderboard names (for `/lb` tab completion) plus an `alias` object mapping alias terms to matching leaderboard names. Regenerate the leaderboard list with `./scripts/update-leaderboards.sh` (jq merge, only touches the `leaderboards` field).
