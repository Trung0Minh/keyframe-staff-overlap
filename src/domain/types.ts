export type PersonId = string;
export type ProductionId = string;

export interface StaffPerson {
  personId: PersonId;
  displayName: string;
  nativeNames: string[];
  aliases: string[];
  jobs: string[];
  avatarUrl?: string;
  profileUrl: string;
}

export interface ProductionMeta {
  productionId: ProductionId;
  canonicalUrl: string;
  title: string;
  aliases: string[];
  year?: number;
  studios: string[];
}

export interface CreditUnit {
  raw: string;
  key: string;
  kind: "episode" | "op" | "ed" | "movie" | "mv" | "pv" | "cm" | "special" | "overview" | "other";
  number?: number;
  suffix?: string;
  flags: string[];
  note?: string;
  studio?: string;
  alias?: string;
}

export interface CreditEntry {
  category?: string;
  roleJa?: string;
  roleEn?: string;
  rawRole?: string;
  units: CreditUnit[];
  note?: string;
}

export interface PersonProductionCredits {
  personId: PersonId;
  production: ProductionMeta;
  credits: CreditEntry[];
}

export interface PersonHistory {
  person: StaffPerson;
  productions: PersonProductionCredits[];
  fetchedAt: number;
}

export type ComparisonMode = "production" | "unit";

export interface ComparisonPerson {
  person: StaffPerson;
  credits: CreditEntry[];
}

export interface ComparisonResult {
  production: ProductionMeta;
  people: ComparisonPerson[];
  sharedUnitKeys?: string[];
}

export interface PairOverlap {
  a: StaffPerson;
  b: StaffPerson;
  productionCount: number;
  productionIds: ProductionId[];
}

export interface GroupOverlap {
  people: StaffPerson[];
  productionCount: number;
  productionIds: ProductionId[];
}
