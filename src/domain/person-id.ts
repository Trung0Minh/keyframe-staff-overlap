export function validPersonId(value: unknown): value is string {
  return typeof value === "string" && (/^\d+$/.test(value) || /^(ja|en):\S[^\r\n]*$/.test(value));
}

export function personProfileUrl(personId: string): string {
  const path = /^\d+$/.test(personId) ? personId
    : personId.slice(0, 3) + encodeURIComponent(personId.slice(3)).replace(/%2F/g, "%252F");
  return `https://keyframe-staff-list.com/person/${path}`;
}
