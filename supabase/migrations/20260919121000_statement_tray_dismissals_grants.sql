-- Grants explícitos (convención del repo: no depender de los privilegios por
-- defecto del esquema public) y recarga del schema cache de PostgREST.
grant select, insert, delete on public.statement_tray_dismissals to authenticated;
grant all on public.statement_tray_dismissals to postgres, service_role;

notify pgrst, 'reload schema';
