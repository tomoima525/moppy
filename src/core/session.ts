import fs from 'fs-extra';
import path from 'path';
import { Conversation, Message } from './conversation.js';
import { SourceContent } from '../sources/index.js';

export interface SessionState {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  sources: SourceInfo[];
  generatedFiles: string[];
  currentSlideFile?: string;
  theme: string;
  outputDir: string;
}

export interface SourceInfo {
  type: 'pdf' | 'web';
  path: string;
  loadedAt: Date;
}

export class Session {
  private state: SessionState;
  private conversation: Conversation;
  private loadedSources: SourceContent[] = [];

  constructor(outputDir: string = './slides', theme: string = 'default') {
    this.state = {
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      sources: [],
      generatedFiles: [],
      theme,
      outputDir,
    };
    this.conversation = new Conversation();
  }

  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  getId(): string {
    return this.state.id;
  }

  getConversation(): Conversation {
    return this.conversation;
  }

  getState(): Readonly<SessionState> {
    return { ...this.state };
  }

  setTheme(theme: string): void {
    this.state.theme = theme;
    this.touch();
  }

  getTheme(): string {
    return this.state.theme;
  }

  setOutputDir(dir: string): void {
    this.state.outputDir = dir;
    this.touch();
  }

  getOutputDir(): string {
    return this.state.outputDir;
  }

  addSource(source: SourceContent): void {
    this.loadedSources.push(source);
    this.state.sources.push({
      type: source.type,
      path: source.type === 'pdf' ? source.sourcePath : source.sourceUrl,
      loadedAt: new Date(),
    });
    this.touch();
  }

  getSources(): SourceContent[] {
    return this.loadedSources;
  }

  setCurrentSlideFile(filePath: string): void {
    this.state.currentSlideFile = filePath;
    if (!this.state.generatedFiles.includes(filePath)) {
      this.state.generatedFiles.push(filePath);
    }
    this.touch();
  }

  getCurrentSlideFile(): string | undefined {
    return this.state.currentSlideFile;
  }

  addGeneratedFile(filePath: string): void {
    if (!this.state.generatedFiles.includes(filePath)) {
      this.state.generatedFiles.push(filePath);
    }
    this.touch();
  }

  getGeneratedFiles(): string[] {
    return [...this.state.generatedFiles];
  }

  private touch(): void {
    this.state.updatedAt = new Date();
  }

  async save(sessionDir: string = './.moppy'): Promise<string> {
    await fs.ensureDir(sessionDir);
    const filePath = path.join(sessionDir, `${this.state.id}.json`);

    const data = {
      state: this.state,
      messages: this.conversation.getMessages(),
    };

    await fs.writeJson(filePath, data, { spaces: 2 });
    return filePath;
  }

  static async load(filePath: string): Promise<Session> {
    const data = await fs.readJson(filePath);

    const session = new Session(data.state.outputDir, data.state.theme);
    session.state = {
      ...data.state,
      createdAt: new Date(data.state.createdAt),
      updatedAt: new Date(data.state.updatedAt),
    };

    // Restore messages
    for (const msg of data.messages as Message[]) {
      if (msg.role === 'user') {
        session.conversation.addUserMessage(msg.content);
      } else {
        session.conversation.addAssistantMessage(msg.content);
      }
    }

    return session;
  }

  reset(): void {
    this.conversation.clear();
    this.loadedSources = [];
    this.state.sources = [];
    this.state.generatedFiles = [];
    this.state.currentSlideFile = undefined;
    this.touch();
  }
}
