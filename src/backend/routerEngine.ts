import { GoogleGenAI } from '@google/genai';
import { Response } from 'express';
import {
  AgentProfile,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  KeyPoolItem,
  OpenAiToolCall,
  OpenAiToolDefinition,
  ProviderType,
  RequestLog,
} from '../types.js';
import { store } from './store.js';
import { tradingEngine } from './tradingEngine.js';

let roundRobinIndex = 0;

export interface AttemptDetail {
  requested_model: string;
  actual_model: string;
  key_index: number;
  attempt_number: number;
  fallback_model: string;
  error_reason?: string;
  success: boolean;
  timestamp: string;
}

export interface LastRequestDebug {
  requestedModel: string;
  selectedModel: string;
  keyIndex: number;
  attempts: number;
  fallbackUsed: boolean;
  errorReason: string | null;
  reason?: string;
  failedModels?: string[];
  excludedModels?: string[];
  timestamp: string;
  attemptDetails: AttemptDetail[];
}

export interface RouteResult {
  response?: ChatCompletionResponse;
  isStreamed?: boolean;
  error?: {
    statusCode: number;
    message: string;
    reason?: string;
    failed_models?: string[];
    excluded_models?: string[];
    attempts?: number;
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
  private lastRequestDebug: LastRequestDebug | null = null;

  public getLastRequestDebug(): LastRequestDebug | null {
    return this.lastRequestDebug;
  }

  public getRuntimeModelsInfo() {
    const state = store.getState();
    const activeModels = state.models
      .filter((m) => m.isEnabled)
      .sort((a, b) => a.priorityRank - b.priorityRank)
      .map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category || 'chat',
        capabilities: m.capabilities || ['chat'],
        priorityRank: m.priorityRank,
        isDefault: m.isDefault,
      }));

    return {
      defaultModelId: state.settings.defaultModelId,
      activeModels,
      fallbackChain: state.settings.fallbackChain,
    };
  }
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
    attempt: number,
    failedKeysInCurrentModel?: Set<string>,
    requestQuotaExhaustedKeys?: Set<string>
  ): { keyItem: KeyPoolItem; rawKey: string } | null {
    const state = store.getState();
    const now = new Date().getTime();

    // Filter available keys for provider
    let availableKeys = state.keyPool.filter((k) => k.provider === provider && k.status !== 'missing');

    // Check if cooldown expired (unless quota exhausted in current request session)
    availableKeys.forEach((k) => {
      if (
        k.status === 'cooldown' &&
        k.cooldownUntil &&
        new Date(k.cooldownUntil).getTime() <= now &&
        !requestQuotaExhaustedKeys?.has(k.envVarName)
      ) {
        k.status = 'active';
        k.cooldownUntil = undefined;
      }
    });

    // Active candidates excluding current model failed keys AND quota exhausted keys
    let activeCandidates = availableKeys.filter(
      (k) => k.status === 'active' && !requestQuotaExhaustedKeys?.has(k.envVarName)
    );

    if (failedKeysInCurrentModel && failedKeysInCurrentModel.size > 0) {
      const nonFailed = activeCandidates.filter((k) => !failedKeysInCurrentModel.has(k.envVarName));
      if (nonFailed.length > 0) {
        activeCandidates = nonFailed;
      }
    }

    if (activeCandidates.length === 0) {
      // Reset cooldown ONLY for keys that haven't failed for this model AND are not quota exhausted
      if (availableKeys.length > 0) {
        let resetCount = 0;
        availableKeys.forEach((k) => {
          if (!failedKeysInCurrentModel?.has(k.envVarName) && !requestQuotaExhaustedKeys?.has(k.envVarName)) {
            k.status = 'active';
            k.cooldownUntil = undefined;
            resetCount++;
          }
        });
        if (resetCount > 0) {
          activeCandidates = availableKeys.filter(
            (k) =>
              k.status === 'active' &&
              !failedKeysInCurrentModel?.has(k.envVarName) &&
              !requestQuotaExhaustedKeys?.has(k.envVarName)
          );
        }
      }

      if (activeCandidates.length === 0) {
        return null;
      }
    }

    let selected: KeyPoolItem;

    if (state.settings.strategy === 'round-robin') {
      const idx = (roundRobinIndex + attempt) % activeCandidates.length;
      selected = activeCandidates[idx];
      roundRobinIndex = (roundRobinIndex + 1) % activeCandidates.length;
    } else if (state.settings.strategy === 'failover') {
      const idx = Math.min(attempt, activeCandidates.length - 1);
      selected = activeCandidates[idx];
    } else {
      // Priority
      const sortedByPriority = [...activeCandidates].sort((a, b) => a.keyIndex - b.keyIndex);
      const idx = Math.min(attempt, sortedByPriority.length - 1);
      selected = sortedByPriority[idx];
    }

    const rawVal = store.getRawKeyValue(selected.envVarName);
    if (!rawVal) {
      selected.status = 'missing';
      return activeCandidates.length > 1
        ? this.selectApiKey(provider, attempt + 1, failedKeysInCurrentModel, requestQuotaExhaustedKeys)
        : null;
    }

    return { keyItem: selected, rawKey: rawVal };
  }

  /**
   * Builds model cascade: requested model -> default model / tool optimized -> fallback chain
   * Filters out models that are image-only for chat/tool requests.
   */
  private buildModelCascade(
    requestedModel?: string,
    hasToolsOrVision?: boolean
  ): { cascade: string[]; excludedModels: string[] } {
    const state = store.getState();
    const enabledModels = state.models.filter((m) => m.isEnabled);

    const excludedModels: string[] = [];

    // Filter out image-only models (e.g. gemini-3.1-flash-image) for text/chat/tool requests
    const validChatModels = enabledModels.filter((m) => {
      if (requestedModel && m.id === requestedModel) {
        return true;
      }
      if (m.category === 'image') {
        excludedModels.push(`${m.id} because incompatible capability (image generation model)`);
        return false;
      }
      return true;
    });

    const validChatModelIds = validChatModels.map((m) => m.id);
    const cascade: string[] = [];

    if (requestedModel && validChatModelIds.includes(requestedModel)) {
      cascade.push(requestedModel);
    }

    if (hasToolsOrVision) {
      // Specialized Tool / Computer Use fallback policy: prioritize fast, high-capacity Flash models first
      const toolPreferredOrder = [
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-3.5-pro',
        'gemini-2.5-pro',
        'gemini-3.1-pro-preview',
      ];
      for (const mId of toolPreferredOrder) {
        if (validChatModelIds.includes(mId) && !cascade.includes(mId)) {
          cascade.push(mId);
        }
      }
    } else {
      if (!cascade.includes(state.settings.defaultModelId) && validChatModelIds.includes(state.settings.defaultModelId)) {
        cascade.push(state.settings.defaultModelId);
      }

      for (const fbId of state.settings.fallbackChain) {
        if (validChatModelIds.includes(fbId) && !cascade.includes(fbId)) {
          cascade.push(fbId);
        }
      }
    }

    // Safety net: append any remaining valid chat models only
    for (const mId of validChatModelIds) {
      if (!cascade.includes(mId)) {
        cascade.push(mId);
      }
    }

    // Default fallback if empty
    if (cascade.length === 0) {
      cascade.push('gemini-3.6-flash');
    }

    return { cascade, excludedModels };
  }

  /**
   * Main Router Handler for Chat Completion Requests
   */
  public async handleChatCompletion(
    reqBody: ChatCompletionRequest,
    agentProfile: AgentProfile,
    res?: Response
  ): Promise<RouteResult> {
    const startTime = Date.now();
    const state = store.getState();

    const userMessages = reqBody.messages || [];

    // Extract system instructions and combines with Agent System Prompt Overlay and Live MT5 Trading Context
    const systemParts: string[] = [];
    if (agentProfile.systemPrompt) {
      systemParts.push(String(agentProfile.systemPrompt).normalize('NFC'));
    }

    // Always inject live MetaTrader 5 account and chart symbols context
    try {
      const liveContext = tradingEngine.getLiveTradingContextForAI();
      if (liveContext) systemParts.push(liveContext);
    } catch (e) {
      console.warn('Failed to generate live context for router engine:', e);
    }

    const filteredMessages: ChatMessage[] = [];
    for (const msg of userMessages) {
      const cleanContent = String(msg.content || '').normalize('NFC');
      if (msg.role === 'system') {
        systemParts.push(cleanContent);
      } else {
        filteredMessages.push({ ...msg, content: cleanContent });
      }
    }

    const combinedSystemInstruction = systemParts.join('\n\n');

    let totalAttempts = 0;
    let lastError: string | undefined;

    // Last user prompt snippet for log
    const lastUserMsg = [...filteredMessages].reverse().find((m) => m.role === 'user')?.content || '';
    const userPromptSnippet =
      typeof lastUserMsg === 'string'
        ? lastUserMsg.length > 100
          ? `${lastUserMsg.slice(0, 100)}...`
          : lastUserMsg
        : '[Multimodal / Array Content]';

    const hasToolsOrVision =
      Boolean(reqBody.tools && reqBody.tools.length > 0) ||
      userMessages.some(
        (m) =>
          m.role === 'tool' ||
          m.role === 'function' ||
          Boolean(m.tool_calls && m.tool_calls.length > 0) ||
          Array.isArray(m.content)
      );

    const { cascade: modelCascade, excludedModels } = this.buildModelCascade(
      reqBody.model,
      hasToolsOrVision
    );

    const attemptDetails: AttemptDetail[] = [];
    const requestedModel = reqBody.model || state.settings.defaultModelId;

    const failedModels = new Set<string>();
    const requestQuotaExhaustedKeys = new Set<string>();

    for (const modelId of modelCascade) {
      const modelConfig = state.models.find((m) => m.id === modelId);
      const provider = modelConfig?.provider || 'google';

      const providerKeys = state.keyPool.filter(
        (k) => k.provider === provider && k.status !== 'missing'
      );

      // Early exit if all provider keys are known to be quota exhausted in this session
      const allKeysExhaustedInSession =
        providerKeys.length > 0 &&
        providerKeys.every((k) => requestQuotaExhaustedKeys.has(k.envVarName));

      if (allKeysExhaustedInSession) {
        console.warn(
          `[Hermes Router] All ${providerKeys.length} keys for provider '${provider}' have exceeded quota (429 RESOURCE_EXHAUSTED). Halting model cascade early.`
        );
        lastError = `All ${providerKeys.length} API keys for provider '${provider}' exceeded quota (429 RESOURCE_EXHAUSTED).`;
        break;
      }

      const availableKeysCount = providerKeys.length > 0 ? providerKeys.length : 1;
      const maxKeyAttempts = Math.min(state.settings.maxRetries, availableKeysCount);
      const failedKeysForThisModel = new Set<string>();

      for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
        totalAttempts++;
        const keySelection = this.selectApiKey(
          provider,
          keyAttempt,
          failedKeysForThisModel,
          requestQuotaExhaustedKeys
        );

        if (!keySelection) {
          lastError = `No active API key available for provider ${provider}`;
          attemptDetails.push({
            requested_model: requestedModel,
            actual_model: modelId,
            key_index: keyAttempt + 1,
            attempt_number: totalAttempts,
            fallback_model: modelCascade[modelCascade.indexOf(modelId) + 1] || 'none',
            error_reason: lastError,
            success: false,
            timestamp: new Date().toISOString(),
          });
          break; // move to next fallback model
        }

        const { keyItem, rawKey } = keySelection;
        failedKeysForThisModel.add(keyItem.envVarName);

        try {
          if (provider === 'google') {
            if (reqBody.stream) {
              const completionId = `chatcmpl-hermes-${Date.now()}`;
              const createdSec = Math.floor(Date.now() / 1000);

              const streamResult = await this.executeGeminiCallStream(
                {
                  rawKey,
                  modelId,
                  messages: filteredMessages,
                  systemInstruction: combinedSystemInstruction,
                  temperature: reqBody.temperature ?? modelConfig?.temperature ?? 0.7,
                  maxTokens: reqBody.max_tokens ?? modelConfig?.maxOutputTokens ?? 4096,
                  tools: reqBody.tools,
                },
                (chunkText, chunkToolCalls, resStream) => {
                  if (resStream) {
                    const deltaObj: Record<string, unknown> = {};
                    if (chunkText) {
                      deltaObj.content = chunkText;
                    }
                    if (chunkToolCalls && chunkToolCalls.length > 0) {
                      deltaObj.tool_calls = chunkToolCalls;
                    }

                    const chunkPayload = {
                      id: completionId,
                      object: 'chat.completion.chunk',
                      created: createdSec,
                      model: modelId,
                      choices: [
                        {
                          index: 0,
                          delta: deltaObj,
                          finish_reason: null,
                        },
                      ],
                    };
                    resStream.write(`data: ${JSON.stringify(chunkPayload)}\n\n`);
                    if (typeof (resStream as any).flush === 'function') {
                      (resStream as any).flush();
                    }
                  }
                },
                res
              );

              if (res) {
                const stopPayload = {
                  id: completionId,
                  object: 'chat.completion.chunk',
                  created: createdSec,
                  model: modelId,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason:
                        streamResult.toolCalls && streamResult.toolCalls.length > 0
                          ? 'tool_calls'
                          : 'stop',
                    },
                  ],
                };
                res.write(`data: ${JSON.stringify(stopPayload)}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              }

              const latencyMs = Date.now() - startTime;
              store.markKeySuccess(keyItem.envVarName);

              const isFallback = modelId !== requestedModel;
              const statusType = isFallback ? 'fallback_success' : 'success';

              attemptDetails.push({
                requested_model: requestedModel,
                actual_model: modelId,
                key_index: keyItem.keyIndex,
                attempt_number: totalAttempts,
                fallback_model: 'none',
                success: true,
                timestamp: new Date().toISOString(),
              });

              this.lastRequestDebug = {
                requestedModel,
                selectedModel: modelId,
                keyIndex: keyItem.keyIndex,
                attempts: totalAttempts,
                fallbackUsed: isFallback,
                errorReason: null,
                timestamp: new Date().toISOString(),
                attemptDetails,
              };

              const logEntry: RequestLog = {
                id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                timestamp: new Date().toISOString(),
                agentId: agentProfile.id,
                agentName: agentProfile.name,
                requestedModel,
                actualModel: modelId,
                provider,
                keyIndex: keyItem.keyIndex,
                status: statusType,
                statusCode: 200,
                latencyMs,
                promptTokens: streamResult.usage.prompt_tokens,
                completionTokens: streamResult.usage.completion_tokens,
                totalTokens: streamResult.usage.total_tokens,
                userPromptSnippet,
                responseSnippet: streamResult.fullText.slice(0, 150),
                attempts: totalAttempts,
              };

              store.addLog(logEntry);

              return {
                isStreamed: true,
                hermesMeta: {
                  agentId: agentProfile.id,
                  agentName: agentProfile.name,
                  requestedModel,
                  actualModel: modelId,
                  provider,
                  keyIndex: keyItem.keyIndex,
                  attempts: totalAttempts,
                  latencyMs,
                },
              };
            }

            const result = await this.executeGeminiCall({
              rawKey,
              modelId,
              messages: filteredMessages,
              systemInstruction: combinedSystemInstruction,
              temperature: reqBody.temperature ?? modelConfig?.temperature ?? 0.7,
              maxTokens: reqBody.max_tokens ?? modelConfig?.maxOutputTokens ?? 4096,
              tools: reqBody.tools,
            });

            const latencyMs = Date.now() - startTime;
            store.markKeySuccess(keyItem.envVarName);

            const isFallback = modelId !== requestedModel;
            const statusType = isFallback ? 'fallback_success' : 'success';

            attemptDetails.push({
              requested_model: requestedModel,
              actual_model: modelId,
              key_index: keyItem.keyIndex,
              attempt_number: totalAttempts,
              fallback_model: 'none',
              success: true,
              timestamp: new Date().toISOString(),
            });

            this.lastRequestDebug = {
              requestedModel,
              selectedModel: modelId,
              keyIndex: keyItem.keyIndex,
              attempts: totalAttempts,
              fallbackUsed: isFallback,
              errorReason: null,
              timestamp: new Date().toISOString(),
              attemptDetails,
            };

            const logEntry: RequestLog = {
              id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timestamp: new Date().toISOString(),
              agentId: agentProfile.id,
              agentName: agentProfile.name,
              requestedModel,
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
              responseSnippet:
                result.toolCalls && result.toolCalls.length > 0
                  ? `[Tool Calls: ${result.toolCalls.map((t) => t.function.name).join(', ')}]`
                  : result.responseText.slice(0, 150),
              attempts: totalAttempts,
            };

            store.addLog(logEntry);

            const responseMessage: ChatMessage = {
              role: 'assistant',
              content:
                result.toolCalls && result.toolCalls.length > 0
                  ? result.responseText || null
                  : result.responseText,
            };
            if (result.toolCalls && result.toolCalls.length > 0) {
              responseMessage.tool_calls = result.toolCalls;
            }

            const responsePayload: ChatCompletionResponse = {
              id: `chatcmpl-hermes-${Date.now()}`,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: modelId,
              choices: [
                {
                  index: 0,
                  message: responseMessage,
                  finish_reason: result.finishReason,
                },
              ],
              usage: result.usage,
              hermes_meta: {
                provider,
                requested_model: requestedModel,
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
                requestedModel,
                actualModel: modelId,
                provider,
                keyIndex: keyItem.keyIndex,
                attempts: totalAttempts,
                latencyMs,
              },
            };
          } else {
            throw new Error(`Provider ${provider} is not currently configured with an active key.`);
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          lastError = errMsg;
          failedModels.add(modelId);

          const nextFallback = modelCascade[modelCascade.indexOf(modelId) + 1] || 'none';

          attemptDetails.push({
            requested_model: requestedModel,
            actual_model: modelId,
            key_index: keyItem.keyIndex,
            attempt_number: totalAttempts,
            fallback_model: nextFallback,
            error_reason: errMsg,
            success: false,
            timestamp: new Date().toISOString(),
          });

          console.warn(`[Hermes Router Attempt Log]`, {
            requested_model: requestedModel,
            actual_model: modelId,
            key_index: keyItem.keyIndex,
            attempt_number: totalAttempts,
            fallback_model: nextFallback,
            error_reason: errMsg,
          });

          const isQuotaError =
            errMsg.includes('429') ||
            errMsg.toLowerCase().includes('quota') ||
            errMsg.toLowerCase().includes('rate limit') ||
            errMsg.toLowerCase().includes('resource_exhausted');

          if (isQuotaError) {
            requestQuotaExhaustedKeys.add(keyItem.envVarName);
            store.markKeyCooldown(keyItem.envVarName, state.settings.cooldownMinutes);
          } else if (
            errMsg.includes('403') ||
            errMsg.includes('401') ||
            errMsg.toLowerCase().includes('timeout') ||
            errMsg.toLowerCase().includes('network') ||
            errMsg.toLowerCase().includes('fetch failed')
          ) {
            store.markKeyCooldown(keyItem.envVarName, state.settings.cooldownMinutes);
          }
        }
      }
    }

    // All attempts exhausted or stopped early
    const latencyMs = Date.now() - startTime;
    const failedModelsList = Array.from(failedModels);

    const providerKeysCount = state.keyPool.filter(
      (k) => k.provider === 'google' && k.status !== 'missing'
    ).length;

    let failureReason = 'unknown_failure';
    if (
      requestQuotaExhaustedKeys.size >= providerKeysCount &&
      providerKeysCount > 0
    ) {
      failureReason = 'all_google_keys_exceeded_quota';
    } else if (failedModelsList.length > 0) {
      failureReason = 'key_exhausted_or_model_unavailable';
    } else {
      failureReason = 'no_active_keys_or_models';
    }

    this.lastRequestDebug = {
      requestedModel,
      selectedModel: 'none',
      keyIndex: 0,
      attempts: totalAttempts,
      fallbackUsed: true,
      errorReason: lastError || 'Exceeded retries across available API keys and model fallbacks.',
      reason: failureReason,
      failedModels: failedModelsList,
      excludedModels,
      timestamp: new Date().toISOString(),
      attemptDetails,
    };

    const logEntry: RequestLog = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      agentId: agentProfile.id,
      agentName: agentProfile.name,
      requestedModel,
      actualModel: 'none',
      provider: 'google',
      keyIndex: 0,
      status: 'error',
      statusCode: 502,
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      errorDetails: `[Reason: ${failureReason}] ${lastError || ''}`,
      userPromptSnippet,
      responseSnippet: `[Failed: ${failureReason}] ${lastError || ''}`,
      attempts: totalAttempts,
    };

    store.addLog(logEntry);

    return {
      error: {
        statusCode: 502,
        message: 'Hermes Cloud Router Failed: Exceeded retries across available API keys and model fallbacks.',
        reason: failureReason,
        failed_models: failedModelsList,
        excluded_models: excludedModels,
        attempts: totalAttempts,
        details: lastError,
      },
      hermesMeta: {
        agentId: agentProfile.id,
        agentName: agentProfile.name,
        requestedModel,
        actualModel: 'none',
        provider: 'google',
        keyIndex: 0,
        attempts: totalAttempts,
        latencyMs,
      },
    };
  }

  private parseContentToParts(content: any): any[] {
    if (!content) return [{ text: '' }];
    if (typeof content === 'string') {
      return [{ text: content.normalize('NFC') }];
    }
    if (Array.isArray(content)) {
      const parts: any[] = [];
      for (const item of content) {
        if (!item) continue;
        if (typeof item === 'string') {
          parts.push({ text: item.normalize('NFC') });
        } else if (typeof item === 'object') {
          if (item.type === 'text' && typeof item.text === 'string') {
            parts.push({ text: item.text.normalize('NFC') });
          } else if (
            (item.type === 'image_url' || item.type === 'image') &&
            item.image_url?.url
          ) {
            const urlStr = String(item.image_url.url);
            if (urlStr.startsWith('data:')) {
              const matches = urlStr.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                parts.push({
                  inlineData: {
                    mimeType: matches[1],
                    data: matches[2],
                  },
                });
              } else {
                parts.push({ text: `[Image: ${urlStr.slice(0, 40)}...]` });
              }
            } else {
              parts.push({ text: `[Image URL: ${urlStr}]` });
            }
          } else if (item.inline_data || item.inlineData) {
            const idata = item.inline_data || item.inlineData;
            parts.push({
              inlineData: {
                mimeType: idata.mime_type || idata.mimeType || 'image/png',
                data: idata.data,
              },
            });
          } else if (item.text) {
            parts.push({ text: String(item.text).normalize('NFC') });
          }
        }
      }
      return parts.length > 0 ? parts : [{ text: JSON.stringify(content) }];
    }
    return [{ text: JSON.stringify(content) }];
  }

  private convertOpenAiToolsToGemini(tools?: OpenAiToolDefinition[]): any[] | undefined {
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return undefined;
    }
    const functionDeclarations = tools.map((t) => {
      const fn = t.function || t;
      return {
        name: fn.name,
        description: fn.description || '',
        parameters: fn.parameters || { type: 'OBJECT', properties: {} },
      };
    });
    return [{ functionDeclarations }];
  }

  private mapOpenAiMessagesToGemini(messages: ChatMessage[]): any[] {
    const toolCallMap = new Map<string, string>();
    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.id && tc.function?.name) {
            toolCallMap.set(tc.id, tc.function.name);
          }
        }
      }
    }

    const geminiContents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        continue;
      }

      if (msg.role === 'user') {
        geminiContents.push({
          role: 'user',
          parts: this.parseContentToParts(msg.content),
        });
      } else if (msg.role === 'assistant') {
        const parts: any[] = [];
        if (msg.content) {
          parts.push(...this.parseContentToParts(msg.content));
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            let args = {};
            try {
              args =
                typeof tc.function.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : tc.function.arguments || {};
            } catch {
              args = {};
            }
            parts.push({
              functionCall: {
                name: tc.function.name,
                args: args,
              },
            });
          }
        }
        if (parts.length === 0) {
          parts.push({ text: '' });
        }
        geminiContents.push({
          role: 'model',
          parts,
        });
      } else if (msg.role === 'tool' || msg.role === 'function') {
        const functionName =
          msg.name ||
          (msg.tool_call_id ? toolCallMap.get(msg.tool_call_id) : undefined) ||
          'function';
        let responseObj: Record<string, unknown> = {};
        const contentStr =
          typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
        try {
          const parsed = JSON.parse(contentStr);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            responseObj = parsed;
          } else {
            responseObj = { output: contentStr };
          }
        } catch {
          responseObj = { output: contentStr };
        }

        geminiContents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: functionName,
                response: responseObj,
              },
            },
          ],
        });
      }
    }

    if (geminiContents.length === 0) {
      geminiContents.push({ role: 'user', parts: [{ text: '' }] });
    }

    return geminiContents;
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
    tools?: OpenAiToolDefinition[];
  }): Promise<{
    responseText: string;
    toolCalls?: OpenAiToolCall[];
    finishReason: string;
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

    const contentsPayload = this.mapOpenAiMessagesToGemini(params.messages);

    const genConfig: Record<string, unknown> = {
      temperature: params.temperature,
    };

    if (params.systemInstruction) {
      genConfig.systemInstruction = String(params.systemInstruction).normalize('NFC');
    }

    const toolsPayload = this.convertOpenAiToolsToGemini(params.tools);
    if (toolsPayload) {
      genConfig.tools = toolsPayload;
    }

    const response = await ai.models.generateContent({
      model: params.modelId,
      contents: contentsPayload,
      config: genConfig,
    });

    let responseText = '';
    const toolCalls: OpenAiToolCall[] = [];
    const candidate = response.candidates?.[0];

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          responseText += part.text;
        }
        if (part.functionCall) {
          const callId = `call_${Math.random().toString(36).slice(2, 11)}`;
          toolCalls.push({
            id: callId,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          });
        }
      }
    } else if (response.functionCalls && response.functionCalls.length > 0) {
      for (const fc of response.functionCalls) {
        const callId = `call_${Math.random().toString(36).slice(2, 11)}`;
        toolCalls.push({
          id: callId,
          type: 'function',
          function: {
            name: fc.name,
            arguments: JSON.stringify(fc.args || {}),
          },
        });
      }
    } else {
      responseText = String(response.text || '').normalize('NFC');
    }

    const finishReason = toolCalls.length > 0 ? 'tool_calls' : 'stop';

    // Estimate usage tokens
    const promptLen = JSON.stringify(params.messages).length;
    const completionLen = responseText.length + JSON.stringify(toolCalls).length;
    const prompt_tokens = Math.ceil(promptLen / 4);
    const completion_tokens = Math.ceil(completionLen / 4);

    return {
      responseText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason,
      usage: {
        prompt_tokens,
        completion_tokens,
        total_tokens: prompt_tokens + completion_tokens,
      },
    };
  }

  /**
   * Executes Gemini API Streaming Call
   */
  private async executeGeminiCallStream(
    params: {
      rawKey: string;
      modelId: string;
      messages: ChatMessage[];
      systemInstruction?: string;
      temperature: number;
      maxTokens: number;
      tools?: OpenAiToolDefinition[];
    },
    onChunk: (
      chunkText: string,
      chunkToolCalls: OpenAiToolCall[],
      resStream?: Response
    ) => void,
    resStream?: Response
  ): Promise<{
    fullText: string;
    toolCalls?: OpenAiToolCall[];
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

    const contentsPayload = this.mapOpenAiMessagesToGemini(params.messages);

    const genConfig: Record<string, unknown> = {
      temperature: params.temperature,
    };

    if (params.systemInstruction) {
      genConfig.systemInstruction = String(params.systemInstruction).normalize('NFC');
    }

    const toolsPayload = this.convertOpenAiToolsToGemini(params.tools);
    if (toolsPayload) {
      genConfig.tools = toolsPayload;
    }

    const responseStream = await ai.models.generateContentStream({
      model: params.modelId,
      contents: contentsPayload,
      config: genConfig,
    });

    if (resStream && !resStream.headersSent) {
      resStream.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      if (typeof (resStream as any).flushHeaders === 'function') {
        (resStream as any).flushHeaders();
      }
    }

    let fullText = '';
    const toolCalls: OpenAiToolCall[] = [];

    for await (const chunk of responseStream) {
      const candidate = chunk.candidates?.[0];
      let chunkText = '';
      const chunkToolCalls: OpenAiToolCall[] = [];

      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            chunkText += part.text;
          }
          if (part.functionCall) {
            const callId = `call_${Math.random().toString(36).slice(2, 11)}`;
            const tc: OpenAiToolCall = {
              id: callId,
              type: 'function',
              function: {
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args || {}),
              },
            };
            chunkToolCalls.push(tc);
            toolCalls.push(tc);
          }
        }
      } else {
        chunkText = String(chunk.text || '').normalize('NFC');
      }

      if (chunkText) {
        fullText += chunkText;
      }
      onChunk(chunkText, chunkToolCalls, resStream);
    }

    const promptLen = JSON.stringify(params.messages).length;
    const completionLen = fullText.length + JSON.stringify(toolCalls).length;
    const prompt_tokens = Math.ceil(promptLen / 4);
    const completion_tokens = Math.ceil(completionLen / 4);

    return {
      fullText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        prompt_tokens,
        completion_tokens,
        total_tokens: prompt_tokens + completion_tokens,
      },
    };
  }
}

export const routerEngine = new RouterEngine();
