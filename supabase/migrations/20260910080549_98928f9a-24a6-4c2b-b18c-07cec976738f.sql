CREATE EXTENSION IF NOT EXISTS vector;

-- ============ enums ============
-- app_role already exists in this project (legacy app) with the same labels.
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TYPE public.member_role AS ENUM ('owner','admin','member');
CREATE TYPE public.doc_status AS ENUM ('processing','ready','failed');

-- ============ profiles ============
CREATE TABLE public.paperline_profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.paperline_profiles TO authenticated;
GRANT ALL ON public.paperline_profiles TO service_role;
ALTER TABLE public.paperline_profiles ENABLE ROW LEVEL SECURITY;

-- ============ platform roles ============
CREATE TABLE public.paperline_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.paperline_user_roles TO authenticated;
GRANT ALL ON public.paperline_user_roles TO service_role;
ALTER TABLE public.paperline_user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.paperline_user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============ plans ============
CREATE TABLE public.paperline_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  price_cents INT NOT NULL DEFAULT 0,
  max_documents INT NOT NULL,
  max_storage_bytes BIGINT NOT NULL,
  max_questions_month INT NOT NULL,
  max_seats INT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT ON public.paperline_plans TO authenticated, anon;
GRANT ALL ON public.paperline_plans TO service_role;
ALTER TABLE public.paperline_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.paperline_plans FOR SELECT USING (true);

INSERT INTO public.paperline_plans (id,name,sort_order,price_cents,max_documents,max_storage_bytes,max_questions_month,max_seats,features) VALUES
 ('free','Free',1,0,20,52428800,100,2,'["20 documents","50 MB storage","100 AI questions / month","2 seats"]'::jsonb),
 ('pro','Pro',2,2900,500,5368709120,3000,10,'["500 documents","5 GB storage","3,000 AI questions / month","10 seats","Document comparison","Structured extraction"]'::jsonb),
 ('team','Team',3,9900,5000,53687091200,25000,50,'["5,000 documents","50 GB storage","25,000 AI questions / month","50 seats","Priority processing","Workspace analytics"]'::jsonb);

-- ============ workspaces ============
CREATE TABLE public.paperline_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES public.paperline_plans(id),
  suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperline_workspaces TO authenticated;
GRANT ALL ON public.paperline_workspaces TO service_role;
ALTER TABLE public.paperline_workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.paperline_workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.paperline_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperline_workspace_members TO authenticated;
GRANT ALL ON public.paperline_workspace_members TO service_role;
ALTER TABLE public.paperline_workspace_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_workspace UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.paperline_workspace_members WHERE workspace_id = _workspace AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_workspace UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.paperline_workspace_members WHERE workspace_id = _workspace AND user_id = _user AND role IN ('owner','admin'));
$$;

-- profiles policies (need is_member for teammate visibility)
CREATE POLICY "own profile read" ON public.paperline_profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM public.paperline_workspace_members m1
    JOIN public.paperline_workspace_members m2 ON m1.workspace_id = m2.workspace_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = public.paperline_profiles.id));
CREATE POLICY "own profile insert" ON public.paperline_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.paperline_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "roles readable by self or admin" ON public.paperline_user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "workspaces select" ON public.paperline_workspaces FOR SELECT TO authenticated
  USING (public.is_member(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "workspaces insert" ON public.paperline_workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces update" ON public.paperline_workspaces FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "workspaces delete" ON public.paperline_workspaces FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "members select" ON public.paperline_workspace_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "members insert" ON public.paperline_workspace_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.paperline_workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
    OR public.is_manager(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "members update" ON public.paperline_workspace_members FOR UPDATE TO authenticated
  USING (public.is_manager(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_manager(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "members delete" ON public.paperline_workspace_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_manager(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- ============ invites ============
CREATE TABLE public.paperline_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.paperline_workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.member_role NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperline_invites TO authenticated;
GRANT ALL ON public.paperline_invites TO service_role;
ALTER TABLE public.paperline_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites select" ON public.paperline_invites FOR SELECT TO authenticated
  USING (public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "invites manage" ON public.paperline_invites FOR INSERT TO authenticated
  WITH CHECK (public.is_manager(workspace_id, auth.uid()));
CREATE POLICY "invites update" ON public.paperline_invites FOR UPDATE TO authenticated
  USING (public.is_manager(workspace_id, auth.uid())) WITH CHECK (public.is_manager(workspace_id, auth.uid()));
CREATE POLICY "invites delete" ON public.paperline_invites FOR DELETE TO authenticated
  USING (public.is_manager(workspace_id, auth.uid()));

-- ============ documents ============
CREATE TABLE public.paperline_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.paperline_workspaces(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_kind TEXT NOT NULL DEFAULT 'pdf',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status public.doc_status NOT NULL DEFAULT 'processing',
  error_message TEXT,
  page_count INT,
  word_count INT,
  content TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX paperline_documents_workspace_idx ON public.paperline_documents(workspace_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperline_documents TO authenticated;
GRANT ALL ON public.paperline_documents TO service_role;
ALTER TABLE public.paperline_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents select" ON public.paperline_documents FOR SELECT TO authenticated
  USING (public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "documents insert" ON public.paperline_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_member(workspace_id, auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "documents update" ON public.paperline_documents FOR UPDATE TO authenticated
  USING (public.is_member(workspace_id, auth.uid())) WITH CHECK (public.is_member(workspace_id, auth.uid()));
CREATE POLICY "documents delete" ON public.paperline_documents FOR DELETE TO authenticated
  USING (public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.paperline_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.paperline_documents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.paperline_workspaces(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  page_number INT,
  content TEXT NOT NULL,
  embedding vector(3072),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX paperline_document_chunks_doc_idx ON public.paperline_document_chunks(document_id, chunk_index);
CREATE INDEX paperline_document_chunks_embedding_idx ON public.paperline_document_chunks
  USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperline_document_chunks TO authenticated;
GRANT ALL ON public.paperline_document_chunks TO service_role;
ALTER TABLE public.paperline_document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chunks select" ON public.paperline_document_chunks FOR SELECT TO authenticated
  USING (public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "chunks write" ON public.paperline_document_chunks FOR INSERT TO authenticated
  WITH CHECK (public.is_member(workspace_id, auth.uid()));
CREATE POLICY "chunks delete" ON public.paperline_document_chunks FOR DELETE TO authenticated
  USING (public.is_member(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(3072),
  _workspace UUID,
  _document_ids UUID[] DEFAULT NULL,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID, document_id UUID, document_name TEXT, chunk_index INT,
  page_number INT, content TEXT, similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.document_id, d.name, c.chunk_index, c.page_number, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.paperline_document_chunks c
  JOIN public.paperline_documents d ON d.id = c.document_id
  WHERE c.workspace_id = _workspace
    AND c.embedding IS NOT NULL
    AND (_document_ids IS NULL OR c.document_id = ANY(_document_ids))
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

-- ============ conversations ============
CREATE TABLE public.paperline_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.paperline_workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  document_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperline_conversations TO authenticated;
GRANT ALL ON public.paperline_conversations TO service_role;
ALTER TABLE public.paperline_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv select" ON public.paperline_conversations FOR SELECT TO authenticated
  USING (public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "conv insert" ON public.paperline_conversations FOR INSERT TO authenticated
  WITH CHECK (public.is_member(workspace_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "conv update" ON public.paperline_conversations FOR UPDATE TO authenticated
  USING (public.is_member(workspace_id, auth.uid())) WITH CHECK (public.is_member(workspace_id, auth.uid()));
CREATE POLICY "conv delete" ON public.paperline_conversations FOR DELETE TO authenticated
  USING (public.is_member(workspace_id, auth.uid()));

CREATE TABLE public.paperline_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.paperline_conversations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.paperline_workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  client_id TEXT,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX paperline_messages_conv_idx ON public.paperline_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperline_messages TO authenticated;
GRANT ALL ON public.paperline_messages TO service_role;
ALTER TABLE public.paperline_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages select" ON public.paperline_messages FOR SELECT TO authenticated
  USING (public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "messages insert" ON public.paperline_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_member(workspace_id, auth.uid()));
CREATE POLICY "messages delete" ON public.paperline_messages FOR DELETE TO authenticated
  USING (public.is_member(workspace_id, auth.uid()));

-- ============ extractions & comparisons ============
CREATE TABLE public.paperline_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.paperline_documents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.paperline_workspaces(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperline_extractions TO authenticated;
GRANT ALL ON public.paperline_extractions TO service_role;
ALTER TABLE public.paperline_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extractions select" ON public.paperline_extractions FOR SELECT TO authenticated
  USING (public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "extractions insert" ON public.paperline_extractions FOR INSERT TO authenticated
  WITH CHECK (public.is_member(workspace_id, auth.uid()));
CREATE POLICY "extractions delete" ON public.paperline_extractions FOR DELETE TO authenticated
  USING (public.is_member(workspace_id, auth.uid()));

CREATE TABLE public.paperline_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.paperline_workspaces(id) ON DELETE CASCADE,
  document_a UUID NOT NULL REFERENCES public.paperline_documents(id) ON DELETE CASCADE,
  document_b UUID NOT NULL REFERENCES public.paperline_documents(id) ON DELETE CASCADE,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paperline_comparisons TO authenticated;
GRANT ALL ON public.paperline_comparisons TO service_role;
ALTER TABLE public.paperline_comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comparisons select" ON public.paperline_comparisons FOR SELECT TO authenticated
  USING (public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "comparisons insert" ON public.paperline_comparisons FOR INSERT TO authenticated
  WITH CHECK (public.is_member(workspace_id, auth.uid()));
CREATE POLICY "comparisons delete" ON public.paperline_comparisons FOR DELETE TO authenticated
  USING (public.is_member(workspace_id, auth.uid()));

-- ============ usage ============
CREATE TABLE public.paperline_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.paperline_workspaces(id) ON DELETE CASCADE,
  user_id UUID,
  kind TEXT NOT NULL,
  amount INT NOT NULL DEFAULT 1,
  document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX paperline_usage_events_ws_idx ON public.paperline_usage_events(workspace_id, created_at DESC);
GRANT SELECT, INSERT ON public.paperline_usage_events TO authenticated;
GRANT ALL ON public.paperline_usage_events TO service_role;
ALTER TABLE public.paperline_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage select" ON public.paperline_usage_events FOR SELECT TO authenticated
  USING (public.is_member(workspace_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "usage insert" ON public.paperline_usage_events FOR INSERT TO authenticated
  WITH CHECK (public.is_member(workspace_id, auth.uid()));

-- ============ updated_at ============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_workspaces_updated BEFORE UPDATE ON public.paperline_workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_documents_updated BEFORE UPDATE ON public.paperline_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_conversations_updated BEFORE UPDATE ON public.paperline_conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
