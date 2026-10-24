// One way to put names in A–Z order everywhere: ignores upper/lower case and accents, and
// reads numbers as numbers ("Batch 2" before "Batch 10"). A plain `.sort()` compares
// character codes, which puts "ASTRO" before "Adidas".
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function compareText(a: unknown, b: unknown) {
  return collator.compare(String(a ?? ""), String(b ?? ""));
}
