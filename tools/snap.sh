#!/bin/sh
# Render a Palmwire City screenshot scene in headless Chrome (software GL) and report page errors.
#   tools/snap.sh <scene> <out.png> [extra query]     (needs `node serve.ts` running on :8080)
# Each run uses its own throwaway browser profile so a lingering instance cannot block it.
SCENE="$1"
OUT="$2"
EXTRA="$3"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE="${TMPDIR:-/tmp}/palmwire-profiles"
URL="http://localhost:8080/?shot=${SCENE}&seed=1${EXTRA}"
FLAGS="--headless=new --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --hide-scrollbars --window-size=1280,720 --virtual-time-budget=60000"
P1="$BASE/dom-$$"
P2="$BASE/shot-$$"
"$CHROME" $FLAGS --user-data-dir="$P1" --dump-dom "$URL" 2>/dev/null | grep -o '<title>[^<]*</title>\|<div id="errlog">[^<]*' | head -c 4000
echo
"$CHROME" $FLAGS --user-data-dir="$P2" --screenshot="$OUT" "$URL" 2>/dev/null
rm -rf "$P1" "$P2" 2>/dev/null
ls -la "$OUT"
