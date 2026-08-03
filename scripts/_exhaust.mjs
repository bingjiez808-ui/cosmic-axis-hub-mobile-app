import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Mark the 3 stuck chapters as attempts exhausted so the reopen pass proves 0 provider calls.
const { data, error } = await s.from("premium_report_chapters")
  .update({ attempt_count: 3 })
  .eq("report_id", "274c92fb-7fdd-490c-8991-c2a02ec81f6f")
  .eq("status", "failed")
  .select("chapter_key, attempt_count");
console.log(error || data);
