// Canonical payer names + the spellings seen in spreadsheets, used by seed and import.
export const PAYER_CATALOG: { name: string; aliases: string[] }[] = [
  { name: "1199SEIU", aliases: ["1199", "1199 seiu"] },
  { name: "Aetna", aliases: [] },
  { name: "Aetna Better Health", aliases: ["aetna better health", "aetna medicaid"] },
  { name: "Ambetter", aliases: [] },
  { name: "AmeriHealth", aliases: ["amerihealth", "amerihealth caritas"] },
  { name: "Cigna", aliases: [] },
  { name: "Clover Health", aliases: ["clover", "clover health medicare advantage ppo hmo"] },
  { name: "Curative", aliases: [] },
  { name: "EmblemHealth (GHI)", aliases: ["emblem", "emblem ghi", "ghi", "emblemhealth", "hip"] },
  { name: "Empire BCBS", aliases: ["empire", "anthem", "empire blue cross"] },
  { name: "First Health", aliases: [] },
  { name: "Healthfirst", aliases: [] },
  { name: "Horizon BCBS", aliases: ["bcbs horizon", "bcbs horizan", "horizon", "horizon blue cross"] },
  { name: "Humana", aliases: [] },
  { name: "MagnaCare", aliases: ["magna care", "magnacare"] },
  { name: "Medicaid", aliases: ["mediciad", "medicaid ny", "nys medicaid"] },
  { name: "Medicare", aliases: ["medicare part b", "cms"] },
  { name: "MetroPlus", aliases: ["metro plus"] },
  { name: "Molina", aliases: [] },
  { name: "MultiPlan", aliases: ["multiplan", "multi plan"] },
  { name: "Optum", aliases: [] },
  { name: "Oxford", aliases: ["oxford plans", "oxford health"] },
  { name: "Tricare", aliases: [] },
  { name: "UMR", aliases: [] },
  { name: "UnitedHealthcare", aliases: ["uhc", "united", "united healthcare", "unitedhealthcare"] },
  { name: "Wellcare / Fidelis Care", aliases: ["wellcare", "fidelis", "wellcare/fidelis care", "fidelis care"] },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Splits a sheet label like "Medicare group" / "Multiplan(ind)" into
 * a canonical payer name and whether it is a group or individual enrollment.
 */
export function parsePayerLabel(label: string): { name: string; type: "group" | "individual" } {
  let raw = label.trim();
  let type: "group" | "individual" = "individual";
  if (/\bgroup\b/i.test(raw)) type = "group";
  raw = raw
    .replace(/\(\s*(group|grp|ind|individual)\s*\)/gi, " ")
    .replace(/\b(group|grp|ind|individual)\b/gi, " ")
    .replace(/\(.*?\)/g, " ") // drop descriptors like "(Medicare Advantage PPO HMO)"
    .trim();

  const key = norm(raw);
  for (const p of PAYER_CATALOG) {
    if (norm(p.name) === key || p.aliases.some((a) => norm(a) === key)) return { name: p.name, type };
  }
  // prefix match, e.g. "Wellcare/Fidelis Care" variants
  for (const p of PAYER_CATALOG) {
    if ([p.name, ...p.aliases].some((a) => key.startsWith(norm(a)) && norm(a).length >= 4))
      return { name: p.name, type };
  }
  return { name: raw.replace(/\s+/g, " "), type };
}
