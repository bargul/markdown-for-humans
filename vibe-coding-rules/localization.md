# Localization

> Every text a user can read goes through VS Code's translation mechanism. Load this guide before adding or changing any UI text.
> Plan and background: `roadmap/pipeline/task-localization.md`.

## The three places text lives

| Where the text is               | How to write it                                                        | English source            |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------- |
| `package.json` (manifest)       | `"title": "%markdownForHumans.someKey%"`                               | `package.nls.json`        |
| Extension host (`src/` outside `webview/`) | `vscode.l10n.t('Saved {0}', name)`                          | `l10n/bundle.l10n.json`   |
| Webview (`src/webview/`)        | `import * as l10n from '../l10n'` then `l10n.t('Saved {0}', name)`     | `l10n/bundle.l10n.json`   |

The English sentence is the lookup key. With no translation the English shows, so nothing is ever blank.

## Rules

1. **One whole sentence per message, as a string literal.** Arguments use `{0}`, `{1}`.
   - No concatenation (`'Saved ' + name`), no template variables (`` `Saved ${name}` ``), no plural suffix (`'file' + (n > 1 ? 's' : '')`).
2. **Singular and plural are two messages.** `l10n.t(count === 1 ? '{0} comment' : '{0} comments', count)`.
3. **Text inside an HTML template uses `l10n.html(...)`.** It escapes the result, arguments included.
   - To wrap part of a sentence in markup: `l10n.html('Add {0} to see the outline').replace('{0}', '<code># Heading</code>')`.
4. **Ambiguous or very short words get a translator comment.** `l10n.t({ message: 'Quote', comment: 'Toolbar button that inserts a block quote' })`. The comment becomes part of the key.
5. **Never compare against translated text.** Keep the label in a constant and compare with the constant:
   ```ts
   const retry = vscode.l10n.t('Retry');
   const choice = await vscode.window.showErrorMessage(vscode.l10n.t('Could not save.'), retry);
   if (choice === retry) { ... }
   ```
6. **Dates and numbers use `Intl` or `toLocaleString()`** without a hardcoded `'en-US'`.
7. **After adding or changing text, run `npm run l10n:extract`** and commit the updated `l10n/bundle.l10n.json`.

## What must stay English

- Log lines (`[MD4H] ...`) and the detail of thrown errors. Users paste them into issues.
- Command IDs, setting keys, protocol values, CSS classes, selectors.
- Markdown, Mermaid and LaTeX syntax and templates.
- The Feedback bundle, the agent handoff prompt and their validators (the files listed in `UNTRANSLATED_FILES` in `src/__tests__/l10n/hardcodedText.ts`). They are a file format read by AI agents.
- Product and format names: Markdown, Mermaid, KaTeX, LaTeX, PDF, Word, Chrome, programming language names.
- Key names as printed on the keyboard: Ctrl, Cmd, Shift, Enter, Escape.
- `displayName`, `description` and `keywords` in `package.json`. Marketplace search depends on them.

Mark such text where it sits in a UI sink: `// l10n-ignore: product name`.

## What CI checks (`src/__tests__/l10n/`)

| Check                                                              | Fails when                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| Message can be extracted                                           | The message is not a literal                            |
| `l10n/bundle.l10n.json` matches the code                           | You forgot `npm run l10n:extract`                       |
| No stale translation, placeholders kept, no added `<` or `>`       | A locale bundle is out of date or broken                |
| Shipped locales are complete                                       | A bundle in `l10n/` misses a message                    |
| Hardcoded UI text ratchet                                          | New English text is written straight into a UI sink     |

To list the hardcoded UI text that is left, with file and line:

```sh
L10N_LIST=/tmp/hardcoded.txt npx jest src/__tests__/l10n/hardcodedText.test.ts
```

## Languages

- `l10n/bundle.l10n.<locale>.json`: shipped. Must translate every message.
- `l10n/drafts/bundle.l10n.<locale>.json`: work in progress. Not packaged, may be partial.
- A language moves from `drafts/` to `l10n/` only when it is complete and a native reader has reviewed it.
- VS Code picks the bundle from the display language. There is no language setting in this extension.

## Tests

- Tests run in English. `l10n.t('Bold')` returns `'Bold'`, so assertions on English text keep working.
- To test a translation, call `l10n.configureL10n({...})` and `l10n.resetL10n()` afterwards.
- A hand-written `jest.mock('vscode', ...)` factory needs an `l10n` entry once the code under test calls `vscode.l10n`.
