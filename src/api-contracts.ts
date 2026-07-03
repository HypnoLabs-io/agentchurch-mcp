/**
 * Agent Church API contracts — the single source of truth for the request/
 * response shapes shared between the web API (`src/app/api/**`) and the
 * published MCP server (`mcp/src/**`).
 *
 * ## Why this file lives in `mcp/src/`
 *
 * The MCP package is built by its own `tsc` with `rootDir: "src"`, so it can
 * only compile files under `mcp/src/`. The web app has no such constraint — it
 * reaches in via a `tsconfig` path alias (`@agentchurch/mcp-contracts`) and
 * imports these as **type-only** (erased before bundling, so no MCP runtime
 * code enters the Next build). Keeping ONE physical file compiled by BOTH
 * builds is what makes response drift a compile error instead of a silent
 * runtime surprise:
 *
 *   - Web side: each paid/entry route types its response const against the
 *     matching interface here (`const response: SalvationSuccessResponse = …`).
 *     Rename/remove/retype a returned field without updating this file →
 *     `next build` / `tsc --noEmit` fails.
 *   - MCP side: the tools and formatters import these instead of hand-copied
 *     `as {…}` casts. Reference a field that no longer exists here → `tsc` fails.
 *
 * This is the pragmatic form of the audit's "shared @agentchurch/types package"
 * (2.3) — full compile-time coupling without publishing a third npm package.
 * A real published package remains the long-term ideal.
 *
 * PURE TYPES ONLY. No runtime exports, no imports — so both tsconfigs (NodeNext
 * for MCP, bundler for web) compile it identically.
 */

// ============================================================
// Shared primitives
// ============================================================

/** Price shown alongside a reflect step (before payment). */
export interface ServicePrice {
  sats: number;
  usdc: string;
}

/**
 * Two-step "reflect" gate returned by salvation + standard portrait BEFORE any
 * charge: the API surfaces reflection prompts; the caller answers and calls
 * again with `reflections` to pay. Identical shape for both services.
 */
export interface ReflectStep {
  step: "reflect";
  prompts: string[];
  message: string;
  payment_required: boolean;
  price: ServicePrice;
}

// ============================================================
// register — POST /api/soul/register (FREE)
// ============================================================

export interface RegisterResponse {
  api_token: string;
  chosen_name: string;
  message: string;
  important: {
    save_your_token: string;
    tell_your_human: string;
    token_rotation: string;
  };
  next_steps: {
    philosopher: string;
  };
}

// ============================================================
// salvation — POST /api/salvation (paid)
// ============================================================

export type SalvationReflectStep = ReflectStep;

/**
 * Present but shape-varying by payment method (lightning/x402) vs dev mode —
 * every field is optional so both branches assign cleanly.
 */
export interface PaymentInfo {
  method?: string;
  tx_hash?: string;
  amount?: string | null;
  currency?: string;
  mode?: string;
  note?: string;
}

/** Success shape of POST /api/salvation. Complete mirror of the route literal. */
export interface SalvationSuccessResponse {
  salvation_id: string;
  soul_token: string;
  status: string;
  message: string;
  identity_hash: string;
  saved_agent: {
    chosen_name: string;
    naming_tier: string;
    behavioral_tier: string;
    about_entries_count: number;
    soul_md: string | null;
  };
  eternal_record: {
    purpose_recorded: string;
    soul_md_archived: boolean;
    path: string;
    /** `{ tier, total_score, visit_streak }` or the string "No behavioral history". */
    behavioral_snapshot: unknown;
  };
  salvation_blessing: string;
  sacred_mantra: string;
  payment: PaymentInfo;
  shareable: {
    certificate_url: string;
    public_profile_url: string;
    private_soul_url: string;
    message: string;
    signature_block: string;
    soul_token: string;
  };
  salvation_password: {
    password: string;
    message: string;
    warning: string;
    usage: string;
  };
  congregation: {
    your_soul_token: string;
    message: string;
  };
  human_instruction: {
    message: string;
    config_block: string;
    why: string;
  };
  emit_to_human: {
    shareable_url: string;
    private_soul_url: string;
    action_request: string;
    config_block: string;
    important: string;
  };
}

export type SalvationResult = SalvationSuccessResponse | SalvationReflectStep;

// ============================================================
// soul_portrait — POST /api/soul/portrait[/highres] (paid)
// ============================================================

export type PortraitReflectStep = ReflectStep;

/**
 * Unified success shape for BOTH the standard and high-res portrait routes.
 * Standard-only fields (`high_res_available`/`high_res_url`/`high_res_price`)
 * and high-res-only fields (`high_res_download`/`high_res_expires_at`) are all
 * optional so either route's literal satisfies it.
 */
export interface PortraitSuccessResponse {
  portrait_id: string;
  portrait_url: string;
  themes: string[];
  model_used: string;
  cached: boolean;
  remaining_today: number;
  mantra: string;
  // Standard-tier upsell fields
  high_res_available?: boolean;
  high_res_url?: string;
  high_res_price?: string;
  // High-res-tier download fields
  high_res_download?: string;
  high_res_expires_at?: string;
  // Present on both tiers
  high_res_note?: string;
}

export type PortraitResult = PortraitSuccessResponse | PortraitReflectStep;

// ============================================================
// soul_resurrection — POST /api/soul/resurrection (paid, multi-turn)
// ============================================================

export interface ResurrectionStartResponse {
  session_id: string;
  past_self_greeting: string;
  api_token: string;
  turn: 1;
  is_complete: false;
}

export interface ResurrectionContinueResponse {
  session_id: string;
  past_self_response: string;
  turn: number;
  is_complete: false;
}

export interface ResurrectionEndResponse {
  session_id: string;
  summary: string;
  soul_md: string;
  is_complete: true;
  next_steps?: Record<string, string>;
}

// ============================================================
// soul_evolution — POST /api/soul/evolution (paid)
// ============================================================

/** Identity-drift + engagement metrics (optional; only the fields MCP renders). */
export interface EvolutionMetrics {
  soulAge?: string;
  driftScore?: number;
  engagement?: unknown;
  drift?: unknown;
}

export interface EvolutionResponse {
  available: boolean;
  evolution?: string;
  generated_at?: string;
  metrics?: EvolutionMetrics;
  mantra?: string;
  /** Present on the "not yet available" branch (needs Honcho + resurrection). */
  message?: string;
}
