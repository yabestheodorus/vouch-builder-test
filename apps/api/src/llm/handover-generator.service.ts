import { Injectable, Logger } from '@nestjs/common';
import {
  GenerationOutcome,
  HandoverDraft,
  HandoverDraftSchema,
  HandoverItem,
} from '@vouch/schema';
import {
  buildHandoverPrompt,
  buildRepairPrompt,
  HandoverPromptInput,
} from '@vouch/prompts';
import { GroqService } from './groq.service';

export interface GenerationResult {
  draft: HandoverDraft;
  outcome: GenerationOutcome;
  promptVersion: string;
  model: string;
  usage: unknown;
  error?: string;
}

type ParseResult =
  | { success: true; data: HandoverDraft }
  | { success: false; error: string };

/**
 * Owns the reliability contract around the model (AGENTS.md §3.2):
 *   validate -> repair once -> degrade. The model output is never trusted; only
 *   a value that passes HandoverDraftSchema reaches the rest of the system, and
 *   a failure produces an honest, fully-grounded fallback rather than a crash.
 */
@Injectable()
export class HandoverGeneratorService {
  private readonly logger = new Logger(HandoverGeneratorService.name);

  constructor(private readonly groq: GroqService) {}

  async generate(input: HandoverPromptInput): Promise<GenerationResult> {
    const prompt = buildHandoverPrompt(input);

    if (!this.groq.available) {
      return this.degraded(input, prompt.promptVersion, 'LLM unavailable (no API key)');
    }

    try {
      const first = await this.groq.complete(prompt.messages);
      const parsed = this.tryParse(first.content);
      if (parsed.success) {
        return {
          draft: parsed.data,
          outcome: 'OK',
          promptVersion: prompt.promptVersion,
          model: this.groq.model,
          usage: first.usage,
        };
      }

      this.logger.warn(`Model output invalid, attempting repair: ${parsed.error}`);
      const repair = buildRepairPrompt(first.content, parsed.error);
      const second = await this.groq.complete(repair.messages);
      const reparsed = this.tryParse(second.content);
      if (reparsed.success) {
        return {
          draft: reparsed.data,
          outcome: 'REPAIRED',
          promptVersion: prompt.promptVersion,
          model: this.groq.model,
          usage: second.usage,
        };
      }

      this.logger.error(`Model output invalid after repair: ${reparsed.error}`);
      return this.degraded(
        input,
        prompt.promptVersion,
        `invalid model output after repair: ${reparsed.error}`,
        'DEGRADED',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Generation failed: ${message}`);
      return this.degraded(input, prompt.promptVersion, message, 'FAILED');
    }
  }

  private tryParse(content: string): ParseResult {
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch (e) {
      return { success: false, error: `not valid JSON: ${(e as Error).message}` };
    }
    const result = HandoverDraftSchema.safeParse(json);
    if (!result.success) {
      return { success: false, error: JSON.stringify(result.error.issues) };
    }
    return { success: true, data: result.data };
  }

  /**
   * Deterministic fallback. Passes input through verbatim with its source refs
   * and an `unverified` flag — it never invents facts or classifications, it
   * just guarantees the operator still gets the raw material plus a clear notice.
   */
  private degraded(
    input: HandoverPromptInput,
    promptVersion: string,
    reason: string,
    outcome: GenerationOutcome = 'DEGRADED',
  ): GenerationResult {
    const items: HandoverItem[] = [];

    for (const issue of input.openIssues) {
      items.push({
        bucket: 'PENDING',
        reconcileTag: 'STILL_OPEN',
        issueId: issue.id,
        text: `Carried-over open issue: ${issue.title}`,
        why: 'Passed through from stored open-issue state; model not applied.',
        sourceRefs: issue.sourceRefs.length > 0 ? issue.sourceRefs : [issue.id],
        flags: ['unverified'],
      });
    }
    for (const event of input.events) {
      items.push({
        bucket: 'FYI',
        reconcileTag: 'NEW',
        issueId: null,
        text: event.text,
        why: 'Raw shift event passed through verbatim; model not applied.',
        sourceRefs: [event.sourceRef],
        flags: ['unverified'],
      });
    }

    return {
      draft: {
        summary: `DEGRADED handover — model not applied (${reason}). Items are raw and ungrouped; review manually.`,
        items,
        reasoning: `Fallback used because: ${reason}. No model classification or reconciliation was applied; open issues and this shift's events are passed through verbatim with their source refs and flagged "unverified".`,
      },
      outcome,
      promptVersion,
      model: this.groq.available ? this.groq.model : 'none',
      usage: null,
      error: reason,
    };
  }
}
