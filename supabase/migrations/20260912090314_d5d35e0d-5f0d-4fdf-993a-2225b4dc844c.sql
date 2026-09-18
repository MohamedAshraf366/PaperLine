CREATE INDEX IF NOT EXISTS paperline_document_chunks_ws_idx ON public.paperline_document_chunks (workspace_id);
CREATE INDEX IF NOT EXISTS paperline_extractions_doc_idx ON public.paperline_extractions (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS paperline_workspace_members_user_idx ON public.paperline_workspace_members (user_id);
ANALYZE public.paperline_document_chunks;
ANALYZE public.paperline_documents;
