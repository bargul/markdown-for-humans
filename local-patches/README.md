# Local patches

Fixes applied on top of the built extension (`dist/`), kept here until they are turned into proper source changes.

- `focus.js` — the editor loses the text cursor when the VS Code window loses and regains focus (Alt+Tab, emoji pickers). Restores it.
- `tab.js` — Tab and Shift+Tab move only the innermost list item. Shift+Tab on a bullet inside a todo no longer turns the todo into plain text. Tab also nests the first item of a list into the list above it (e.g. a bullet under a todo).
- `nested-lists.css` — normal bullets nested under todos keep their markers and indentation; nested checkboxes and top-level bullets line up with each other.

Apply to the installed extension: `./apply.sh`, then `Developer: Reload Window`. The originals are kept as `webview.js.orig` and `webview.css.orig`.

Tested on version 0.4.5.
