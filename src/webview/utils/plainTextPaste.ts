/**
 * Copyright (c) 2025-2026 Concret.io
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * Paste as plain text (Ctrl/Cmd+Shift+V).
 *
 * Inserts clipboard text as written: nothing is read as Markdown or HTML, no
 * code block is created, and the text takes the formatting at the caret.
 */

import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { Fragment, Slice, type Node as ProseMirrorNode, type ResolvedPos } from '@tiptap/pm/model';

/**
 * Insert text at the selection as one undo step.
 *
 * - Code block: the text exactly as it is, newlines included.
 * - Table cell: the text stays in the cell and every newline is a line break,
 *   because a second paragraph or a split would change the table.
 * - Heading: every line is its own block, so the first joins the heading and
 *   the rest follow as paragraphs. A Markdown heading cannot hold a line break.
 * - Anywhere else: a single newline is a line break, one or more blank lines
 *   start a new paragraph.
 *
 * @param editor - The TipTap editor
 * @param text - Clipboard text
 * @returns true when the document changed
 */
export function insertPlainText(editor: Editor, text: string): boolean {
  if (!editor.isEditable) return false;
  const normalized = text.replace(/\r\n?/g, '\n');
  const { state, view } = editor;
  const { schema, selection } = state;
  const { $from } = selection;
  const tr = state.tr;

  if ($from.parent.type.spec.code) {
    if (!normalized) return false;
    tr.insertText(normalized);
  } else {
    const trimmed = normalized.replace(/^\n+|\n+$/g, '');
    if (!trimmed) return false;

    const marks = state.storedMarks ?? $from.marks();
    const hardBreak = schema.nodes.hardBreak;
    const paragraph = (lines: string[]): ProseMirrorNode => {
      const inline: ProseMirrorNode[] = [];
      lines.forEach((line, index) => {
        if (index > 0) inline.push(hardBreak.create());
        if (line) inline.push(schema.text(line, marks));
      });
      return schema.nodes.paragraph.create(null, inline);
    };

    // A heading, or any other text block that is not a paragraph.
    const inHeading = $from.parent.isTextblock && $from.parent.type !== schema.nodes.paragraph;
    let paragraphs: ProseMirrorNode[];
    if (isInTableCell($from)) {
      paragraphs = [paragraph(trimmed.split('\n'))];
    } else if (inHeading) {
      paragraphs = trimmed.split(/\n+/).map(line => paragraph([line]));
    } else {
      paragraphs = trimmed.split(/\n{2,}/).map(block => paragraph(block.split('\n')));
    }
    // Open on both sides so the first and last paragraph merge into the text
    // around the caret instead of splitting it into separate blocks.
    tr.replaceSelection(new Slice(Fragment.from(paragraphs), 1, 1));
  }

  // ProseMirror merges changes made within 500 ms into one undo step. Without
  // this, undoing a paste made right after typing would remove the typing too.
  view.dispatch(closeHistory(tr).scrollIntoView());
  return true;
}

function isInTableCell($pos: ResolvedPos): boolean {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const name = $pos.node(depth).type.name;
    if (name === 'tableCell' || name === 'tableHeader') return true;
  }
  return false;
}
