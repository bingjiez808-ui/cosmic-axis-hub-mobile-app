import { auth, defineMcp } from "@lovable.dev/mcp-js";

import askOracleTool from "./tools/ask-oracle";
import getMyProfileTool from "./tools/get-my-profile";

// The OAuth issuer MUST be the direct Supabase host. On publish, SUPABASE_URL
// is rewritten to the `.lovable.cloud` proxy, which mcp-js rejects (RFC 8414
// issuer mismatch). The project ref is the only Supabase value that survives
// publish unchanged. Fallback keeps the issuer well-formed during the
// throwaway manifest-extract eval; the published build inlines the real ref
// and a token never verifies against the sentinel.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "library-of-destiny-mcp",
  title: "Library of Destiny MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Library of Destiny app. `get_my_profile` returns the signed-in user's profile and membership tier. `ask_oracle` asks the four-tradition elder a life question, optionally grounded in a chart snapshot.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfileTool, askOracleTool],
});
