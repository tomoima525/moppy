import React from 'react';
import { render } from 'ink';
import { Chat } from './components/Chat.js';
import { MoppyAgent, AgentConfig } from '../core/agent.js';
import type { LLMProvider } from '../llm/client.js';

export interface AppOptions {
  provider?: LLMProvider;
  model?: string;
  outputDir?: string;
  theme?: string;
}

export function createApp(options: AppOptions): { agent: MoppyAgent; waitUntilExit: () => Promise<void> } {
  const config: AgentConfig = {
    provider: options.provider,
    model: options.model,
    outputDir: options.outputDir || './slides',
    theme: options.theme || 'default',
  };

  const agent = new MoppyAgent(config);

  const { waitUntilExit } = render(<Chat agent={agent} />);

  return { agent, waitUntilExit };
}

export async function runInteractiveMode(options: AppOptions): Promise<void> {
  const { waitUntilExit } = createApp(options);
  await waitUntilExit();
}
