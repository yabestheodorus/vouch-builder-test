import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import type { ChatMessage } from '@vouch/prompts';

export interface CompletionResult {
  content: string;
  usage: unknown;
}

/**
 * Thin Groq client. Deterministic (temperature 0) and constrained to JSON output.
 * If no API key is configured the service reports `available = false` so the
 * pipeline can degrade gracefully instead of crashing (AGENTS.md §3.2).
 */
@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly client: Groq | null;
  readonly model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    this.client = apiKey ? new Groq({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('GROQ_API_KEY not set — handover generation will degrade.');
    }
  }

  get available(): boolean {
    return this.client !== null;
  }

  async complete(messages: ChatMessage[]): Promise<CompletionResult> {
    if (!this.client) {
      throw new Error('GROQ_API_KEY not configured');
    }
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    return {
      content: response.choices[0]?.message?.content ?? '',
      usage: response.usage ?? null,
    };
  }
}
