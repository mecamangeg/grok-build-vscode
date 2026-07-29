// media/epilogue-strip.js — chat-egress epilogue filter (docs/PLAN-alt-ai-ui-layout-epilogue.md
// WS1.7, AD-7/8/9). Strips a TRAILING model-authored epilogue, and hides `[[prov:...]]`
// observability tokens, at DISPLAY/copy/TTS time — never at the wire.
//
// AD-9 cross-port agreement: this is an INDEPENDENT port of the ONE written contract
// (kitchen/lib/companion/epilogue-strip.ts) — no kitchen import (the fork ships standalone). The
// `stripEpilogue`-shaped rules below (HR_LINE_RE / SOURCES_HEADING_RE / CITE_MARKER_RE /
// SOFT_CTA_PATTERNS / ORIENTATION_PATTERNS / the two strip passes / the idempotence loop) MUST
// match that file bit-for-bit — kitchen/fixtures/epilogue-strip/cases.json is the shared fixture
// set an agreement golden checks both ports against (test/epilogue-strip.test.ts carries this
// fork's own copy of those cases so the suite stays self-contained).
//
// v1, CONSERVATIVE, TRAILING-ONLY:
// 1. A trailing `---` immediately followed by a Sources / References / Bibliography heading (+ its
//    list) is dropped, together with everything after it.
// 2. A trailing soft-CTA paragraph ("let me know if…", "feel free to…", "happy to…", "if you
//    share…") is dropped.
// 3. A trailing court-news orientation paragraph ("For recent Court news…", "visit the Supreme
//    Court website…") is dropped.
// 4. A `---` that is NOT the last one in the document, or is not immediately followed by a
//    Sources-shaped heading, is NEVER touched — pleadings/drafting output use `---` structurally
//    mid-body.
// 5. A trailing paragraph that still carries an inline citation marker is NEVER dropped as a
//    CTA/orientation match — it is treated as substantive, grounded content.
// 6. Idempotent: `stripEpilogueForChat(stripEpilogueForChat(x)) === stripEpilogueForChat(x)`.
//
// On top of the ported `stripEpilogue`, this module ALSO hides `[[prov:...]]` tokens (the same
// `/\[\[\s*prov\s*:[^\]]*\]\]/gi` shape as extension/src/citationRender.ts's
// `extractAndStripProvTokens`) — observability payload that must never reach a lawyer's screen.
// Inline `⟦N⟧` / `[[N]]` / `[N]` cite markers are always preserved (they are a DIFFERENT bracket
// shape — no digit-only token starting with the literal word "prov" collides with them).
(function (root) {
  const HR_LINE_RE = /^[ \t]*-{3,}[ \t]*$/;
  const SOURCES_HEADING_RE = /^#{0,6}[ \t]*(sources|references|bibliography)[ \t]*:?[ \t]*$/i;
  // The rendered display markers (⟦N⟧ / [[N]] / [N]) AND the raw pre-render [claim_id] form a
  // model still submits at this boundary (e.g. "[c3]") — either shape marks a paragraph as
  // substantive.
  const CITE_MARKER_RE = /⟦\d+⟧|\[\[\d+\]\]|\[\d+\]|\[[A-Za-z][\w-]*\]/;

  const SOFT_CTA_PATTERNS = [
    /^let (?:me|us) know\b/i,
    /^do let (?:me|us) know\b/i,
    /^feel free to\b/i,
    /^happy to\b/i,
    /^i(?:'m|\u2019m)? happy to\b/i,
    /^i(?:'d|\u2019d)? be happy to\b/i,
    /^please (?:let me|feel free|do let me)\b/i,
    /^should you (?:need|require|have|wish)\b/i,
    /^if you (?:can|could|would like to|share|provide|need|have|want|wish to)\b/i,
  ];

  const ORIENTATION_PATTERNS = [
    /^for (?:the )?(?:latest|most recent|recent) (?:supreme court|sc|philippine court|court) (?:news|updates|developments|jurisprudence)\b/i,
    /^for recent court news\b/i,
    /^you may (?:also |wish to |want to )?(?:check|see|visit|follow) (?:the )?(?:supreme court|sc)\b/i,
    /^(?:visit|check) (?:the )?(?:supreme court|sc)(?:'s|\u2019s)?(?: website| e-library| judiciary)?\b.*\b(?:news|updates|announcements|rulings)\b/i,
    /^stay (?:updated|informed) on\b/i,
  ];

  // Deliberately the SAME regex extension/src/citationRender.ts's extractAndStripProvTokens uses —
  // an unrelated, non-citation observability token this module hides at display time.
  const PROV_TOKEN_RE = /\[\[\s*prov\s*:[^\]]*\]\]/gi;

  function containsCiteMarker(s) {
    return CITE_MARKER_RE.test(s);
  }

  function matchesAny(patterns, s) {
    return patterns.some((re) => re.test(s));
  }

  /** Rule 1 — a trailing `---` immediately followed by a Sources/References/Bibliography heading. */
  function stripTrailingSourcesFooter(text) {
    const lines = text.split(/\r?\n/);
    let hrIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (HR_LINE_RE.test(lines[i])) {
        hrIndex = i;
        break;
      }
    }
    if (hrIndex === -1) return text;
    let j = hrIndex + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    if (j >= lines.length) return text; // trailing hr with nothing after it — not a footer, leave it
    if (!SOURCES_HEADING_RE.test(lines[j].trim())) return text; // not Sources-shaped — mid-body `---` survives
    const kept = lines.slice(0, hrIndex).join("\n");
    return kept.trim() ? kept : text; // never nuke the whole answer
  }

  /** Rules 2/3 — drop the LAST paragraph when it matches a category and carries no citation marker. */
  function stripTrailingParagraphIf(text, matches) {
    const parts = text.split(/\n{2,}/);
    if (parts.length <= 1) return text; // never strip the ONLY paragraph in the answer
    const last = parts[parts.length - 1].trim();
    if (!last || containsCiteMarker(last)) return text;
    if (!matches(last)) return text;
    return parts.slice(0, -1).join("\n\n");
  }

  /**
   * PURE, keyless, conservative trailing-epilogue strip — bit-for-bit port of
   * kitchen/lib/companion/epilogue-strip.ts's `stripEpilogue`.
   */
  function stripEpilogue(prose) {
    let text = prose;
    for (let i = 0; i < 6; i++) {
      let next = stripTrailingSourcesFooter(text);
      next = stripTrailingParagraphIf(next, (p) => matchesAny(SOFT_CTA_PATTERNS, p));
      next = stripTrailingParagraphIf(next, (p) => matchesAny(ORIENTATION_PATTERNS, p));
      next = next.replace(/[ \t]+$/gm, "").replace(/\s+$/, "");
      if (next === text) break;
      text = next;
    }
    return text.trim();
  }

  /** Removes every `[[prov:...]]` token verbatim — display/copy/TTS hiding only. */
  function stripProvTokens(text) {
    return text.replace(PROV_TOKEN_RE, "");
  }

  /**
   * The one chat-egress entry point: trailing-epilogue strip + prov-token hiding, applied ONCE at
   * turn finalize (then re-rendered). Idempotent by construction — stripEpilogue's own loop already
   * converges, and a second stripProvTokens pass over already-prov-free text is a no-op.
   */
  function stripEpilogueForChat(text) {
    if (!text) return text;
    return stripProvTokens(stripEpilogue(text));
  }

  const api = { stripEpilogue, stripProvTokens, stripEpilogueForChat };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.GrokEpilogueStrip = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
