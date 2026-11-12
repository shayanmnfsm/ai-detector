#!/usr/bin/env bash
# Downloads the SIL OFL variable fonts (Inter + Vazirmatn) as woff2 files
# from Google Fonts into ./fonts/. Run from anywhere:
#   bash scripts/fetch-fonts.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p fonts

python3 - <<'PY'
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

def fetch(family, subsets):
    url = f"https://fonts.googleapis.com/css2?family={family}:wght@100..900&display=swap"
    css = urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read().decode("utf-8")
    # css2 groups @font-face blocks under /* subset */ comments.
    parts = re.split(r"/\*\s*([a-z-]+)\s*\*/", css)
    for i in range(1, len(parts) - 1, 2):
        subset, body = parts[i], parts[i + 1]
        if subset in subsets:
            m = re.search(r"url\((https://[^)]+\.woff2)\)", body)
            if not m:
                raise SystemExit(f"no woff2 URL found for {family}/{subset}")
            out = subsets[subset]
            print(f"{family}/{subset} -> {out}")
            urllib.request.urlretrieve(m.group(1), out)

fetch("Inter", {"latin": "fonts/inter-latin.woff2"})
fetch("Vazirmatn", {
    "arabic": "fonts/vazirmatn-arabic.woff2",
    "latin": "fonts/vazirmatn-latin.woff2",
})
print("Done. Fonts are in ./fonts/ (SIL OFL).")
PY
