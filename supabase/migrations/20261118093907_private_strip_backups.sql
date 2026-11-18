insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lumi-private-backups', 'lumi-private-backups', false, 25165824, array['application/octet-stream']);

-- Storage's object record is the backup catalog. Only a completed single
-- object upload creates a visible entry, so no separate row can be orphaned.
create policy "Lumi backups only allow the account owner"
on storage.objects as restrictive for all to public
using (
  bucket_id <> 'lumi-private-backups'
  or (
    (select auth.jwt()->>'is_anonymous') = 'false'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  )
)
with check (
  bucket_id <> 'lumi-private-backups'
  or (
    (select auth.jwt()->>'is_anonymous') = 'false'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^(web-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}|flutter-[0-9]{1,20}-[0-9]{1,10})[.]lumi$'
  )
);

create policy "Lumi backups are immutable"
on storage.objects as restrictive for update to public
using (bucket_id <> 'lumi-private-backups')
with check (bucket_id <> 'lumi-private-backups');

create policy "Read own Lumi backups"
on storage.objects for select to authenticated
using (bucket_id = 'lumi-private-backups');

create policy "Create own Lumi backups"
on storage.objects for insert to authenticated
with check (bucket_id = 'lumi-private-backups');

create policy "Delete own Lumi backups"
on storage.objects for delete to authenticated
using (bucket_id = 'lumi-private-backups');
