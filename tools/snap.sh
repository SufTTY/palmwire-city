#!/bin/sh
# Render a Palmwire City screenshot scene in headless Chrome (software GL) and report page errors.
#   tools/snap.sh <scene> <out.png> [extra query]     (needs `node serve.ts` running on :8080)
SCENE="$1"
OUT="$2"
EXTRA="$3"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROFILE="${TMPDIR:-/tmp}/palmwire-chrome-profile"
URL="http://localhost:8080/?shot=${SCENE}&seed=1${EXTRA}"
FLAGS="--headless=new --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --hide-scrollbars --window-size=1280,720 --virtual-time-budget=60000"
"$CHROME" $FLAGS --user-data-dir="$PROFILE" --dump-dom "$URL" 2>/dev/null | grep -o '<title>[^<]*</title>\|<div id="errlog">[^<]*' | head -c 4000
echo
"$CHROME" $FLAGS --user-data-dir="$PROFILE" --screenshot="$OUT" "$URL" 2>/dev/null
ls -la "$OUT"
