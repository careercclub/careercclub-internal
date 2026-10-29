# DESIGN.md: CareerCclub Internal

Direction for every screen of the internal app. Chosen on 29 Oct 2026 ("Rapor karier"): the user
picked it from three options prepared by Claude, so it is a starting point to adjust, not a fixed
brand book.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1

## Identity

- **Who uses it:** the CareerCclub team (marketing, operations, sales), every day, on a laptop and
  on a phone.
- **What CareerCclub is:** preparation for Management Trainee selection (assessment simulation,
  psikotes, interviews, webinars, bootcamps). Its world is scores, grades and progress toward a goal.
- **Personality:** a report card. Clear marks, one verdict per page, calm otherwise.

## Palette

- **CareerCclub blue** `--purple-mid` #1554c0: actions, links, selected states, progress in motion.
- **Achievement** `--achieve` #a34a00 (dark mode #f5a524), on `--achieve-bg`, bar `--achieve-mark`.
  This is the one warm accent. Use it only for a target reached, an A grade, or being on track.
  Never for decoration.
- **Red** `--red`: late or danger only.
- **Neutrals:** `--text`, `--text-muted`, `--surface-2`, `--bg`, `--border`.
- Every text pairing is at least 4.5:1 (computed). Change a token only after checking contrast again.

## Type

- **Plus Jakarta Sans** (already loaded): an Indonesian typeface with round, friendly figures that
  stay readable at large sizes. It suits the numbers this app shows.
- **Page title (h1):** 26–34px, weight 800, tight tracking. It names the page; nothing sits above it
  unless it adds information (a date, an event type).
- **No uppercase labels with wide tracking.** Labels are sentence case.

## Layout

- **One lead number per screen.** The figure to act on, or the score that matters, spans two
  columns and is the biggest number on the page. The rest are compact. Example: Dashboard leads
  with "Late, needs action" when anything is late, else this week's tasks.
- **Corners:** controls (buttons, tabs, inputs, search) 10px; cards 14–16px. Pills are only for
  status chips, and circles only for avatars and icon buttons.
- **Surfaces are flat:** a border, no shadow. `--shadow-raised` only for what floats (popups,
  tooltips, sticky bars).
- **Touch:** every control is at least 44px on a phone. A header's buttons wrap instead of squeezing.

## Identity motif: the score line

A thin 4px line under a number that has a scale (17 of 100, 3 of 4 tasks). It is blue while in
progress and turns to the achievement accent when the target is reached. Use `<ScoreLine>`
(`app/_components/score-line.tsx`).

Grades read like a report: A, B, C or D next to a score (`GRADE_LETTER`). A is the only grade in
the warm accent.

## Motion

Hover and press feedback only. No looping or decorative animation. A number may animate when it
changes, if that is ever added.

## Words

English UI, short, specific. Empty values are written as words (No date, Not set). There is no em
dash in UI text. See KAMUS_ISTILAH.md.
