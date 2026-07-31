import {
  UnifiedSnapshot,
  ExecutionEngineResult,
  TelemetryRecord,
  NotificationPayload,
} from '../types.js';
import { supabaseService } from './supabaseClient.js';

export class TelemetryEngine {
  private recentRecords: TelemetryRecord[] = [];
  private readonly MAX_HISTORY = 100;

  /**
   * Captures end-to-end execution snapshot data, builds audit record, formats notifications, and syncs to Supabase.
   */
  public recordTelemetry(
    snapshot: UnifiedSnapshot,
    executionResult?: ExecutionEngineResult
  ): TelemetryRecord {
    const timestamp = new Date().toISOString();
    const id = `tel_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const riskScore = snapshot.riskAssessment?.riskScore ?? 0;
    const riskAllowed = snapshot.riskAssessment?.isAllowed ?? true;
    const signalAction = snapshot.strategySignal?.action ?? 'HOLD';
    const confidenceScore = snapshot.strategySignal?.confidenceScore ?? 50;
    const aiDecision = snapshot.aiAnalysis?.decision ?? 'HOLD';
    const ordersCount = executionResult?.ordersToDispatch?.length ?? 0;
    const modsCount = executionResult?.modificationsToDispatch?.length ?? 0;

    // Determine overall system health status
    let status: 'OPTIMAL' | 'WARNING' | 'ALERT' | 'CRITICAL' = 'OPTIMAL';
    if (!riskAllowed || riskScore > 75) {
      status = 'CRITICAL';
    } else if (snapshot.dataQuality.lastTickAgeMs > 10000 || snapshot.dataQuality.latencyMs > 250) {
      status = 'ALERT';
    } else if (riskScore > 40 || snapshot.dataQuality.latencyMs > 100) {
      status = 'WARNING';
    }

    // Format localized notification templates
    const notification = this.formatNotifications(snapshot, executionResult, status);

    const record: TelemetryRecord = {
      id,
      timestamp,
      sequenceNumber: snapshot.sequence || Date.now(),
      latencyMs: snapshot.dataQuality.latencyMs,
      riskScore,
      riskAllowed,
      strategySignalAction: signalAction,
      confidenceScore,
      aiDecision,
      ordersDispatchedCount: ordersCount,
      modificationsCount: modsCount,
      persianNotificationText: notification.persianMessage,
      englishNotificationText: notification.englishMessage,
      status,
    };

    // Store in internal circular buffer
    this.recentRecords.unshift(record);
    if (this.recentRecords.length > this.MAX_HISTORY) {
      this.recentRecords.pop();
    }

    // Asynchronously log to Supabase for persistence
    supabaseService.logTradingEvent({
      id,
      timestamp,
      type: status === 'CRITICAL' ? 'error' : ordersCount > 0 ? 'order_dispatched' : 'rule_check',
      message: notification.persianMessage,
    }).catch((err) => {
      console.warn('TelemetryEngine: Supabase log sync error (non-blocking):', err);
    });

    return record;
  }

  /**
   * Generates formatted notifications for live messaging channels (Telegram/Discord/UI Badges).
   */
  public formatNotifications(
    snapshot: UnifiedSnapshot,
    execResult?: ExecutionEngineResult,
    status?: string
  ): NotificationPayload {
    const symbol = snapshot.market.symbol || 'XAUUSD.m';
    const ask = snapshot.market.ask;
    const bid = snapshot.market.bid;
    const risk = snapshot.riskAssessment;
    const sig = snapshot.strategySignal;
    const ai = snapshot.aiAnalysis;
    const orders = execResult?.ordersToDispatch || [];
    const mods = execResult?.modificationsToDispatch || [];

    let level: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS' = 'INFO';
    if (orders.length > 0) level = 'SUCCESS';
    else if (status === 'CRITICAL' || status === 'ALERT') level = 'ALERT';
    else if (status === 'WARNING') level = 'WARNING';

    const faOrderDetails = orders.map((o) => `• سفارش ${o.type} ${o.lot} لات روی $${o.executionPrice || ask} (حد ضرر: $${o.sl} | حد سود: $${o.tp})`).join('\n');
    const faModDetails = mods.map((m) => `• پوزیشن #${m.ticket}: ${m.reason}`).join('\n');

    const persianMessage = `
[گزارش تلپاتیک ایجنت معامله‌گر هرمس] 
نماد: ${symbol} | قیمت: $${ask.toFixed(2)} / $${bid.toFixed(2)}
وضعیت ریسک: ${risk?.isAllowed ? 'ایمن' : 'بحرانی'} (امتیاز ریسک: ${risk?.riskScore}/100)
سیگنال استراتژی: ${sig?.action} (اطمینان: ${sig?.confidenceScore}٪)
تصمیم هوش مصنوعی جمینی: ${ai?.decision} (${ai?.suggestedAction})
${orders.length > 0 ? `\nدستورات صادر شده:\n${faOrderDetails}` : ''}
${mods.length > 0 ? `\nتغییرات محافظتی پوزیشن:\n${faModDetails}` : ''}
تحلیل هوشمند: ${ai?.persianAnalysis || 'تحلیل پیوسته فعال است.'}
    `.trim();

    const englishMessage = `
[Hermes AI Telemetry Dispatch]
Symbol: ${symbol} | Ask: $${ask.toFixed(2)} | Bid: $${bid.toFixed(2)}
Risk Status: ${risk?.isAllowed ? 'ALLOWED' : 'BLOCKED'} (Risk Score: ${risk?.riskScore}/100)
Strategy Signal: ${sig?.action} (Confidence: ${sig?.confidenceScore}%)
Gemini AI Decision: ${ai?.decision}
Orders Dispatched: ${orders.length} | Position Adjustments: ${mods.length}
Reasoning: ${ai?.englishAnalysis || 'Continuous telemetry active.'}
    `.trim();

    return {
      title: `Hermes Telemetry Event [${level}]`,
      persianMessage,
      englishMessage,
      level,
      timestamp: new Date().toISOString(),
      meta: {
        sequence: snapshot.sequence,
        latencyMs: snapshot.dataQuality.latencyMs,
        riskScore: risk?.riskScore,
      },
    };
  }

  public getRecentRecords(): TelemetryRecord[] {
    return this.recentRecords;
  }
}

export const telemetryEngine = new TelemetryEngine();
