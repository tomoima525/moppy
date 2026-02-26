# Moppy

AI-powered slide generator using multiple LLM providers and Marp.

Supports **Anthropic Claude**, **OpenAI GPT**, **Google Gemini**, **Groq**, and **Mistral** models.

## Installation

```bash
npm install
npm run build
```

## Setup

### API Keys

Set your API key for the provider you want to use:

**Anthropic (default):**
```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
```

**OpenAI:**
```bash
export OPENAI_API_KEY=sk-xxx
```

**Google Gemini:**
```bash
export GEMINI_API_KEY=xxx
```

**Groq:**
```bash
export GROQ_API_KEY=xxx
```

**Mistral:**
```bash
export MISTRAL_API_KEY=xxx
```

Or create a `.env` file:

```
# Required: API key for your chosen provider
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional: Choose provider (default: anthropic)
LLM_PROVIDER=anthropic

# Optional: Override model
LLM_MODEL=claude-sonnet-4-20250514
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | LLM provider to use | `anthropic` |
| `LLM_MODEL` | Model ID override | Provider default |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `GROQ_API_KEY` | Groq API key | - |
| `MISTRAL_API_KEY` | Mistral API key | - |
| `OUTPUT_DIR` | Default output directory | `./slides` |
| `DEFAULT_THEME` | Default Marp theme | `default` |

### Supported Providers and Default Models

| Provider | Default Model |
|----------|---------------|
| `anthropic` | `claude-sonnet-4-20250514` |
| `openai` | `gpt-4o` |
| `google` | `gemini-2.0-flash` |
| `groq` | `llama-3.3-70b-versatile` |
| `mistral` | `mistral-large-latest` |

## Usage

### Interactive Mode (Default)

Start an interactive session to create slides through conversation:

```bash
moppy [options]
```

**Options:**
- `-o, --output <path>` - Output directory (default: `./slides`)
- `-t, --theme <name>` - Theme: `default`, `gaia`, `uncover` (default: `default`)

### Generate Command

Generate slides directly from PDF files or URLs:

```bash
moppy generate <sources...> [options]
```

**Arguments:**
- `<sources...>` - One or more PDF files or URLs

**Options:**
- `-o, --output <path>` - Output directory (default: `./slides`)
- `-t, --theme <name>` - Theme: `default`, `gaia`, `uncover` (default: `default`)
- `-s, --slides <number>` - Number of slides to generate

**Examples:**
```bash
# Using default provider (Anthropic)
moppy generate ./document.pdf

# Using OpenAI
LLM_PROVIDER=openai moppy generate https://example.com/article -s 10

# Using Google Gemini
LLM_PROVIDER=google moppy generate file1.pdf file2.pdf -o ./output -t gaia
```

### Preview Command

Start a live preview server with hot reload:

```bash
moppy preview <file> [options]
```

**Arguments:**
- `<file>` - Marp markdown file to preview

**Options:**
- `-p, --port <number>` - Server port (default: `8080`)
- `--no-open` - Do not open browser automatically

**Example:**
```bash
moppy preview ./slides/presentation.md -p 3000
```

### List Command

List all stored markdown files:

```bash
moppy list
moppy ls
```

Generated markdown files are automatically stored in `.moppy/markdown/` with timestamps for later use.

### Export Command

Export Marp markdown to various formats:

```bash
moppy export <file> [options]
```

**Arguments:**
- `<file>` - Marp markdown file path or stored filename

**Options:**
- `-f, --format <type>` - Output format: `html`, `pdf`, `pptx`, `png`, `jpeg` (default: `pdf`)
- `-o, --output <path>` - Output file path
- `-t, --theme <name>` - Override theme

**Examples:**
```bash
# Export from file path
moppy export ./slides/presentation.md

# Export from stored markdown (use filename from "moppy list")
moppy export slides-2024-01-15T10-30-00.md -f pdf

# Export with options
moppy export slides-2024-01-15T10-30-00.md -f pptx -o ./output/deck.pptx
```

## Markdown Storage

Moppy automatically stores generated markdown files in `.moppy/markdown/` directory with timestamps. This allows you to:

- Keep a history of generated slides
- Re-export slides to different formats later
- Share markdown files with others

**Storage location:** `.moppy/markdown/`
**Filename format:** `slides-YYYY-MM-DDTHH-MM-SS.md`

Use `moppy list` to see all stored files and `moppy export <filename>` to generate PDFs or other formats from them.

## Requirements

- Node.js >= 18.0.0
- API key for at least one supported provider

## License

MIT
