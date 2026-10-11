# Task: Paste as plain text

## 1. Task Metadata

- **Task name:** Paste as plain text (Ctrl/Cmd+Shift+V)
- **Slug:** paste-plain-text
- **Status:** in-progress
- **Created:** 2026-10-11
- **Last updated:** 2026-10-11
- **Shipped:** _(pending)_
- **Issue:** #11

---

## 2. Context & Problem

**Current state:**
- Ctrl+Shift+V (Cmd+Shift+V on macOS) does nothing in the rich editor.
- A single identifier copied from a VS Code text editor and pasted with Ctrl/Cmd+V lands as a code block that splits the paragraph. Reproduced on `main` at `a6b5579` in a real TipTap editor (jsdom): `Hello world` becomes `Hello`, a `typescript` code block, ` world`.
- `src/webview/utils/pasteHandler.ts` (reworked in `8f637ab` and `76977c1`, July 2026) already classifies VS Code's span-wrapped HTML as plain text. That did not fix the symptom: the paste is then left to TipTap, and TipTap's stock CodeBlock extension has a paste plugin (`codeBlockVSCodeHandler`) that wraps any clipboard carrying `vscode-editor-data` with a language in a code block. `CodeBlockWithCopy` inherits that plugin.

**Pain points:**
- **No way to drop formatting:** text copied from a web page, Word or another editor always arrives with its formatting or is read as Markdown.
- **Copy from code, paste in prose:** a class name copied from the code editor breaks the sentence it is pasted into.

**Why it matters:**
- **Convention:** Ctrl/Cmd+Shift+V is "paste without formatting" in browsers, Google Docs, Slack and Office.
- **Reading experience:** an unwanted code block in the middle of a sentence is the opposite of writing naturally.

---

## 3. Desired Outcome & Scope

**Success criteria:**
- Ctrl+Shift+V (Cmd+Shift+V on macOS) inserts the clipboard's plain text at the caret: no formatting from the clipboard, no automatic code block, no Markdown conversion, no HTML conversion.
- Line breaks are kept: one newline is a line break, a blank line starts a new paragraph.
- The paste is one undo step.
- Ctrl/Cmd+V is unchanged, except that a single line copied from a VS Code editor now lands as inline text.
- Pastes into the search box, dialogs and other inputs are unchanged.

**In scope:**
- A command, `markdownForHumans.pastePlainText`, titled "Markdown Editor for Humans: Paste as Plain Text", with a default keybinding that users can rebind.
- The fix for the single-line VS Code copy.

**Out of scope:**
- Multi-line copies from a VS Code editor: they still become a code block with the source language.
- A toolbar button or context menu entry.
- Browser-hosted VS Code (Codespaces in a browser, code-server). See section 8.

---

## 4. UX & Behavior

**Entry points:**
- Ctrl+Shift+V on Windows and Linux, Cmd+Shift+V on macOS, while the rich editor has focus.
- Command Palette: "Markdown Editor for Humans: Paste as Plain Text".

**Behavior rules (plain-text paste):**

| Caret is in | What is inserted |
| --- | --- |
| Paragraph, list item, blockquote | The text. Each single newline becomes a line break in the same paragraph. One or more blank lines start a new paragraph (a run of blank lines counts as one). |
| Heading | The first line joins the heading. Every further line becomes a paragraph below it, because a Markdown heading cannot hold a line break. |
| Code block | The text exactly as it is, newlines included. A fenced block in the clipboard is not unwrapped (Ctrl/Cmd+V unwraps it). |
| Table cell | The text stays in that cell. Every newline becomes a line break (`<br>` in the saved table). No rows, cells or paragraphs are added; tabs stay as characters. |

- A selection is replaced by the pasted text.
- The pasted text takes the formatting at the caret (pasting inside bold text gives bold text), as "paste and match style" does elsewhere. Nothing is taken from the clipboard's HTML.
- Leading and trailing newlines are dropped, except inside a code block.
- Windows line endings are read as plain newlines.
- Markdown syntax in the text stays literal on screen: `**bold**` shows as asterisks. No input rules or paste rules run.
- Nothing happens when the clipboard has no text (for example an image), while Feedback has the document locked, or while focus is in the search box, the link dialog, the math editor or another input.

**Behavior rule (normal paste):**
- A single line copied from a VS Code text editor is inserted as inline text. A whole-line copy made with an empty selection counts as a single line.

---

## 5. Technical Plan

**How the keystroke travels (verified against VS Code source, releases 1.98 and 1.141):**

```
keydown in webview iframe
   |
   |  our document keydown handler: no match, lets it bubble
   v
VS Code's injected handler (webview/browser/pre/index.html, handleInnerKeydown)
   |  isCopyPasteOrCut = (ctrl or meta) and key is C, V or X. Shift is not checked.
   |  On Electron it calls preventDefault(), so Chromium never fires a paste event.
   v
did-keydown message to the workbench, re-dispatched on the webview element
   |
   v
keybinding service: markdownForHumans.pastePlainText (when clause below)
   |
   v
extension host: vscode.env.clipboard.readText()
   |
   v
postMessage { type: 'pastePlainText', text } to the active webview
   |
   v
insertPlainText(editor, text): one ProseMirror transaction
```

**Mechanism chosen: contributed command and keybinding.**

| Option | Verdict | Why |
| --- | --- | --- |
| Contributed command and keybinding, host reads the clipboard | Chosen | Uses only documented API. Rebindable and visible in the Command Palette. Same on macOS and Windows. Follows `vscode-integration.md` (host commands forward to the active webview). |
| Paste event flag (let Chromium paste, read the Shift state) | Rejected | On desktop VS Code the paste event never fires for this chord: VS Code cancels the keydown. |
| Webview keydown plus `navigator.clipboard.readText()` | Rejected | Works only because VS Code grants the webview `clipboard-read`, which is not a documented contract. The shortcut would be hard-coded and not rebindable. |

**When clause:** `activeCustomEditorId == 'markdownForHumans.editor' && !terminalFocus && !inputFocus`
- External extension keybindings outrank built-in ones (weight 400 against 200 and 300), so the clause must not match while a terminal has focus: Ctrl+Shift+V is terminal paste on Linux and Windows.
- `!inputFocus` keeps the chord away from VS Code's own text inputs. While the webview has focus the workbench's active element is the iframe, which is not an input, so the clause holds.
- VS Code's "Markdown: Open Preview" on the same chord does not apply: it needs a focused text editor (`editorFocus` in 1.141, `editorLangId` in 1.98 and 1.108).

**Key changes:**
- `package.json`: command `markdownForHumans.pastePlainText` and its keybinding.
- `src/extension.ts`: register the command; read the clipboard; post `pastePlainText` to the active webview.
- `src/webview/utils/plainTextPaste.ts` (new): `insertPlainText(editor, text)`, the behavior table above in one transaction, closed off from the previous undo group with `closeHistory`.
- `src/webview/editor.ts`: handle the `pastePlainText` message with the Feedback lock and focus guards.
- `src/webview/utils/pasteHandler.ts`: `getSingleLineEditorCopy(clipboardData)`.
- `src/webview/extensions/codeBlockWithCopy.ts`: a paste plugin placed before TipTap's inherited one that inserts a single-line VS Code copy as plain text.

**Performance considerations:**
- One clipboard read and one transaction per paste. Nothing is added to the typing path.

---

## 6. Work Breakdown

- [x] **Research** - keybinding path, clipboard access, root cause of the code block
- [ ] **Tests first**
  - [ ] `plainTextPaste.realEditor.test.ts`: single line, rich clipboard text, Markdown and HTML syntax kept literal, multi-line, heading, code block, table cell, selection, undo, read-only, empty text
  - [ ] `pasteVsCodeIdentifier.realEditor.test.ts`: the issue's symptom through a real paste event; multi-line copy unchanged
  - [ ] `pastePlainTextCommand.test.ts`: manifest entry, keybinding, host routing
  - [ ] `pastePlainTextMessage.test.ts`: webview message routing and guards
  - [ ] `pasteHandler.test.ts`: `getSingleLineEditorCopy`, VS Code clipboard classification
- [ ] **Implementation**
- [ ] **Docs** - `CHANGELOG.md`, `README.md`
- [ ] **Manual check at a real keyboard** (section 7)

---

## 7. Implementation Log

### 2026-10-11 – Research

- **What:** research done, plan written. Tests and implementation follow.
- **Symptom:** the issue's code block symptom was still present on `main`. The July paste rework did not fix it; the cause is TipTap's inherited VS Code paste plugin, not the HTML classification.
- **Not verified in a real VS Code window:** this session was told not to launch VS Code or use computer use, and a keyboard chord cannot be automated in the Extension Host tests. The Jest suites cover the host command, the message, and the insertion. The keystroke reaching the command is covered only by reading VS Code's source.

**Manual checklist (macOS and Windows):**
1. Copy formatted text from a web page (bold, a link, a heading). Cmd/Ctrl+Shift+V in a paragraph: plain text, no formatting. Cmd/Ctrl+V: still formatted.
2. Copy a class name from a VS Code code editor. Cmd/Ctrl+V mid-sentence: inline text, no code block.
3. Copy three lines with a blank line between the second and third. Cmd/Ctrl+Shift+V: two lines in one paragraph, then a new paragraph.
4. Cmd/Ctrl+Shift+V inside a code block and inside a table cell: see the table in section 4.
5. One Cmd/Ctrl+Z removes the whole paste and nothing else, even right after typing.
6. Open the search box (Cmd/Ctrl+F), press Cmd/Ctrl+Shift+V: the document does not change.
7. Focus the integrated terminal with the rich editor open, press Ctrl+Shift+V (Windows, Linux): the terminal pastes, the document does not change.
8. Open a `.md` file in the plain text editor, press Cmd/Ctrl+Shift+V: VS Code's Markdown preview still opens.
9. Command Palette, "Markdown Editor for Humans: Paste as Plain Text": pastes at the caret.
10. Keyboard Shortcuts: the command is listed and can be rebound.

---

## 8. Decisions & Tradeoffs

- **Line breaks:** a single newline becomes a line break, not a new paragraph. This matches how the editor reads a single newline in a file today (`breaks: true`) and how Markdown-looking pastes are handled. ProseMirror's own plain paste would make every line a paragraph and drop the difference between a line break and a blank line.
- **Own transaction, not `view.pasteText`:** ProseMirror's paste path marks the transaction as a paste, which runs TipTap's paste rules and would turn `**bold**` into bold text.
- **`closeHistory`:** ProseMirror merges changes made within 500 ms into one undo step. Without it, undo after "type, then paste at once" would also remove the typing.
- **Single line only for the VS Code fix:** the issue is about an identifier. Multi-line code copied from VS Code still becomes a code block, which is useful for code.
- **Clipboard read on the host:** `vscode.env.clipboard` also works when the extension host is remote.
- **Could not confirm from documentation:** that `editorLangId` is unset while a custom editor has focus. The source shows it is bound to the text editor widget, and the issue reporter saw no preview open. Our keybinding outranks the built-in one in either case.
- **Not covered: browser-hosted VS Code.** There VS Code does not cancel or forward the keydown, so the browser's own plain paste fires and our paste handler treats it like Ctrl+V. Behavior there is unchanged by this task.

---

## 9. Follow-up & Future Work

- Text that starts a line with `#`, `-`, `>` or `1.` stays literal on screen after a plain paste but is saved without an escape, so it reads as a heading or list when the file is reopened. This is how the serializer treats any literal text today; inline syntax (`**`, backticks, brackets, HTML tags) is escaped correctly.
- Multi-line prose copied from a `.md` file open in VS Code's text editor still pastes as a `markdown` code block when it has no Markdown syntax.
- Code copied from VS Code that contains `*` pairs (`a * b * c`) is read as Markdown emphasis by normal paste.
- Browser-hosted VS Code: honor Shift on the native paste event.
- A "Paste as plain text" entry in the context menu.
