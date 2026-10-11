# Translations

Status: proof of concept. The extension does not load these files yet, because
`package.json` has no `"l10n": "./l10n"` entry. See
`roadmap/pipeline/task-localization.md` for the plan.

| File                       | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `bundle.l10n.json`         | English source: every message passed to `l10n.t(...)` in `src` |
| `bundle.l10n.<locale>.json` | Translations, keyed by the English message                     |

`bundle.l10n.zh-cn.json` is sample text written to exercise the mechanism. It
has not been reviewed by a native speaker and leaves `Close search` untranslated
on purpose, to show the fallback to English.

Rules, enforced by `src/__tests__/l10n/bundles.test.ts`:

- The key is the exact English message. Do not edit keys.
- Keep every `{0}`, `{1}` placeholder of the English message. They may move.
- A message you leave out is shown in English.
- Remove a message once the code stops using it.
