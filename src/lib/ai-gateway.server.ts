import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Shared Lovable AI Gateway provider — server-only.
 * Reads LOVABLE_API_KEY inside the caller's handler, not at module scope.
 */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}
