import Anthropic from "@anthropic-ai/sdk";
import { oidcFederationProvider } from "@anthropic-ai/sdk/lib/credentials/oidc-federation";
import { getVercelOidcToken } from "@vercel/oidc";

// Server-only.

/**
 * The Claude client for code running on Vercel (server actions, route
 * handlers). Authenticates WITHOUT an API key when federation is configured:
 * Vercel's per-request OIDC token is exchanged for a short-lived Anthropic
 * token, the same Workload Identity Federation the refresh-personas GitHub
 * Action uses. Static keys kept dying (revoked, then an unscoped replacement
 * that 400s with "not scoped to a workspace").
 *
 * Resolution:
 *   1. ANTHROPIC_API_KEY set → plain key (local dev, scripts). It also shadows
 *      federation inside the SDK, so it MUST be removed from Vercel's env for
 *      federation to take over.
 *   2. On Vercel with ANTHROPIC_FEDERATION_RULE_ID / _ORGANIZATION_ID /
 *      _SERVICE_ACCOUNT_ID set → federation with the Vercel OIDC token.
 *   3. Otherwise → SDK defaults (env-var federation, profiles), e.g. CI.
 *
 * One client per server instance: the SDK caches the minted token and only
 * re-exchanges near expiry. Vercel tokens carry no `jti`, so instances sharing
 * a token never trip Anthropic's replay check. They do live 2 hours, so the
 * Anthropic issuer's max token lifetime must be raised from the 1 h default.
 */
let federated: Anthropic | null = null;

export function claude(): Anthropic {
  if (process.env.ANTHROPIC_API_KEY) return new Anthropic();

  const ruleId = process.env.ANTHROPIC_FEDERATION_RULE_ID;
  const organizationId = process.env.ANTHROPIC_ORGANIZATION_ID;
  const serviceAccountId = process.env.ANTHROPIC_SERVICE_ACCOUNT_ID;
  if (process.env.VERCEL && ruleId && organizationId && serviceAccountId) {
    federated ??= new Anthropic({
      credentials: oidcFederationProvider({
        // Read at exchange time, inside a request: on Vercel the token comes
        // from that request's x-vercel-oidc-token header and must not be cached.
        identityTokenProvider: () => getVercelOidcToken(),
        federationRuleId: ruleId,
        organizationId,
        serviceAccountId,
        workspaceId: process.env.ANTHROPIC_WORKSPACE_ID || undefined,
        baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
        fetch: globalThis.fetch,
      }),
    });
    return federated;
  }

  return new Anthropic();
}
