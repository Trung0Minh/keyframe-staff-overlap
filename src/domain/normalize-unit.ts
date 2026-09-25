import type { CreditUnit } from "./types.ts";

const flagsPattern = /\[NC\]/gi;

export function normalizeUnit(raw: string): CreditUnit {
  const flags = /\[NC\]/i.test(raw) ? ["NC"] : [];
  const clean = raw.replace(flagsPattern, "").trim().toUpperCase();

  const episode = clean.match(/^#\s*(\d+)$/);
  if (episode && Number.isSafeInteger(Number(episode[1]))) return { raw, key: `episode:${Number(episode[1])}`, kind: "episode", number: Number(episode[1]), flags };

  const numbered = clean.match(/^(OP|ED)\s*0*(\d+)$/);
  if (numbered && Number.isSafeInteger(Number(numbered[2]))) return { raw, key: `${numbered[1].toLowerCase()}:${Number(numbered[2])}`, kind: numbered[1].toLowerCase() as "op" | "ed", number: Number(numbered[2]), flags };

  const known: Record<string, CreditUnit["kind"]> = {
    OP: "op", ED: "ed", MOVIE: "movie", MV: "mv", PV: "pv", CM: "cm", SPECIAL: "special", OVERVIEW: "overview",
  };
  const kind = Object.hasOwn(known, clean) ? known[clean] : undefined;
  if (kind) return { raw, key: kind, kind, flags };

  return { raw, key: `other:${clean.toLowerCase()}`, kind: "other", flags };
}
