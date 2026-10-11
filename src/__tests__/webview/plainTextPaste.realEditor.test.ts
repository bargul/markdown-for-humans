/** @jest-environment jsdom */

/**
 * Paste as plain text (Ctrl/Cmd+Shift+V, issue 11).
 *
 * The clipboard's text goes in as written: no formatting from the clipboard,
 * no code block, no Markdown or HTML conversion, and the whole paste is one
 * undo step. `insertPlainText` is what the `pastePlainText` host message runs.
 */

import type { Editor } from '@tiptap/core';
import { insertPlainText } from '../../webview/utils/plainTextPaste';
import { processPasteContent } from '../../webview/utils/pasteHandler';
import { getEditorMarkdownForSync } from '../../webview/utils/markdownSerialization';
import {
  blocks,
  clipboard,
  createPasteTestEditor,
  placeCaretAfter,
  selectText,
} from '../helpers/pasteTestEditor';

/** Every mark used anywhere in the document. */
function marksIn(editor: Editor): string[] {
  const names = new Set<string>();
  editor.state.doc.descendants(node => {
    node.marks.forEach(mark => names.add(mark.type.name));
  });
  return [...names];
}

function nodeTypesIn(editor: Editor): string[] {
  const names = new Set<string>();
  editor.state.doc.descendants(node => {
    names.add(node.type.name);
  });
  return [...names];
}

describe('insertPlainText', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
    document.body.replaceChildren();
  });

  describe('in a paragraph', () => {
    it('inserts a single line at the caret as inline text', () => {
      editor = createPasteTestEditor('Hello world');
      placeCaretAfter(editor, 'Hello ');

      expect(insertPlainText(editor, 'MarkdownEditorProvider')).toBe(true);

      expect(blocks(editor)).toEqual(['paragraph: Hello MarkdownEditorProviderworld']);
    });

    it('replaces the selection', () => {
      editor = createPasteTestEditor('Hello world');
      selectText(editor, 'world');

      insertPlainText(editor, 'there');

      expect(blocks(editor)).toEqual(['paragraph: Hello there']);
    });

    it('drops the formatting a rich clipboard carries', () => {
      const html =
        '<h2>Title</h2><p>Some <strong>bold</strong> and <a href="https://x.y">a link</a></p>';
      const text = 'Title\n\nSome bold and a link';

      // Normal paste converts the HTML and keeps the formatting.
      const normal = createPasteTestEditor('');
      const result = processPasteContent(clipboard({ 'text/html': html, 'text/plain': text }));
      expect(result.wasConverted).toBe(true);
      normal.commands.insertContent(result.content);
      expect(nodeTypesIn(normal)).toContain('heading');
      expect(marksIn(normal)).toEqual(expect.arrayContaining(['bold', 'link']));
      normal.destroy();

      // Plain paste gets the text flavor only.
      editor = createPasteTestEditor('');
      insertPlainText(editor, text);

      expect(blocks(editor)).toEqual(['paragraph: Title', 'paragraph: Some bold and a link']);
      expect(marksIn(editor)).toEqual([]);
    });

    it('keeps Markdown syntax as literal text', () => {
      editor = createPasteTestEditor('');
      const text = '**bold** _em_ `code` [link](https://example.com) ~~gone~~';

      insertPlainText(editor, text);

      expect(blocks(editor)).toEqual([`paragraph: ${text}`]);
      expect(marksIn(editor)).toEqual([]);
    });

    it('keeps block Markdown syntax as literal text', () => {
      editor = createPasteTestEditor('');

      insertPlainText(editor, '# Title\n\n- item\n\n> quote\n\n```js\ncode\n```\n\n| a | b |');

      expect(blocks(editor)).toEqual([
        'paragraph: # Title',
        'paragraph: - item',
        'paragraph: > quote',
        'paragraph: ```js⏎code⏎```',
        'paragraph: | a | b |',
      ]);
    });

    it('keeps HTML source as literal text', () => {
      editor = createPasteTestEditor('');
      const text = '<b>bold</b> <table><tr><td>cell</td></tr></table>';

      insertPlainText(editor, text);

      expect(blocks(editor)).toEqual([`paragraph: ${text}`]);
      expect(marksIn(editor)).toEqual([]);
    });

    it('saves the text as written', () => {
      // The editor's serializer does not escape prose (see
      // escapeMarkdownSyntaxForProse), so the file holds what the clipboard
      // held. Markdown syntax in it is read as Markdown the next time the file
      // is loaded: a limit of the serializer, listed in KNOWN_ISSUES.md.
      editor = createPasteTestEditor('');
      const text = '**bold** and snake_case_name';

      insertPlainText(editor, text);

      expect(getEditorMarkdownForSync(editor).trim()).toBe(text);
    });

    it('does not turn a URL into a link', () => {
      editor = createPasteTestEditor('');

      insertPlainText(editor, 'https://example.com/page');

      expect(marksIn(editor)).toEqual([]);
    });

    it('takes the formatting at the caret, like paste and match style', () => {
      editor = createPasteTestEditor('**bold**');
      placeCaretAfter(editor, 'bo');

      insertPlainText(editor, 'X');

      expect(getEditorMarkdownForSync(editor).trim()).toBe('**boXld**');
    });
  });

  describe('line breaks', () => {
    it('keeps a single newline as a line break and a blank line as a new paragraph', () => {
      editor = createPasteTestEditor('');

      insertPlainText(editor, 'line one\nline two\n\nline four');

      expect(blocks(editor)).toEqual(['paragraph: line one⏎line two', 'paragraph: line four']);
      expect(getEditorMarkdownForSync(editor).trim()).toBe('line one  \nline two\n\nline four');
    });

    it('reads Windows line endings as plain newlines', () => {
      editor = createPasteTestEditor('');

      insertPlainText(editor, 'a\r\nb\r\n\r\nc');

      expect(blocks(editor)).toEqual(['paragraph: a⏎b', 'paragraph: c']);
    });

    it('treats a run of blank lines as one paragraph break', () => {
      editor = createPasteTestEditor('');

      insertPlainText(editor, 'a\n\n\n\nb');

      expect(blocks(editor)).toEqual(['paragraph: a', 'paragraph: b']);
    });

    it('drops leading and trailing newlines', () => {
      editor = createPasteTestEditor('Hello world');
      placeCaretAfter(editor, 'Hello ');

      insertPlainText(editor, '\nline\n');

      expect(blocks(editor)).toEqual(['paragraph: Hello lineworld']);
    });

    it('splits the paragraph when several paragraphs are pasted mid-sentence', () => {
      editor = createPasteTestEditor('Hello world');
      placeCaretAfter(editor, 'Hello ');

      insertPlainText(editor, 'A\n\nB');

      expect(blocks(editor)).toEqual(['paragraph: Hello A', 'paragraph: Bworld']);
    });

    it('keeps pasted lines inside the list item', () => {
      editor = createPasteTestEditor('- item');
      placeCaretAfter(editor, 'item');

      insertPlainText(editor, ' one\ntwo');

      expect(blocks(editor)).toEqual(['bulletList: item one⏎two']);
    });
  });

  describe('in a heading', () => {
    it('keeps the first line in the heading and puts later lines in paragraphs', () => {
      editor = createPasteTestEditor('# Title');
      placeCaretAfter(editor, 'Title');

      insertPlainText(editor, ' one\ntwo\n\nthree');

      expect(blocks(editor)).toEqual(['heading: Title one', 'paragraph: two', 'paragraph: three']);
    });
  });

  describe('in a code block', () => {
    it('inserts the text exactly as written, without unwrapping fences', () => {
      editor = createPasteTestEditor('```js\nconst a = 1;\n```');
      placeCaretAfter(editor, 'const a = 1;');
      const text = '\n**not bold**\r\n```\nfenced\n```\n\n<b>x</b>\n';

      insertPlainText(editor, text);

      expect(blocks(editor)).toEqual([
        'codeBlock: const a = 1;\n**not bold**\n```\nfenced\n```\n\n<b>x</b>\n',
      ]);
    });
  });

  describe('in a table cell', () => {
    const TABLE = '| A | B |\n| --- | --- |\n| one | two |';

    it('keeps the text in the cell, with a line break for every newline', () => {
      editor = createPasteTestEditor(TABLE);
      placeCaretAfter(editor, 'one');

      insertPlainText(editor, ' x\ny\n\nz\tw | v');

      const cells: string[] = [];
      let paragraphsInFirstCell = 0;
      editor.state.doc.descendants(node => {
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          if (node.type.name === 'tableCell' && cells.length === 2) {
            paragraphsInFirstCell = node.childCount;
          }
          cells.push(node.textBetween(0, node.content.size, ' / ', '⏎'));
        }
      });
      expect(cells).toEqual(['A', 'B', 'one x⏎y⏎⏎z\tw | v', 'two']);
      expect(paragraphsInFirstCell).toBe(1);
      expect(getEditorMarkdownForSync(editor)).toMatch(
        /\| one x<br>y<br><br>z\sw \\\| v +\| two +\|/
      );
    });
  });

  describe('undo', () => {
    it('is one undo step, separate from typing just before it', () => {
      editor = createPasteTestEditor('Start');
      placeCaretAfter(editor, 'Start');
      editor.commands.insertContent(' typed');
      const beforePaste = editor.getJSON();

      insertPlainText(editor, ' pasted\nsecond line\n\nnew paragraph');
      expect(blocks(editor)).toEqual([
        'paragraph: Start typed pasted⏎second line',
        'paragraph: new paragraph',
      ]);

      editor.commands.undo();
      expect(editor.getJSON()).toEqual(beforePaste);

      editor.commands.redo();
      expect(blocks(editor)).toEqual([
        'paragraph: Start typed pasted⏎second line',
        'paragraph: new paragraph',
      ]);
    });
  });

  describe('nothing to do', () => {
    it('leaves the document alone for empty text', () => {
      editor = createPasteTestEditor('Hello');
      const before = editor.getJSON();

      expect(insertPlainText(editor, '')).toBe(false);
      expect(insertPlainText(editor, '\n\r\n')).toBe(false);

      expect(editor.getJSON()).toEqual(before);
    });

    it('leaves a read-only editor alone', () => {
      editor = createPasteTestEditor('Hello');
      editor.setEditable(false);
      const before = editor.getJSON();

      expect(insertPlainText(editor, 'text')).toBe(false);

      expect(editor.getJSON()).toEqual(before);
    });
  });
});
