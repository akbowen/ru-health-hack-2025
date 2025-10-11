// Utilities to create stable deterministic IDs so they don't change between imports

export const normalize = (input: string): string =>
  input.toLowerCase().trim().replace(/\s+/g, ' ');

export const slugify = (input: string): string =>
  normalize(input).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const stableProviderId = (name: string): string => `provider-${slugify(name)}`;

export const stableSiteId = (name: string): string => `site-${slugify(name)}`;

export const toYMD = (d: Date | string): string => {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const stableScheduleId = (
  providerId: string,
  siteId: string,
  date: Date | string,
  shift: string
): string => {
  const pid = providerId.replace(/^provider-/, '');
  const sid = siteId.replace(/^site-/, '');
  const ymd = toYMD(date);
  return `schedule-${pid}_${sid}_${ymd}_${slugify(shift)}`;
};
