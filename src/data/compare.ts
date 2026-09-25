import type { PersonHistory, StaffPerson } from "../domain/types.ts";
import type { KeyframeDataSource } from "./KeyframeDataSource.ts";
import { DataSourceError } from "../shared/errors.ts";

export class ComparisonRunner {
  private source: Pick<KeyframeDataSource, "getPersonHistory">;
  private current?: AbortController;

  constructor(source: Pick<KeyframeDataSource, "getPersonHistory">) { this.source = source; }

  cancel(): void { this.current?.abort(); }

  async run(people: StaffPerson[], forceRefresh: boolean, progress: (loaded: number) => void): Promise<PersonHistory[] | null> {
    this.cancel();
    const run = new AbortController();
    this.current = run;
    const histories: PersonHistory[] = new Array(people.length);
    let next = 0, loaded = 0;
    let failure: DataSourceError | undefined;
    const worker = async () => {
      while (next < people.length && !run.signal.aborted) {
        const index = next++;
        try {
          histories[index] = await this.source.getPersonHistory(people[index].personId, { signal: run.signal, forceRefresh });
          if (!run.signal.aborted) progress(++loaded);
        } catch (error) {
          if (!run.signal.aborted) {
            failure = new DataSourceError(error instanceof DataSourceError ? error.code : "NETWORK",
              `Could not load data for ${people[index].displayName}. The comparison was not completed.`, { cause: error });
            run.abort();
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, people.length) }, worker));
    if (this.current !== run) return null;
    if (failure) throw failure;
    return run.signal.aborted ? null : histories;
  }
}
