import { normalizeUnit } from "../domain/normalize-unit.ts";
import { normalizeProductionUrl } from "../domain/normalize-production.ts";
import { validPersonId, personProfileUrl } from "../domain/person-id.ts";
import type { CreditEntry, PersonHistory, StaffPerson } from "../domain/types.ts";
import { DataSourceError } from "../shared/errors.ts";
import type { KeyframeDataSource } from "./KeyframeDataSource.ts";

const ORIGIN = "https://keyframe-staff-list.com";
type RecordValue = Record<string, unknown>;
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;

function invalid(field: string): never {
  throw new DataSourceError("SCHEMA_CHANGED", `Unexpected KeyFrame field: ${field}`);
}
function record(value: unknown, field: string): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : invalid(field);
}
function list(value: unknown, field: string): unknown[] {
  return Array.isArray(value) ? value : invalid(field);
}
function requiredText(value: unknown, field: string): string {
  return text(value) ?? invalid(field);
}
function id(value: unknown): string {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+$/.test(String(value))) invalid("person.id");
  return String(value);
}

export function parseHistory(payload: unknown, requestedId?: string): PersonHistory {
  const data = record(payload, "history");
  const staff = record(data.staff, "staff");
  const personId = staff.id == null && requestedId && /^(ja|en):/.test(requestedId)
    ? requestedId : id(staff.id);
  if (/^(ja|en):/.test(personId) && staff[personId.slice(0, 2)] !== personId.slice(3)) invalid("person.name mismatch");
  const aliases = list(staff.aliases ?? [], "aliases").flatMap(value => {
    const alias = record(value, "alias");
    return [text(alias.en), ...list(alias.jaAliases ?? [], "jaAliases").map(item => text(record(item, "alias.ja").ja))]
      .filter((name): name is string => Boolean(name));
  });
  const person: StaffPerson = {
    personId, displayName: text(staff.en) ?? requiredText(staff.ja, "staff.name"),
    nativeNames: text(staff.ja) ? [staff.ja as string] : [], aliases: [...new Set(aliases)],
    jobs: list(data.jobs ?? [], "jobs").map(job => requiredText(job, "job")),
    profileUrl: personProfileUrl(personId),
  };
  const productions = list(data.credits, "credits").map(value => {
    const work = record(value, "production");
    const credits: CreditEntry[] = [];
    for (const nameValue of list(work.names, "production.names")) {
      const name = record(nameValue, "production.name");
      for (const categoryValue of list(name.categories, "categories")) {
        const category = record(categoryValue, "category");
        for (const roleValue of list(category.roles, "roles")) {
          const role = record(roleValue, "role");
          if (!text(role.role_en) && !text(role.role_ja)) invalid("role.name");
          credits.push({
            category: text(category.category), roleEn: text(role.role_en), roleJa: text(role.role_ja),
            units: list(role.credits, "role.credits").map(creditValue => {
              const credit = record(creditValue, "credit");
              const unit = normalizeUnit(requiredText(credit.episode, "episode"));
              if (credit.is_nc != null && credit.is_nc !== 0 && credit.is_nc !== 1 && typeof credit.is_nc !== "boolean") invalid("is_nc");
              if (credit.is_nc === 1 || credit.is_nc === true) unit.flags = [...new Set([...unit.flags, "NC"])];
              if (credit.comment != null && typeof credit.comment !== "string") invalid("comment");
              if (credit.is_primary_alias != null && typeof credit.is_primary_alias !== "boolean") invalid("is_primary_alias");
              unit.note = text(credit.comment);
              if (credit.studio != null) {
                const studio = record(credit.studio, "studio");
                unit.studio = [text(studio.en), text(studio.ja)].filter(Boolean).join(" / ") || undefined;
              }
              if (credit.is_primary_alias === false) unit.alias = [text(name.en), text(name.ja)].filter(Boolean).join(" / ") || undefined;
              return unit;
            }),
          });
        }
      }
    }
    let canonicalUrl: string;
    const slug = requiredText(work.slug, "slug");
    if (/[/?#\\]/.test(slug) || slug === "." || slug === "..") invalid("slug");
    try { canonicalUrl = normalizeProductionUrl(`/staff/${encodeURIComponent(slug)}`); }
    catch { invalid("production.url"); }
    const title = text(work.stafflist_name) ?? requiredText(work.stafflist_name_ja, "title");
    return {
      personId,
      production: {
        productionId: requiredText(work.uuid, "uuid"), canonicalUrl, title,
        aliases: [text(work.stafflist_name_ja)].filter((name): name is string => Boolean(name) && name !== title),
        year: typeof work.seasonYear === "number" && Number.isFinite(work.seasonYear) ? work.seasonYear : undefined,
        studios: text(work.stafflist_studios)?.split(",").map(studio => studio.trim()).filter(Boolean) ?? [],
      }, credits,
    };
  });
  return { person, productions, fetchedAt: Date.now() };
}

export class StructuredKeyframeDataSource implements KeyframeDataSource {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = (...args) => fetchImpl(...args);
  }

  async searchPeople(query: string, signal?: AbortSignal): Promise<StaffPerson[]> {
    if (query.trim().length < 2) return [];
    const url = new URL("/api/search/", ORIGIN);
    url.searchParams.set("q", query.trim());
    url.searchParams.set("type", "staff");
    try {
      signal?.throwIfAborted();
      const response = await this.fetchImpl(url, { signal, credentials: "same-origin" });
      if (response.status === 429) throw new DataSourceError("RATE_LIMITED", "KeyFrame is busy. Please try again later.");
      if (!response.ok) throw new DataSourceError("NETWORK", `Search request failed (${response.status}).`);
      let payload: unknown;
      try { payload = await response.json(); }
      catch { throw new DataSourceError("PARSE_FAILED", "Could not read staff suggestions."); }
      const people = new Map<string, StaffPerson>();
      for (const value of list(record(payload, "search").staff, "search.staff")) {
        const staff = record(value, "search.staff member");
        if (staff.is_studio === 1) continue;
        if (staff.is_studio !== 0) invalid("search.is_studio");
        const personId = staff.anilist_id == null
          ? text(staff.ja) ? `ja:${staff.ja}` : `en:${requiredText(staff.en, "search.name")}`
          : id(staff.anilist_id);
        const displayName = text(staff.main_en) ?? text(staff.en) ?? text(staff.main_ja) ?? requiredText(staff.ja, "search.name");
        const nativeNames = [text(staff.main_ja), text(staff.ja)].filter((name): name is string => Boolean(name));
        const aliases = [text(staff.en), text(staff.ja)].filter((name): name is string => Boolean(name) && name !== displayName);
        const jobs = list(staff.jobs ?? [], "search.jobs").map(job => requiredText(job, "search.job"));
        const existing = people.get(personId);
        people.set(personId, {
          personId, displayName: existing?.displayName ?? displayName,
          nativeNames: [...new Set([...(existing?.nativeNames ?? []), ...nativeNames])],
          aliases: [...new Set([...(existing?.aliases ?? []), ...aliases])],
          jobs: [...new Set([...(existing?.jobs ?? []), ...jobs])],
          profileUrl: personProfileUrl(personId),
        });
      }
      signal?.throwIfAborted();
      return [...people.values()];
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new DataSourceError("ABORTED", "Request cancelled.");
      if (error instanceof DataSourceError) throw error;
      throw new DataSourceError("NETWORK", "Could not search KeyFrame staff.", { cause: error });
    }
  }

  async getPersonHistory(personId: string, options: { signal?: AbortSignal } = {}): Promise<PersonHistory> {
    if (!validPersonId(personId)) invalid("person.id");
    const url = new URL("/api/person/show.php", ORIGIN);
    url.searchParams.set("id", personId);
    url.searchParams.set("type", "person");
    try {
      const response = await this.fetchImpl(url, { signal: options.signal, credentials: "same-origin" });
      if (response.status === 404) throw new DataSourceError("NOT_FOUND", "Staff profile not found.");
      if (response.status === 429) throw new DataSourceError("RATE_LIMITED", "KeyFrame is busy. Please try again later.");
      if (!response.ok) throw new DataSourceError("NETWORK", `History request failed (${response.status}).`);
      let payload: unknown;
      try { payload = await response.json(); }
      catch { throw new DataSourceError("PARSE_FAILED", "Could not read the staff history."); }
      const history = parseHistory(payload, personId);
      if (history.person.personId !== personId) invalid("person.id mismatch");
      options.signal?.throwIfAborted();
      return history;
    } catch (error) {
      if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw new DataSourceError("ABORTED", "Request cancelled.");
      }
      if (error instanceof DataSourceError) throw error;
      throw new DataSourceError("NETWORK", "Could not load KeyFrame history.", { cause: error });
    }
  }
}
