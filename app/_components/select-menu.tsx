"use client";

// One styled menu for every native <select> in the app.
//
// The real <select> stays on the page: its own styles, name, required, aria-invalid,
// React onChange and FormData all keep working. Only the browser's option list is
// replaced. On a mouse/trackpad device a press (or Space / Enter / arrow keys) on a
// select opens this menu instead; picking an option sets the select's value and fires
// the same input + change events the browser would. Phones keep the native picker,
// which is the better control on touch. Add data-native-select to an element to opt out.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./select-menu.module.css";

type Item = { kind: "option"; value: string; label: string; disabled: boolean; placeholder: boolean; index: number } | { kind: "group"; label: string };
type Menu = { select: HTMLSelectElement; items: Item[]; active: number; query: string };

const SEARCH_FROM = 8;
const valueSetter = typeof window === "undefined" ? undefined : Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;

function readItems(select: HTMLSelectElement): Item[] {
  const items: Item[] = [];
  let group: HTMLOptGroupElement | null = null;
  Array.from(select.options).forEach((option, index) => {
    if (option.hidden) return;
    const parent = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement : null;
    if (parent && parent !== group) items.push({ kind: "group", label: parent.label });
    group = parent;
    items.push({ kind: "option", value: option.value, label: (option.label || option.text).trim(), disabled: option.disabled || Boolean(parent?.disabled), placeholder: option.value === "", index });
  });
  return items;
}

function eligible(target: EventTarget | null): target is HTMLSelectElement {
  return target instanceof HTMLSelectElement && !target.multiple && target.size <= 1 && !target.disabled && !target.closest("[data-native-select]");
}

function visibleItems(menu: Menu) {
  const query = menu.query.trim().toLowerCase();
  if (!query) return menu.items;
  return menu.items.filter((item) => item.kind === "option" && !item.placeholder && item.label.toLowerCase().includes(query));
}

function choosable(items: Item[]) {
  return items.flatMap((item, position) => (item.kind === "option" && !item.disabled ? [position] : []));
}

export function SelectMenuHost() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const menuRef = useRef<Menu | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  menuRef.current = menu;

  const close = useCallback((refocus = false) => {
    const current = menuRef.current;
    if (!current) return;
    current.select.removeAttribute("aria-expanded");
    current.select.removeAttribute("aria-activedescendant");
    menuRef.current = null;
    setMenu(null);
    setPlace(null);
    if (refocus) current.select.focus({ preventScroll: true });
  }, []);

  const choose = useCallback((item: Item | undefined) => {
    const current = menuRef.current;
    if (!current || !item || item.kind !== "option" || item.disabled) return;
    const { select } = current;
    close(true);
    if (select.selectedIndex === item.index) return;
    if (valueSetter) valueSetter.call(select, item.value); else select.value = item.value;
    select.selectedIndex = item.index;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, [close]);

  const open = useCallback((select: HTMLSelectElement) => {
    const items = readItems(select);
    const active = Math.max(0, items.findIndex((item) => item.kind === "option" && item.index === select.selectedIndex));
    select.setAttribute("aria-expanded", "true");
    select.focus({ preventScroll: true });
    setMenu({ select, items, active, query: "" });
  }, []);

  // Open on press / keys, close on outside press, scroll, resize, focus elsewhere.
  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    function onPointerDown(event: PointerEvent) {
      const current = menuRef.current;
      const target = event.target as Element | null;
      if (current) {
        if (boxRef.current?.contains(target)) return;
        if (target === current.select) { event.preventDefault(); event.stopPropagation(); close(true); return; }
        // Like the native list: a press outside only closes the menu; that press and its click
        // do not also reach the page (so a popup behind it stays open).
        event.stopPropagation();
        swallowClickUntil = performance.now() + 1000;
        close();
        return;
      }
      if (event.button !== 0 || event.pointerType === "touch" || !finePointer.matches || !eligible(target)) return;
      event.preventDefault();
      event.stopPropagation();
      open(target);
    }
    let swallowClickUntil = 0;
    function onClick(event: MouseEvent) {
      if (performance.now() > swallowClickUntil) return;
      swallowClickUntil = 0;
      event.preventDefault();
      event.stopPropagation();
    }
    function onMouseDown(event: MouseEvent) {
      if (performance.now() < swallowClickUntil) { event.stopPropagation(); return; }
      // The browser opens its own list on mousedown; stop it when ours handles the press.
      if (eligible(event.target) && finePointer.matches && (event.target === menuRef.current?.select || menuRef.current === null)) event.preventDefault();
    }
    function onKeyDown(event: KeyboardEvent) {
      const current = menuRef.current;
      if (!current) {
        if (!eligible(event.target) || !finePointer.matches || event.ctrlKey || event.metaKey) return;
        if (event.key === " " || event.key === "Enter" || event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "F4") {
          event.preventDefault();
          event.stopPropagation();
          open(event.target);
        }
        return;
      }
      const items = visibleItems(current);
      const ids = choosable(items);
      const at = ids.indexOf(current.active);
      const move = (next: number) => setMenu({ ...current, active: ids[Math.max(0, Math.min(ids.length - 1, next))] ?? 0 });
      let handled = true;
      if (event.key === "Escape") close(true);
      else if (event.key === "Tab") { handled = false; close(); }
      else if (event.key === "ArrowDown") move(at < 0 ? 0 : at + 1);
      else if (event.key === "ArrowUp") move(at < 0 ? 0 : at - 1);
      else if (event.key === "Home") move(0);
      else if (event.key === "End") move(ids.length - 1);
      else if (event.key === "PageDown") move(at + 8);
      else if (event.key === "PageUp") move(at - 8);
      else if (event.key === "Enter" || (event.key === " " && !current.query)) choose(items[current.active]);
      else if (event.key === "Backspace") setMenu({ ...current, query: current.query.slice(0, -1), active: 0 });
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const query = current.query + event.key;
        const next = { ...current, query };
        setMenu({ ...next, active: choosable(visibleItems(next))[0] ?? 0 });
      } else handled = false;
      if (handled) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); }
    }
    function onScroll(event: Event) {
      if (menuRef.current && !boxRef.current?.contains(event.target as Node)) close();
    }
    function onFocusIn(event: FocusEvent) {
      if (menuRef.current && event.target !== menuRef.current.select && !boxRef.current?.contains(event.target as Node)) close();
    }
    const onResize = () => close();
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [choose, close, open]);

  // Place the menu under (or above) its select.
  useLayoutEffect(() => {
    if (!menu) return;
    const rect = menu.select.getBoundingClientRect();
    const gap = 6;
    const below = window.innerHeight - rect.bottom - gap - 8;
    const above = rect.top - gap - 8;
    const width = Math.min(Math.max(rect.width, 200), 420, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const upward = below < 220 && above > below;
    setPlace(upward
      ? { left, width, bottom: window.innerHeight - rect.top + gap, maxHeight: Math.min(340, above) }
      : { left, width, top: rect.bottom + gap, maxHeight: Math.min(340, below) });
  }, [menu?.select]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the active option in view; the page's scroll lock in popups blocks wheel scrolling, so scroll the list by hand.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>("[data-active=true]")?.scrollIntoView({ block: "nearest" });
    if (menu) {
      const id = listRef.current?.querySelector("[data-active=true]")?.id;
      if (id) menu.select.setAttribute("aria-activedescendant", id); else menu.select.removeAttribute("aria-activedescendant");
    }
  }, [menu]);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onWheel = (event: WheelEvent) => { event.preventDefault(); event.stopPropagation(); list.scrollTop += event.deltaY; };
    list.addEventListener("wheel", onWheel, { passive: false });
    return () => list.removeEventListener("wheel", onWheel);
  }, [place]);

  if (!menu || !place) return null;
  const items = visibleItems(menu);
  const selected = menu.select.selectedIndex;
  const optionCount = menu.items.filter((item) => item.kind === "option" && !item.placeholder).length;
  const label = menu.select.labels?.[0]?.innerText.replace(/\*/g, "").trim() || menu.select.getAttribute("aria-label") || "Options";

  return createPortal(
    <div
      className={styles.menu}
      data-select-menu=""
      ref={boxRef}
      style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {optionCount >= SEARCH_FROM ? (
        <div className={styles.search} aria-hidden="true">
          <i className="ti ti-search" />
          {menu.query ? <span className={styles.query}>{menu.query}<span className={styles.caret} /></span> : <span className={styles.searchHint}>Type to search</span>}
        </div>
      ) : null}
      <div className={styles.list} id="select-menu-list" ref={listRef} role="listbox" aria-label={label}>
        {items.length === 0 ? <p className={styles.empty}>No matches for “{menu.query}”</p> : null}
        {items.map((item, position) => item.kind === "group"
          ? <p className={styles.group} key={`g-${item.label}-${position}`} role="presentation">{item.label}</p>
          : (
            <div
              aria-disabled={item.disabled || undefined}
              aria-selected={item.index === selected}
              className={`${styles.option} ${item.placeholder ? styles.placeholder : ""}`}
              data-active={position === menu.active}
              id={`select-menu-option-${item.index}`}
              key={`o-${item.index}`}
              role="option"
              onClick={() => choose(item)}
              onMouseMove={() => { if (!item.disabled && menu.active !== position) setMenu({ ...menu, active: position }); }}
            >
              <span>{item.label || " "}</span>
              {item.index === selected && !item.placeholder ? <i className="ti ti-check" aria-hidden="true" /> : null}
            </div>
          ))}
      </div>
    </div>,
    document.body,
  );
}
