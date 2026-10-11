# Task: Localization (translation) support

## 1. Task Metadata

- **Task name:** Localization (translation) support
- **Slug:** localization
- **Status:** planned (scoping done, proof of concept on branch `claude/l10n-scoping-d621b8`)
- **Created:** 2026-10-11
- **Last updated:** 2026-10-11
- **Shipped:** _(pending)_
- **Issues:** [#55](https://github.com/concretios/markdown-for-humans/issues/55) (Chinese Simplified, suggests `vscode-nls`, offers to review), [#77](https://github.com/concretios/markdown-for-humans/issues/77) (translate the extension, "including icons with a letter such as B for bold")

**Recommendation in one paragraph.** Do the invisible groundwork now (Phase 0, 1.5 working days, English only), not the full conversion. Full translation is about 16.5 working days for one locale; the smallest translated release that reads as finished is about 12. Demand today is two issues, both self-rated "Low - Nice to have", with no comments. Phase 0 stops the string debt from growing while three feature branches add more text, and costs nothing visible. Schedule the area conversions as small pull requests between features, and switch a language on only when the gate in section 6 passes.

---

## 2. Context & Problem

**Current state (measured at `a6b5579`, origin/main, 2026-10-11):**

- Every user-facing string is hardcoded English. No `package.nls.json`, no `l10n` folder, no `vscode.l10n` call.
- `engines.vscode` is `^1.98.0`. Everything needed exists at that floor (section 5.1).
- 134 source files, 74,835 lines. 11,818 string literals contain letters. About 925 of them are user-facing text.

**Pain points:**

- **No way to contribute a translation:** issue #55 offers Chinese text and review, and there is nowhere to put it.
- **Letter icons:** issue #77 points at the bold button. Its glyph is a drawn Latin "B" from the Codicon font, so it cannot be translated as a string (section 5.4, item 5).
- **Debt grows daily:** 87 of the last 306 commits (90 days) touched the files that hold UI text.

**Why it matters:**

- **Reach:** VS Code ships 14 non-English display languages. Simplified Chinese is the largest; its language pack has 3.65 million downloads on Open VSX alone [S15].
- **Cost of waiting:** each new feature adds strings that must later be converted one by one.
- **Platform standard:** VS Code has had a built-in translation API since 1.73 [S1][S5]. `vscode-nls`, which #55 suggests, still works but receives no new features [S8].

### Measured counts

How it was counted: a TypeScript AST walk over `src/` (tests and mocks excluded) classified every string literal by where it flows (notification call, DOM text or attribute assignment, UI helper argument, `throw`, `console.*`, comparison, selector). Text inside HTML templates was split into visible text nodes and `title`, `aria-label`, `placeholder`, `alt` attributes. I read every row of the host group (131 rows, 1 false positive, 8 missed in `wordCount.ts`) and about 600 webview rows. Treat the totals as accurate to about plus or minus 5 percent. Scripts: `l10n-scoping/` in the shared session notes folder.

| Group                                   | Strings | Notes                                                                 |
| --------------------------------------- | ------: | --------------------------------------------------------------------- |
| Manifest (`package.json`)               |      41 | 39 translatable; `displayName` and `description` stay literal         |
| Extension host UI                       |    ~140 | notifications, dialogs, quick picks, progress, status bar             |
| Webview UI                              |     754 | 668 distinct texts; 77 texts appear more than once                    |
| **Translatable total**                  | **~925** |                                                                       |
| Diagnostic error text (host + webview)  |     206 | `throw new Error(...)` detail; recommended to stay English            |
| Never translate: report and validators  |     749 | sealed Feedback bundle, agent handoff prompt, bundle validators       |
| Never translate: log lines              |     314 | 277 literals carry the `[MD4H]` prefix                                |
| Never translate: keys and technical     |  ~9,800 | command IDs, selectors, class names, protocol values, Markdown syntax |

Manifest breakdown: 16 command titles, 10 setting descriptions, 2 setting Markdown descriptions, 8 color descriptions, 1 configuration title, 1 custom editor name, 1 view name, 2 listing fields.

Webview by area:

| Area                         | Strings | Largest files                                                                                   |
| ---------------------------- | ------: | ----------------------------------------------------------------------------------------------- |
| Feedback review              |     323 | `feedbackReview.ts` 162, `feedbackCapture.ts` 46, `feedbackTargetPresentation.ts` 46            |
| Toolbar and menus            |     124 | `BubbleMenuView.ts` 109, `mermaidTemplates.ts` 15                                               |
| Image dialogs                |     120 | `imageResizeModal.ts` 24, `imageRenameDialog.ts` 22, `imageInsertDialog.ts` 16                  |
| Dialogs and overlays         |     118 | `linkDialog.ts` 39, `mathEditor.ts` 33, `searchOverlay.ts` 11, `tocOverlay.ts` 9                |
| Audit                        |      38 | `auditOverlay.ts` 27, `auditDocument.ts` 11                                                     |
| Editor core and node views   |      31 | `editor.ts` 14, `codeBlockCopyNodeView.ts` 7                                                    |

Host by file: `MarkdownEditorProvider.ts` 83 (about 33 belong to Feedback), `documentExport.ts` 38, `wordCount.ts` 12, `outlineView.ts` 2, `feedbackCommandReadiness.ts` 2, `extension.ts` 1, `documentEditCoordinator.ts` 1.

Never translate, and why:

- **Log lines** with `[MD4H]`: support and bug reports depend on searchable English.
- **Command IDs, setting keys, protocol values, selectors, Markdown and Mermaid syntax, LaTeX templates.**
- **Feedback bundle and agent handoff** (`feedbackReportV2.ts`, `feedbackHandoffPrompt.ts`, `feedbackItemSummaryV2.ts`, `feedbackSessionStore.ts` and 7 more files): the text is a file format read by AI agents and by the bundle validators.
- **Diagnostic detail** inside wrappers such as `Failed to save image: {0}`: translate the wrapper, keep the inner error English.

---

## 3. Desired Outcome & Scope

**Success criteria:**

- A user whose VS Code display language has a complete bundle sees the manifest, notifications and editor UI in that language.
- A string or language without a translation shows English. Nothing is ever blank or shows a key.
- No release ships a language that covers only part of the product (gate in section 6).
- Editor start stays under 500 ms and typing under 16 ms. Measured cost of the mechanism: 0.3 ms host render plus 0.3 ms webview parse for a 900-string bundle; 0.2 microseconds per lookup.
- No new runtime dependency.
- CI fails on stale, broken or unextractable translations.

**In scope:**

- Manifest strings except `displayName` and `description`.
- Host notifications, dialogs, quick picks, progress and status bar text.
- Webview toolbar, menus, dialogs, overlays, placeholders, tooltips, `aria-label` text, live-region announcements.
- A contributor path for community translators.

**Out of scope:**

- `displayName`, `description`, `keywords`, README, CHANGELOG, Marketplace listing.
- Log lines, error detail, the Feedback bundle and handoff prompt.
- Right-to-left layout (section 5.4, item 8).
- A language switch inside the extension. The VS Code display language decides.
- Machine translation at runtime, any network call, any hosted translation service.

---

## 4. UX & Behavior

**Entry points:**

- None new. The user picks a language with VS Code's "Configure Display Language", which needs that language's Language Pack [S10].

**User flows:**

### Flow 1: User with a translated display language

1. VS Code starts with display language `zh-cn`.
2. VS Code loads `package.nls.zh-cn.json` for the manifest and `l10n/bundle.l10n.zh-cn.json` for code.
3. The host renders the loaded bundle into the webview HTML.
4. Toolbar, dialogs and notifications appear in Chinese.

### Flow 2: User with a language that has no bundle, or English

1. VS Code finds no bundle; `vscode.l10n.bundle` is `undefined` [S4].
2. The host adds nothing to the HTML.
3. Everything appears in English, exactly as today.

### Flow 3: Community translator

1. Copies `l10n/bundle.l10n.json` to `bundle.l10n.<locale>.json` and translates the values.
2. Opens a pull request that touches only translation files.
3. CI checks keys, placeholders and markup. A second native speaker or a back-translation review approves (section 5.6).

**Behavior rules:**

- Lookup is by exact VS Code locale id (`zh-cn`, `pt-br`, `de`). VS Code does not fall back from a regional locale to a base language [S9].
- A changed English sentence loses its translation until re-translated, and shows English meanwhile.
- Keyboard shortcut names (`Ctrl`, `Shift`, `Enter`, `Escape`) stay as printed on the key.
- Product and format names stay untranslated: Mermaid, Markdown, LaTeX, KaTeX, PDF, Word, Chrome, language names in the code block menu.

---

## 5. Technical Plan

### 5.1 How VS Code localizes extensions (verified)

| Mechanism                          | What it covers                         | Minimum VS Code                     | This extension (`^1.98.0`)        |
| ---------------------------------- | -------------------------------------- | ----------------------------------- | --------------------------------- |
| `package.nls.json` + `%key%`       | Manifest strings                       | Older than 1.73; docs state no version [S1] | Available                 |
| `package.nls.<locale>.json`        | Manifest translations, English fallback per key | Same                       | Available                         |
| `vscode.l10n.t`, `.bundle`, `.uri` | Host code strings                      | 1.73 [S1][S5]                       | Available; confirmed in the pinned `@types/vscode@1.98.0` |
| `"l10n": "./l10n"` manifest field  | Tells VS Code where bundles live; required [S6] | 1.73                       | Not set today                     |
| `l10n/bundle.l10n.<locale>.json`   | Translations keyed by English text     | 1.73                                | None today                        |
| `@vscode/l10n-dev` 0.0.35 (dev tool) | Extract strings, XLIFF, pseudo-locale | Any; runs at build time [S3]        | Not used; see 5.3                 |
| `@vscode/l10n` 0.0.18 (runtime lib) | Same `t()` for subprocesses           | Any [S2]                            | Not used; see 5.3                 |

Facts that shape the design:

- `vscode.l10n.bundle` and `.uri` are `undefined` when no bundle was found or the language is the default [S4].
- The bundle file name uses the exact app language; a missing key returns the English message [S9].
- A key with a translator comment is `message/comment` [S9].
- VS Code offers no plural or gender support in this API.
- A non-English display language requires an installed Language Pack [S10].

### 5.2 How strings reach the webview

Microsoft has no supported webview path. The maintainer's words: "there is no recommended way to do this" [S7]. Three options exist:

| Option | Startup | Content Security Policy | Bundle size | Verdict |
| ------ | ------- | ----------------------- | ----------- | ------- |
| A. Host renders `vscode.l10n.bundle` into a `<body>` attribute; webview has its own `t()` | Synchronous, ready before any UI is built; 0.3 ms + 0.3 ms for 900 strings (119 KB of HTML) | Unchanged. No script, no fetch | 563 bytes minified, 376 gzip | **Chosen. Built in the proof of concept** |
| B. Host posts a string map by `postMessage` after `ready` | Arrives after first paint; toolbar would render English, then need a rebuild | Unchanged | Same as A | Rejected: flash of English or delayed first paint |
| C. `@vscode/l10n` in the webview with `config({ uri })` [S2][S7] | One async fetch before UI can render | Uses the existing `connect-src` and extension resource root | 2,969 bytes plus a licence entry | Rejected: new runtime dependency and an awaited fetch for no gain |

Option A copies an existing pattern: the provider already passes `data-highlighting-worker-uri` on `<body>`.

### 5.3 Recommended architecture

```text
package.json  --%key%-->  package.nls.json  +  package.nls.<locale>.json     (VS Code resolves)

Host code     vscode.l10n.t('English {0}', x)        <-- l10n/bundle.l10n.<locale>.json
                    |                                     (VS Code loads the one for the display language)
                    v
              vscode.l10n.bundle  --render-->  <body data-l10n-bundle="...">
                                                         |
Webview code  l10n.t('English {0}', x)  <--- parsed once, on first lookup
              (src/webview/l10n.ts)          missing key or no bundle: English
```

- **One format for both halves.** English text is the key; `{0}`, `{1}` mark arguments. One bundle file per locale serves host and webview.
- **English as key means zero churn in existing tests.** `t('Bold')` returns `'Bold'` with no bundle, so the 424 English assertions keep passing.
- **Own extractor, in Jest.** `src/__tests__/l10n/bundles.test.ts` finds every `l10n.t(...)` call with the TypeScript compiler, which is already a dev dependency.

Alternatives rejected:

| Alternative | Reason |
| ----------- | ------ |
| `vscode-nls` (suggested in #55) | Superseded by `vscode.l10n` in 1.73; no new features [S8]. Its build step rewrites source files. |
| Symbolic keys (`toolbar.bold.label`) | Every test that asserts English text would need a lookup table; code becomes harder to read. Costs the 424 assertions for no user benefit. |
| `@vscode/l10n-dev` as the extractor | Verified on this branch: it only sees `l10n.t` when the module is imported from `vscode` or `@vscode/l10n`. It extracted 0 of 11 calls made through our own webview helper. Using it would force option C. Revisit only if XLIFF or pseudo-locale tooling is wanted. |
| i18next, FormatJS, ICU MessageFormat | A runtime dependency and a licence entry each; bundle cost not measured here. Plurals are the only gain, and 16 call sites do not justify it. |
| Separate bundles for host and webview | Two files per locale for translators; no measurable saving at this size. |
| Placeholders for `displayName` and `description` | See 5.5. No benefit, some risk. |

### 5.4 Hard cases (file and line at `a6b5579`)

1. **HTML templates: 31 templates, 137 text segments.** Text sits inside `innerHTML` strings, so a translation would be parsed as markup.
   - `linkDialog.ts:728` (3), `:739` (23); `imageRenameDialog.ts:91` (14); `imageResizeModal.ts:381` (13); `imageInsertDialog.ts:88` (12); `localImageOutsideRepoDialog.ts:67` (12)
   - `hugeImageDialog.ts:163` (6); `imageConfirmation.ts:66` (6); `imageResizeWarning.ts:55` (5); `mathEditor.ts:127` (4), `:270` (3), `:327`, `:344`
   - `tableInsert.ts:67` (3), `:78` (4); `tocOverlay.ts:42` (3), `:86` (4); `mermaidEditor.ts:71` (3), `:116` (2)
   - `auditOverlay.ts:305` (2), `:718`, `:782`, `:794`, `:800`, `:950`; `imageMenu.ts:67` (2); `imageMetadata.ts:258`, `:301`; `editor.ts:1449` (2); `mathBlock.ts:148`; `mermaid.ts:211`
   - Fix: escape every translated value before it enters a template, and reject `<` or `>` in translations in CI.
2. **Plurals and grammar agreement: 16 sites.**
   - `feedbackReview.ts:1546`, `:1551`, `:1553`, `:1565`, `:2191`, `:3177`, `:3257`, `:3262`, `:4688`
   - `imageRenameDialog.ts:510`, `imageResizeModal.ts:840` (a lone `s` suffix); `imageConfirmation.ts:68`; `imageInsertDialog.ts:241`; `auditOverlay.ts:962`; `feedbackTargetPresentation.ts:158`; `MarkdownEditorProvider.ts:5659`
   - Fix: one whole sentence per form, picked with `Intl.PluralRules`, or count-neutral wording ("Comments: {0}"). Russian and Polish need more than two forms; accept two forms at first.
3. **Sentences built from parts: 22 concatenations and 120 template literals with variables.**
   - Concatenation: `BubbleMenuView.ts:791`, `:793`, `:812`, `:814`; `feedbackReview.ts:1551`, `:1553`, `:2192`; `feedbackTargetPresentation.ts:408`, `:464`; `imageMenu.ts:57`; `MarkdownEditorProvider.ts:5515`
   - Template literals: `MarkdownEditorProvider.ts` 30, `feedbackReview.ts` 24, `BubbleMenuView.ts` 8, `auditDocument.ts` 8, `documentExport.ts` 7, `feedbackTargetPresentation.ts` 6
   - Fix: convert to a literal with `{0}` arguments. The CI guard already fails on a non-literal message.
4. **Text used as a lookup key.**
   - Host button labels compared after the dialog returns, 15 sites: `documentExport.ts:1231`, `:1233`, `:1248`, `:1252`, `:1313`, `:1317`, `:1324`, `:1327`; `MarkdownEditorProvider.ts:5668`, `:7663`, `:7721`, `:8984`, `:11233`, `:11256`, `:11277`. Fix: keep the translated label in a constant and compare against it.
   - Tests that select by English `aria-label` or `title`: 14 selectors in 6 files. They keep working in English.
   - Production code never selects by `aria-label` or `title`.
5. **Icons that are letters (issue #77).**
   - Toolbar icons are Codicon font glyphs chosen by name (`BubbleMenuView.ts:342`, `:352`, `:362`). The `bold` glyph is itself a drawn "B".
   - Text fallbacks (`B`, `I`, `S`, `H+`, `Tbl`, `Mer`, `TOC`) show only when the font fails to load (`editor.css:3648`, `content: attr(data-fallback)`).
   - `H1`, `H2`, `H3` have no glyph and always render as text (`BubbleMenuView.ts:382`, `:391`, `:400`).
   - Fix: a translatable glyph letter with a translator comment; when a locale supplies a different letter, render text instead of the glyph. About half a day, in Phase 3a.
6. **Text in CSS: 2 strings.** `editor.css:1272` (`'Start writing...'`), `:1290` (`'Drop image here'`). Fix: `content: attr(...)` or a CSS variable set from script.
7. **Dates and numbers.**
   - `imageMetadata.ts:147`, `:150`, `:154` hardcode `'en-US'`, "Yesterday" and "{n} days ago". Fix: `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` with the display language.
   - `wordCount.ts:73-76`, `:156`, `:181`, `:199-202` already use `toLocaleString()`.
   - File sizes use `toFixed(1)` with English units: `hugeImageDialog.ts:83-84`, `imageMetadata.ts:129-131`, `imageInsertDialog.ts:247`.
   - `'en-US'` in the Feedback report files is correct and must stay.
8. **Right to left.** `editor.css` has 130 physical left or right declarations and 0 logical ones; no `dir` handling anywhere; the HTML shell hardcodes `lang="en"` (`MarkdownEditorProvider.ts:11628`). None of VS Code's 14 non-English display languages is right to left [S10], so this is out of scope. Set `lang` from `vscode.env.language` in Phase 0.
9. **Short words that mean different things.** 75 single-word labels; "Cancel" appears 12 times, "Retry" 6, and "Quote", "Source", "Table", "Open" can be noun or verb. Fix: translator comments, which make a distinct key (`message/comment`), matching VS Code [S9].
10. **Feedback boundary.** 323 webview strings sit next to 749 report strings that must stay English. Not verified: whether any webview label (for example "Whole table" in `feedbackTargetPresentation.ts`) is also written into the sealed bundle. Check before Phase 3e.

### 5.5 Marketplace, Open VSX and other hosts

- **`vsce` replaces `%key%` with the English value from `package.nls.json` when it packages.** Read in `node_modules/@vscode/vsce/out/nls.js` and `package.js` (`readManifest`, version 4.0.0). The Marketplace therefore receives the same literal English `DisplayName` and `Description` either way.
- **The Marketplace does not use `package.nls.<locale>.json` for listing text.** The request to honor it has been open since 2022-09-28 [S11]; a 2025 report confirms listings stay English [S12].
- **Search weights the display name most, then the short description; keywords become tags** [S13][S14]. These are maintainer comments in issues, not documentation.
- **Not answered by any documentation:** whether a placeholder `displayName` changes ranking. The packaging code says the indexed text is identical, but a known bug turns the comment form of an `nls` value into `[object Object]` in the listing [S16].
- **Decision: keep `displayName` and `description` literal.** Translating them gains nothing, and the policy test and the recent rename depend on the literals.
- **Open VSX:** `ovsx` packages with `vsce` [S17], and the registry treats `extension.vsixmanifest` as the source of truth [S18], so it sees the same resolved English text.
- **VSCodium and Cursor:** the official Simplified Chinese Language Pack is on Open VSX (namespace `MS-CEINTL`, published by the Open VSX account, version 1.131.0) [S15]. Extension bundles load through the same `vscode.l10n` code path in any Code OSS build [S9]. For Cursor only community sources exist: display language comes from `locale` in `~/.cursor/argv.json`, and language packs work for the Code OSS parts [S19]. Not tested in Cursor, VSCodium or Windsurf.

### 5.6 Translator workflow and review

- **Contribute:** copy `l10n/bundle.l10n.json` and `package.nls.json`, translate values, open a pull request. `l10n/README.md` holds the four rules.
- **Safe to merge without reading the language:** CI proves the pull request cannot break the product. It checks keys, placeholders, non-empty values and no markup. A translation-only pull request changes no code.
- **Meaning review when no maintainer reads the language:**
  1. A second native speaker approves (the author of #55 offered for Chinese), or
  2. a maintainer reviews a machine back-translation of the diff to catch wrong, offensive or promotional text.
- **Ownership:** each locale lists its maintainer and the last version reviewed in `l10n/README.md`. A locale more than two releases behind, or below the coverage gate, is removed from the package, not shipped half-done.
- **Glossary:** a short term list per locale (Feedback, Audit, Outline, Source view) to keep wording consistent.

### 5.7 CI detection of missing and stale translations

Already implemented in `src/__tests__/l10n/bundles.test.ts` (runs with `npx jest`):

| Check | Result |
| ----- | ------ |
| `l10n.t(...)` message is not a string literal | Fail, with `file:line` |
| `bundle.l10n.json` differs from the messages in code | Fail (stale English bundle) |
| Locale bundle has a key the code no longer uses | Fail (stale translation) |
| Translation drops or adds a `{n}` placeholder | Fail |
| Empty translation | Fail |
| Missing translation | Listed; the sample asserts its one known gap |

To add in Phase 0 and Phase 1:

- Fail when a translation contains `<` or `>` that the English source does not.
- `npm run l10n:extract` to regenerate `bundle.l10n.json` (reuse the extractor in the test).
- A locale status list (`complete` or `draft`); only `complete` locales are packaged, and for them a missing translation fails.
- Manifest parity: every `%key%` exists in `package.nls.json`; no orphan keys in any `package.nls.<locale>.json`.
- A pseudo-locale bundle generated in tests to prove no converted surface still shows raw English.

### 5.8 What breaks in the test suite

| Item | Count | Effect |
| ---- | ----: | ------ |
| Test files | 217 | |
| Files that reference English UI text | 76 (35%) | None while the test runs in English |
| Exact English UI literals in assertions | 424 | None, because English is the key |
| Selectors by English `aria-label` or `title` | 14 in 6 files | None in English |
| Partial or template matches | 58 in 21 files | None in English |
| Files with a hand-written `jest.mock('vscode')` | 5 | Each needs an `l10n` entry once the code under test calls `vscode.l10n`. One already hit and fixed: `inMemoryFiles.test.ts` |
| `marketplaceListingPolicy.test.ts` | 2 of 8 tests | 4 literal assertions break when the open command title, the configuration title, the custom editor name and the view name become `%key%`. Fix: resolve through `package.nls.json` in the test, and extend the old-product-name scan to `package.nls*.json`. The `displayName` and `description` tests stay as they are |

Most hit files: `feedbackReview.test.ts` 85, `feedbackProvider.test.ts` 43, `feedbackTargetPresentation.test.ts` 24, `documentExport.test.ts` 23, `feedbackCapture.test.ts` 23.

Real test work comes from restructuring, not from wrapping: label-as-key sites, plural rewrites and HTML template splits change behavior and need new tests.

### 5.9 Surfaces and key changes

- `src/shared/l10n.ts` (done): format, bundle parsing, `<body>` attribute rendering.
- `src/webview/l10n.ts` (done): `t()`, `configureL10n()`, `resetL10n()`.
- `src/editor/MarkdownEditorProvider.ts` (done): one import, one attribute in `getHtmlForWebview`.
- `src/__mocks__/vscode.ts` (done): `l10n` mock that behaves like English.
- `l10n/` (done as sample): English bundle, sample `zh-cn` bundle, translator rules.
- `package.json` (Phase 0 and 1): `"l10n": "./l10n"`, then `%key%` values.
- `package.nls.json` (Phase 1).

**Performance:** bundle parse is lazy and happens once per webview. No work on the typing path. The release `webview.js` is 4,710,330 bytes; the helper adds 563. About 10 bytes per converted call site adds roughly 8 KB for all 754.

---

## 6. Work Breakdown

**The rule that prevents a half-translated release:** wrapping a string in `l10n.t(...)` changes nothing a user sees. Only shipping a locale file does. So conversion can land in any order, and a locale is packaged only when (a) every surface in the release scope is converted and (b) that locale covers 100 percent of the English bundle and `package.nls.json`.

Estimates are working days for one developer working the way this repository does (test first, real VS Code host check per phase). They assume the three in-flight branches have merged, conversion pull requests are reviewed within a day, and no visual redesign for longer text.

| Phase | Content | Strings | Days | User-visible change |
| ----- | ------- | ------: | ---: | ------------------- |
| 0. Infrastructure, English only | Merge the helper and guard; `"l10n"` field; `lang` attribute; translator comments in `t()`; markup check; extract script; locale status list; contributor doc; host check on 1.98.0 and stable | 12 | 1.5 | None |
| 1. Manifest | 39 strings to `package.nls.json`; policy test resolves keys; parity check | 39 | 0.5 | None |
| 2. Host messages | 7 files; 15 label-as-key sites; 5 custom mocks | ~140 | 2.0 | None |
| 3a. Toolbar and menus | `BubbleMenuView.ts`, Mermaid template names, shortcut tooltips, letter glyphs (#77) | 124 | 1.5 | None |
| 3b. Dialogs and overlays | link, table, outline, math, Mermaid editors; 2 CSS strings | 118 | 2.0 | None |
| 3c. Image dialogs | 9 HTML templates, dates, sizes | 120 | 2.0 | None |
| 3d. Audit, editor core, node views | | 69 | 1.0 | None |
| 3e. Feedback review | 9 plural sites, live announcements, bundle boundary check | 323 | 4.0 | None |
| 4. First language | `zh-cn` with the #55 author; pseudo-locale pass; layout check for long text in real VS Code; switch the locale to `complete` | all | 2.0 | Simplified Chinese |
| **Total** | | **~925** | **16.5** | |

Each further language: 0.5 to 1 day of maintainer time for review and a layout pass, if a community translator supplies the text.

**Smallest useful first release (translated):** everything except Feedback review. Phases 0, 1, 2 (non-Feedback part, about 105 strings), 3a to 3d, and 4: about 575 strings and **12 working days** (1.5 + 0.5 + 1.5 + 6.5 + 2). The Feedback remainder is 4.5 days. Feedback review is a separate mode a user enters on purpose, so it is the one boundary where English next to a translated editor reads as intended, not as unfinished. It needs a release note saying so.

**Smallest release with value and no risk (not translated):** Phase 0 alone, 1.5 days.

- [ ] **Phase 0: Infrastructure, English only**
  - [x] Shared format, webview `t()`, host delivery, guard test (proof of concept)
  - [ ] `"l10n": "./l10n"` in `package.json`; drop or complete the sample bundle first
  - [ ] Translator comment overload; markup check; `l10n:extract` script; locale status list
  - [ ] `lang` attribute from `vscode.env.language`
  - [ ] Real host check on 1.98.0 and stable with a pseudo-locale
- [ ] **Phase 1: Manifest**
- [ ] **Phase 2: Host messages**
- [ ] **Phase 3: Webview areas**, one pull request per area (3a to 3e)
- [ ] **Phase 4: First language**
- [ ] **Testing**
  - [x] Unit tests for format, parsing, lookup, fallback, placeholder substitution
  - [x] Host-to-webview delivery through the real provider HTML
  - [x] Bundle guard (extraction, stale keys, placeholders)
  - [ ] Pseudo-locale coverage per converted area
  - [ ] Real VS Code host: display language `zh-cn` with the Language Pack, light and dark, long-text layout

---

## 7. Implementation Log

### 2026-10-11 - Scoping and proof of concept

- **What:** Research, string census, and one end-to-end slice: the search overlay (11 webview strings) and the word count notification (1 host string).
- **Files:** `src/shared/l10n.ts`, `src/webview/l10n.ts`, `src/webview/features/searchOverlay.ts`, `src/features/wordCount.ts`, `src/editor/MarkdownEditorProvider.ts` (2 lines), `src/__mocks__/vscode.ts`, `l10n/*`, 4 new test files, 3 extended test files.
- **Tests:** written first and seen failing. `npm run lint` clean. `npx jest`: 216 suites passed, 1 skipped; 4,445 tests passed.
- **Notes:**
  - The slice is inert in a real install: `package.json` has no `"l10n"` field, so VS Code loads no bundle and the product stays English. This was deliberate; three other branches are editing `package.json`.
  - The `zh-cn` bundle is sample text, not reviewed by a native speaker. It leaves "Close search" untranslated on purpose to prove the fallback.
  - `@vscode/l10n-dev` 0.0.35 was run from a scratch folder, not installed. It found the host call and none of the webview calls.
  - Not done: a check in a real VS Code Extension Development Host. This session was told not to launch VS Code. The `<body>` attribute path is covered only by Jest with jsdom.

---

## 8. Decisions & Tradeoffs

- **English text as the key:** chosen over symbolic keys. Gain: no churn in 424 test assertions, readable code, same convention as VS Code. Cost: editing an English sentence orphans its translations until redone, and identical short words need a comment to tell them apart.
- **Own 563-byte helper, no `@vscode/l10n`:** chosen to avoid a runtime dependency and an awaited fetch. Cost: the official extractor cannot see webview calls, so extraction lives in a Jest test. Switching later is an import change, because the call shape is identical.
- **Bundle on a `<body>` attribute:** chosen over `postMessage` for synchronous availability and an unchanged Content Security Policy. Cost: about 119 KB of HTML per editor open for a full 900-string bundle, 0.6 ms total.
- **Empty translation means missing in the webview.** VS Code's host returns an empty translation as written [S9]; the CI guard rejects empty values so the two never differ in practice.
- **`displayName` and `description` stay literal:** no listing or search benefit exists, and a known Marketplace bug can corrupt them.
- **Diagnostics stay English:** 206 error-detail strings and all logs. Users paste them into issues; maintainers must be able to search them.
- **No right-to-left work:** none of VS Code's display languages needs it.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Search ranking drops | Low | High | Do not touch `displayName`, `description`, `keywords`. Policy test keeps pinning them |
| Test churn | Low for wrapping, medium for restructuring | Medium | English as key; convert one area per pull request; 5 custom `vscode` mocks need `l10n` |
| Bundle size and startup | Low | Low | Measured: 563 bytes, 0.6 ms. Re-measure when the bundle is full |
| Merge conflicts with in-flight work | High today | Medium | Start Phase 0 only after copy-ai-reference, font-settings and paste-as-plain-text merge. The proof of concept touches one line of `MarkdownEditorProvider.ts` and none of `package.json`, `extension.ts`, `BubbleMenuView.ts` |
| Ongoing cost for every new string | Certain | Medium | Every UI string change needs `l10n.t`, a bundle regeneration and, per locale, a re-translation. Missing text shows English, so features never wait for translators |
| Translations go stale | High over time | Medium | CI fails on stale keys; a locale that falls behind is unpackaged, not shipped partial |
| Bad or hostile translation merged | Low | Medium | Markup check, back-translation review, second native reviewer |
| Translated text breaks layout | Medium | Medium | Pseudo-locale and real host pass per area; as a rule of thumb German text runs about a third longer than English |
| Markup injection through a translation | Low | High | Escape translated values in the 31 HTML templates; reject `<` and `>` in CI |
| Works in VS Code, not in Cursor or VSCodium | Unknown | Low | Same Code OSS code path; falls back to English if a host differs. Manual check before announcing |

### Could not verify

- Whether a placeholder `displayName` or `description` affects Marketplace ranking. No documentation covers it.
- The minimum VS Code version for `package.nls.json`. The docs give none; it predates 1.73.
- Behavior in Cursor, VSCodium and Windsurf. Community sources only [S19].
- The delivery path in a real VS Code host (see the log).
- Whether any webview Feedback label is also written into the sealed bundle.
- The search weighting claims come from maintainer comments in 2018 and 2022 issues and may have changed.

### Sources

- [S1] microsoft/vscode-l10n README: https://github.com/microsoft/vscode-l10n
- [S2] `@vscode/l10n` README: https://github.com/microsoft/vscode-l10n/blob/main/l10n/README.md
- [S3] `@vscode/l10n-dev` README: https://github.com/microsoft/vscode-l10n/blob/main/l10n-dev/README.md
- [S4] VS Code API reference, `l10n` namespace: https://code.visualstudio.com/api/references/vscode-api#l10n (same text in `node_modules/@types/vscode/index.d.ts`, version 1.98.0, line 17788)
- [S5] VS Code 1.73 release notes, "Localization improvements in the web": https://code.visualstudio.com/updates/v1_73
- [S6] Official l10n sample: https://github.com/microsoft/vscode-extension-samples/tree/main/l10n-sample
- [S7] Webview localization, maintainer answers: https://github.com/microsoft/vscode-extension-samples/issues/877 and https://github.com/microsoft/vscode/issues/206547
- [S8] "Localization as part of the API": https://github.com/microsoft/vscode-discussions/discussions/159
- [S9] VS Code source, `extHostLocalizationService.ts`: https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostLocalizationService.ts
- [S10] Display Language docs: https://code.visualstudio.com/docs/configure/locales
- [S11] "Honor package.nls.LOCALE.json files", open: https://github.com/microsoft/vsmarketplace/issues/489
- [S12] "Extension title/descriptions/commands are not translated in marketplace": https://github.com/microsoft/vsmarketplace/issues/1146
- [S13] Marketplace search weighting, maintainer comments: https://github.com/microsoft/vscode/issues/42890
- [S14] Indexed fields and keywords as tags: https://github.com/microsoft/vscode-loc/issues/714
- [S15] Open VSX registry entry: https://open-vsx.org/api/MS-CEINTL/vscode-language-pack-zh-hans
- [S16] `nls` comment form shows `[object Object]`: https://github.com/microsoft/vsmarketplace/issues/488
- [S17] Open VSX publishing wiki: https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions
- [S18] Open VSX manifest validation: https://github.com/eclipse-openvsx/openvsx/pull/1825
- [S19] Community Cursor language pack architecture notes (not official): https://github.com/polang233/cursor-language-pack/blob/main/docs/architecture.md
- Extension Manifest reference: https://code.visualstudio.com/api/references/extension-manifest
- Local source read: `node_modules/@vscode/vsce/out/nls.js`, `out/package.js` (version 4.0.0)

---

## 9. Follow-up & Future Work

- Reply on #55 and #77 with the plan once the owner decides. Drafts only; nothing was posted.
- Ask the #55 author whether the offer to review Chinese still stands before Phase 4.
- A count ratchet: fail CI when the number of unconverted UI strings in a converted area rises.
- Plural forms beyond two, if a Slavic language is contributed.
- Right-to-left layout, if VS Code gains such a display language.
- Translated README section or Marketplace gallery text, if the Marketplace starts honoring locale files [S11].
