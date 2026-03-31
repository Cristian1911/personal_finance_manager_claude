-- Add EMAIL to data_provider enum
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'EMAIL'
    and enumtypid = (select oid from pg_type where typname = 'data_provider')
  ) then
    alter type data_provider add value 'EMAIL';
  end if;
end $$;
