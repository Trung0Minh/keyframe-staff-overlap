import type { PersonHistory, StaffPerson } from "../domain/types.ts";
import type { KeyframeDataSource } from "../data/KeyframeDataSource.ts";
import type { StorageArea } from "../data/cache.ts";
import { HistoryCache, validPerson } from "../data/cache.ts";
import { ComparisonRunner } from "../data/compare.ts";
import { DataSourceError } from "../shared/errors.ts";
import { autocomplete } from "./autocomplete.ts";
import { renderResults } from "./results.ts";
import { button, el } from "./dom.ts";

export async function mountPanel(shadow: ShadowRoot, source: KeyframeDataSource, storage: StorageArea): Promise<void> {
  let selected: StaffPerson[] = [];
  try {
    const saved = (await storage.get("selectedPeople")).selectedPeople;
    if (Array.isArray(saved)) selected = [...new Map(saved.filter(validPerson).map(person => [person.personId, person])).values()];
  } catch { /* Selection storage is optional. */ }
  let saveQueue = Promise.resolve();
  const saveSelection = () => {
    const snapshot = [...selected];
    saveQueue = saveQueue.then(() => storage.set({ selectedPeople: snapshot })).catch(() => {
      persistence.textContent = "Your selection could not be saved for the next page.";
    });
  };
  let histories: PersonHistory[] | null = null, loading = false, generation = 0;
  const runner = new ComparisonRunner(new HistoryCache(source, storage));
  const trigger = button("Compare Staff", "trigger", open);
  trigger.setAttribute("aria-label", "Compare Staff");
  trigger.setAttribute("aria-haspopup", "dialog"); trigger.setAttribute("aria-controls", "kf-compare-dialog");
  const dialog = el("dialog", "panel"); dialog.id = "kf-compare-dialog"; dialog.setAttribute("aria-labelledby", "kf-panel-title");
  const header = el("header", "panel-header");
  const titleWrap = el("div"); titleWrap.append(el("p", "eyebrow", "KEYFRAME / STAFF OVERLAP"));
  const title = el("h1", "", "Compare Staff"); title.id = "kf-panel-title"; titleWrap.append(title);
  const close = button("Close", "close", () => dialog.close());
  header.append(titleWrap, close);
  const body = el("div", "panel-body");
  const chips = el("div", "chips"); chips.setAttribute("aria-label", "Selected staff");
  const search = autocomplete(source, () => selected, person => {
    if (selected.some(p => p.personId === person.personId)) return;
    selected.push(person); selectionChanged();
  });
  const persistence = el("p", "hint muted"); persistence.setAttribute("role", "status");
  const actions = el("div", "actions");
  const compare = button("Compare", "primary", () => void run(false));
  const refresh = button("Refresh", "secondary", () => void run(true)); refresh.hidden = true;
  const cancel = button("Cancel", "text-button", () => { invalidate(); status.textContent = "Comparison cancelled."; updateControls(); }); cancel.hidden = true;
  actions.append(compare, refresh, cancel);
  search.input.after(actions);
  const status = el("p", "status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
  const progress = el("progress"); progress.hidden = true; progress.setAttribute("aria-label", "Staff histories loaded");
  const results = el("section", "results"); results.setAttribute("aria-label", "Comparison results");
  const footer = el("footer", "panel-footer", "Unofficial utility / Public credits from KeyFrame Staff List");
  const setup = el("div", "comparison-setup");
  setup.append(search.root, chips, persistence);
  body.append(setup, status, progress, results);
  dialog.append(header, body, footer);
  shadow.append(trigger, dialog);

  function updateControls() {
    compare.disabled = selected.length < 2;
    compare.textContent = loading ? "Restart comparison" : "Compare";
    refresh.hidden = !histories;
    cancel.hidden = !loading; progress.hidden = !loading;
    if (!loading && !histories) status.textContent ||= selected.length < 2 ? "Select at least two unique staff members." : "Ready to compare.";
  }
  function invalidate() {
    generation++; runner.cancel(); loading = false; histories = null;
    results.replaceChildren(); status.textContent = "";
  }
  function renderChips() {
    chips.replaceChildren(...selected.map(person => {
      const chip = el("span", "chip"); chip.append(el("span", "", person.displayName));
      const remove = button("x", "remove", () => { selected = selected.filter(p => p.personId !== person.personId); selectionChanged(); search.input.focus(); });
      remove.setAttribute("aria-label", `Remove ${person.displayName}`); chip.append(remove); return chip;
    }));
  }
  function selectionChanged() { invalidate(); renderChips(); saveSelection(); updateControls(); }
  function display() {
    if (!histories) return;
    results.replaceChildren(renderResults(histories));
    status.textContent = "";
  }
  async function run(forceRefresh: boolean) {
    if (selected.length < 2) return;
    search.cancel();
    invalidate(); const runId = generation; const people = [...selected]; loading = true;
    status.textContent = `Loading staff histories: 0 of ${people.length}.`;
    progress.max = people.length; progress.value = 0; updateControls();
    try {
      const loaded = await runner.run(people, forceRefresh, count => {
        if (runId === generation) { progress.value = count; status.textContent = `Loading staff histories: ${count} of ${people.length}.`; }
      });
      if (!loaded || runId !== generation || !dialog.open) return;
      histories = loaded; selected = loaded.map(history => history.person); renderChips(); saveSelection(); display();
    } catch (error) {
      if (runId !== generation || !dialog.open) return;
      const message = error instanceof DataSourceError ? error.message : "Could not complete the comparison.";
      const schema = error instanceof DataSourceError && ["SCHEMA_CHANGED", "PARSE_FAILED"].includes(error.code);
      const alert = el("div", "error"); alert.setAttribute("role", "alert");
      alert.append(el("p", "", schema ? "KeyFrame's data format may have changed. This version could not read the staff history." : message));
      if (error instanceof DataSourceError && error.code === "RATE_LIMITED") alert.append(el("p", "", "KeyFrame is busy. Wait a little before retrying."));
      alert.append(button("Retry comparison", "secondary", () => void run(forceRefresh))); results.replaceChildren(alert);
      status.textContent = "Comparison was not completed.";
    } finally {
      if (runId === generation) { loading = false; updateControls(); }
    }
  }
  function open() { if (!dialog.open) dialog.showModal(); search.input.focus(); }
  dialog.addEventListener("close", () => {
    search.cancel(); if (loading) { invalidate(); updateControls(); }
    trigger.focus();
  });
  dialog.addEventListener("click", event => { if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  } });
  renderChips(); updateControls();
}
