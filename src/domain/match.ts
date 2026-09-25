import type {
  ComparisonMode, ComparisonResult, GroupOverlap, PairOverlap,
  PersonHistory, PersonProductionCredits, ProductionId,
} from "./types.ts";

export function intersectSets<T>(sets: Set<T>[]): Set<T> {
  if (!sets.length) return new Set();
  const [smallest, ...rest] = [...sets].sort((a, b) => a.size - b.size);
  return new Set([...smallest].filter((value) => rest.every((set) => set.has(value))));
}

export function indexHistoryByProductionId(history: PersonHistory): Map<ProductionId, PersonProductionCredits> {
  const index = new Map<ProductionId, PersonProductionCredits>();
  for (const entry of history.productions) {
    if (!entry.credits.length) continue;
    const previous = index.get(entry.production.productionId);
    index.set(entry.production.productionId, previous ? {
      ...previous, production: { ...previous.production, year: previous.production.year ?? entry.production.year },
      credits: [...previous.credits, ...entry.credits],
    } : entry);
  }
  return index;
}

function sharedUnitKeys(entries: PersonProductionCredits[]): Set<string> {
  return intersectSets(entries.map((entry) => new Set(entry.credits.flatMap((credit) => credit.units).filter((unit) => unit.kind !== "overview").map((unit) => unit.key))));
}

function resultsFor(histories: PersonHistory[], ids: Set<ProductionId>, mode: ComparisonMode): ComparisonResult[] {
  const indexes = histories.map(indexHistoryByProductionId);
  return [...ids].map((productionId) => {
    const entries = indexes.map((index) => index.get(productionId)!);
    const shared = mode === "unit" ? [...sharedUnitKeys(entries)] : undefined;
    return {
      production: { ...entries[0].production, year: entries.find(entry => entry.production.year !== undefined)?.production.year },
      people: entries.map((entry, index) => ({ person: histories[index].person, credits: entry.credits })),
      ...(shared?.length ? { sharedUnitKeys: shared } : {}),
    };
  }).filter((result) => mode === "production" || Boolean(result.sharedUnitKeys?.length));
}

export function findMatches(histories: PersonHistory[], mode: ComparisonMode): ComparisonResult[] {
  if (histories.length < 2) return [];
  if (new Set(histories.map(history => history.person.personId)).size !== histories.length) throw new Error("Select unique staff members.");
  const ids = intersectSets(histories.map((history) => new Set(indexHistoryByProductionId(history).keys())));
  return sortResults(resultsFor(histories, ids, mode));
}

export function computePairOverlaps(histories: PersonHistory[], mode: ComparisonMode): PairOverlap[] {
  const overlaps: PairOverlap[] = [];
  for (let i = 0; i < histories.length; i += 1) {
    for (let j = i + 1; j < histories.length; j += 1) {
      const results = findMatches([histories[i], histories[j]], mode);
      overlaps.push({ a: histories[i].person, b: histories[j].person, productionCount: results.length, productionIds: results.map((result) => result.production.productionId) });
    }
  }
  return overlaps.sort((a, b) => b.productionCount - a.productionCount);
}

export function computeLeaveOneOutOverlaps(histories: PersonHistory[], mode: ComparisonMode): GroupOverlap[] {
  if (histories.length < 4) return [];
  return histories.map((_, omitted) => {
    const group = histories.filter((__, index) => index !== omitted);
    const results = findMatches(group, mode);
    return { people: group.map((history) => history.person), productionCount: results.length, productionIds: results.map((result) => result.production.productionId) };
  }).filter((group) => group.productionCount > 0).sort((a, b) => b.productionCount - a.productionCount);
}

export function sortResults(results: ComparisonResult[]): ComparisonResult[] {
  return [...results].sort((a, b) => {
    if (a.production.year !== undefined && b.production.year !== undefined && a.production.year !== b.production.year) return b.production.year - a.production.year;
    if (a.production.year !== b.production.year) return a.production.year === undefined ? 1 : -1;
    return a.production.title.localeCompare(b.production.title);
  });
}
