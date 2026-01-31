import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { Spinner } from './Spinner.js';
import { ThemeSelector } from './ThemeSelector.js';
import { MoppyAgent } from '../../core/agent.js';

export interface ChatProps {
  agent: MoppyAgent;
}

type ViewMode = 'chat' | 'theme-selector';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const Chat: React.FC<ChatProps> = ({ agent }) => {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'Welcome to Moppy! Load a PDF or URL to get started, or type "help" for commands.',
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  const addMessage = useCallback((role: Message['role'], content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
  }, []);

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      setInput('');

      // Handle special commands
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        await agent.cleanup();
        exit();
        return;
      }

      if (trimmed.toLowerCase() === 'help') {
        addMessage('system', getHelpText());
        return;
      }

      if (trimmed.toLowerCase() === 'themes') {
        setViewMode('theme-selector');
        return;
      }

      if (trimmed.toLowerCase() === 'clear') {
        setMessages([]);
        return;
      }

      addMessage('user', trimmed);
      setIsProcessing(true);
      setStreamingContent('');

      try {
        // Detect if this is a load command
        if (trimmed.toLowerCase().startsWith('load ')) {
          const sources = trimmed.slice(5).trim().split(/\s+/);
          setProcessingMessage(`Loading ${sources.length} source(s)...`);

          await agent.loadSources(sources, {
            onProgress: (msg) => setProcessingMessage(msg),
          });

          const loaded = agent.getSession().getSources();
          addMessage(
            'assistant',
            `Loaded ${loaded.length} source(s). You can now ask me to generate slides.`
          );
        } else if (
          trimmed.toLowerCase().includes('generate') ||
          trimmed.toLowerCase().includes('create slides')
        ) {
          // Extract slide count if mentioned
          const countMatch = trimmed.match(/(\d+)\s*slides?/i);
          const slideCount = countMatch ? parseInt(countMatch[1], 10) : undefined;

          setProcessingMessage('Generating slides...');

          const result = await agent.generateSlides(slideCount, {
            onProgress: (msg) => setProcessingMessage(msg),
            onToken: (token) => setStreamingContent((prev) => prev + token),
          });

          if (result) {
            setStreamingContent('');
            addMessage(
              'assistant',
              `Created ${result.slideCount} slides!\nSaved to: ${result.filePath}`
            );
          } else {
            addMessage('assistant', 'Failed to generate slides. Make sure you have loaded sources first.');
          }
        } else if (trimmed.toLowerCase().startsWith('export')) {
          const formatMatch = trimmed.match(/export(?:\s+to)?\s+(html|pdf|png|jpeg|pptx)/i);
          const format = formatMatch ? formatMatch[1].toLowerCase() : 'pdf';

          setProcessingMessage(`Exporting to ${format}...`);

          const outputPath = await agent.export(format as 'html' | 'pdf' | 'png' | 'jpeg' | 'pptx', {
            onProgress: (msg) => setProcessingMessage(msg),
          });

          if (outputPath) {
            addMessage('assistant', `Exported to: ${outputPath}`);
          } else {
            addMessage('assistant', 'Export failed. Generate slides first.');
          }
        } else if (trimmed.toLowerCase() === 'preview') {
          setProcessingMessage('Starting preview server...');

          const server = await agent.startPreview({
            onProgress: (msg) => setProcessingMessage(msg),
          });

          if (server) {
            addMessage('assistant', `Preview started at: ${server.url}`);
          } else {
            addMessage('assistant', 'Failed to start preview. Generate slides first.');
          }
        } else {
          // Regular chat
          setProcessingMessage('Thinking...');

          const response = await agent.chat(trimmed, {
            onToken: (token) => setStreamingContent((prev) => prev + token),
          });

          setStreamingContent('');
          addMessage('assistant', response);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        addMessage('system', `Error: ${errMsg}`);
      } finally {
        setIsProcessing(false);
        setProcessingMessage('');
        setStreamingContent('');
      }
    },
    [agent, addMessage, exit]
  );

  const handleThemeSelect = useCallback(
    (theme: string) => {
      agent.getSession().setTheme(theme);
      addMessage('system', `Theme changed to: ${theme}`);
      setViewMode('chat');
    },
    [agent, addMessage]
  );

  const handleThemeCancel = useCallback(() => {
    setViewMode('chat');
  }, []);

  if (viewMode === 'theme-selector') {
    return (
      <ThemeSelector
        currentTheme={agent.getSession().getTheme()}
        onSelect={handleThemeSelect}
        onCancel={handleThemeCancel}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="magenta">
          Moppy
        </Text>
        <Text dimColor> - AI Slide Generator</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginBottom={1}>
        {messages.slice(-10).map((msg, i) => (
          <MessageLine key={i} message={msg} />
        ))}
      </Box>

      {/* Streaming content */}
      {streamingContent && (
        <Box marginBottom={1}>
          <Text color="green">{streamingContent}</Text>
        </Box>
      )}

      {/* Processing indicator */}
      {isProcessing && !streamingContent && (
        <Box marginBottom={1}>
          <Spinner message={processingMessage} />
        </Box>
      )}

      {/* Input */}
      {!isProcessing && (
        <Box>
          <Text color="cyan">&gt; </Text>
          <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
        </Box>
      )}
    </Box>
  );
};

interface MessageLineProps {
  message: Message;
}

const MessageLine: React.FC<MessageLineProps> = ({ message }) => {
  const colors = {
    user: 'yellow',
    assistant: 'green',
    system: 'gray',
  } as const;

  const prefixes = {
    user: 'You: ',
    assistant: 'Moppy: ',
    system: '> ',
  };

  return (
    <Box>
      <Text color={colors[message.role]}>
        {prefixes[message.role]}
        {message.content}
      </Text>
    </Box>
  );
};

function getHelpText(): string {
  return `
Available commands:
  load <file.pdf|url>  - Load a PDF file or web URL
  generate [n] slides  - Generate slides from loaded sources
  export [format]      - Export to html, pdf, png, jpeg, or pptx
  preview              - Start live preview server
  themes               - Select a theme
  clear                - Clear chat history
  help                 - Show this help
  exit                 - Exit Moppy

Examples:
  load ./report.pdf
  load https://example.com/article
  generate 10 slides
  export pdf
`.trim();
}
