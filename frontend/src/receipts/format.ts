export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;

export const tone = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : v > 0 ? "rc-pos" : v < 0 ? "rc-neg" : "";

// "2022-07-15" -> "15 Jul 2022"
export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export const fmtTs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const cleanName = (name: string) => name.replace(/\s+(Limited|Ltd\.?)$/, "");
// must match the queries pre-saved for the offline demo
export const stockNewsQuery = (name: string) => `${cleanName(name)} share`;
