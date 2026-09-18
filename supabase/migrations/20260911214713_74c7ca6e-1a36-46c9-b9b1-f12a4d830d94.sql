-- Tables are created with the paperline_ prefix from the start, so no renames here.
-- Only the RPC is refreshed to point at the final table names.

CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, _workspace uuid, _document_ids uuid[] DEFAULT NULL, match_count integer DEFAULT 8)
RETURNS TABLE(id uuid, document_id uuid, document_name text, chunk_index integer, page_number integer, content text, similarity double precision)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id,
         c.document_id,
         d.name AS document_name,
         c.chunk_index,
         c.page_number,
         c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.paperline_document_chunks c
  JOIN public.paperline_documents d ON d.id = c.document_id
  WHERE c.workspace_id = _workspace
    AND (_document_ids IS NULL OR c.document_id = ANY(_document_ids))
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count
$$;
