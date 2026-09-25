import type { PersonHistory, StaffPerson } from "../domain/types.ts";

export interface KeyframeDataSource {
  searchPeople(query: string, signal?: AbortSignal): Promise<StaffPerson[]>;
  getPersonHistory(personId: string, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<PersonHistory>;
}
