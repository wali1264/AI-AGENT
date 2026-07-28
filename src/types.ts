export type ProviderType = 'google' | 'openai' | 'anthropic' | 'local';

export type RouterStrategy = 'round-robin' | 'failover' | 'priority';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  description: string;
  isEnabled: boolean;
  isDefault: boolean;
  priorityRank: number; // 1 = highest priority
  maxOutputTokens: number;
  temperature: number;
  thinkingLevel?: 'HIGH' | 'LOW' | 'MINIMAL';
  supportsStreaming: boolean;
}

export interface RouterSettings {
  strategy: RouterStrategy;
  maxRetries: number;
  timeoutMs: number;
  cooldownMinutes: number;
  defaultModelId: string;
  fallbackChain: string[]; // List of model IDs in order of preference
}

export interface AgentProfile {
  id: string;
  name: string;
  roleTitle: string;
  description: string;
  systemPrompt: string;
  defaultModelId?: string; // Optional model override
  apiKeyToken: string; // Bearer token for client request authentication
  isEnabled: boolean;
  createdAt: string;
  requestCount: number;
}

export interface RequestLog {
  id: string;
  timestamp: string; // ISO String
  agentId: string;
  agentName: string;
  requestedModel: string;
  actualModel: string;
  provider: ProviderType;
  keyIndex: number;
  status: 'success' | 'error' | 'fallback_success';
  statusCode: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  errorDetails?: string;
  userPromptSnippet: string;
  responseSnippet: string;
  attempts: number;
}

export interface KeyPoolItem {
  keyIndex: number;
  provider: ProviderType;
  envVarName: string;
  maskedKey: string;
  status: 'active' | 'cooldown' | 'exhausted' | 'missing';
  cooldownUntil?: string; // ISO String
  lastUsed?: string;
  successCount: number;
  errorCount: number;
}

export interface SystemStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackRequests: number;
  avgLatencyMs: number;
  totalTokensUsed: number;
  activeKeysCount: number;
  activeModelsCount: number;
  uptimeSeconds: number;
}

export interface ServerState {
  models: ModelConfig[];
  settings: RouterSettings;
  agents: AgentProfile[];
  keyPool: KeyPoolItem[];
  logs: RequestLog[];
  stats: SystemStats;
  authRequired: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponseChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionResponseChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  hermes_meta?: {
    provider: ProviderType;
    requested_model: string;
    actual_model: string;
    key_index: number;
    attempts: number;
    latency_ms: number;
    agent_id: string;
  };
}
