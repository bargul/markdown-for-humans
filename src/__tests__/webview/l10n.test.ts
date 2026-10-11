/** @jest-environment jsdom */
/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import { L10N_BUNDLE_ATTRIBUTE } from '../../shared/l10n';
import * as l10n from '../../webview/l10n';

describe('webview l10n', () => {
  afterEach(() => {
    document.body.removeAttribute(L10N_BUNDLE_ATTRIBUTE);
    l10n.resetL10n();
  });

  describe('lookup', () => {
    it('returns the translation when the bundle has the message', () => {
      l10n.configureL10n({ 'No results': '无结果' });
      expect(l10n.t('No results')).toBe('无结果');
    });

    it('substitutes placeholders in the translated message', () => {
      l10n.configureL10n({ '{0} of {1}': '第 {0} 项，共 {1} 项' });
      expect(l10n.t('{0} of {1}', 3, 12)).toBe('第 3 项，共 12 项');
    });
  });

  describe('fallback to English', () => {
    it('returns the source message when no bundle is configured', () => {
      expect(l10n.t('No results')).toBe('No results');
      expect(l10n.t('{0} of {1}', 3, 12)).toBe('3 of 12');
    });

    it('returns the source message when the bundle lacks it', () => {
      l10n.configureL10n({ 'No results': '无结果' });
      expect(l10n.t('Close search')).toBe('Close search');
    });

    it('treats an empty translation as missing', () => {
      l10n.configureL10n({ 'No results': '' });
      expect(l10n.t('No results')).toBe('No results');
    });

    it('ignores inherited object keys', () => {
      l10n.configureL10n({});
      expect(l10n.t('constructor')).toBe('constructor');
      expect(l10n.t('toString')).toBe('toString');
    });
  });

  describe('delivery from the extension host', () => {
    it('reads the bundle the host rendered on <body> on first use', () => {
      document.body.setAttribute(L10N_BUNDLE_ATTRIBUTE, JSON.stringify({ 'No results': '无结果' }));
      expect(l10n.t('No results')).toBe('无结果');
    });

    it('stays in English when the attribute is absent', () => {
      expect(l10n.t('No results')).toBe('No results');
    });

    it('stays in English when the attribute is malformed', () => {
      document.body.setAttribute(L10N_BUNDLE_ATTRIBUTE, '{broken');
      expect(l10n.t('No results')).toBe('No results');
    });

    it('reads the attribute only once', () => {
      const read = jest.spyOn(document.body, 'getAttribute');
      l10n.t('No results');
      l10n.t('No results');
      l10n.t('Close search');
      expect(read.mock.calls.filter(([name]) => name === L10N_BUNDLE_ATTRIBUTE)).toHaveLength(1);
      read.mockRestore();
    });
  });
});
