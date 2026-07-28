import fs from 'fs';
import path from 'path';
import {
  AgentProfile,
  KeyPoolItem,
  ModelConfig,
  ProviderType,
  RequestLog,
  RouterSettings,
  ServerState,
  SystemStats,
} from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'hermes-state.json');

// Initial default models aligned with @google/genai SDK guidelines
const INITIAL_MODELS: ModelConfig[] = [
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'google',
    description: 'مدل اصلی هوشمند، فوق‌العاده سریع و بهینه برای اکثر درخواست‌های عمومی و مکالمه ایجنت‌ها',
    isEnabled: true,
    isDefault: true,
    priorityRank: 1,
    maxOutputTokens: 4096,
    temperature: 0.7,
    supportsStreaming: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'google',
    description: 'مدل قدرتمند برای استدلال‌های پیچیده، برنامه‌نویسی، تحلیل مالی و پردازش عمیق',
    isEnabled: true,
    isDefault: false,
    priorityRank: 2,
    maxOutputTokens: 8192,
    temperature: 0.5,
    supportsStreaming: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'google',
    description: 'مدل فوق‌العاده سبک و کم‌هزینه با تاخیر بسیار پایین برای خلاصه‌سازی و کوئری‌های ساده',
    isEnabled: true,
    isDefault: false,
    priorityRank: 3,
    maxOutputTokens: 2048,
    temperature: 0.7,
    supportsStreaming: true,
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Gemini 3.1 Flash Image',
    provider: 'google',
    description: 'مدل تخصصی تولید تصویر و تحلیل بصری پیشرفته',
    isEnabled: true,
    isDefault: false,
    priorityRank: 4,
    maxOutputTokens: 4096,
    temperature: 0.7,
    supportsStreaming: false,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'مدل نسل ۲.۵ سبک، ایده‌آل و با کیفیت بالا برای پاسخگویی عمومی و کنترل بار کاری',
    isEnabled: true,
    isDefault: false,
    priorityRank: 5,
    maxOutputTokens: 4096,
    temperature: 0.7,
    supportsStreaming: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'مدل پیشرفته نسل ۲.۵ برای استدلال‌های سنگین، برنامه‌نویسی و تحلیل‌های چندوجهی',
    isEnabled: true,
    isDefault: false,
    priorityRank: 6,
    maxOutputTokens: 8192,
    temperature: 0.5,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o (آماده توسعه)',
    provider: 'openai',
    description: 'مدل OpenAI برای معماری چند ارائه‌دهنده‌ای (نیاز به OPENAI_API_KEY دارد)',
    isEnabled: false,
    isDefault: false,
    priorityRank: 7,
    maxOutputTokens: 4096,
    temperature: 0.7,
    supportsStreaming: true,
  },
];

const INITIAL_SETTINGS: RouterSettings = {
  strategy: 'round-robin',
  maxRetries: 3,
  timeoutMs: 30000,
  cooldownMinutes: 5,
  defaultModelId: 'gemini-3.6-flash',
  fallbackChain: [
    'gemini-3.6-flash',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ],
};

const INITIAL_AGENTS: AgentProfile[] = [
  {
    id: 'teacher-agent',
    name: 'Teacher Agent',
    roleTitle: 'استاد و مربی آموزشی',
    description: 'پاسخ‌دهی گام‌به‌گام با لحن صبورانه، آموزشی و روان برای تفهیم دقیق مفاهیم',
    systemPrompt: 'شما یک مربی و استاد با‌تجربه هستید. پاسخ‌ها را گام‌به‌گام، شمرده، با مثال‌های ملموس و ساختار شفاف به زبان فارسی ارائه دهید.',
    apiKeyToken: 'hermes-tk-teacher-8821',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    requestCount: 0,
  },
  {
    id: 'trading-agent',
    name: 'Trading Agent',
    roleTitle: 'تحلیل‌گر بازارهای مالی و بورس',
    description: 'بررسی تکنیکال و فاندامنتال، مدیریت ریسک و ارزیابی سناریوهای بازار',
    systemPrompt: 'شما یک تحلیل‌گر حرفه‌ای بازارهای مالی هستید. داده‌ها را بدون تعصب بررسی کنید، سطوح حمایتی/مقاومتی، مدیریت ریسک و سناریوهای احتمالی را مشخص کنید.',
    apiKeyToken: 'hermes-tk-trading-9942',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    requestCount: 0,
  },
  {
    id: 'content-agent',
    name: 'Content Agent',
    roleTitle: 'تولید محتوا و کپی‌رایتر',
    description: 'نگارش متون جذاب، مقالات وب، قلاب‌های شبکه‌های اجتماعی و کپی‌رایتینگ حرفه‌ای',
    systemPrompt: 'شما یک نویسنده و کپی‌رایتر خلاق هستید. متن‌های شیوا، جذاب، لحن متناسب با مخاطب و با رعایت کامل اصول نگارش فارسی بنویسید.',
    apiKeyToken: 'hermes-tk-content-3310',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    requestCount: 0,
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    roleTitle: 'پژوهشگر عمیق و خلاصه‌ساز',
    description: 'تحلیل ساختاریافته مقالات، بررسی منابع علمی و استخراج نکات کلیدی',
    systemPrompt: 'شما یک پژوهشگر علمی دقبق هستید. اطلاعات را به‌صورت ساختاریافته، با خلاصه‌های بولت‌پوینت، استدلال‌های منطقی و بدون ادعای بدون مدرک ارائه دهید.',
    apiKeyToken: 'hermes-tk-research-7754',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    requestCount: 0,
  },
];

const startTime = Date.now();

export class StoreManager {
  private state: ServerState;

  constructor() {
    this.state = this.loadState();
    this.refreshKeyPoolFromEnv();
  }

  private maskKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  public refreshKeyPoolFromEnv(): void {
    const keys: KeyPoolItem[] = [];
    const env = process.env;

    // Dynamically scan process.env for all keys matching GEMINI_API_KEY*, GEMINI_KEY*, GOOGLE_API_KEY*, OPENAI_API_KEY*, ANTHROPIC_API_KEY*
    const matchedEnvVars: { name: string; provider: ProviderType; numIndex: number }[] = [];

    for (const keyName of Object.keys(env)) {
      const val = env[keyName]?.trim();
      if (!val || val === 'MY_GEMINI_API_KEY' || val === 'undefined' || val === 'null' || val === 'YOUR_KEY_HERE') {
        continue;
      }

      let provider: ProviderType | null = null;
      if (
        keyName.startsWith('GEMINI_API_KEY') ||
        keyName.startsWith('GEMINI_KEY') ||
        keyName.startsWith('GOOGLE_API_KEY')
      ) {
        provider = 'google';
      } else if (keyName.startsWith('OPENAI_API_KEY') || keyName.startsWith('OPENAI_KEY')) {
        provider = 'openai';
      } else if (keyName.startsWith('ANTHROPIC_API_KEY') || keyName.startsWith('ANTHROPIC_KEY')) {
        provider = 'anthropic';
      }

      if (provider) {
        // Extract numeric suffix if present, e.g. GEMINI_API_KEY_2 -> 2, GEMINI_API_KEY -> 0
        const matchNum = keyName.match(/_(\d+)$/);
        const numIndex = matchNum ? parseInt(matchNum[1], 10) : 0;
        matchedEnvVars.push({ name: keyName, provider, numIndex });
      }
    }

    // Sort keys logically: GEMINI_API_KEY first (0), then _1, _2, _3... up to dynamic N
    matchedEnvVars.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      return a.numIndex - b.numIndex;
    });

    let displayIndex = 1;
    for (const item of matchedEnvVars) {
      const val = env[item.name]?.trim() || '';
      const existing = this.state.keyPool.find((k) => k.envVarName === item.name);

      keys.push({
        keyIndex: displayIndex++,
        provider: item.provider,
        envVarName: item.name,
        maskedKey: this.maskKey(val),
        status: existing?.status || 'active',
        cooldownUntil: existing?.cooldownUntil,
        lastUsed: existing?.lastUsed,
        successCount: existing?.successCount || 0,
        errorCount: existing?.errorCount || 0,
      });
    }

    this.state.keyPool = keys;
    this.state.stats.activeKeysCount = keys.filter((k) => k.status === 'active').length;
  }

  private loadState(): ServerState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        // Merge initial models into loaded models if missing
        const loadedModels: ModelConfig[] = parsed.models || [];
        for (const initModel of INITIAL_MODELS) {
          if (!loadedModels.some((m) => m.id === initModel.id)) {
            loadedModels.push(initModel);
          }
        }

        return {
          models: loadedModels,
          settings: parsed.settings || INITIAL_SETTINGS,
          agents: parsed.agents || INITIAL_AGENTS,
          keyPool: parsed.keyPool || [],
          logs: parsed.logs || [],
          stats: parsed.stats || {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            fallbackRequests: 0,
            avgLatencyMs: 0,
            totalTokensUsed: 0,
            activeKeysCount: 0,
            activeModelsCount: INITIAL_MODELS.filter((m) => m.isEnabled).length,
            uptimeSeconds: 0,
          },
          authRequired: Boolean(process.env.ADMIN_SECRET),
        };
      }
    } catch (err) {
      console.warn('Could not load persistent state file, using defaults:', err);
    }

    return {
      models: INITIAL_MODELS,
      settings: INITIAL_SETTINGS,
      agents: INITIAL_AGENTS,
      keyPool: [],
      logs: [],
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        fallbackRequests: 0,
        avgLatencyMs: 0,
        totalTokensUsed: 0,
        activeKeysCount: 0,
        activeModelsCount: INITIAL_MODELS.filter((m) => m.isEnabled).length,
        uptimeSeconds: 0,
      },
      authRequired: Boolean(process.env.ADMIN_SECRET),
    };
  }

  public saveState(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save state to disk:', err);
    }
  }

  public getState(): ServerState {
    this.refreshKeyPoolFromEnv();
    const activeModels = this.state.models.filter((m) => m.isEnabled).length;
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    return {
      ...this.state,
      stats: {
        ...this.state.stats,
        activeModelsCount: activeModels,
        uptimeSeconds,
      },
    };
  }

  public updateModels(models: ModelConfig[]): void {
    this.state.models = models;
    this.saveState();
  }

  public updateSettings(settings: RouterSettings): void {
    this.state.settings = settings;
    this.saveState();
  }

  public updateAgents(agents: AgentProfile[]): void {
    this.state.agents = agents;
    this.saveState();
  }

  public addLog(log: RequestLog): void {
    this.state.logs.unshift(log);
    // Keep max 200 logs in memory/disk
    if (this.state.logs.length > 200) {
      this.state.logs = this.state.logs.slice(0, 200);
    }

    // Update global stats
    const stats = this.state.stats;
    stats.totalRequests += 1;
    if (log.status === 'success' || log.status === 'fallback_success') {
      stats.successfulRequests += 1;
    } else {
      stats.failedRequests += 1;
    }
    if (log.status === 'fallback_success') {
      stats.fallbackRequests += 1;
    }

    stats.totalTokensUsed += log.totalTokens;

    // Recalculate average latency
    const recentLogs = this.state.logs.slice(0, 50);
    const sumLatency = recentLogs.reduce((acc, l) => acc + l.latencyMs, 0);
    stats.avgLatencyMs = Math.round(sumLatency / recentLogs.length);

    // Update agent request count
    const agent = this.state.agents.find((a) => a.id === log.agentId);
    if (agent) {
      agent.requestCount += 1;
    }

    this.saveState();
  }

  public clearLogs(): void {
    this.state.logs = [];
    this.saveState();
  }

  public markKeyCooldown(envVarName: string, minutes: number): void {
    const key = this.state.keyPool.find((k) => k.envVarName === envVarName);
    if (key) {
      key.status = 'cooldown';
      key.errorCount += 1;
      const cooldownTime = new Date(Date.now() + minutes * 60 * 1000);
      key.cooldownUntil = cooldownTime.toISOString();
      this.saveState();
    }
  }

  public markKeySuccess(envVarName: string): void {
    const key = this.state.keyPool.find((k) => k.envVarName === envVarName);
    if (key) {
      key.status = 'active';
      key.successCount += 1;
      key.lastUsed = new Date().toISOString();
      key.cooldownUntil = undefined;
      this.saveState();
    }
  }

  public getRawKeyValue(envVarName: string): string | undefined {
    return process.env[envVarName]?.trim();
  }
}

export const store = new StoreManager();
