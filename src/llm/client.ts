import {
  getModel,
  stream,
  complete,
  type Model,
  type Context,
  type Message,
  type UserMessage,
  type AssistantMessage,
  type TextContent,
  type ImageContent as PiAiImageContent,
  type Api,
} from '@mariozechner/pi-ai';

export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral';

export interface LLMClientOptions {
  provider?: LLMProvider;
  model?: string;
  apiKey?: string;
}

export interface ImageContent {
  data: string; // base64
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

// Simple message format for external use
export interface SimpleMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-large-latest',
};

const PROVIDER_API_KEY_ENV: Record<LLMProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
};

export class LLMClient {
  private provider: LLMProvider;
  private modelId: string;
  private model: Model<Api>;
  private apiKey: string;

  constructor(options: LLMClientOptions = {}) {
    this.provider = options.provider || 'anthropic';
    this.modelId = options.model || DEFAULT_MODELS[this.provider];
    this.model = getModel(this.provider as any, this.modelId as any);

    // Get API key from options or environment
    const envKey = PROVIDER_API_KEY_ENV[this.provider];
    this.apiKey = options.apiKey || process.env[envKey] || '';
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  getModelId(): string {
    return this.modelId;
  }

  async sendMessage(
    systemPrompt: string,
    messages: SimpleMessage[],
    maxTokens: number = 4096
  ): Promise<string> {
    const context: Context = {
      systemPrompt,
      messages: this.convertMessages(messages),
    };

    const response = await complete(this.model, context, { maxTokens, apiKey: this.apiKey });
    return this.extractText(response);
  }

  async *streamMessage(
    systemPrompt: string,
    messages: SimpleMessage[],
    maxTokens: number = 4096
  ): AsyncGenerator<string, void, unknown> {
    const context: Context = {
      systemPrompt,
      messages: this.convertMessages(messages),
    };

    const eventStream = stream(this.model, context, { maxTokens, apiKey: this.apiKey });

    for await (const event of eventStream) {
      if (event.type === 'text_delta') {
        yield event.delta;
      } else if (event.type === 'error') {
        const errorMessage = event.error?.errorMessage || 'Unknown streaming error';
        throw new Error(errorMessage);
      }
    }
  }

  async analyzeWithVision(
    systemPrompt: string,
    textContent: string,
    images: ImageContent[],
    maxTokens: number = 4096
  ): Promise<string> {
    const content: (TextContent | PiAiImageContent)[] = [
      { type: 'text', text: textContent },
      ...images.map((img) => ({
        type: 'image' as const,
        data: img.data,
        mimeType: img.mimeType,
      })),
    ];

    const userMessage: UserMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const context: Context = {
      systemPrompt,
      messages: [userMessage],
    };

    const response = await complete(this.model, context, { maxTokens, apiKey: this.apiKey });
    return this.extractText(response);
  }

  createTextMessage(role: 'user' | 'assistant', text: string): SimpleMessage {
    return { role, content: text };
  }

  createImageMessage(
    text: string,
    images: ImageContent[]
  ): SimpleMessage {
    // For simple message format, we just include the text
    // Vision analysis should use analyzeWithVision directly
    return { role: 'user', content: text };
  }

  private convertMessages(messages: SimpleMessage[]): Message[] {
    return messages.map((msg): Message => {
      if (msg.role === 'user') {
        return {
          role: 'user',
          content: msg.content,
          timestamp: Date.now(),
        } as UserMessage;
      } else {
        return {
          role: 'assistant',
          content: [{ type: 'text', text: msg.content }],
          api: this.model.api,
          provider: this.provider,
          model: this.modelId,
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
          stopReason: 'stop',
          timestamp: Date.now(),
        } as AssistantMessage;
      }
    });
  }

  private extractText(response: AssistantMessage): string {
    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }
}

// Backward compatibility alias
export { LLMClient as ClaudeClient };
export type { LLMClientOptions as ClaudeClientOptions };
