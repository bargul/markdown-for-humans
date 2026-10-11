# Task: Warn before a save drops source the editor cannot keep

## 1. Task Metadata

- **Task name:** Warn before a save drops source the editor cannot keep
- **Slug:** html-loss-guard
- **Status:** planned (detection built and measured; behavior waits for the owner's decisions in section 4)
- **Created:** 2026-10-11
- **Last updated:** 2026-10-11
- **Shipped:** _(pending)_

---

## 2. Context & Problem

**Current state:**
- A block the user does not edit is saved from its authored source. A block the user edits is written again from the editor's document tree.
- Whatever the tree does not hold is dropped at that moment, with no message: an HTML tag with no mark (`<mark>`, `<u>`, `<span>`, `<br>`), a backslash escape, the edge spaces of a code span.
- Some source never enters the editor at all (`<video>`, `<iframe>`, a standalone `<a name>` anchor). It is dropped by the first edit anywhere in the document.
- Measured in `fidelity-audit-2026-10.md`: 50 of 229 shapes lose or change content when edited; 12 shapes are lost without being edited.

**Pain points:**
- **Silent loss:** the user sees nothing in the rich view and finds the change later in Git, or not at all.
- **No way out:** until every shape has its own node or mark, the editor cannot keep these. It can at least say so.

**Why it matters:**
- Fidelity is the product's promise. A warning turns a silent loss into a choice.
- Each past fix covered one reported shape. A guard that compares input with output covers shapes nobody has reported.

---

## 3. Desired Outcome & Scope

**Success criteria:**
- The editor never writes a file that lost source text without telling the user what was lost.
- On open, the user is told when the document holds content that any edit would remove.
- No measurable cost while typing; the scan runs outside the typing path.

**In scope:**
- Detection (built, see section 5).
- The warning and what the editor does at the moment of loss (not built, see section 4).

**Out of scope:**
- Making the shapes round-trip. That is the generic passthrough, `fidelity-audit-2026-10.md` section 6 item 4.
- A blanket warning on any file that contains HTML. 44 of 55 HTML shapes are safe untouched, so it would fire on files that are fine.

---

## 4. UX & Behavior: decisions needed

Two situations, found by the scan right after load:

```
document opens
   |
   +-- A. source no block holds (lost by any edit)   e.g. <video>, <iframe>, <a name>
   |
   +-- B. a fragile block (lost when that block is edited)
            B1. named loss: tags, comments, definitions    e.g. <mark>, <br>, <h1 align>
            B2. reads differently, nothing named            e.g. \# escape, `code ` spaces, loose list
```

| Decision | Options | Recommendation |
|---|---|---|
| **1. Situation A, on open** | (a) Banner only. (b) Banner, and the rich view is read-only until the user clicks "Edit anyway". | (b). Any keystroke destroys the content, so the user should choose first. One click, once per opened document. |
| **2. Situation B1, when the block is edited** | (a) Let the edit through, then show a banner naming what was dropped, with Undo and "Open in text editor". (b) Lock the block in the rich view. (c) Ask before the first edit of such a block. | (a). Locking stops a typo fix in any paragraph with a `<br>`; asking interrupts typing. |
| **3. Situation B2** | (a) Same banner as B1 with generic wording. (b) No warning. (c) Warn only when the block's kind changes (paragraph to heading or list). | (a), shown once per document until dismissed, because most B2 cases are list spacing and would repeat. |
| **4. Marking fragile blocks up front** | (a) No mark. (b) A quiet gutter mark on blocks with a named loss. | (a) first. Add (b) if the banner proves too late. |

Wording, for approval (all through `l10n.t`):
- A: "This file has content the editor cannot keep: {tags}. Editing here will remove it from the file." Actions: "Open in text editor", "Edit anyway".
- B1: "Saving this block removed {tags} from the file." Actions: "Undo", "Open in text editor".
- B2: "Saving this block changed how it reads." Actions: "Undo", "Open in text editor".

---

## 5. Technical Plan

**Built (no behavior change, nothing calls it in the product yet):**
- `src/shared/sourceLoss.ts`: `describeSourceLoss(source, saved, render?)` names the HTML tags, comments and link definitions the saved text lacks, counting repeats; with a renderer it also reports a different rendering. Pure, so the host can use it too.
- `src/webview/utils/markdownSerialization.ts`: `listRememberedBlockSources(editor)` returns, for each block whose authored source is still held, that source and what the serializer writes for it.
- `src/webview/utils/sourceFidelity.ts`: `findFragileBlocks(editor, render?)` and `renderForComparison` (a private marked instance with the editor's dialect: GFM, single newlines as breaks).
- `src/__tests__/helpers/productionEditor.ts`: one test editor with production's parse and save extensions, used by the audit and the new tests.

**How the two situations are detected:**
- A: `describeSourceLoss(source, untouched save)`. One string comparison when nothing is wrong.
- B: `findFragileBlocks(editor, renderForComparison)`.

**Measured accuracy** (the audit runs the scan after load, then really edits each block and compares):

| Corpus | Loses content when edited | Caught by name only | Caught with rendering | False alarms with rendering |
|---|---|---|---|---|
| 229 testable shapes | 50 | 31 | 46 | 3 |
| 5,525 testable repository blocks | 93 | 9 | 92 | 1 |

- Detection by tag name alone, the literal "raw HTML" reading of this task, catches 10% of the lossy blocks in real documents. Comparing renderings catches 99%.
- Missed shapes: `H~2~O`, `[X]` task marker, two adjacent lists with different markers, and the mixed plain and task list. marked renders the before and after of these the same.
- False alarms: an HTML table rewritten with the same cells, `<hr>` written as `---`, and one indented image.

**Measured cost** (jsdom, 8,499 lines, 2,500 blocks, 500 of them fragile): load 913 ms; document check 1 ms; block scan about 30 ms.

**Still to build, after the decisions:**
- Run the scan after load in idle time (`src/webview/editor.ts`), keep the result per document.
- Situation A: banner, and read-only if decision 1 is (b).
- Situation B: on a transaction that changes a fragile block, show the banner; "Undo" runs the editor's undo.
- UI text through `l10n.t`, then `npm run l10n:extract`.
- Extension Host test with a fixture for A and one for B.

---

## 6. Work Breakdown

- [x] Detection core, test-first: 10 unit tests, 13 real-editor tests
- [x] Accuracy and cost measured through the audit harness
- [ ] Owner decisions 1 to 4 and wording
- [ ] Scan after load, banners, read-only state
- [ ] Extension Host tests, real VS Code check
- [ ] `KNOWN_ISSUES.md` and `CHANGELOG.md`

---

## 7. Implementation Log

### 2026-10-11 - Detection built, design stop

- **What:** pure loss description, block scan, shared test editor, audit accuracy columns.
- **Notes:** the first comparison treated a reference link (`[a]`) as changed, because a block rendered alone has no definitions. The scan now renders every block together with the document's definitions. Spaces at the end of a line are ignored, since the editor's dialect shows nothing for them.

---

## 8. Decisions & Tradeoffs

- **Scan at load, not at save.** At save time the host only sees old text and new text and cannot tell a tag the user deleted from one the serializer dropped. At load the editor still has both the authored source and its own output for each block, so the comparison is exact and happens before any loss.
- **Compare renderings, not only tag names.** See the accuracy table.
- **marked as the judge.** It is already in the webview bundle and is the dialect the rich view reads. markdown-it would add about 100 KB to the bundle (not measured).

---

## 9. Follow-up & Future Work

- Generic passthrough, so situations A and B1 stop existing.
- Feed the scan result to Feedback, so a refusal can name the block and the reason.
- Turn the audit into a CI ratchet (`fidelity-audit-2026-10.md` section 6 item 1).
