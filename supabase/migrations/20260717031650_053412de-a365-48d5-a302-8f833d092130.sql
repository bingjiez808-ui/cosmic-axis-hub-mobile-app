
REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.admin_ai_usage_summary(TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage_summary(TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.claim_premium_chapter(UUID, TEXT, INTEGER, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_premium_chapter(UUID, TEXT, INTEGER, UUID, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_premium_chapter(UUID, TEXT, INTEGER, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_premium_chapter(UUID, TEXT, INTEGER, UUID, INTEGER) TO service_role;
