-- Putaran 39: spelling tolerance in global search (Ctrl+K). pg_trgm ships with PostgreSQL
-- (contrib) and provides word_similarity(), used only when the exact pass finds little.
-- Search keeps working without it (exact matches and synonyms only).

create extension if not exists pg_trgm;
