# DESIGN.md: CareerCclub Internal

Direction for every screen of the internal app. Chosen on 29 Oct 2026 ("Rapor karier") and refreshed
on 30 Oct 2026 ("Fresh", Putaran 63): the user liked a reference with a light gray page, borderless
cards, pill buttons and light numbers, kept CareerCclub blue instead of its lime, and loved its dark
mode. A starting point to adjust, not a fixed brand book.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1

## Identity

- **Who uses it:** the CareerCclub team (marketing, operations, sales), every day, on a laptop and
  on a phone.
- **What CareerCclub is:** preparation for Management Trainee selection (assessment simulation,
  psikotes, interviews, webinars, bootcamps). Its world is scores, grades and progress toward a goal.
- **Personality:** a report card. Clear marks, one verdict per page, calm otherwise.

## Palette

- **CareerCclub blue** `--purple-mid` #1554c0: primary actions, links, selected states, progress.
  Soft blue tint `--purple-light` #e4ecfa for the selected menu item, avatars and chips.
- **Achievement:** a solid blue chip (`--achieve-bg` with `--achieve` text): a target reached, an A
  grade, on track. No second hue.
- **Large panels** (program cards, Instagram hero): airy light blue `--hero` → `--hero-deep` with dark
  text `--on-hero`.
- **Charts and ranked bars:** soft blue `--chart-mark` (3:1 on white), ink on hover.
- **Red** `--red`: late or danger only.
- **Neutrals:** a cool gray page `--bg` #eceef1, white cards, `--text`, `--text-muted`, `--surface-2`.
  The active tab of a segmented control is the dark neutral.
- **Dark mode:** neutral black (not blue-black), light pill for the primary action, deep blue tints for
  selected items and panels.
- Every text pairing is at least 4.5:1 (computed). Change a token only after checking contrast again.

## Type

- **Plus Jakarta Sans** (already loaded): an Indonesian typeface with round, friendly figures that
  stay readable at large sizes. It suits the numbers this app shows.
- **Words stay bold:** page title (h1, 26–34px, weight 800), card titles, names, buttons.
- **Big numbers are light:** weight 300 (lead and large figures) or 400 (22–23px), with a small grey
  unit (`/100`, `h`). Numbers read as quiet data, words carry the hierarchy.
- **No uppercase labels with wide tracking.** Labels are sentence case.

## Layout

- **One lead number per screen.** The figure to act on, or the score that matters, spans two
  columns and is the biggest number on the page. The rest are compact. Example: Dashboard leads
  with "Late, needs action" when anything is late, else this week's tasks.
- **Corners:** buttons, tabs, filters and search are pills; inputs and text areas 12px; cards 18–20px.
  Circles for avatars and icon buttons.
- **Surfaces are flat:** white cards on the gray page with no outline (`--card-line: transparent`),
  no shadow. A card inside a card keeps a hairline. `--shadow-raised` only for what floats (popups,
  tooltips, sticky bars).
- **Touch:** every control is at least 44px on a phone. A header's buttons wrap instead of squeezing.

## Identity motif: the score line

A thin 4px line under a number that has a scale (17 of 100, 3 of 4 tasks), in CareerCclub blue. Use `<ScoreLine>`
(`app/_components/score-line.tsx`).

Grades read like a report: A, B, C or D next to a score (`GRADE_LETTER`). A is the only grade on a
solid blue chip.

## Motion

Hover and press feedback only. No looping or decorative animation. A number may animate when it
changes, if that is ever added.

## Words

English UI, short, specific. Empty values are written as words (No date, Not set). There is no em
dash in UI text. See KAMUS_ISTILAH.md.
