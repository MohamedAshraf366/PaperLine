create policy "docs read" on storage.objects for select to authenticated
using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid, auth.uid()));

create policy "docs insert" on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid, auth.uid()));

create policy "docs delete" on storage.objects for delete to authenticated
using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid, auth.uid()));