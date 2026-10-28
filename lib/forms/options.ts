// One rule for every dropdown in an edit form: the record's current value is always an option,
// even when it is no longer in the list (an old status, a renamed platform). Otherwise the
// browser shows the first option or nothing, and saving silently replaces the value.

/** The options, plus the current value when it is not among them. */
export function withCurrent(options: readonly string[], current: unknown): string[] {
  const value = current === null || current === undefined ? "" : String(current).trim();
  return value && !options.includes(value) ? [...options, value] : [...options];
}

/** Label for a kept value that is no longer in the list. */
export function optionLabel(options: readonly string[], option: string) {
  return options.includes(option) ? option : `${option} (not in list)`;
}
