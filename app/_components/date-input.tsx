"use client";

// One date field for the whole app: always shown as dd/mm/yyyy, with a calendar in the
// app's style.
//
// The real <input type="date"> stays: its name, required, min/max, form value and React
// onChange keep working, and it still holds ISO yyyy-mm-dd. Only how it looks changes —
// its own text (which follows each laptop's locale, mm/dd or dd/mm) is hidden behind a
// dd/mm/yyyy label. With a mouse or trackpad a press opens the calendar below; digits
// can be typed straight in ("24102026"). Phones keep their native date picker.

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import s from "./date-input.module.css";

type Props = Omit<ComponentProps<"input">, "type"> & {
  /** Render the field with another input component (e.g. the shadcn Input). */
  as?: ComponentType<ComponentProps<"input">>;
  /** Class for the wrapper that holds the field and its label. */
  wrapperClassName?: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const valueSetter = typeof window === "undefined" ? undefined : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

const pad = (value: number) => String(value).padStart(2, "0");
export const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
function fromIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}
/** "2026-10-24" → "24/10/2026". */
export function formatDayMonthYear(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}
/** "24102026" → "24/10/2026" as it is typed. */
function maskDigits(digits: string) {
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

function weeksOf(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7)); // Monday first
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

export function DateInput({ as: Field, wrapperClassName, value, defaultValue, onChange, className, style, ref: _ref, ...rest }: Props) {
  void _ref; // the field keeps its own ref; nothing in the app forwards one
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const controlled = value !== undefined;
  const [own, setOwn] = useState(String(defaultValue ?? ""));
  const current = controlled ? String(value ?? "") : own;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => fromIso(current) || new Date());
  const [active, setActiveDay] = useState<Date>(() => fromIso(current) || new Date());
  // Moving the highlighted day also moves the month shown.
  const setActive = useCallback((next: Date | ((date: Date) => Date)) => {
    const date = typeof next === "function" ? next(activeRef.current) : next;
    activeRef.current = date;
    setActiveDay(date);
    setView((shown) => (shown.getMonth() === date.getMonth() && shown.getFullYear() === date.getFullYear() ? shown : new Date(date.getFullYear(), date.getMonth(), 1)));
  }, []);
  const [typed, setTypedState] = useState("");
  // The open calendar's key handler reads these, so fast key presses never see a stale day.
  const typedRef = useRef("");
  const activeRef = useRef<Date>(new Date());
  const setTyped = useCallback((next: string | ((text: string) => string)) => {
    const value = typeof next === "function" ? next(typedRef.current) : next;
    typedRef.current = value;
    setTypedState(value);
  }, []);
  const [place, setPlace] = useState<CSSProperties>({});
  const [overlay, setOverlay] = useState<CSSProperties>({});
  const swallowUntil = useRef(0);

  const min = fromIso(String(rest.min ?? "")); const max = fromIso(String(rest.max ?? ""));
  const allowed = useCallback((date: Date) => (!min || date >= min) && (!max || date <= max), [min, max]);

  // The label sits exactly over the field's text area.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const measure = () => {
      const cs = getComputedStyle(input);
      setOverlay({
        paddingLeft: `calc(${cs.paddingLeft} + ${cs.borderLeftWidth})`, paddingRight: `calc(${cs.paddingRight} + ${cs.borderRightWidth})`,
        fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily, letterSpacing: cs.letterSpacing,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(input);
    // A form reset puts the default back without an input event.
    const form = input.form;
    const onReset = () => window.setTimeout(() => setOwn(input.value), 0);
    form?.addEventListener("reset", onReset);
    return () => { observer.disconnect(); form?.removeEventListener("reset", onReset); };
  }, []);

  const commit = useCallback((iso: string) => {
    const input = inputRef.current;
    if (!input) return;
    if (input.value !== iso) {
      if (valueSetter) valueSetter.call(input, iso); else input.value = iso;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (!controlled) setOwn(iso);
  }, [controlled]);

  const close = useCallback(() => { setOpen(false); setTyped(""); }, [setTyped]);

  const show = useCallback(() => {
    const input = inputRef.current;
    if (!input || input.disabled || input.readOnly) return;
    const start = fromIso(input.value) || new Date();
    setActive(start); setTyped("");
    const rect = input.getBoundingClientRect();
    const width = 296; const height = 348;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const below = window.innerHeight - rect.bottom - 14;
    setPlace(below < height && rect.top > below ? { left, bottom: window.innerHeight - rect.top + 6 } : { left, top: rect.bottom + 6 });
    setOpen(true);
  }, [setActive, setTyped]);

  const pick = useCallback((date: Date) => {
    if (!allowed(date)) return;
    commit(toIso(date));
    close();
    inputRef.current?.focus({ preventScroll: true });
  }, [allowed, close, commit]);

  // Press handling on the field itself (mouse / trackpad only; phones keep their picker).
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const fine = window.matchMedia("(pointer: fine)");
    const onDown = (event: MouseEvent) => {
      if (event.button !== 0 || !fine.matches || input.disabled || input.readOnly) return;
      event.preventDefault();
      input.focus({ preventScroll: true });
      if (open) close(); else show();
    };
    const onKey = (event: KeyboardEvent) => {
      if (open || !fine.matches || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") { event.preventDefault(); show(); }
      else if (/^\d$/.test(event.key)) { event.preventDefault(); show(); setTyped(event.key); }
      else if ((event.key === "Backspace" || event.key === "Delete") && !input.required) { event.preventDefault(); commit(""); }
      else if (event.key.length === 1 || event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowRight") event.preventDefault();
    };
    // Firefox opens its own picker on click rather than on mousedown.
    const onClick = (event: MouseEvent) => { if (fine.matches) event.preventDefault(); };
    input.addEventListener("mousedown", onDown);
    input.addEventListener("click", onClick);
    input.addEventListener("keydown", onKey);
    return () => { input.removeEventListener("mousedown", onDown); input.removeEventListener("click", onClick); input.removeEventListener("keydown", onKey); };
  }, [open, show, close, commit, setTyped]);

  // While open: keys drive the calendar, a press outside only closes it.
  useEffect(() => {
    if (!open) return;
    const shift = (days: number) => setActive((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
    const shiftMonths = (months: number) => setActive((date) => new Date(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), 28)));
    const onKey = (event: KeyboardEvent) => {
      let handled = true;
      if (event.key === "Escape") { close(); inputRef.current?.focus({ preventScroll: true }); }
      else if (event.key === "Tab") { handled = false; close(); }
      else if (event.key === "ArrowLeft") shift(-1);
      else if (event.key === "ArrowRight") shift(1);
      else if (event.key === "ArrowUp") shift(-7);
      else if (event.key === "ArrowDown") shift(7);
      else if (event.key === "PageUp") shiftMonths(event.shiftKey ? -12 : -1);
      else if (event.key === "PageDown") shiftMonths(event.shiftKey ? 12 : 1);
      else if (event.key === "Enter" || event.key === " ") {
        const typedNow = typedRef.current;
        if (typedNow.length === 8) { const date = fromIso(`${typedNow.slice(4)}-${typedNow.slice(2, 4)}-${typedNow.slice(0, 2)}`); if (date) pick(date); }
        else pick(activeRef.current);
      } else if (event.key === "Backspace") setTyped((text) => text.slice(0, -1));
      else if (/^\d$/.test(event.key)) {
        const next = (typedRef.current + event.key).slice(0, 8);
        setTyped(next);
        if (next.length === 8) {
          const date = fromIso(`${next.slice(4)}-${next.slice(2, 4)}-${next.slice(0, 2)}`);
          if (date && toIso(date) === `${next.slice(4)}-${next.slice(2, 4)}-${next.slice(0, 2)}`) pick(date);
        }
      } else handled = false;
      if (handled) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popRef.current?.contains(target) || target === inputRef.current) return;
      event.stopPropagation();
      swallowUntil.current = performance.now() + 1000;
      close();
    };
    const onClick = (event: MouseEvent) => { if (performance.now() < swallowUntil.current) { swallowUntil.current = 0; event.preventDefault(); event.stopPropagation(); } };
    const onScroll = (event: Event) => { if (!popRef.current?.contains(event.target as Node)) close(); };
    const onFocus = (event: FocusEvent) => { if (event.target !== inputRef.current && !popRef.current?.contains(event.target as Node)) close(); };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    document.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open, close, pick, setActive, setTyped]);

  const days = useMemo(() => weeksOf(view.getFullYear(), view.getMonth()), [view]);
  const selected = current.slice(0, 10);
  const today = toIso(new Date());
  const shown = typed ? maskDigits(typed) : formatDayMonthYear(current);
  const Component = (Field || "input") as "input";

  return (
    <span className={`${s.wrap} ${wrapperClassName || ""}`} data-date-field="">
      <Component
        {...rest}
        aria-expanded={open || undefined}
        className={className}
        data-date-input=""
        onChange={(event) => { if (!controlled) setOwn(event.target.value); onChange?.(event); }}
        ref={inputRef}
        style={style}
        type="date"
        {...(controlled ? { value: current } : { defaultValue: defaultValue as string })}
      />
      <span aria-hidden="true" className={s.label} style={overlay}>
        <span className={shown ? s.text : s.placeholder}>{shown || "dd/mm/yyyy"}</span>
        <i className={`ti ti-calendar ${s.icon}`} />
      </span>
      {open ? createPortal(
        <div aria-label="Choose a date" className={s.popover} data-select-menu="" onMouseDown={(event) => event.preventDefault()} ref={popRef} role="dialog" style={place}>
          <div className={s.head}>
            <button aria-label="Previous year" onClick={() => setActive((date) => new Date(date.getFullYear() - 1, date.getMonth(), Math.min(date.getDate(), 28)))} type="button"><i className="ti ti-chevrons-left" aria-hidden="true" /></button>
            <button aria-label="Previous month" onClick={() => setActive((date) => new Date(date.getFullYear(), date.getMonth() - 1, Math.min(date.getDate(), 28)))} type="button"><i className="ti ti-chevron-left" aria-hidden="true" /></button>
            <b aria-live="polite">{MONTHS[view.getMonth()]} {view.getFullYear()}</b>
            <button aria-label="Next month" onClick={() => setActive((date) => new Date(date.getFullYear(), date.getMonth() + 1, Math.min(date.getDate(), 28)))} type="button"><i className="ti ti-chevron-right" aria-hidden="true" /></button>
            <button aria-label="Next year" onClick={() => setActive((date) => new Date(date.getFullYear() + 1, date.getMonth(), Math.min(date.getDate(), 28)))} type="button"><i className="ti ti-chevrons-right" aria-hidden="true" /></button>
          </div>
          {typed ? <p className={s.typed}>Typing {maskDigits(typed)}<span>dd/mm/yyyy</span></p> : null}
          <div className={s.grid} role="grid">
            {WEEKDAYS.map((day) => <span className={s.weekday} key={day} role="columnheader">{day}</span>)}
            {days.map((date) => {
              const iso = toIso(date);
              const outside = date.getMonth() !== view.getMonth();
              return (
                <button
                  aria-label={`${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`}
                  aria-selected={iso === selected}
                  className={s.day}
                  data-active={iso === toIso(active)}
                  data-outside={outside || undefined}
                  data-today={iso === today || undefined}
                  disabled={!allowed(date)}
                  key={iso}
                  onClick={() => pick(date)}
                  // Only a real move: Chrome also sends one when the calendar opens under a resting cursor.
                  onMouseMove={(event) => { if ((event.movementX || event.movementY) && toIso(activeRef.current) !== iso) setActive(date); }}
                  role="gridcell"
                  type="button"
                >{date.getDate()}</button>
              );
            })}
          </div>
          <div className={s.foot}>
            <button disabled={!allowed(new Date())} onClick={() => pick(new Date())} type="button">Today</button>
            {!rest.required && current ? <button onClick={() => { commit(""); close(); inputRef.current?.focus({ preventScroll: true }); }} type="button">Clear</button> : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </span>
  );
}
