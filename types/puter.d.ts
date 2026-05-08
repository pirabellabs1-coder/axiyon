/**
 * Type declarations for Puter.js (loaded globally via <script>).
 * https://docs.puter.com/AI/chat/
 */

interface PuterChatOptions {
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

interface PuterChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string; [k: string]: unknown }>;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface PuterChatResponse {
  message?: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  };
  text?: string;
  toString(): string;
}

interface PuterAI {
  chat(prompt: string | PuterChatMessage[], options?: PuterChatOptions): Promise<PuterChatResponse | AsyncIterable<{ text?: string }>>;
}

interface PuterAuth {
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  getUser(): Promise<{ uuid: string; username: string; email_confirmed: boolean } | null>;
  isSignedIn(): boolean;
}

interface PuterRoot {
  ai: PuterAI;
  auth: PuterAuth;
  print(...args: unknown[]): void;
}

declare global {
  interface Window {
    puter?: PuterRoot;
  }
}

export {};
