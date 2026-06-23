/**
 * Prompt version recorded in every GenerationLog. Bump on ANY wording change so
 * a stored handover can be tied back to the exact prompt that produced it
 * (AGENTS.md §4). Keep in sync with the PROMPT_VERSION env default.
 */
export const PROMPT_VERSION = 'v2';
