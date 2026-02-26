export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export async function collectStream(
  stream: AsyncGenerator<string, void, unknown>,
  callbacks?: StreamCallbacks
): Promise<string> {
  let fullText = '';

  try {
    for await (const token of stream) {
      fullText += token;
      callbacks?.onToken?.(token);
    }
    callbacks?.onComplete?.(fullText);
    return fullText;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    callbacks?.onError?.(err);
    throw err;
  }
}

export async function streamToConsole(
  stream: AsyncGenerator<string, void, unknown>
): Promise<string> {
  return collectStream(stream, {
    onToken: (token) => process.stdout.write(token),
    onComplete: () => console.log(),
  });
}
