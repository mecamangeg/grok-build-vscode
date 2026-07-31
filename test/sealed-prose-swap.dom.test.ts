// Product-correct numbering (2.0.16) — the kitchen seal gate may rewrite the submitted
// answer (strip sentences, renumber citations compactly), so the CLI-authored chat prose
// can carry [N] markers that silently resolve to the WRONG sealed passages. The host posts
// applySealedProse when a FRESH seal lands (probeCitationGate turnId changed while the
// window was open); the webview swaps the last assistant body to the sealed prose so badge
// numbering matches the sealed citations by construction, with a subtle inline notice when
// the gate actually edited the text.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click, Posted } from "./webview-harness";

const CHAT_PROSE =
  "## Facts\nThe borrowers took a loan [1]. They restructured it [2].\n\n## Issue\nWas the interest unconscionable? [6]\n\n## Ruling\nPetition denied [12].";
const SEALED_PROSE =
  "## Facts\nThe borrowers took a loan \u27e61\u27e7. They restructured it \u27e62\u27e7.\n\n## Ruling\nPetition denied \u27e66\u27e7.";

const renderAgent = (text: string) => {
  const { doc, window, posted } = bootWebview();
  dispatch(window, { type: "messageChunk", text });
  dispatch(window, { type: "promptComplete" });
  return { window, posted, doc };
};

const lastAgentBody = (doc: Document) => {
  const bodies = doc.querySelectorAll(".msg.agent > .body");
  return bodies[bodies.length - 1] as HTMLElement;
};

describe("applySealedProse — swap chat body to the kitchen-sealed text", () => {
  it("replaces the assistant body with the sealed prose and renders sealed \u27e6N\u27e7 badges live", () => {
    const { window, doc } = renderAgent(CHAT_PROSE);
    dispatch(window, {
      type: "applySealedProse",
      prose: SEALED_PROSE,
      sourceNumbers: [1, 2, 6],
      turnId: "turn-fresh-001",
    });
    const body = lastAgentBody(doc);
    // Sealed text shown; the pre-seal [12] marker is gone.
    expect(body.textContent).not.toContain("[12]");
    expect(body.textContent).not.toContain("unconscionable");
    expect(body.querySelector('a.cite-marker[data-cite-n="12"]')).toBeNull();
    // Sealed markers render as badges with live affordance from the payload's sourceNumbers.
    for (const n of [1, 2, 6]) {
      const badge = body.querySelector(`a.cite-marker[data-cite-n="${n}"]`) as HTMLElement;
      expect(badge, `badge [${n}]`).not.toBeNull();
      expect(badge.classList.contains("cite-marker-live"), `badge [${n}] live`).toBe(true);
    }
  });

  it("shows the inline notice when the sealed prose differs from the chat prose", () => {
    const { window, doc } = renderAgent(CHAT_PROSE);
    dispatch(window, {
      type: "applySealedProse",
      prose: SEALED_PROSE,
      sourceNumbers: [1, 2, 6],
      turnId: "turn-fresh-002",
    });
    const note = lastAgentBody(doc).querySelector(".sealed-swap-note");
    expect(note).not.toBeNull();
    expect(note!.textContent).toBe("Showing the kitchen-sealed text (3 citations)");
  });

  it("no notice when sealed prose matches the chat prose modulo marker style / whitespace", () => {
    const { window, doc } = renderAgent("Solutio indebiti applies [1]. It requires payment by mistake [2].");
    dispatch(window, {
      type: "applySealedProse",
      prose: "Solutio indebiti applies \u27e61\u27e7. It requires payment by mistake \u27e62\u27e7.",
      sourceNumbers: [1, 2],
      turnId: "turn-fresh-003",
    });
    const body = lastAgentBody(doc);
    expect(body.querySelector(".sealed-swap-note")).toBeNull();
    // Still re-rendered with the sealed markers live.
    expect(body.querySelector('a.cite-marker[data-cite-n="1"]')!.classList.contains("cite-marker-live")).toBe(true);
  });

  it("does NOT swap a body without citation markers (late seal after the lawyer moved on)", () => {
    const { window, doc } = renderAgent("Sure — renamed the file as asked.");
    dispatch(window, {
      type: "applySealedProse",
      prose: SEALED_PROSE,
      sourceNumbers: [1, 2, 6],
      turnId: "turn-late-001",
    });
    const body = lastAgentBody(doc);
    expect(body.textContent).toContain("renamed the file");
    expect(body.textContent).not.toContain("Petition denied");
    expect(body.querySelector(".sealed-swap-note")).toBeNull();
  });

  it("defers a mid-turn seal until agentEnd (streaming body must not be clobbered)", () => {
    const { window, doc } = renderAgent(CHAT_PROSE);
    dispatch(window, { type: "setBusy", value: true });
    dispatch(window, {
      type: "applySealedProse",
      prose: SEALED_PROSE,
      sourceNumbers: [1, 2, 6],
      turnId: "turn-midstream-001",
    });
    // Still the CLI-authored prose while the turn runs.
    expect(lastAgentBody(doc).textContent).toContain("unconscionable");
    dispatch(window, { type: "agentEnd" });
    const body = lastAgentBody(doc);
    expect(body.textContent).toContain("Petition denied");
    expect(body.textContent).not.toContain("unconscionable");
    expect(body.querySelector(".sealed-swap-note")).not.toBeNull();
  });

  it("swapped badges click through to openCitation with the SEALED numbering", () => {
    const { window, doc, posted } = renderAgent(CHAT_PROSE);
    dispatch(window, {
      type: "applySealedProse",
      prose: SEALED_PROSE,
      sourceNumbers: [1, 2, 6],
      turnId: "turn-fresh-004",
    });
    const six = lastAgentBody(doc).querySelector('a.cite-marker[data-cite-n="6"]') as HTMLElement;
    click(window, six);
    expect(posted.filter((p: Posted) => p.type === "openCitation")).toEqual([
      { type: "openCitation", n: 6 },
    ]);
  });
});
