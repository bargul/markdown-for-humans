/** @jest-environment jsdom */
/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Proves the host-to-webview path for translations: the bundle VS Code loaded
 * for the display language is rendered into the webview HTML, and the webview
 * `t()` reads it back.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { MarkdownEditorProvider } from '../../editor/MarkdownEditorProvider';
import { L10N_BUNDLE_ATTRIBUTE } from '../../shared/l10n';
import * as l10n from '../../webview/l10n';

type MutableL10n = { bundle: Record<string, string> | undefined };

function fileUri(fsPath: string): vscode.Uri {
  return { fsPath, path: fsPath, scheme: 'file', toString: () => `file://${fsPath}` } as vscode.Uri;
}

function renderHtml(): string {
  const provider = new MarkdownEditorProvider({
    extensionUri: fileUri('/extension'),
    subscriptions: [],
    globalState: { get: jest.fn(), update: jest.fn(async () => undefined) },
    extension: { packageJSON: { version: '0.0.0-test' } },
  } as unknown as vscode.ExtensionContext);
  const webview = {
    cspSource: 'vscode-webview://l10n',
    asWebviewUri: (uri: vscode.Uri) => ({
      toString: () => `vscode-webview://l10n/${path.basename(uri.fsPath)}`,
    }),
  } as unknown as vscode.Webview;
  try {
    return (
      provider as unknown as { getHtmlForWebview(webview: vscode.Webview): string }
    ).getHtmlForWebview(webview);
  } finally {
    provider.dispose();
  }
}

describe('translation delivery to the webview', () => {
  const uriApi = vscode.Uri as unknown as { joinPath?: unknown };
  const originalJoinPath = uriApi.joinPath;

  beforeEach(() => {
    uriApi.joinPath = (base: vscode.Uri, ...segments: string[]) =>
      fileUri(path.join(base.fsPath, ...segments));
  });

  afterEach(() => {
    uriApi.joinPath = originalJoinPath;
    (vscode.l10n as unknown as MutableL10n).bundle = undefined;
    document.body.removeAttribute(L10N_BUNDLE_ATTRIBUTE);
    l10n.resetL10n();
  });

  it('adds nothing to the HTML when VS Code runs in English', () => {
    expect(renderHtml()).not.toContain(L10N_BUNDLE_ATTRIBUTE);
  });

  it('delivers the loaded bundle so the webview translates on first use', () => {
    (vscode.l10n as unknown as MutableL10n).bundle = {
      'No results': '无结果',
      '{0} of {1}': '第 {0} 项，共 {1} 项',
    };

    const parsed = new DOMParser().parseFromString(renderHtml(), 'text/html');
    const attribute = parsed.body.getAttribute(L10N_BUNDLE_ATTRIBUTE);
    expect(attribute).not.toBeNull();
    // The existing worker attribute must survive next to the new one.
    expect(parsed.body.getAttribute('data-highlighting-worker-uri')).toContain(
      'highlighting-worker.js'
    );

    document.body.setAttribute(L10N_BUNDLE_ATTRIBUTE, attribute ?? '');
    expect(l10n.t('No results')).toBe('无结果');
    expect(l10n.t('{0} of {1}', 2, 7)).toBe('第 2 项，共 7 项');
    expect(l10n.t('Close search')).toBe('Close search');
  });

  it('keeps the Content Security Policy unchanged', () => {
    (vscode.l10n as unknown as MutableL10n).bundle = { 'No results': '无结果' };
    const html = renderHtml();
    expect(html).toContain("default-src 'none';");
    expect(html).not.toMatch(/script-src[^;]*(?:unsafe-eval|unsafe-inline|blob:)/);
    expect(html.match(/<script/g)).toHaveLength(1);
  });
});
