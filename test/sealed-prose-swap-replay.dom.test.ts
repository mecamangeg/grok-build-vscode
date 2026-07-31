// Repro of the live dogfood sequence: a RESTORED session (historyReplay) whose last agent
// message is the digest, then a fresh seal arrives (applySealedProse). Guards the swap
// against the replayed-session shape, not just the live-turn shape.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch } from "./webview-harness";

const DIGEST =
  "## Facts\nBorrowed under PN 7155 [1]. Restructured [2].\n\n## Ruling\nPetition denied [7].\n\n---\n\n**Takeaway:** Autonomy of loan contracts yields when iniquitous.";
const SEALED =
  "## Facts\nBorrowed under PN 7155 \u27e61\u27e7. Restructured \u27e62\u27e7.\n\n## Ruling\nPetition denied \u27e66\u27e7.";

describe("applySealedProse after a restored (replayed) session", () => {
  it("swaps the replayed last agent body when a fresh seal lands", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "historyReplay", active: true });
    dispatch(window, { type: "userMessage", text: "case digest viroomal" });
    dispatch(window, { type: "messageChunk", text: DIGEST });
    dispatch(window, { type: "historyReplay", active: false });
    // Startup gate probe (seal already on disk at boot): baseline — badges live, no swap posted.
    dispatch(window, { type: "setCitationsLive", live: true, sourceNumbers: [1, 2, 6] });

    // Fresh seal lands while the window is open.
    dispatch(window, {
      type: "applySealedProse",
      prose: SEALED,
      sourceNumbers: [1, 2, 6],
      turnId: "turn-replay-fresh-001",
    });

    const bodies = doc.querySelectorAll(".msg.agent > .body");
    const last = bodies[bodies.length - 1] as HTMLElement;
    expect(last.textContent).toContain("Petition denied");
    expect(last.textContent).not.toContain("[7]");
    expect(last.querySelector('a.cite-marker[data-cite-n="6"]')).not.toBeNull();
    expect(last.querySelector(".sealed-swap-note")).not.toBeNull();
  });
});
