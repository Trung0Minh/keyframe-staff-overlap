import type { ComparisonPerson, CreditEntry, CreditUnit } from "./types.ts";

export function groupUnits(people: ComparisonPerson[]) {
  const rows = new Map<string, { unit?: CreditUnit; cells: Map<string, CreditEntry>[] }>();
  for (const [personIndex, person] of people.entries()) {
    for (const credit of person.credits) {
      for (const unit of credit.units.length ? credit.units : [undefined]) {
        const key = unit?.key ?? "unspecified";
        let row = rows.get(key);
        if (!row) {
          row = { unit, cells: people.map(() => new Map()) };
          rows.set(key, row);
        }
        const roleKey = JSON.stringify([credit.category, credit.roleEn, credit.roleJa, credit.rawRole, credit.note]);
        const cell = row.cells[personIndex];
        let entry = cell.get(roleKey);
        if (!entry) { entry = { ...credit, units: [] }; cell.set(roleKey, entry); }
        if (unit) entry.units.push(unit);
      }
    }
  }
  return [...rows.values()].map(row => {
    const cells = row.cells.map(cell => [...cell.values()]);
    const count = cells.filter(cell => cell.length).length;
    const specific = row.unit !== undefined && row.unit.kind !== "overview";
    return { unit: row.unit, cells, count, shared: specific && count === people.length, rank: specific ? count : 0 };
  }).sort((a, b) => b.rank - a.rank
    || (a.unit?.key ?? "zz:unspecified").localeCompare(b.unit?.key ?? "zz:unspecified", undefined, { numeric: true }));
}
