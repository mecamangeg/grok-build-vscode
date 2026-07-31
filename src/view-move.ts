// View placement. ALT AI fork default-homes `grok.chat` in the PRIMARY side bar
// (`viewsContainers.activitybar` / `grokPrimary`) so lawyer lockdown can hide the
// Secondary Side Bar + Activity Bar icons without burying chat. Empty containers
// remain as `vscode.moveViews` targets for gear-menu relocate. VS Code >= 1.106
// (engines floor) still required for secondarySidebar contribution.

export const GROK_VIEW_ID = "grok.chat";

/** Contributed containers, one per dock location (package.json prefixes each id
 *  with `workbench.view.extension.`). `grokPrimary` homes the view; the other
 *  two are empty by default (an empty container renders nothing) and exist only
 *  as `vscode.moveViews` targets. */
export const SECONDARY_CONTAINER_ID = "workbench.view.extension.grokSidebar";
export const PRIMARY_CONTAINER_ID = "workbench.view.extension.grokPrimary";
export const PANEL_CONTAINER_ID = "workbench.view.extension.grokPanel";

/** Resolve a gear-menu destination to the container `vscode.moveViews` should
 *  target, or null for an unknown location (callers fall back to the built-in
 *  destination picker preselected on the Grok view). */
export function moveViewContainerFor(location: unknown): string | null {
  if (location === "panel") return PANEL_CONTAINER_ID;
  if (location === "sidebar") return PRIMARY_CONTAINER_ID;
  if (location === "auxiliarybar") return SECONDARY_CONTAINER_ID;
  return null;
}
