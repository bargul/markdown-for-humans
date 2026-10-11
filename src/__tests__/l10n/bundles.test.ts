/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 *
 * Guards the translation bundles in `l10n/`:
 * - every `l10n.t(...)` call uses a string literal, so it can be extracted
 * - `bundle.l10n.json` (English) lists exactly the strings used in the code
 * - a locale bundle never keeps a string that the code no longer uses
 * - a translation keeps the placeholders of its English source
 */

import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const repoRoot = path.resolve(__dirname, '../../..');
const sourceRoot = path.join(repoRoot, 'src');
const bundleRoot = path.join(repoRoot, 'l10n');

interface Extraction {
  messages: Set<string>;
  /** `file:line` of calls whose message is not a plain string literal. */
  unextractable: string[];
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== '__mocks__') sourceFiles(fullPath, found);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      found.push(fullPath);
    }
  }
  return found;
}

function extractMessages(files: Array<{ name: string; text: string }>): Extraction {
  const messages = new Set<string>();
  const unextractable: string[] = [];
  for (const { name, text } of files) {
    if (!text.includes('l10n.t(')) continue;
    const sourceFile = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && /(^|\.)l10n\.t$/.test(node.expression.getText(sourceFile))) {
        const message = node.arguments[0];
        if (
          message &&
          (ts.isStringLiteral(message) || ts.isNoSubstitutionTemplateLiteral(message))
        ) {
          messages.add(message.text);
        } else {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          unextractable.push(`${name}:${line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return { messages, unextractable };
}

function readBundle(fileName: string): Record<string, string> {
  return JSON.parse(readFileSync(path.join(bundleRoot, fileName), 'utf8')) as Record<
    string,
    string
  >;
}

function placeholders(message: string): string[] {
  return [...new Set(message.match(/\{\d+\}/g) ?? [])].sort();
}

const extraction = extractMessages(
  sourceFiles(sourceRoot).map(file => ({
    name: path.relative(repoRoot, file),
    text: readFileSync(file, 'utf8'),
  }))
);
const english = readBundle('bundle.l10n.json');
const localeFiles = readdirSync(bundleRoot).filter(
  name => /^bundle\.l10n\..+\.json$/.test(name) && name !== 'bundle.l10n.json'
);

describe('message extraction', () => {
  it('finds host and webview calls and reports messages it cannot extract', () => {
    const result = extractMessages([
      {
        name: 'sample.ts',
        text: [
          "vscode.l10n.t('Saved {0}', name);",
          "l10n.t('No results');",
          'l10n.t(`Plain template`);',
          'l10n.t(`Found ${count} results`);',
          "l10n.t('Count: ' + count);",
          "other.t('ignored');",
        ].join('\n'),
      },
    ]);
    expect([...result.messages].sort()).toEqual(['No results', 'Plain template', 'Saved {0}']);
    expect(result.unextractable).toEqual(['sample.ts:4', 'sample.ts:5']);
  });

  it('finds no unextractable message in the source tree', () => {
    expect(extraction.unextractable).toEqual([]);
  });
});

describe('English bundle', () => {
  it('lists exactly the messages used in the code', () => {
    expect(Object.keys(english).sort()).toEqual([...extraction.messages].sort());
  });

  it('maps every message to itself', () => {
    for (const [message, value] of Object.entries(english)) expect(value).toBe(message);
  });
});

describe.each(localeFiles)('%s', fileName => {
  const bundle = readBundle(fileName);

  it('has no stale message', () => {
    expect(Object.keys(bundle).filter(message => !(message in english))).toEqual([]);
  });

  it('has only non-empty text', () => {
    for (const value of Object.values(bundle)) {
      expect(typeof value).toBe('string');
      expect(value.trim()).not.toBe('');
    }
  });

  it('keeps the placeholders of each English source', () => {
    for (const [message, value] of Object.entries(bundle)) {
      expect({ message, placeholders: placeholders(value) }).toEqual({
        message,
        placeholders: placeholders(message),
      });
    }
  });
});

describe('Simplified Chinese sample bundle', () => {
  it('reports the one message it deliberately leaves untranslated', () => {
    const sample = readBundle('bundle.l10n.zh-cn.json');
    expect(Object.keys(english).filter(message => !(message in sample))).toEqual(['Close search']);
  });
});
