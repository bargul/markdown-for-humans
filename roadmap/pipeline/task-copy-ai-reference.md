# Task: Copy Reference for AI

## 1. Task Metadata

- **Task name:** Copy Reference for AI (file and exact source lines)
- **Slug:** copy-ai-reference
- **Status:** in-progress
- **Created:** 2026-10-11
- **Last updated:** 2026-10-11
- **Shipped:** _(pending)_

---

## 2. Context & Problem

**Current state:**
- 0.4.0 retired "Copy AI Context Reference" (PR 90, commit `3b87155`) when the Feedback workflow shipped. Nothing replaces it for the quick case.
- Issue 140: Feedback is too much when all a user needs is a reliable line reference to paste into an agent. The old version copied nothing useful inside tables. The user asks for a command that can be bound to a key.
- Issue 61: users of Cline and similar tools need source line numbers, which the rendered view does not show.

**Weaknesses of the retired version** (read from tag `archive/copy-ai-context-line-numbers`):

| Weakness | Cause |
|---|---|
| Line numbers were computed, not read | The webview serialized each top-level block again and added up line counts (`cursorLine += 2 + pendingBlanks`). Correct only if the saved file is byte-identical to that serialization |
| Block rounded | A caret anywhere in a 40-row table, a long list or a code block returned the whole block |
| Depended on focus | `shouldIncludeLineRange(isFocused, selectionEmpty)`: from the Command Palette the editor is blurred, so a plain caret gave a bare `@file` |
| Frontmatter by subtraction | Subtracted the two fence lines of the wrapped frontmatter, a second copy of a host rule |
| Dialog and setting | A save-confirmation dialog plus `copyAiContextRef.skipSaveWarning` |
| Alt+C | Collides with Toggle Find Case Sensitive on Windows and Linux, which this editor's own find widget uses |

**Why it matters:**
- A wrong line number sends an agent to edit the wrong place. A missing number is an inconvenience; a wrong one is a defect.
- Since 0.4.0 the host has `buildFeedbackAnchorMap`, which reads line spans from the real file text. That did not exist when the old command was written.

---

## 3. Desired Outcome & Scope

**Success criteria:**
- Output is `@<path>#L<start>-<end>`, or `#L<n>` for one line. Path is relative to the file's workspace folder, forward slashes on every platform.
- Every line number is a 1-based line of the saved file and is read from that file's text. It is exact, or it is the exact range of the smallest enclosing block that could be verified, or it is absent. It is never estimated.
- Exact to the line in: paragraphs (including hard-wrapped), headings, nested lists, task lists, blockquotes, GitHub alerts, table rows, code block lines, frontmatter lines, and documents with blank-line runs.
- One Command Palette command, bindable, enabled only in this editor. No new setting.
- Works on a 10,000-line document.

**In scope:**
- Host line resolver, reference formatter, webview selection describer, command, toolbar button, toast, tests, docs.

**Out of scope:**
- A line-number gutter in the rendered view (issue 61's other ask). One rendered block is not one source line, so this is a separate design.
- A live "Ln 12" status bar readout.
- Copying the quoted text with the reference.

---

## 4. UX & Behavior

**Name:** "Copy Reference for AI". Command ID `markdownForHumans.copyReferenceForAi` (the retired ID `copyAiContextRef` stays retired; its guard test is unchanged).

**Entry points:**
- Command Palette: **Markdown Editor for Humans: Copy Reference for AI**, visible and enabled only when `activeCustomEditorId == 'markdownForHumans.editor'`.
- Toolbar: one `@` icon button in the copy and export group, directly after **Copy MD**. Tooltip: "Copy reference for AI (@file#L10-14)". Feedback stays the first control.
- Keybinding: none shipped. README documents how to bind one.

```text
[Feedback] | B I S <> H1 H2 H3 H+ | lists | table quote ... math | Outline Source | Copy MD  @  Export | Audit  Gear
                                                                                              ^ new, same group as the other copy action
```

**Flow:**
1. User places the caret or selects, then runs the command or clicks `@`.
2. If the file has unsaved changes it is saved first (the same flush and save path the autosave bridge uses).
3. The reference is on the clipboard. A toast in the editor shows it: "Copied @bom/README.md#L10-14".

**Behavior rules:**

| Situation | Result |
|---|---|
| No selection | The line of the caret |
| Selection | First through last source line with selected content. A selection that ends at the very start of a block or line does not include that block or line |
| Whole block selected as a node | That block's full range, fences included for a code block |
| Caret in a table cell | That row's line |
| Caret in a code block | That code line, not the fence |
| Caret on a blank line | That blank line when the gap matches the editor's layout, else the blank gap's range |
| A nested position that cannot be verified | The exact range of the smallest verified enclosing block (item, quote, list, table, top-level block) |
| The document cannot be matched to the file at all | `@path` with no line suffix, and the toast says no line numbers were available |
| Untitled document | Not copied. Toast: save the file first |
| Save fails or the editor cannot flush | Not copied. Toast says so |
| Feedback mode active | Works, read only: no flush, no save (the file is already frozen at saved bytes). If the file is dirty there, not copied |
| File outside every workspace folder | Absolute path with forward slashes |

**Fallback, defined precisely.** A step from a block to one of its children is taken only when markdown-it's parse of that block's own source lines has the same number of children as the rendered node and the target child has the same kind. A line inside a paragraph is taken only when the paragraph's source line count equals the rendered line count and every source newline is a line break token. A code line is taken only when the code line counts match. The first check that fails stops the descent, and the range of the last verified node is used.

---

## 5. Technical Plan

**Surfaces:** extension host (resolution, save, clipboard), webview (selection description, toolbar, toast).

```text
command or toolbar
      |
      v
webview: describe selection (block ordinal + child steps + line in block)
         + canonical top-level blocks (same enumeration Feedback uses)
      |  message: copyReferenceForAi
      v
host: flush + save if dirty
      buildFeedbackAnchorMap(saved text, blocks)   -> exact top-level line spans
      verify the touched blocks' content           -> same check Feedback uses
      walk markdown-it tokens of that one block    -> row / item / line
      format, write clipboard
      |  message: copyReferenceForAi.result
      v
webview: toast
```

**Key changes:**
- `src/shared/aiReferenceProtocol.ts` (new): point and selection types, node kind vocabulary, strict request parser.
- `src/editor/aiReference.ts` (new): `resolveAiReferenceLines`, `aiReferencePath`, `formatAiReference`.
- `src/webview/features/aiReferenceSelection.ts` (new): `describeAiReferenceSelection(state)`.
- `src/editor/feedbackSnapshotService.ts`: export the per-block content check and the reference collection it already performs (no behavior change).
- `src/shared/feedbackSnapshotProtocol.ts`: export the existing canonical block parser.
- `src/editor/MarkdownEditorProvider.ts`: `copyReferenceForAi` message handler.
- `src/extension.ts`, `package.json`: command registration and contribution.
- `src/webview/editor.ts`, `src/webview/BubbleMenuView.ts`: trigger, toolbar button, toast.

**Architecture notes:**
- Reuses `buildFeedbackAnchorMap` unchanged. No second parser, no new dependency, no network.
- Line numbers always come from the host's `TextDocument` text after the save. The webview only says which block and which child.
- The clipboard is written on the host (`vscode.env.clipboard`), so it does not depend on webview focus.
- The selection is read from ProseMirror state, which survives blur, so the Command Palette path and the toolbar path behave the same.

**Performance considerations:**
- One block enumeration in the webview and one anchor map build on the host per invocation, the same work Feedback does at start. Nested parsing touches only the one or two blocks at the selection ends.

---

## 6. Work Breakdown

- [x] **Phase 1: Research** - issues 140 and 61, retired code, Feedback mapping, toolbar, external formats
- [ ] **Phase 2: Mapping** - failing tests, then `aiReference.ts` and `aiReferenceSelection.ts`
- [ ] **Phase 3: Wiring** - failing tests, then command, provider handler, webview trigger and toast
- [ ] **Phase 4: Toolbar button** - separate commit so it can be dropped on its own
- [ ] **Phase 5: Docs** - CHANGELOG, README, docs
- [ ] **Testing**
  - [ ] Jest: resolver per block type, multi-block, CRLF, frontmatter, 10,000 lines
  - [ ] Jest: formatting (Windows paths, spaces, outside workspace)
  - [ ] Jest: real editor end to end (selection to lines)
  - [ ] Jest: `package.json` and `extension.ts` wiring
  - [ ] Extension Development Host: command registered and reachable
  - [ ] Real VS Code window pass

---

## 7. Implementation Log

### 2026-10-11 - Research and plan

- **What:** Read both issues, PR 90, the archived implementation and its three commits, the Feedback anchor and snapshot code, and the toolbar. Confirmed markdown-it line maps for table rows, list items, quote paragraphs and fences.
- **Notes:** The archived code emitted `#10-14` with no `L`. Issue 140 writes `#L10-14`. Claude Code's current docs show `@app.ts#5-10`; its older docs showed `@File#L1-99`. See Decisions.

---

## 8. Decisions & Tradeoffs

- **Line format `#L10-14`:** as written in issue 140 and as GitHub writes line anchors, so any agent reads it as lines. Open point: Claude Code's own extension inserts `#5-10` today. Whether its parser attaches the range for the `L` form is not verified. The format lives in one function.
- **Unsaved changes: save first.** The reference must match what the agent reads from disk. Refusing costs a second keypress every time; warning produces a reference that is wrong until the user saves. Saving is what the user would do next anyway, and Feedback already saves on entry. The toast says when a save happened. No dialog, no setting.
- **No default keybinding.** Alt+C is Toggle Find Case Sensitive on Windows and Linux, including in this editor's find widget, and the retirement guard forbids it. Feedback commands also ship unbound. README suggests Alt+K, the chord Claude Code uses for the same action in text editors, as a personal binding.
- **Toolbar button in the copy group.** The September decision was that Feedback is the first control; a button beside Copy MD does not compete with that. Issue 140's reporter could not find the feature after the update, which is a discoverability failure a palette-only command repeats.
- **Toast, not status bar.** Every other toolbar action in this editor confirms inside the editor, and the status bar can be hidden. The toast is not modal and shows the reference.
- **Bare `@path` when nothing can be verified,** instead of refusing. The path alone is true and still useful.
- **Spaces in paths are copied as they are.** No documented quoting form was found for agent mentions.
- **Multi-root workspaces:** the path is relative to the file's own folder, matching the issue's example.

---

## 9. Follow-up & Future Work

- Partial anchoring: when the document as a whole cannot be matched, blocks before the first mismatch could still be anchored.
- A status bar "Ln" readout for the caret (issue 61).
- A right-click entry through `webview/context`.
