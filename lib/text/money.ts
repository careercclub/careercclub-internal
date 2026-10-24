// One way to show rupiah. Amounts on rows and details are full ("Rp 2.500.000");
// only headline summaries use the short form ("Rp 4.7M", "Rp 750K").

function digitsOf(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.round(value)) : "";
  const text = String(value).trim();
  const whole = /^-?\d+(\.\d+)?$/.test(text) ? String(Math.round(Number(text))) : text.replace(/\D/g, "");
  return whole.replace(/^0+(?=\d)/, "");
}

/** 2500000 → "Rp 2.500.000"; empty → "". */
export function formatRupiah(value: unknown) {
  const digits = digitsOf(value);
  return digits ? `Rp ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}` : "";
}

/** 4700000 → "Rp 4.7M"; 750000 → "Rp 750K"; 950 → "Rp 950". */
export function formatRupiahShort(value: unknown) {
  const number = Number(digitsOf(value) || 0);
  if (number >= 1_000_000_000) return `Rp ${+(number / 1_000_000_000).toFixed(number >= 10_000_000_000 ? 0 : 1)}B`;
  if (number >= 1_000_000) return `Rp ${+(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
  if (number >= 1_000) return `Rp ${Math.round(number / 1_000)}K`;
  return `Rp ${number}`;
}
