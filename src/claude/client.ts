import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  TextBlockParam,
  ImageBlockParam,
} from '@anthropic-ai/sdk/resources/messages';

export interface ClaudeClientOptions {
  apiKey: string;
  model?: string;
}

export interface ImageContent {
  type: 'base64';
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  data: string;
}

type ContentBlockInput = TextBlockParam | ImageBlockParam;

export class ClaudeClient {
  private client: Anthropic;
  private model: string;

  constructor(options: ClaudeClientOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
    });
    this.model = options.model || 'claude-sonnet-4-5-20250929';
  }

  async sendMessage(
    systemPrompt: string,
    messages: MessageParam[],
    maxTokens: number = 4096
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  async *streamMessage(
    systemPrompt: string,
    messages: MessageParam[],
    maxTokens: number = 4096
  ): AsyncGenerator<string, void, unknown> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  async analyzeWithVision(
    systemPrompt: string,
    textContent: string,
    images: ImageContent[],
    maxTokens: number = 4096
  ): Promise<string> {
    const content: ContentBlockInput[] = [
      { type: 'text', text: textContent },
      ...images.map((img) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.mediaType,
          data: img.data,
        },
      })),
    ];

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  createTextMessage(role: 'user' | 'assistant', text: string): MessageParam {
    return { role, content: text };
  }

  createImageMessage(
    text: string,
    images: ImageContent[]
  ): MessageParam {
    return {
      role: 'user',
      content: [
        { type: 'text', text },
        ...images.map((img) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: img.mediaType,
            data: img.data,
          },
        })),
      ],
    };
  }
}
