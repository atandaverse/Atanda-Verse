alter table public.vault_resources enable row level security;

drop policy if exists "public_read_vault_resources" on public.vault_resources;
drop policy if exists "public_write_vault_resources" on public.vault_resources;
drop policy if exists "anon_insert_vault_resources" on public.vault_resources;
drop policy if exists "anon_update_vault_resources" on public.vault_resources;
drop policy if exists "anon_delete_vault_resources" on public.vault_resources;

notify pgrst, 'reload schema';
