/**
 * Paste as plain text through the real host, webview and document.
 *
 * VS Code cancels Ctrl/Cmd+Shift+V inside a webview and forwards the key to
 * the workbench, where it is a keybinding on `markdownForHumans.pastePlainText`.
 * The Extension Host API cannot press keys, so this suite runs the command the
 * keybinding runs and checks everything behind it: the host reads the
 * clipboard, the shipped webview inserts the text, and the edit reaches the
 * TextDocument. The keystroke itself stays a manual check.
 *
 * The test writes to the system clipboard and puts the previous text back.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');

const CUSTOM_EDITOR_VIEW_TYPE = 'markdownForHumans.editor';
const COMMAND_ID = 'markdownForHumans.pastePlainText';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

suite('Paste as Plain Text (Ext Host)', () => {
  suiteSetup(async function () {
    this.timeout(60_000);
    const extension = vscode.extensions.getExtension('concretio.markdown-for-humans');
    assert.ok(extension, 'Expected the development extension');
    await extension.activate();
  });

  test('registers the command', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.equal(commands.includes(COMMAND_ID), true);
  });

  test('inserts the clipboard text as written and syncs it to the document', async function () {
    this.timeout(90_000);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, 'Expected integration fixture workspace');

    const temporary = fs.mkdtempSync(path.join(workspaceFolder.uri.fsPath, '.paste-host-'));
    const sourceUri = vscode.Uri.file(path.join(temporary, 'paste-plain-text.md'));
    fs.writeFileSync(sourceUri.fsPath, 'Paste target.\n');

    const previousClipboard = await vscode.env.clipboard.readText();
    // The text must reach the file as written, with no code block around it.
    const pasted = `MarkdownEditorProvider ${Date.now()}`;
    try {
      await vscode.env.clipboard.writeText(pasted);
      if ((await vscode.env.clipboard.readText()) !== pasted) {
        // No usable system clipboard in this environment.
        this.skip();
      }

      await vscode.commands.executeCommand('vscode.openWith', sourceUri, CUSTOM_EDITOR_VIEW_TYPE, {
        viewColumn: vscode.ViewColumn.One,
        preview: false,
        preserveFocus: false,
      });
      const document = await vscode.workspace.openTextDocument(sourceUri);

      // The command has no readiness signal: a message posted before the
      // webview has built its editor is dropped. Repeat until a paste lands.
      const deadline = Date.now() + 45_000;
      while (!document.getText().includes(pasted)) {
        assert.ok(
          Date.now() < deadline,
          `Timed out waiting for the pasted text in the document: ${document.getText()}`
        );
        await vscode.commands.executeCommand(COMMAND_ID);
        for (
          let waited = 0;
          waited < 2_000 && !document.getText().includes(pasted);
          waited += 100
        ) {
          await sleep(100);
        }
      }

      const text = document.getText();
      assert.ok(text.includes('Paste target.'), `Existing text must survive: ${text}`);
      assert.equal(text.includes('```'), false, `No code block may be created: ${text}`);
    } finally {
      await vscode.env.clipboard.writeText(previousClipboard);
      // A dirty document would stop closeAllEditors at a save prompt.
      await vscode.workspace.saveAll(false);
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });
});
