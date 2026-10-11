/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Extension host text reaches the user through `vscode.l10n.t`. These tests
 * swap in a translating `t` to prove that notifications are translated, that
 * arguments land in their placeholders, and that a translated button label is
 * still recognized when the user picks it.
 */

import * as vscode from 'vscode';
import { MarkdownEditorProvider } from '../../editor/MarkdownEditorProvider';
import { activate } from '../../extension';

jest.mock('../../features/wordCount', () => ({
  WordCountFeature: jest.fn(() => ({ activate: jest.fn(), showDetailedStats: jest.fn() })),
}));

jest.mock('../../features/outlineView', () => ({
  outlineViewProvider: {
    setTreeView: jest.fn(),
    revealActive: jest.fn(),
    showFilterInput: jest.fn(),
    clearFilter: jest.fn(),
  },
}));

type Internals = {
  handleOpenFileLink: (
    message: Record<string, unknown>,
    document: vscode.TextDocument
  ) => Promise<void>;
  showDocumentSyncConflict: (replacedContent: string) => Promise<void>;
};

const DOC_PATH = '/tmp/mdws/docs/guide.md';

const GERMAN: Record<string, string> = {
  'File not found: {0}': 'Datei nicht gefunden: {0}',
  'This file changed outside the rich editor while you were typing. Your typing was kept and replaced that change.':
    'Diese Datei wurde außerhalb des Editors geändert. Ihre Eingabe wurde beibehalten.',
  'Open Replaced Version': 'Ersetzte Version öffnen',
  'Markdown Editor for Humans: formatting shortcuts disabled':
    'Markdown Editor for Humans: Formatierungskürzel deaktiviert',
};

function createProvider(): Internals {
  return new MarkdownEditorProvider({
    extensionUri: vscode.Uri.file('/tmp/mdws'),
    subscriptions: [],
    globalState: {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      update: jest.fn(async () => undefined),
    },
    extension: { packageJSON: { version: '0.0.0-test' } },
  } as unknown as vscode.ExtensionContext) as unknown as Internals;
}

function createDocument(): vscode.TextDocument {
  return {
    uri: vscode.Uri.file(DOC_PATH),
    fileName: DOC_PATH,
    languageId: 'markdown',
    version: 1,
    isDirty: false,
    getText: jest.fn(() => '# Guide\n'),
    lineCount: 1,
  } as unknown as vscode.TextDocument;
}

describe('extension host localization', () => {
  const translate = vscode.l10n.t as unknown as jest.Mock;
  const english = translate.getMockImplementation();
  let openTextDocument: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    translate.mockImplementation((message: string, ...args: unknown[]) =>
      (GERMAN[message] ?? message).replace(/\{(\d+)\}/g, (placeholder, index: string) =>
        args[Number(index)] === undefined ? placeholder : String(args[Number(index)])
      )
    );
    openTextDocument = jest.fn(async (options: unknown) => ({ options }));
    const workspace = vscode.workspace as unknown as Record<string, unknown>;
    workspace.fs = {
      stat: jest.fn(async () => {
        throw new Error('ENOENT');
      }),
    };
    workspace.openTextDocument = openTextDocument;
    workspace.workspaceFolders = undefined;
    (vscode.window as unknown as Record<string, unknown>).showTextDocument = jest.fn(
      async () => undefined
    );
  });

  afterEach(() => {
    translate.mockImplementation(english);
    delete (vscode.workspace as unknown as { fs?: unknown }).fs;
  });

  it('translates a notification and fills its placeholder', async () => {
    await createProvider().handleOpenFileLink(
      { type: 'openFileLink', path: 'missing.md' },
      createDocument()
    );

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'Datei nicht gefunden: missing.md'
    );
  });

  it('acts on a button the user picked by its translated label', async () => {
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValueOnce(
      'Ersetzte Version öffnen'
    );

    await createProvider().showDocumentSyncConflict('Agent wrote this.\n');

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      'Diese Datei wurde außerhalb des Editors geändert. Ihre Eingabe wurde beibehalten.',
      'Ersetzte Version öffnen'
    );
    expect(openTextDocument).toHaveBeenCalledWith({
      language: 'markdown',
      content: 'Agent wrote this.\n',
    });
  });

  it('does not act on the English label once the button is translated', async () => {
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValueOnce('Open Replaced Version');

    await createProvider().showDocumentSyncConflict('Agent wrote this.\n');

    expect(openTextDocument).not.toHaveBeenCalled();
  });

  it('translates the formatting shortcuts status message as one sentence', async () => {
    const registered = new Map<string, () => Promise<void>>();
    const registerCommand = vscode.commands.registerCommand as unknown as jest.Mock;
    const registerCommandDefault = registerCommand.getMockImplementation();
    registerCommand.mockImplementation((command: string, handler: () => Promise<void>) => {
      registered.set(command, handler);
      return { dispose: jest.fn() };
    });
    (vscode.window as unknown as Record<string, unknown>).createTreeView = jest.fn(() => ({
      dispose: jest.fn(),
    }));
    (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => ({
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
      update: jest.fn(async () => undefined),
    }));
    const register = jest
      .spyOn(MarkdownEditorProvider, 'register')
      .mockReturnValue({ dispose: jest.fn() } as unknown as vscode.Disposable);

    try {
      activate({ subscriptions: [] } as unknown as vscode.ExtensionContext);
      await registered.get('markdownForHumans.toggleFormattingShortcuts')?.();
    } finally {
      register.mockRestore();
      registerCommand.mockImplementation(registerCommandDefault);
    }

    // The setting defaults to enabled, so the toggle turns it off.
    expect(vscode.window.setStatusBarMessage).toHaveBeenCalledWith(
      'Markdown Editor for Humans: Formatierungskürzel deaktiviert',
      3000
    );
  });
});
