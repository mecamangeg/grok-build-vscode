import * as vscode from "vscode";
import { GrokSidebar } from "./sidebar";

/** What `activate` hands back through `extension.exports`. Empty in every
 *  released build — the test seam below is populated only under
 *  `ExtensionMode.Test`. */
export interface GrokExtensionApi {
  __test?: ReturnType<GrokSidebar["installTestHooks"]>;
}

export function activate(context: vscode.ExtensionContext): GrokExtensionApi {
  const output = vscode.window.createOutputChannel("Grok");
  const sidebar = new GrokSidebar(context, output);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GrokSidebar.viewId, sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    output,
    { dispose: () => sidebar.dispose() },
    // ALT AI shell hides Secondary Side Bar — open/focus Primary (grokPrimary), not grokSidebar.
    vscode.commands.registerCommand("grok.open", () => sidebar.dockChatPrimary()),
    vscode.commands.registerCommand("grok.newSession", () => sidebar.newSession()),
    vscode.commands.registerCommand("grok.newWorktreeSession", () => sidebar.newWorktreeSession()),
    vscode.commands.registerCommand("grok.applyWorktree", () => sidebar.applyFocusedWorktree()),
    vscode.commands.registerCommand("grok.removeWorktree", () => sidebar.removeFocusedWorktree()),
    vscode.commands.registerCommand("grok.rewind", () => sidebar.rewindFocusedSession()),
    vscode.commands.registerCommand("grok.compact", () => {
      // emulated by sending the slash command as a prompt; CLI handles it
      vscode.window.showInformationMessage(
        "Type /compact in the composer to compress the conversation.",
      );
    }),
    vscode.commands.registerCommand("grok.pickModel", () => sidebar.pickModel()),
    vscode.commands.registerCommand("grok.sendSelection", () =>
      sidebar.insertActiveMention({ selection: true }),
    ),
    vscode.commands.registerCommand(
      "grok.sendFile",
      (uri?: vscode.Uri) => sidebar.insertActiveMention({ uri, pickIfMissing: true }),
    ),
    vscode.commands.registerCommand("grok.insertAtMention", () =>
      sidebar.insertActiveMention(),
    ),
    vscode.commands.registerCommand("grok.showLogs", () => output.show()),
    vscode.commands.registerCommand("grok.logout", () => sidebar.logout()),
    vscode.commands.registerCommand("grok.linkRemote", () => sidebar.linkRemoteDevice()),
    vscode.commands.registerCommand("grok.unlinkRemote", () => sidebar.unlinkRemoteDevice()),
    // ALT AI layout (docs/PLAN-alt-ai-ui-layout-epilogue.md WS1.6): one-click dock
    // of grok.chat into the Primary Side Bar, for a Get-started wizard step.
    vscode.commands.registerCommand("grok.dockChatPrimary", () => sidebar.dockChatPrimary()),
    // Internal debug helper for manually exercising the plan-review card UI
    // (Approve / Reject / Cancel flows) without a live CLI session.
    vscode.commands.registerCommand("grok._debugDummyPlan", () => sidebar.debugShowDummyPlan()),
  );

  // Lawyer shell: Activity Bar + Secondary Side Bar are hidden, so onView:grok.chat never
  // fires. onStartupFinished activates us; dock+focus makes ALT AI chat visible in Primary.
  void sidebar.dockChatPrimary().catch(() => {
    /* fail-soft — workbench may still be wiring view containers */
  });

  // VS Code sets ExtensionMode.Test ONLY when the extension host was launched by
  // a test runner, so an installed build can never reach this branch and the
  // seam is genuinely absent there rather than merely undocumented.
  return context.extensionMode === vscode.ExtensionMode.Test
    ? { __test: sidebar.installTestHooks() }
    : {};
}

export function deactivate(): void {
  // disposables handle cleanup
}
