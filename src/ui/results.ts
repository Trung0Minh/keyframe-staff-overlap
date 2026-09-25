import type { ComparisonResult, PersonHistory } from "../domain/types.ts";
import { computeLeaveOneOutOverlaps, computePairOverlaps, findMatches } from "../domain/match.ts";
import { groupUnits } from "../domain/group-units.ts";
import { el, link } from "./dom.ts";

function productionResult(result: ComparisonResult): HTMLElement {
  const section = el("article", "production");
  const title = el("h3"); title.append(link(result.production.title, result.production.canonicalUrl));
  section.append(title, el("p", "muted metadata", [result.production.year, ...result.production.studios].filter(Boolean).join(" / ")));
  const columns = el("div", "staff-columns");
  columns.style.setProperty("--staff-count", String(result.people.length));
  columns.tabIndex = 0;
  columns.setAttribute("role", "region");
  columns.setAttribute("aria-label", `Staff credits for ${result.production.title}; scroll horizontally for more staff`);
  const table = el("table", "episode-table");
  table.append(el("caption", "sr-only", `${result.production.title}: episodes and roles by staff member`));
  const head = el("thead"), headings = el("tr");
  const episodeHeading = el("th", "episode-heading", "Episode"); episodeHeading.scope = "col";
  headings.append(episodeHeading);
  for (const { person } of result.people) {
    const heading = el("th", "staff-heading"); heading.scope = "col";
    heading.append(link(person.displayName, person.profileUrl)); headings.append(heading);
  }
  head.append(headings); table.append(head);
  const body = el("tbody");
  for (const group of groupUnits(result.people)) {
    const row = el("tr", group.shared ? "episode-row shared-episode" : "episode-row");
    const unit = group.unit;
    const label = !unit ? "Unspecified unit" : unit.kind === "episode" ? `Episode ${unit.number}`
      : unit.raw.replace(/\[NC\]/gi, "").trim();
    const heading = el("th", "episode-label"); heading.scope = "row";
    heading.append(el("span", "episode-name", label));
    if (unit?.kind === "overview") heading.append(el("span", "episode-status muted", "Production-wide"));
    row.append(heading);
    for (const credits of group.cells) {
      const cell = el("td", "person-credits");
      if (!credits.length) cell.append(el("span", "muted no-credit", "No credit listed"));
      const list = el("ul", "credits");
      for (const credit of credits) {
        const item = el("li");
        item.append(el("strong", "role", [credit.roleEn, credit.roleJa && credit.roleJa !== credit.roleEn ? credit.roleJa : undefined, credit.rawRole].filter(Boolean).join(" / ") || "Credit"));
        const flags = [...new Set(credit.units.flatMap(unit => unit.flags))];
        if (flags.length) item.append(el("span", "credit-flags", flags.map(flag => `[${flag}]`).join(" ")));
        if (credit.units.some(unit => unit.note || unit.alias || unit.studio)) {
          const detail = el("details", "credit-note"); detail.append(el("summary", "", "Credit details"));
          for (const unit of credit.units) {
            if (!unit.note && !unit.alias && !unit.studio) continue;
            const source = el("div", "source-credit");
            if (unit.studio) source.append(el("p", "", `Studio: ${unit.studio}`));
            if (unit.alias) source.append(el("p", "", `Credited as: ${unit.alias}`));
            if (unit.note) source.append(el("p", "source-note", unit.note));
            detail.append(source);
          }
          item.append(detail);
        }
        if (credit.note) item.append(el("p", "source-note", credit.note));
        list.append(item);
      }
      cell.append(list); row.append(cell);
    }
    body.append(row);
  }
  table.append(body); columns.append(table);
  section.append(el("p", `column-hint muted hint${result.people.length > 3 ? " many-staff" : ""}`, "Staff stay in selection order. Scroll sideways to see more columns."), columns);
  return section;
}

export function renderResults(histories: PersonHistory[]): HTMLElement {
  const container = el("div");
  const results = findMatches(histories, "production");
  const count = results.length;
  const heading = el("h2", "results-heading", count ? `${count} common production${count === 1 ? "" : "s"}` : "No match for everyone");
  container.append(heading);
  if (count) {
    const episodes = results.reduce((total, result) => total + groupUnits(result.people)
      .filter(group => group.shared && group.unit?.kind === "episode").length, 0);
    heading.append(el("span", "common-episode-count", ` / ${episodes} common episode${episodes === 1 ? "" : "s"}`));
  }
  if (count) container.append(...results.map(productionResult));
  else {
    container.append(el("p", "empty-message", `No common productions found for all ${histories.length} selected staff.`));
    if (histories.length > 2) {
      const partial = el("section", "partial"); partial.append(el("h3", "", "Partial overlaps"), el("p", "muted", "These groups include only some of your selected staff."));
      const meta = new Map(histories.flatMap(h => h.productions.map(p => [p.production.productionId, p.production] as const)));
      const groupRow = (names: string[], ids: string[]) => {
        const detail = el("details"); detail.append(el("summary", "", `${names.join(" + ")} / ${ids.length} shared production${ids.length === 1 ? "" : "s"}`));
        const list = el("ul");
        for (const id of ids) { const work = meta.get(id)!; const item = el("li"); item.append(link(work.title, work.canonicalUrl)); list.append(item); }
        detail.append(list); return detail;
      };
      const groups = computeLeaveOneOutOverlaps(histories, "production");
      if (groups.length) {
        partial.append(el("h4", "", "All but one"));
        for (const group of groups) partial.append(groupRow(group.people.map(p => p.displayName), group.productionIds));
      }
      const pairs = computePairOverlaps(histories, "production");
      const visible = histories.length === 3 ? pairs : pairs.filter(pair => pair.productionCount > 0);
      partial.append(el("h4", "", "Pairs"));
      if (!pairs.some(pair => pair.productionCount)) partial.append(el("p", "muted", "No pairs share a production."));
      for (const pair of visible.slice(0, 10)) partial.append(groupRow([pair.a.displayName, pair.b.displayName], pair.productionIds));
      if (visible.length > 10) {
        const more = el("details"); more.append(el("summary", "", `Show all pair overlaps (${visible.length})`));
        for (const pair of visible.slice(10)) more.append(groupRow([pair.a.displayName, pair.b.displayName], pair.productionIds));
        partial.append(more);
      }
      container.append(partial);
    }
  }
  return container;
}
