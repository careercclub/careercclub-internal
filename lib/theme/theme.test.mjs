import assert from "node:assert/strict";
import test from "node:test";
import { THEME_BOOT_SCRIPT, themeFrom } from "./theme.ts";

test("light by default; dark only when chosen", () => {
  assert.equal(themeFrom(null), "light");
  assert.equal(themeFrom("system"), "light");
  assert.equal(themeFrom("dark"), "dark");
  assert.ok(!/prefers-color-scheme/.test(THEME_BOOT_SCRIPT), "the computer setting is not followed");
});
