/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * @fileoverview Translation lookup for webview UI text.
 *
 * Import as `import * as l10n from '../l10n'` and call `l10n.t('English text')`,
 * the same shape as `vscode.l10n.t` in the extension host. Without a bundle, or
 * without an entry for a message, the English text is returned.
 *
 * @module webview/l10n
 */

import {
  L10N_BUNDLE_ATTRIBUTE,
  formatL10n,
  parseL10nBundle,
  type L10nArgument,
  type L10nBundle,
} from '../shared/l10n';

let bundle: L10nBundle | undefined;

/**
 * Use the given translations instead of the ones rendered by the host.
 *
 * @param contents - Translated text keyed by its English source
 */
export function configureL10n(contents: L10nBundle): void {
  bundle = parseL10nBundle(JSON.stringify(contents));
}

/** Forget the loaded translations so the next lookup reads them from the host again. */
export function resetL10n(): void {
  bundle = undefined;
}

/**
 * Translate a UI message.
 *
 * @param message - English source text; must be a string literal so it can be extracted
 * @param args - Values for `{0}`, `{1}` placeholders
 * @returns The translation for the display language, or the English text
 */
export function t(message: string, ...args: L10nArgument[]): string {
  // Read lazily: the host renders the bundle on <body> before any UI is built.
  bundle ??= parseL10nBundle(document.body?.getAttribute(L10N_BUNDLE_ATTRIBUTE));
  return formatL10n(bundle[message] || message, args);
}
