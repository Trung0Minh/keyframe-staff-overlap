import type { PersonHistory, StaffPerson } from "../domain/types.ts";
import { normalizeUnit } from "../domain/normalize-unit.ts";
import { normalizeProductionUrl } from "../domain/normalize-production.ts";
import { validPersonId, personProfileUrl } from "../domain/person-id.ts";
import type { KeyframeDataSource } from "./KeyframeDataSource.ts";

export const CACHE_VERSION = 2;
export const CACHE_TTL = 24 * 60 * 60 * 1000;
export interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");

export function validPerson(value: unknown): value is StaffPerson {
  const p = value as StaffPerson | undefined;
  return Boolean(p && validPersonId(p.personId) && typeof p.displayName === "string" && p.displayName.trim()
    && strings(p.nativeNames) && strings(p.aliases) && strings(p.jobs)
    && p.profileUrl === personProfileUrl(p.personId));
}

function validHistory(value: unknown, personId: string): value is PersonHistory {
  try {
    const h = value as PersonHistory;
    const optionalText = (v: unknown) => v === undefined || typeof v === "string";
    return validPerson(h.person) && h.person.personId === personId && Number.isFinite(h.fetchedAt) && Array.isArray(h.productions)
      && h.productions.every(p => p.personId === personId && typeof p.production.productionId === "string" && p.production.productionId.length > 0
        && typeof p.production.title === "string" && strings(p.production.aliases) && strings(p.production.studios)
        && (p.production.year === undefined || Number.isFinite(p.production.year))
        && normalizeProductionUrl(p.production.canonicalUrl) === p.production.canonicalUrl
        && Array.isArray(p.credits) && p.credits.every(c => optionalText(c.category) && optionalText(c.roleEn) && optionalText(c.roleJa) && optionalText(c.note)
          && Array.isArray(c.units) && c.units.every(u => typeof u.raw === "string" && normalizeUnit(u.raw).key === u.key
            && normalizeUnit(u.raw).kind === u.kind && strings(u.flags) && optionalText(u.note) && optionalText(u.studio) && optionalText(u.alias))));
  } catch { return false; }
}

export class HistoryCache {
  private source: Pick<KeyframeDataSource, "getPersonHistory">;
  private storage: StorageArea;
  private now: () => number;

  constructor(source: Pick<KeyframeDataSource, "getPersonHistory">, storage: StorageArea, now = Date.now) {
    this.source = source; this.storage = storage; this.now = now;
  }

  async getPersonHistory(personId: string, options: { signal?: AbortSignal; forceRefresh?: boolean } = {}): Promise<PersonHistory> {
    options.signal?.throwIfAborted();
    const key = `personHistory:${personId}`;
    if (!options.forceRefresh) {
      try {
        const cached = (await this.storage.get(key))[key] as { schemaVersion: number; fetchedAt: number; value: unknown } | undefined;
        const age = cached ? this.now() - cached.fetchedAt : -1;
        if (cached?.schemaVersion === CACHE_VERSION && age >= 0 && age < CACHE_TTL && validHistory(cached.value, personId)) {
          options.signal?.throwIfAborted();
          return cached.value;
        }
      } catch { /* Unavailable storage must not block a fresh comparison. */ }
    }
    options.signal?.throwIfAborted();
    const history = await this.source.getPersonHistory(personId, options);
    options.signal?.throwIfAborted();
    try { await this.storage.set({ [key]: { schemaVersion: CACHE_VERSION, fetchedAt: this.now(), value: history } }); }
    catch { /* Quota failures leave the fresh result usable and old records intact. */ }
    options.signal?.throwIfAborted();
    return history;
  }
}
