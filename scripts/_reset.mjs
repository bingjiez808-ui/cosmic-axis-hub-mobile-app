import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await s.from("premium_report_chapters").update({ attempt_count: 0, status: "pending", error_message: null, claim_token: null }).eq("report_id", "274c92fb-7fdd-490c-8991-c2a02ec81f6f").eq("status", "failed").select("chapter_key");
console.log(error || data);
