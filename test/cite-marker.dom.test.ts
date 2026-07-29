// Robsky numeric citation markers (docs/NOTE-community-fork-cite-bridge.md) — the fork's one
// documented no-fork exception (PLAN v3). Confirms the three marker forms kitchen's contract
// documents (⟦N⟧ canonical, [[N]] ASCII fallback, bare [N] once rewritten for display) render as
// clickable badges, that the deliberately-excluded [[prov:...]] form is hidden at display (chat-
// egress epilogue filter, docs/PLAN-alt-ai-ui-layout-epilogue.md WS1.7) rather than turned into a
// cite-marker badge, that a real markdown link isn't hijacked, and that a click posts the exact
// "openCitation" message sidebar.ts's host handler expects.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click, Posted } from "./webview-harness";

describe("Robsky citation markers ([[n]] / \u27e6n\u27e7 / [n])", () => {
  // promptComplete forces a synchronous flushAgent so the markdown is in the DOM (same pattern as
  // the LaTeX/Mermaid dom-test suites above).
  const renderAgent = (text: string) => {
    const { doc, window, posted } = bootWebview();
    dispatch(window, { type: "messageChunk", text });
    dispatch(window, { type: "promptComplete" });
    return { el: doc.querySelector(".msg.agent") as HTMLElement, window, posted, doc };
  };

  it("renders the [[n]] ASCII-fallback form as a clickable badge", () => {
    const { el } = renderAgent("Solutio indebiti applies here [[1]].");
    const badge = el.querySelector("a.cite-marker[data-cite-n=\"1\"]");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("[1]");
  });

  it("renders the \u27e6n\u27e7 canonical form as a clickable badge", () => {
    const { el } = renderAgent("Per Art. 2154 \u27e62\u27e7.");
    const badge = el.querySelector("a.cite-marker[data-cite-n=\"2\"]");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("[2]");
  });

  it("renders a bare [n] (not a markdown link) as a clickable badge", () => {
    const { el } = renderAgent("See the ruling [3] for details.");
    const badge = el.querySelector("a.cite-marker[data-cite-n=\"3\"]");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("[3]");
  });

  it("hides [[prov:...]] at display — WS1.7 chat-egress filter, not kitchen's numeric citation contract", () => {
    const { el } = renderAgent("Trailing marker [[prov:abc123]] here.");
    expect(el.querySelector("a.cite-marker")).toBeNull();
    expect(el.textContent).not.toContain("[[prov:abc123]]");
    expect(el.textContent).toContain("Trailing marker");
    expect(el.textContent).toContain("here.");
  });

  it("does not hijack a real markdown link whose text happens to be a number", () => {
    const { el } = renderAgent("[1](https://example.com/statute)");
    expect(el.querySelector("a.cite-marker")).toBeNull();
    const link = el.querySelector("a[href=\"https://example.com/statute\"]");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("1");
  });

  it("clicking a citation badge posts openCitation with the numeric source number", () => {
    const { el, window, posted } = renderAgent("First [[1]], then [[2]].");
    const first = el.querySelector("a.cite-marker[data-cite-n=\"1\"]") as HTMLElement;
    const second = el.querySelector("a.cite-marker[data-cite-n=\"2\"]") as HTMLElement;
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    click(window, first);
    click(window, second);

    const openCitations = posted.filter((p: Posted) => p.type === "openCitation");
    expect(openCitations).toEqual([
      { type: "openCitation", n: 1 },
      { type: "openCitation", n: 2 },
    ]);
  });

  it("a badge click never falls through to openFile/openUrl (href=\"#\" is inert, not a file path)", () => {
    const { el, window, posted } = renderAgent("[[5]]");
    const badge = el.querySelector("a.cite-marker[data-cite-n=\"5\"]") as HTMLElement;
    click(window, badge);
    expect(posted.some((p: Posted) => p.type === "openFile")).toBe(false);
    expect(posted.some((p: Posted) => p.type === "openUrl")).toBe(false);
    expect(posted).toEqual([{ type: "openCitation", n: 5 }]);
  });
});
