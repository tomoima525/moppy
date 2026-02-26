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
      content: 'Welcome to Moppy! Load a PDF or URL to get started, or type "/help" for commands.',
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  const addMessage = useCallback((role: Message['role'], content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
  }, []);

  // Parse slash command: returns { command, args } or null if not a command
  const parseSlashCommand = (input: string): { command: string; args: string } | null => {
    if (!input.startsWith('/')) return null;
    const withoutSlash = input.slice(1);
    const spaceIndex = withoutSlash.indexOf(' ');
    if (spaceIndex === -1) {
      return { command: withoutSlash.toLowerCase(), args: '' };
    }
    return {
      command: withoutSlash.slice(0, spaceIndex).toLowerCase(),
      args: withoutSlash.slice(spaceIndex + 1).trim(),
    };
  };

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      setInput('');

      // Parse slash commands
      const slashCmd = parseSlashCommand(trimmed);

      // Handle slash commands that don't need processing indicator
      if (slashCmd) {
        switch (slashCmd.command) {
          case 'exit':
          case 'quit':
            await agent.cleanup();
            exit();
            return;
          case 'help':
            addMessage('system', getHelpText());
            return;
          case 'themes':
          case 'theme':
            if (slashCmd.args) {
              // Direct theme setting: /theme gaia
              const theme = slashCmd.args.toLowerCase();
              if (['default', 'gaia', 'uncover'].includes(theme)) {
                agent.getSession().setTheme(theme);
                addMessage('system', `Theme changed to: ${theme}`);
              } else {
                addMessage('system', `Unknown theme: ${theme}. Available: default, gaia, uncover`);
              }
            } else {
              setViewMode('theme-selector');
            }
            return;
          case 'clear':
            setMessages([]);
            return;
        }
      }

      addMessage('user', trimmed);
      setIsProcessing(true);
      setStreamingContent('');

      try {
        // Handle slash commands that need processing
        if (slashCmd) {
          switch (slashCmd.command) {
            case 'load': {
              if (!slashCmd.args) {
                addMessage('system', 'Usage: /load <file.pdf|url> [more sources...]');
                return;
              }
              const sources = slashCmd.args.split(/\s+/);
              setProcessingMessage(`Loading ${sources.length} source(s)...`);

              await agent.loadSources(sources, {
                onProgress: (msg) => setProcessingMessage(msg),
              });

              const loaded = agent.getSession().getSources();
              addMessage(
                'assistant',
                `Loaded ${loaded.length} source(s). You can now ask me to generate slides.`
              );
              return;
            }
            case 'generate': {
              const countMatch = slashCmd.args.match(/(\d+)/);
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
              return;
            }
            case 'export': {
              const format = slashCmd.args.toLowerCase() || 'pdf';
              if (!['html', 'pdf', 'png', 'jpeg', 'pptx'].includes(format)) {
                addMessage('system', `Unknown format: ${format}. Available: html, pdf, png, jpeg, pptx`);
                return;
              }

              setProcessingMessage(`Exporting to ${format}...`);

              const outputPath = await agent.export(format as 'html' | 'pdf' | 'png' | 'jpeg' | 'pptx', {
                onProgress: (msg) => setProcessingMessage(msg),
              });

              if (outputPath) {
                addMessage('assistant', `Exported to: ${outputPath}`);
              } else {
                addMessage('assistant', 'Export failed. Generate slides first.');
              }
              return;
            }
            case 'preview': {
              setProcessingMessage('Starting preview server...');

              const server = await agent.startPreview({
                onProgress: (msg) => setProcessingMessage(msg),
              });

              if (server) {
                addMessage('assistant', `Preview started at: ${server.url}`);
              } else {
                addMessage('assistant', 'Failed to start preview. Generate slides first.');
              }
              return;
            }
            default:
              addMessage('system', `Unknown command: /${slashCmd.command}. Type /help for available commands.`);
              return;
          }
        }

        // Regular chat (no slash command)
        setProcessingMessage('Thinking...');

        const response = await agent.chat(trimmed, {
          onToken: (token) => setStreamingContent((prev) => prev + token),
        });

        setStreamingContent('');
        addMessage('assistant', response);
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
  /load <file|url>     - Load a PDF file or web URL
  /generate [n]        - Generate slides (optionally specify count)
  /export [format]     - Export to html, pdf, png, jpeg, or pptx
  /preview             - Start live preview server
  /theme [name]        - Set theme (default, gaia, uncover) or open selector
  /clear               - Clear chat history
  /help                - Show this help
  /exit                - Exit Moppy

Examples:
  /load ./report.pdf
  /load https://example.com/article
  /generate 10
  /export pdf
  /theme gaia

Or just type naturally to chat with Moppy!
`.trim();
}
