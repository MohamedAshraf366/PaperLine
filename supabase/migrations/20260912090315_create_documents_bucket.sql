-- Private storage bucket that document uploads live in.
-- (Access policies on storage.objects are created in an earlier migration.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;