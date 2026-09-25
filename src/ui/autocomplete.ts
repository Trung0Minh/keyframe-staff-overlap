import type { KeyframeDataSource } from "../data/KeyframeDataSource.ts";
import type { StaffPerson } from "../domain/types.ts";
import { el, button } from "./dom.ts";

export function autocomplete(source: Pick<KeyframeDataSource, "searchPeople">, selected: () => StaffPerson[], choose: (person: StaffPerson) => void) {
  const root = el("div", "autocomplete");
  const label = el("label", "field-label", "Find KeyFrame staff");
  const input = el("input"); input.id = "kf-person-query"; label.htmlFor = input.id;
  input.placeholder = "Type a name"; input.autocomplete = "off";
  input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-controls", "kf-person-options");
  input.setAttribute("aria-describedby", "kf-search-help");
  const help = el("p", "muted hint", "Search KeyFrame by name or alias from any page. Enter at least 2 characters.");
  help.id = "kf-search-help";
  const menu = el("div", "suggestions"); menu.id = "kf-person-options"; menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "Staff suggestions"); menu.hidden = true;
  const status = el("p", "hint"); status.setAttribute("role", "status");
  const retry = button("Retry search", "text-button", () => search()); retry.hidden = true;
  root.append(label, input, help, menu, status, retry);
  let results: StaffPerson[] = [], active = -1, generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;

  function hide() {
    menu.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant");
  }
  function cancel() {
    generation++; clearTimeout(timer); controller?.abort(); hide();
    status.textContent = ""; retry.hidden = true;
  }
  function select(index: number) {
    const person = results[index];
    if (!person) return;
    cancel(); input.value = ""; results = []; choose(person); input.focus();
  }
  function highlight(index: number) {
    active = index;
    Array.from(menu.children).forEach((child, i) => child.setAttribute("aria-selected", String(i === active)));
    const option = menu.children[active] as HTMLElement | undefined;
    if (option) { input.setAttribute("aria-activedescendant", option.id); option.scrollIntoView({ block: "nearest" }); }
  }
  async function search() {
    cancel(); const query = input.value.trim(); if (query.length < 2) return;
    const run = generation; controller = new AbortController();
    status.textContent = "Searching KeyFrame...";
    try {
      const candidates = await source.searchPeople(query, controller.signal);
      if (run !== generation) return;
      const excluded = new Set(selected().map(person => person.personId));
      const seen = new Set<string>();
      results = candidates.filter(person => !excluded.has(person.personId) && !seen.has(person.personId) && Boolean(seen.add(person.personId))).slice(0, 10);
      menu.replaceChildren(...results.map((person, i) => {
        const option = el("div", "suggestion"); option.id = `kf-option-${i}`; option.setAttribute("role", "option");
        option.append(el("strong", "", person.displayName), el("span", "muted", [...new Set([...person.nativeNames, ...person.aliases, ...person.jobs])].join(" / ") || `Person #${person.personId}`));
        option.addEventListener("mousedown", event => event.preventDefault());
        option.addEventListener("click", () => select(i));
        return option;
      }));
      menu.hidden = results.length === 0; input.setAttribute("aria-expanded", String(results.length > 0));
      status.textContent = results.length ? `${results.length} staff suggestions.` : "No unselected staff found. Try another name or alias.";
      if (results.length) highlight(0);
    } catch (error) {
      if (run !== generation) return;
      status.textContent = error instanceof Error ? error.message : "Could not search KeyFrame staff."; retry.hidden = false;
    }
  }
  input.addEventListener("input", () => { cancel(); results = []; timer = setTimeout(search, 250); });
  input.addEventListener("focus", () => { if (input.value.trim()) void search(); });
  input.addEventListener("keydown", event => {
    if (event.key === "Escape" && !menu.hidden) { event.preventDefault(); event.stopPropagation(); cancel(); }
    else if (!menu.hidden && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault(); highlight((active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    } else if (event.key === "Enter" && !menu.hidden) { event.preventDefault(); select(active); }
  });
  root.addEventListener("focusout", event => { if (!root.contains(event.relatedTarget as Node | null)) cancel(); });
  return { root, input, cancel };
}
