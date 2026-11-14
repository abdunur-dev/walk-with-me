// Display settings share localStorage keys and values with the widget:
// wwm.large "1"/"0", wwm.contrast "1"/"0", wwm.motion "off"/"on", wwm.lang "am"/"en".
export function getPref(k: string): string | null {
  try { return window.localStorage.getItem(k); } catch { return null; }
}
export function setPref(k: string, v: string): void {
  try { window.localStorage.setItem(k, v); } catch { /* storage blocked: lasts for this page only */ }
}
export function applyPrefs(): void {
  const r = document.documentElement;
  const on = (k: string, v: string) => getPref(k) === v;
  if (on("wwm.large", "1")) r.setAttribute("data-text", "large"); else r.removeAttribute("data-text");
  if (on("wwm.contrast", "1")) r.setAttribute("data-contrast", "high"); else r.removeAttribute("data-contrast");
  if (on("wwm.motion", "off")) r.setAttribute("data-motion", "off"); else r.removeAttribute("data-motion");
}
// Runs before paint (inlined in <head>) so there is no flash of the wrong theme.
export const PREFS_BOOT = `(function(){try{var s=localStorage,r=document.documentElement;
if(s.getItem("wwm.large")==="1")r.setAttribute("data-text","large");
if(s.getItem("wwm.contrast")==="1")r.setAttribute("data-contrast","high");
if(s.getItem("wwm.motion")==="off")r.setAttribute("data-motion","off");}catch(e){}})();`;
