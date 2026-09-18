ALTER FUNCTION public.match_chunks(vector, uuid, uuid[], int) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_chunks(vector, uuid, uuid[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_chunks(vector, uuid, uuid[], int) TO authenticated;