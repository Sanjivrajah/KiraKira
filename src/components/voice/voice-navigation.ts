/**
 * Single source of truth for where the voice agent can send the owner.
 *
 * The `navigate` client tool (see `client-tools.ts`) and `get_current_context`
 * both resolve through here, so spoken destinations, deep links, and in-page
 * tab/section targets stay consistent and are the only place to extend when a
 * new route becomes voice-reachable.
 */

export interface VoiceRoute {
  /** Canonical spoken key (also the friendly name read back to the owner). */
  key: string;
  /** App route path. */
  path: string;
  /** Alternate spoken names the owner might use. */
  aliases: string[];
}

/**
 * Ordered so the reverse lookup in `describePath` prefers the most specific
 * match first (e.g. `/invoices/new` before `/invoices`).
 */
export const VOICE_ROUTES: VoiceRoute[] = [
  { key: "dashboard", path: "/dashboard", aliases: ["home", "overview", "main"] },
  { key: "new expense", path: "/transactions/new", aliases: ["add expense", "add income", "record a sale", "new record", "capture", "add evidence", "new transaction"] },
  { key: "records", path: "/transactions", aliases: ["transactions", "expenses", "income", "bookkeeping"] },
  { key: "new invoice", path: "/invoices/new", aliases: ["create invoice", "create an invoice", "start an invoice", "make an invoice"] },
  { key: "invoices", path: "/invoices", aliases: ["invoice list", "billing"] },
  { key: "e-invoices", path: "/e-invoices", aliases: ["einvoice", "e invoice", "myinvois", "compliance", "e-invoice preparation"] },
  { key: "reminders", path: "/reminders", aliases: ["chase", "follow ups", "receivables reminders"] },
  { key: "cash flow", path: "/cash-flow", aliases: ["cashflow", "money in and out"] },
  { key: "loan readiness", path: "/loan-readiness", aliases: ["loan", "financing", "loan check", "readiness"] },
  { key: "settings", path: "/settings", aliases: ["business", "business details", "profile", "preferences"] },
  { key: "inventory", path: "/inventory", aliases: ["stock", "products"] },
  { key: "voice", path: "/voice", aliases: ["assistant", "voice assistant"] },
];

/** e-Invoice workspace stages, with the spoken synonyms the owner may use. */
const EINVOICE_STAGE_ALIASES: Record<string, string> = {
  prepare: "prepare", preparation: "prepare", preparing: "prepare", prep: "prepare",
  submit: "submit", submission: "submit", send: "submit", sending: "submit",
  history: "history", reconcile: "history", status: "history", audit: "history",
};

/** e-Invoice preparation status filter synonyms. */
const EINVOICE_VIEW_ALIASES: Record<string, string> = {
  needs_information: "needs_information", "needs information": "needs_information", blockers: "needs_information", incomplete: "needs_information",
  ready: "ready", "ready for approval": "ready", "ready to approve": "ready",
  approved: "approved", frozen: "approved", done: "approved",
};

/** Settings section anchor ids the agent can scroll to. */
const SETTINGS_SECTION_ALIASES: Record<string, string> = {
  "business-profile": "business-profile", "business profile": "business-profile", business: "business-profile", profile: "business-profile",
  "myinvois-connection": "myinvois-connection", myinvois: "myinvois-connection", connection: "myinvois-connection",
  telegram: "telegram", bot: "telegram",
  appearance: "appearance", theme: "appearance",
  regional: "regional", locale: "regional", language: "regional",
  "data-tools": "data-tools", data: "data-tools",
  account: "account", "sign out": "account",
};

/** Lowercases and collapses punctuation/whitespace for lenient matching. */
function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Naive singular form so "invoice"/"invoices" and "record"/"records" match. */
function singular(word: string): string {
  return word.endsWith("s") && word.length > 3 ? word.slice(0, -1) : word;
}

/**
 * Scores how well a candidate term (a route key or alias) matches spoken input.
 * Higher wins: exact > singular/plural > full multi-word phrase > shared words.
 * Returns 0 when nothing lines up.
 */
function termScore(term: string, wanted: string, wantedWords: string[]): number {
  if (!term) return 0;
  if (term === wanted) return 100;
  if (singular(term) === singular(wanted)) return 90;
  if (term.includes(" ") && ` ${wanted} `.includes(` ${term} `)) return 80;
  const termWords = term.split(" ");
  const overlap = termWords.filter((tw) => wantedWords.some((ww) => singular(ww) === singular(tw))).length;
  if (overlap === termWords.length) return 60 + overlap;
  if (overlap > 0) return 40 + overlap;
  return 0;
}

function lookupAlias(map: Record<string, string>, raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return map[normalize(raw)] ?? map[raw.toLowerCase().trim()];
}

export interface ResolveDestinationOptions {
  /** e-Invoice stage tab (prepare/submit/history) or generic tab hint. */
  tab?: string;
  /** e-Invoice preparation status filter (needs_information/ready/approved). */
  view?: string;
  /** Settings section to scroll to. */
  section?: string;
}

export interface ResolvedDestination {
  href: string;
  /** Spoken-friendly confirmation, e.g. "e-invoices, submit tab". */
  label: string;
}

/**
 * Resolves a spoken destination (plus optional in-page tab/view/section) to a
 * full href with search params. Returns `null` when nothing matches so the tool
 * can offer a graceful fallback instead of navigating somewhere wrong.
 */
export function resolveDestination(
  destination: string,
  options: ResolveDestinationOptions = {},
): ResolvedDestination | null {
  const wanted = normalize(destination);
  if (!wanted) return null;
  const wantedWords = wanted.split(" ");

  // Score every route by its best-matching term and keep the highest; ties fall
  // to the earlier (more specific) route via the stable VOICE_ROUTES order.
  let route: VoiceRoute | null = null;
  let best = 0;
  for (const candidate of VOICE_ROUTES) {
    const terms = [candidate.key, ...candidate.aliases].map(normalize);
    const score = Math.max(...terms.map((term) => termScore(term, wanted, wantedWords)));
    if (score > best) {
      best = score;
      route = candidate;
    }
  }
  if (!route || best < 41) return null;

  const params = new URLSearchParams();
  const labelParts: string[] = [route.key];

  if (route.path === "/e-invoices") {
    const stage = lookupAlias(EINVOICE_STAGE_ALIASES, options.tab);
    if (stage) { params.set("stage", stage); labelParts.push(`${stage} tab`); }
    const view = lookupAlias(EINVOICE_VIEW_ALIASES, options.view);
    if (view) { params.set("view", view); labelParts.push(view.replace(/_/g, " ")); }
  } else if (route.path === "/settings") {
    const section = lookupAlias(SETTINGS_SECTION_ALIASES, options.section);
    if (section) { params.set("section", section); labelParts.push(`${section.replace(/-/g, " ")} section`); }
  }

  const query = params.toString();
  return { href: query ? `${route.path}?${query}` : route.path, label: labelParts.join(", ") };
}

/** Reverse lookup: a spoken page name for the current pathname. */
export function describePath(pathname: string): string {
  const match = VOICE_ROUTES.find((route) => route.path === pathname)
    ?? VOICE_ROUTES.find((route) => route.path !== "/dashboard" && pathname.startsWith(`${route.path}/`));
  return match?.key ?? "the app";
}

/** Exposed so page components validate their own URL params against one list. */
export const EINVOICE_STAGES = ["prepare", "submit", "history"] as const;
export const EINVOICE_VIEWS = ["needs_information", "ready", "approved"] as const;
