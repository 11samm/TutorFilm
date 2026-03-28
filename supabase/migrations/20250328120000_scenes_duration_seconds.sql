-- Required for dynamic scene lengths from the Director (generate-script).
alter table scenes add column if not exists duration_seconds integer not null default 8;
