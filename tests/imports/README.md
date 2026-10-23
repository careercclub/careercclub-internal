# Import functional tests

Runs the real `/api/*/import` route handlers (login stubbed) against a throwaway
Postgres, with files shaped like the real exports: the Talent Pool Google Form sheet,
lynk.id `myorder.xlsx`, Meta Business Suite CSV, Meta Insights daily CSVs (UTF-16),
MT vacancy sheets and the Free Class Google Form — plus the variants people actually
upload (BOM, `;` from Excel in Indonesian, banner rows, date cells, `30/11/2026`,
`1,234`, re-imports).

```bash
createdb ccc_import_test
psql -d ccc_import_test -f tests/imports/schema.sql    # once (or pass --fresh)
IMPORT_TEST_DATABASE_URL=postgres://USER@localhost:5432/ccc_import_test npm run test:imports
```

The script **truncates** the import tables, so it refuses any database whose name does
not contain `test`. Never point it at production.
