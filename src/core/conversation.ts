import type { SimpleMessage } from '../llm/client.js';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export class Conversation {
  private messages: Message[] = [];
  private maxMessages: number;

  constructor(maxMessages: number = 50) {
    this.maxMessages = maxMessages;
  }

  addUserMessage(content: string): void {
    this.addMessage('user', content);
  }

  addAssistantMessage(content: string): void {
    this.addMessage('assistant', content);
  }

  private addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
    });

    // Trim old messages if exceeding max
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getLastMessage(): Message | undefined {
    return this.messages[this.messages.length - 1];
  }

  toLLMMessages(): SimpleMessage[] {
    return this.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  // Backward compatibility alias
  toClaudeMessages(): SimpleMessage[] {
    return this.toLLMMessages();
  }

  clear(): void {
    this.messages = [];
  }

  getContext(maxTokenEstimate: number = 10000): SimpleMessage[] {
    // Simple token estimation (4 chars ≈ 1 token)
    const messages = this.toLLMMessages();
    let totalChars = 0;
    const maxChars = maxTokenEstimate * 4;

    const selectedMessages: SimpleMessage[] = [];

    // Take messages from the end, respecting token limit
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgChars = msg.content.length;

      if (totalChars + msgChars > maxChars) {
        break;
      }

      selectedMessages.unshift(msg);
      totalChars += msgChars;
    }

    return selectedMessages;
  }
}
