import { GoogleGenAI } from '@google/genai';
import { UnifiedSnapshot, GeminiAIAnalysis } from '../types.js';

export class GeminiEngine {
  private ai: GoogleGenAI | null = null;
  private readonly DEFAULT_MODEL = 'gemini-3.6-flash';

  constructor() {
    this.initClient();
  }

  private initClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.ai = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('GeminiEngine: Failed to initialize GoogleGenAI client:', err);
        this.ai = null;
      }
    }
  }

  /**
   * Generates deep market analysis and trading decisions using Gemini 3.6 Flash model with safe fallback.
   */
  public async analyzeSnapshot(snapshot: UnifiedSnapshot, activeKnowledgeRules?: any[]): Promise<GeminiAIAnalysis> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && !this.ai) {
      this.initClient();
    }

    if (this.ai && apiKey) {
      try {
        const prompt = this.buildAnalysisPrompt(snapshot, activeKnowledgeRules);
        const response = await this.ai.models.generateContent({
          model: this.DEFAULT_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return {
            decision: parsed.decision || 'HOLD',
            confidence: Number(parsed.confidence) || 75,
            marketBias: parsed.marketBias || 'NEUTRAL',
            persianAnalysis: parsed.persianAnalysis || 'تحلیل جمینی بر اساس همگرایی تکنیکال، قوانین دانش تجربی و فیلترهای ریسک صادر شد.',
            englishAnalysis: parsed.englishAnalysis || 'Gemini analysis generated based on technical alignment, empirical knowledge rules, and risk filters.',
            keyObservations: Array.isArray(parsed.keyObservations) ? parsed.keyObservations : [],
            suggestedAction: parsed.suggestedAction || 'Wait for clearer entry confirmation',
            evaluatedAt: new Date().toISOString(),
            modelUsed: this.DEFAULT_MODEL,
          };
        }
      } catch (err) {
        console.error('GeminiEngine: Gemini API call error, falling back to rule-based analysis:', err);
      }
    }

    // Fallback if API key is not present or request failed
    return this.generateFallbackAnalysis(snapshot);
  }

  /**
   * Formats UnifiedSnapshot into structured prompt for LLM evaluation.
   */
  private buildAnalysisPrompt(snapshot: UnifiedSnapshot, activeKnowledgeRules?: any[]): string {
    const m = snapshot.market;
    const acc = snapshot.account;
    const ind = snapshot.indicators?.H1 || snapshot.indicators?.M5;
    const risk = snapshot.riskAssessment;
    const sig = snapshot.strategySignal;

    let knowledgeSection = 'No empirical knowledge rules applied yet.';
    if (activeKnowledgeRules && activeKnowledgeRules.length > 0) {
      knowledgeSection = activeKnowledgeRules
        .filter((r) => r.isEnabled !== false)
        .map(
          (r, idx) =>
            `${idx + 1}. [${r.ruleCode || r.id}] ${r.title}: ${r.descriptionPersian} (اطمینان: ${r.confidenceScore}٪ | نمونه‌ها: ${r.sampleSize} معامله | تاثیر بر WinRate: ${r.winRateImpact > 0 ? '+' : ''}${r.winRateImpact}٪)`
        )
        .join('\n');
    }

    return `
You are Hermes AI (هرمس), an elite institutional quantitative gold (XAUUSD) & forex algorithmic trader.
Analyze the following live unified market snapshot and empirical knowledge rules, then return a strictly valid JSON response.

[MARKET SNAPSHOT]
Symbol: ${m.symbol || 'XAUUSD.m'}
Ask: ${m.ask} | Bid: ${m.bid} | Spread: ${m.spread}
Broker Latency: ${snapshot.dataQuality.latencyMs} ms
Data Freshness: ${snapshot.dataQuality.lastTickAgeMs} ms

[ACCOUNT & RISK STATE]
Balance: $${acc.balance} | Equity: $${acc.equity} | Drawdown: ${acc.drawdown?.toFixed(2)}%
Open Positions: ${snapshot.positions.length}
Risk Assessment Allowed: ${risk?.isAllowed} | Risk Score: ${risk?.riskScore}/100
Risk Recommendation: ${risk?.recommendation}

[TECHNICAL INDICATORS]
EMA20: ${ind?.ema20} | EMA50: ${ind?.ema50} | EMA200: ${ind?.ema200}
RSI(14): ${ind?.rsi14} | ATR(14): ${ind?.atr14} | ADX: ${ind?.adx14?.adx}
Trend Signal: ${ind?.trendSignal}

[STRATEGY ENGINE SIGNAL]
Action: ${sig?.action} | Confidence: ${sig?.confidenceScore}%
Entry: ${sig?.entryPrice} | SL: ${sig?.sl} | TP: ${sig?.tp} | Lot: ${sig?.lot}
Confluences: ${sig?.confluenceReasons?.join(', ')}

[EMPIRICAL KNOWLEDGE LAYER (DANESH EXPERIMENTAL RULES FROM PAST TRADES)]
${knowledgeSection}

Strictly honor the Empirical Knowledge Layer! If any rule indicates severe win-rate reduction under current market spread/conditions, adjust decision to HOLD or lower confidence accordingly.

[OUTPUT REQUIREMENTS]
Return JSON matching this exact structure:
{
  "decision": "BUY" | "SELL" | "HOLD" | "CLOSE_ALL",
  "confidence": number,
  "marketBias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "persianAnalysis": "Short technical justification in Persian language incorporating technicals & empirical rules (2-3 sentences)",
  "englishAnalysis": "Short technical justification in English language (2-3 sentences)",
  "keyObservations": ["Observation 1", "Observation 2", "Observation 3"],
  "suggestedAction": "Exact immediate step recommended for trader"
}
`;
  }

  /**
   * Deterministic Fallback Engine for offline or fallback operation.
   */
  private generateFallbackAnalysis(snapshot: UnifiedSnapshot): GeminiAIAnalysis {
    const sig = snapshot.strategySignal;
    const risk = snapshot.riskAssessment;

    let decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE_ALL' = 'HOLD';
    let marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 70;

    if (sig) {
      decision = sig.action;
      marketBias = sig.htfTrend;
      confidence = sig.confidenceScore;
    }

    if (risk && !risk.isAllowed) {
      decision = 'HOLD';
      confidence = 30;
    }

    const persianAnalysis = `تحلیل خودکار هرمس (حالت آفلاین/پشتیبان): روند کلان بازار ${
      marketBias === 'BULLISH' ? 'صعودی' : marketBias === 'BEARISH' ? 'نزولی' : 'خنثی'
    } ارزیابی شد. به دلیل رعایت شاخص ریسک ${risk?.riskScore || 20}/100، تصمیم نهایی معاملاتی بر روی ${decision} با درجه اطمینان ${confidence}٪ ثبت گردید.`;

    const englishAnalysis = `Hermes Automated Analysis (Fallback Mode): Macro trend evaluated as ${marketBias}. Risk engine score at ${
      risk?.riskScore || 20
    }/100. Final decision set to ${decision} with ${confidence}% confidence.`;

    return {
      decision,
      confidence,
      marketBias,
      persianAnalysis,
      englishAnalysis,
      keyObservations: [
        `اسپرد نماد طلا: ${snapshot.market.spread} پیپ`,
        `ارزیابی ایمنی ریسک: ${risk?.isAllowed ? 'مجاز' : 'غیرمجاز'}`,
        `مومنتوم تایم‌فریم کوتاه: ${sig?.ltfSetup || 'NEUTRAL'}`,
      ],
      suggestedAction: decision === 'HOLD' ? 'منتظر تاییدیه مجدد کندل بعدی باشید' : `اجرای سفارش ${decision} با حد ضرر ${sig?.sl || 0}`,
      evaluatedAt: new Date().toISOString(),
      modelUsed: 'hermes-fallback-engine-v1',
    };
  }
}

export const geminiEngine = new GeminiEngine();
