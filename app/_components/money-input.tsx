"use client";

// Rupiah amounts typed and shown as "Rp 25.000.000". The form still receives plain digits
// ("25000000") under the field's name, so saving and the number columns are unchanged.

import { useRef, useState, type ComponentProps } from "react";
import { formatRupiah } from "@/lib/text/money";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string | number | null;
  defaultValue?: string | number | null;
  /** Every change, as plain digits ("" when empty). */
  onValueChange?: (digits: string) => void;
  /** When the field is left, as plain digits — for fields that save on blur. */
  onCommit?: (digits: string) => void;
};

export const digitsOf = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.round(value)) : "";
  const text = String(value).trim();
  // "25000000.00" from a numeric column keeps its whole part only.
  const whole = /^\d+(\.\d+)?$/.test(text) ? text.split(".")[0] : text;
  return whole.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
};
export { formatRupiah };

export function MoneyInput({ value, defaultValue, onValueChange, onCommit, name, onBlur, onFocus, placeholder = "Rp 0", ...rest }: Props) {
  const controlled = value !== undefined;
  const [own, setOwn] = useState(digitsOf(defaultValue));
  const digits = controlled ? digitsOf(value) : own;
  const ref = useRef<HTMLInputElement>(null);
  // onCommit fires only when the amount changed while the field had focus.
  const atFocus = useRef<string | null>(null);

  function change(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const caret = input.selectionStart ?? input.value.length;
    const digitsBefore = input.value.slice(0, caret).replace(/\D/g, "").length;
    const next = digitsOf(input.value).slice(0, 15);
    if (!controlled) setOwn(next);
    onValueChange?.(next);
    // Keep the caret after the same digit once dots are re-inserted.
    window.requestAnimationFrame(() => {
      const field = ref.current;
      if (!field || document.activeElement !== field) return;
      const shown = field.value;
      let seen = 0; let position = shown.length;
      if (digitsBefore === 0) position = shown.indexOf(" ") + 1 || 0;
      else for (let index = 0; index < shown.length; index += 1) { if (/\d/.test(shown[index])) seen += 1; if (seen === digitsBefore) { position = index + 1; break; } }
      field.setSelectionRange(position, position);
    });
  }

  return (
    <>
      <input
        {...rest}
        autoComplete="off"
        inputMode="numeric"
        onBlur={(event) => { if (atFocus.current !== null && atFocus.current !== digits) onCommit?.(digits); atFocus.current = null; onBlur?.(event); }}
        onFocus={(event) => { atFocus.current = digits; onFocus?.(event); }}
        onChange={change}
        placeholder={placeholder}
        ref={ref}
        type="text"
        value={formatRupiah(digits)}
      />
      {name ? <input name={name} type="hidden" value={digits} /> : null}
    </>
  );
}
