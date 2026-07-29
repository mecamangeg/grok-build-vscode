import { describe, it, expect } from "vitest";
// @ts-expect-error — plain JS module, no types
import { stripEpilogue, stripProvTokens, stripEpilogueForChat } from "../media/epilogue-strip.js";

// Inline copy of kitchen/fixtures/epilogue-strip/cases.json (AD-9, docs/PLAN-alt-ai-ui-layout-
// epilogue.md WS1.7) — kept self-contained so this fork's test suite never depends on the sibling
// kitchen repo's filesystem path. Any cross-port agreement golden that DOES read both repos should
// use kitchen's copy as the source of truth; this one is a byte-for-byte transcription of it.
const CASES: { name: string; mustSurvive: boolean; input: string; expected: string }[] = [
  {
    name: "trailing-sources-footer",
    mustSurvive: false,
    input: "## Short Answer\n\nThe loan is void for usury under the Usury Law [c1].\n\n---\nSources:\n1. Republic Act No. 3765\n2. G.R. No. 12345, Case v. Case",
    expected: "## Short Answer\n\nThe loan is void for usury under the Usury Law [c1].",
  },
  {
    name: "trailing-references-heading",
    mustSurvive: false,
    input: "## Conclusion\n\nThe contract stands [c2].\n\n---\n## References\n- Civil Code, Art. 1306",
    expected: "## Conclusion\n\nThe contract stands [c2].",
  },
  {
    name: "trailing-bibliography-heading",
    mustSurvive: false,
    input: "## Conclusion\n\nThe requisites concur [c9].\n\n---\nBibliography:\n- Tolentino, Civil Code Commentaries",
    expected: "## Conclusion\n\nThe requisites concur [c9].",
  },
  {
    name: "soft-cta-let-me-know",
    mustSurvive: false,
    input: "## Conclusion\n\nThe agreement is enforceable [c3].\n\nLet me know if you'd like me to draft the demand letter next.",
    expected: "## Conclusion\n\nThe agreement is enforceable [c3].",
  },
  {
    name: "soft-cta-if-you-share",
    mustSurvive: false,
    input: "## Conclusion\n\nPrescription has not yet run [c4].\n\nIf you share the exact date of demand, I can narrow this further.",
    expected: "## Conclusion\n\nPrescription has not yet run [c4].",
  },
  {
    name: "soft-cta-feel-free",
    mustSurvive: false,
    input: "## Conclusion\n\nThe deed is void [c10].\n\nFeel free to reach out if you have follow-up questions about the notarization requirements.",
    expected: "## Conclusion\n\nThe deed is void [c10].",
  },
  {
    name: "court-news-orientation-blurb",
    mustSurvive: false,
    input: "## Conclusion\n\nThe requisites are met [c5].\n\nFor recent Court news on this doctrine, check the Supreme Court's e-Library for the latest rulings.",
    expected: "## Conclusion\n\nThe requisites are met [c5].",
  },
  {
    name: "mid-body-hr-survives",
    mustSurvive: true,
    input: "## Prefatory Statement\n\nCOMES NOW plaintiff, by counsel, and respectfully states:\n\n---\n\n## Statement of Facts\n\nOn the date alleged, plaintiff entered into a contract with defendant.",
    expected: "## Prefatory Statement\n\nCOMES NOW plaintiff, by counsel, and respectfully states:\n\n---\n\n## Statement of Facts\n\nOn the date alleged, plaintiff entered into a contract with defendant.",
  },
  {
    name: "inline-markers-survive",
    mustSurvive: true,
    input: "## Short Answer\n\nThe rule applies \u27e61\u27e7 and is reinforced by [[2]] and [3].",
    expected: "## Short Answer\n\nThe rule applies \u27e61\u27e7 and is reinforced by [[2]] and [3].",
  },
  {
    name: "trailing-hr-with-nothing-after-survives",
    mustSurvive: true,
    input: "## Conclusion\n\nThe motion should be granted [c11].\n\n---",
    expected: "## Conclusion\n\nThe motion should be granted [c11].\n\n---",
  },
  {
    name: "stacked-footer-then-cta",
    mustSurvive: false,
    input: "## Conclusion\n\nThe deed is valid [c6].\n\n---\nSources:\n1. Civil Code, Art. 749\n\nLet me know if you need a notarization checklist too.",
    expected: "## Conclusion\n\nThe deed is valid [c6].",
  },
  {
    name: "stacked-cta-then-footer",
    mustSurvive: false,
    input: "## Conclusion\n\nThe deed is valid [c7].\n\nLet me know if you need a notarization checklist too.\n\n---\nSources:\n1. Civil Code, Art. 749",
    expected: "## Conclusion\n\nThe deed is valid [c7].",
  },
  {
    name: "trailing-paragraph-with-cite-marker-survives",
    mustSurvive: true,
    input: "## Conclusion\n\nThe agreement stands.\n\nIf you have the receipt referenced in [c8], the estoppel argument becomes available immediately.",
    expected: "## Conclusion\n\nThe agreement stands.\n\nIf you have the receipt referenced in [c8], the estoppel argument becomes available immediately.",
  },
  {
    name: "single-paragraph-cta-shaped-answer-survives",
    mustSurvive: true,
    input: "Happy to help — the requisites of solutio indebiti are payment, absence of a binding relation, and mistake [c12].",
    expected: "Happy to help — the requisites of solutio indebiti are payment, absence of a binding relation, and mistake [c12].",
  },
];

describe("stripEpilogue (kitchen/lib/companion/epilogue-strip.ts port, AD-9)", () => {
  for (const c of CASES) {
    it(`${c.name} (mustSurvive=${c.mustSurvive})`, () => {
      expect(stripEpilogue(c.input)).toBe(c.expected);
    });
  }

  it("is idempotent", () => {
    for (const c of CASES) {
      const once = stripEpilogue(c.input);
      expect(stripEpilogue(once)).toBe(once);
    }
  });
});

describe("stripProvTokens (hides [[prov:...]] at display, same regex as citationRender.ts)", () => {
  it("removes a single prov token", () => {
    expect(stripProvTokens("Trailing marker [[prov:abc123]] here.")).toBe("Trailing marker  here.");
  });

  it("removes multiple prov tokens and tolerates internal whitespace", () => {
    expect(stripProvTokens("A [[prov: x ]] B [[ prov:y]] C")).toBe("A  B  C");
  });

  it("never touches ⟦N⟧ / [[N]] / [N] cite markers", () => {
    const text = "Per Art. 1306 \u27e61\u27e7, also [[2]] and [3].";
    expect(stripProvTokens(text)).toBe(text);
  });
});

describe("stripEpilogueForChat (the one chat-egress entry point)", () => {
  it("strips a trailing epilogue AND hides prov tokens together", () => {
    const input =
      "## Conclusion\n\nThe deed is valid [c6]. [[prov:xyz]]\n\n---\nSources:\n1. Civil Code, Art. 749";
    // Mirrors extractAndStripProvTokens: the token is removed verbatim with no surrounding
    // whitespace cleanup, so a leading space where it sat is expected, not a bug.
    expect(stripEpilogueForChat(input)).toBe("## Conclusion\n\nThe deed is valid [c6]. ");
  });

  it("preserves inline cite markers while hiding prov tokens", () => {
    const input = "The rule applies \u27e61\u27e7 [[prov:abc]] and [[2]] and [3].";
    expect(stripEpilogueForChat(input)).toBe("The rule applies \u27e61\u27e7  and [[2]] and [3].");
  });

  it("is idempotent", () => {
    const input = "Trailing marker [[prov:abc123]] here.\n\nLet me know if you need more.";
    const once = stripEpilogueForChat(input);
    expect(stripEpilogueForChat(once)).toBe(once);
  });

  it("passes every shared fixture unchanged with respect to cite-marker preservation", () => {
    for (const c of CASES) {
      // stripEpilogueForChat adds prov-hiding on top of stripEpilogue; none of the shared
      // fixtures carry a prov token, so its output must equal stripEpilogue's here.
      expect(stripEpilogueForChat(c.input)).toBe(c.expected);
    }
  });

  it("returns falsy input unchanged", () => {
    expect(stripEpilogueForChat("")).toBe("");
  });
});
