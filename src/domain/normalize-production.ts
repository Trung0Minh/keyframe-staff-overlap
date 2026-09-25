const ORIGIN = "https://keyframe-staff-list.com";

export function normalizeProductionUrl(value: string): string {
  const url = new URL(value, ORIGIN);
  if (url.origin !== ORIGIN || url.username || url.password || !/^\/staff\/[^/]+\/*$/.test(url.pathname)) {
    throw new Error("Expected a KeyFrame staff-list URL.");
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

export function productionIdFromUrl(value: string): string {
  return normalizeProductionUrl(value).replace(`${ORIGIN}/staff/`, "");
}
