import { GoogleGenAI } from '@google/genai';
import {
  AgentProfile,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  KeyPoolItem,
  ProviderType,
  RequestLog,
} from '../types.js';
import { store } from './store.js';

let roundRobinIndex = 0;

export interface RouteResult {
  response?: ChatCompletionResponse;
  streamResponse?: AsyncIterable<unknown>;
  error?: {
    statusCode: number;
    message: string;
    details?: string;
  };
  hermesMeta: {
    agentId: string;
    agentName: string;
    requestedModel: string;
    actualModel: string;
    provider: ProviderType;
    keyIndex: number;
    attempts: number;
    latencyMs: number;
  };
}

export class RouterEngine {
  /**
   * Resolves calling agent from Authorization header or X-Agent-ID
   */
  public resolveAgent(authHeader?: string, agentIdHeader?: string): AgentProfile {
    const state = store.getState();
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (token) {
      const matched = state.agents.find(
        (a) => a.apiKeyToken === token || a.id === token
      );
      if (matched && matched.isEnabled) return matched;
    }

    if (agentIdHeader) {
      const matched = state.agents.find((a) => a.id === agentIdHeader);
      if (matched && matched.isEnabled) return matched;
    }

    // Default Fallback Agent
    return {
      id: 'default-hermes-agent',
      name: 'Hermes Client Agent',
      roleTitle: 'ایجنت پیش‌فرض Hermes',
      description: 'ایجنت اصلی اتصال مشتری به Gateway',
      systemPrompt: '',
      apiKeyToken: process.env.HERMES_API_KEY || 'hermes-default-token',
      isEnabled: true,
      createdAt: new Date().toISOString(),
      requestCount: 0,
    };
  }

  /**
   * Selects an API key from Key Pool based on router strategy
   */
  private selectApiKey(
    provider: ProviderType,
    attempt: number
  ): { keyItem: KeyPoolItem; rawKey: string } | null {
    const state = store.getState();
    const now = new Date().getTime();

    // Filter active keys for provider
    let availableKeys = state.keyPool.filter((k) => k.provider === provider);

    // Check if cooldown expired
    availableKeys.forEach((k) => {
      if (
        k.status === 'cooldown' &&
        k.cooldownUntil &&
        new Date(k.cooldownUntil).getTime() <= now
      ) {
        k.status = 'active';
      }
    });

    // Active candidates
    const activeCandidates = availableKeys.filter((k) => k.status === 'active');

    if (activeCandidates.length === 0) {
      // If all keys in cooldown, reset cooldown to prevent total outage
      if (availableKeys.length > 0) {
        availableKeys.forEach((k) => (k.status = 'active'));
        return this.selectApiKey(provider, attempt);
      }
      return null;
    }

    let selected: KeyPoolItem;

    if (state.settings.strategy === 'round-robin') {
      const idx = (roundRobinIndex + attempt) % activeCandidates.length;
      selected = activeCandidates[idx];
      roundRobinIndex = (roundRobinIndex + 1) % 1000;
    } else if (state.settings.strategy === 'failover') {
      const idx = Math.min(attempt, activeCandidates.length - 1);
      selected = activeCandidates[idx];
    } else {
      // Priority
      selected = activeCandidates[0];
    }

    const rawVal = store.getRawKeyValue(selected.envVarName);
    if (!rawVal) {
      // Mark missing and retry
      selected.status = 'missing';
      return activeCandidates.length > 1
        ? this.selectApiKey(provider, attempt + 1)
        : null;
    }

    return { keyItem: selected, rawKey: rawVal };
  }

  /**
   * Builds model chain: requested or default model -> fallbacks
   */
  private buildModelCascade(requestedModel?: string): string[] {
    const state = store.getState();
    const enabledModelIds = state.models
      .filter((m) => m.isEnabled)
      .map((m) => m.id);

    const cascade: string[] = [];

    if (requestedModel && enabledModelIds.includes(requestedModel)) {
      cascade.push(requestedModel);
    }

    if (!cascade.includes(state.settings.defaultModelId) && enabledModelIds.includes(state.settings.defaultModelId)) {
      cascade.push(state.settings.defaultModelId);
    }

    for (const fbId of state.settings.fallbackChain) {
      if (enabledModelIds.includes(fbId) && !cascade.includes(fbId)) {
        cascade.push(fbId);
      }
    }

    // Default fallback if empty
    if (cascade.length === 0) {
      cascade.push('gemini-3.6-flash');
    }

    return cascade;
  }

  /**
   * Main Router Handler for Chat Completion Requests
   */
  public async handleChatCompletion(
    reqBody: ChatCompletionRequest,
    agentProfile: AgentProfile
  ): Promise<RouteResult> {
    const startTime = Date.now();
    const state = store.getState();
    const modelCascade = this.buildModelCascade(reqBody.model);

    const userMessages = reqBody.messages || [];

    // Extract system instructions and combines with Agent System Prompt Overlay
    const systemParts: string[] = [];
    if (agentProfile.systemPrompt) {
      systemParts.push(agentProfile.systemPrompt);
    }

    const filteredMessages: ChatMessage[] = [];
    for (const msg of userMessages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        filteredMessages.push(msg);
      }
    }

    const combinedSystemInstruction = systemParts.join('\n\n');

    let totalAttempts = 0;
    let lastError: string | undefined;

    // Last user prompt snippet for log
    const lastUserMsg = [...filteredMessages].reverse().find((m) => m.role === 'user')?.content || '';
    const userPromptSnippet = lastUserMsg.length > 100 ? `${lastUserMsg.slice(0, 100)}...` : lastUserMsg;

    for (const modelId of modelCascade) {
      const modelConfig = state.models.find((m) => m.id === modelId);
      const provider = modelConfig?.provider || 'google';

      for (let keyAttempt = 0; keyAttempt < state.settings.maxRetries; keyAttempt++) {
        totalAttempts++;
        const keySelection = this.selectApiKey(provider, keyAttempt);

        if (!keySelection) {
          lastError = `No active API key available for provider ${provider}`;
          continue;
        }

        const { keyItem, rawKey } = keySelection;

        try {
          if (provider === 'google') {
            const result = await this.executeGeminiCall({
              rawKey,
              modelId,
              messages: filteredMessages,
              systemInstruction: combinedSystemInstruction,
              temperature: reqBody.temperature ?? modelConfig?.temperature ?? 0.7,
              maxTokens: reqBody.max_tokens ?? modelConfig?.maxOutputTokens ?? 4096,
              stream: Boolean(reqBody.stream),
            });

            const latencyMs = Date.now() - startTime;
            store.markKeySuccess(keyItem.envVarName);

            const isFallback = modelId !== (reqBody.model || state.settings.defaultModelId);
            const statusType = isFallback ? 'fallback_success' : 'success';

            const logEntry: RequestLog = {
              id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: new Date().toISOString(),
              agentId: agentProfile.id,
              agentName: agentProfile.name,
              requestedModel: reqBody.model || state.settings.defaultModelId,
              actualModel: modelId,
              provider,
              keyIndex: keyItem.keyIndex,
              status: statusType,
              statusCode: 200,
              latencyMs,
              promptTokens: result.usage.prompt_tokens,
              completionTokens: result.usage.completion_tokens,
              totalTokens: result.usage.total_tokens,
              userPromptSnippet,
              responseSnippet: result.responseText.slice(0, 150),
              attempts: totalAttempts,
            };

            store.addLog(logEntry);

            const responsePayload: ChatCompletionResponse = {
              id: `chatcmpl-hermes-${Date.now()}`,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: modelId,
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: result.responseText,
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: result.usage,
              hermes_meta: {
                provider,
                requested_model: reqBody.model || state.settings.defaultModelId,
                actual_model: modelId,
                key_index: keyItem.keyIndex,
                attempts: totalAttempts,
                latency_ms: latencyMs,
                agent_id: agentProfile.id,
              },
            };

            return {
              response: responsePayload,
              hermesMeta: {
                agentId: agentProfile.id,
                agentName: agentProfile.name,
                requestedModel: reqBody.model || state.settings.defaultModelId,
                actualModel: modelId,
                provider,
                keyIndex: keyItem.keyIndex,
                attempts: totalAttempts,
                latencyMs,
              },
            };
          } else {
            // Mock or OpenAI endpoint implementation when key is present
            throw new Error(`Provider ${provider} is not currently configured with an active key.`);
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          lastError = errMsg;
          console.warn(`[Hermes Router] Attempt ${totalAttempts} failed on key #${keyItem.keyIndex} (${modelId}): ${errMsg}`);

          // Mark key cooldown on rate-limit or quota error
          if (
            errMsg.includes('429') ||
            errMsg.toLowerCase().includes('quota') ||
            errMsg.toLowerCase().includes('rate limit') ||
            errMsg.toLowerCase().includes('resource_exhausted')
          ) {
            store.markKeyCooldown(keyItem.envVarName, state.settings.cooldownMinutes);
          }
        }
      }
    }

    // All attempts exhausted
    const latencyMs = Date.now() - startTime;
    const logEntry: RequestLog = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      agentId: agentProfile.id,
      agentName: agentProfile.name,
      requestedModel: reqBody.model || state.settings.defaultModelId,
      actualModel: reqBody.model || state.settings.defaultModelId,
      provider: 'google',
      keyIndex: 0,
      status: 'error',
      statusCode: 502,
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      errorDetails: lastError || 'All models and API keys failed',
      userPromptSnippet,
      responseSnippet: 'خطا در برقراری ارتباط با سرویس‌های هوش مصنوعی',
      attempts: totalAttempts,
    };

    store.addLog(logEntry);

    return {
      error: {
        statusCode: 502,
        message: 'Hermes Cloud Router Failed: Exceeded retries across all available API keys and model fallbacks.',
        details: lastError,
      },
      hermesMeta: {
        agentId: agentProfile.id,
        agentName: agentProfile.name,
        requestedModel: reqBody.model || state.settings.defaultModelId,
        actualModel: 'none',
        provider: 'google',
        keyIndex: 0,
        attempts: totalAttempts,
        latencyMs,
      },
    };
  }

  /**
   * Executes Gemini API Call using official @google/genai SDK
   */
  private async executeGeminiCall(params: {
    rawKey: string;
    modelId: string;
    messages: ChatMessage[];
    systemInstruction?: string;
    temperature: number;
    maxTokens: number;
    stream?: boolean;
  }): Promise<{
    responseText: string;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const ai = new GoogleGenAI({
      apiKey: params.rawKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Build prompt text or message turns
    let contentsPayload: string | { parts: { text: string }[] };
    if (params.messages.length === 1) {
      contentsPayload = params.messages[0].content;
    } else {
      const formattedHistory = params.messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');
      contentsPayload = formattedHistory;
    }

    const genConfig: Record<string, unknown> = {
      temperature: params.temperature,
    };

    if (params.systemInstruction) {
      genConfig.systemInstruction = params.systemInstruction;
    }

    const response = await ai.models.generateContent({
      model: params.modelId,
      contents: contentsPayload,
      config: genConfig,
    });

    const responseText = response.text || '';

    // Estimate usage tokens
    const promptLen = JSON.stringify(params.messages).length;
    const completionLen = responseText.length;
    const prompt_tokens = Math.ceil(promptLen / 4);
    const completion_tokens = Math.ceil(completionLen / 4);

    return {
      responseText,
      usage: {
        prompt_tokens,
        completion_tokens,
        total_tokens: prompt_tokens + completion_tokens,
      },
    };
  }
}

export const routerEngine = new RouterEngine();
