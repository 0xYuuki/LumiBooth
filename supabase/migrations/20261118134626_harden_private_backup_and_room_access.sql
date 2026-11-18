-- Private strip archives use the same authenticated-only delivery as uploads.
create policy "Lumi strip backups disallow signed downloads"
on storage.objects as restrictive for select to public
using (
  bucket_id <> 'lumi-private-backups'
  or regexp_replace((select storage.operation()), '^storage[.]', '') in (
    'object.list', 'object.get_authenticated',
    'object.get_authenticated_info', 'object.head_authenticated_info',
    'object.info_authenticated', 'object.delete', 'object.delete_many'
  )
);

create policy "Lumi strip backups require authenticated uploads"
on storage.objects as restrictive for insert to public
with check (
  bucket_id <> 'lumi-private-backups'
  or regexp_replace((select storage.operation()), '^storage[.]', '') = 'object.upload'
);

-- Existing policies and triggers retain their references when functions move.
create schema lumi_private;
revoke all on schema lumi_private from public;
grant usage on schema lumi_private to authenticated;

alter function public.lumi_room_channel_allowed(text) set schema lumi_private;
alter function public.lumi_notify_room() set schema lumi_private;
revoke execute on function lumi_private.lumi_notify_room() from public, anon, authenticated;
