#!/usr/bin/env bash
# Apply the local patches to the newest installed Markdown for Humans extension.
# Safe to run more than once: a patch already present is skipped.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
ext=$(ls -d ~/.vscode/extensions/concretio.markdown-for-humans-* | sort -V | tail -1)
js="$ext/dist/webview.js"; css="$ext/dist/webview.css"
[ -f "$js.orig" ] || cp "$js" "$js.orig"
[ -f "$css.orig" ] || cp "$css" "$css.orig"
add() { # file patch marker
  if grep -qF "$3" "$1"; then echo "skip: $(basename "$2") already applied"; else printf '\n' >> "$1"; cat "$2" >> "$1"; echo "applied: $(basename "$2")"; fi
}
add "$js" "$here/focus.js" "local patch: restore editor focus"
add "$js" "$here/tab.js" "local patch: Tab/Shift-Tab"
add "$css" "$here/nested-lists.css" "local patch: normal bullets nested under todos"
echo "Patched $ext. Reload VS Code (Developer: Reload Window)."
