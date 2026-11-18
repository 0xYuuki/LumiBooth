insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lumi-private-uploads', 'lumi-private-uploads', false, 20975620, array['application/octet-stream']);

create policy "Lumi upload backups only allow the account owner"
on storage.objects as restrictive for all to public
using (
  bucket_id <> 'lumi-private-uploads'
  or (
    (select auth.jwt()->>'is_anonymous') = 'false'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  )
)
with check (
  bucket_id <> 'lumi-private-uploads'
  or (
    (select auth.jwt()->>'is_anonymous') = 'false'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and regexp_replace((select storage.operation()), '^storage[.]', '') = 'object.upload'
    and storage.filename(name) ~ '^(upload-[0-9]{1,20}-[0-9]{1,10}|[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12})[.]lumi$'
  )
);

-- Authenticated downloads are the only image delivery path.
create policy "Lumi upload backups disallow signed access"
on storage.objects as restrictive for select to public
using (
  bucket_id <> 'lumi-private-uploads'
  or regexp_replace((select storage.operation()), '^storage[.]', '') in (
    'object.list', 'object.get_authenticated',
    'object.get_authenticated_info', 'object.head_authenticated_info', 'object.info_authenticated',
    'object.delete', 'object.delete_many'
  )
);

create policy "Lumi upload backups are immutable"
on storage.objects as restrictive for update to public
using (bucket_id <> 'lumi-private-uploads')
with check (bucket_id <> 'lumi-private-uploads');

create policy "Read own Lumi upload backups"
on storage.objects for select to authenticated
using (bucket_id = 'lumi-private-uploads');

create policy "Create own Lumi upload backups"
on storage.objects for insert to authenticated
with check (bucket_id = 'lumi-private-uploads');

create policy "Delete own Lumi upload backups"
on storage.objects for delete to authenticated
using (bucket_id = 'lumi-private-uploads');
