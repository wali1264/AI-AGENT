import {
  UnifiedSnapshot,
  TradeOrder,
  RiskRule,
  RiskAssessmentResult,
  RiskFailedRule,
} from '../types.js';

export class RiskEngine {
  /**
   * Main entry point: Performs full Risk Engine assessment on a UnifiedSnapshot and optional order context.
   * All rules, thresholds, and master switches are fully customized via activeRiskRules.
   */
  public evaluateRisk(
    snapshot: UnifiedSnapshot,
    activeRiskRules: RiskRule[],
    proposedOrder?: Partial<TradeOrder>
  ): RiskAssessmentResult {
    const passedRules: string[] = [];
    const failedRules: RiskFailedRule[] = [];

    const account = snapshot.account;
    const market = snapshot.market;
    const dataQuality = snapshot.dataQuality;
    const positions = snapshot.positions || [];

    // Helper to check rule status and values dynamically from activeRiskRules
    const getRule = (ruleId: string, defaultValue: number, defaultEnabled: boolean = true) => {
      const found = activeRiskRules.find((r) => r.id === ruleId);
      return {
        enabled: found ? found.isEnabled : defaultEnabled,
        value: found ? Number(found.value) : defaultValue,
        name: found?.name || ruleId,
      };
    };

    // Master Switch: Check if Risk Engine monitoring is globally enabled
    const masterGuard = getRule('enable_risk_guard', 0, false);
    if (!masterGuard.enabled) {
      return {
        isAllowed: true,
        riskScore: 0,
        passedRules: ['master_guard_disabled_by_user'],
        failedRules: [],
        maxAllowedLot: 100,
        recommendation: 'PROCEED',
        evaluatedAt: new Date().toISOString(),
      };
    }

    // Rule 1: Data Quality & Connection Status
    if (!dataQuality.isConnected) {
      failedRules.push({
        ruleId: 'stale_data_disconnected',
        name: 'اتصال متاتریدر',
        reason: 'اتصال متاتریدر ۵ یا پل ارتباطی قطعی دارد.',
        threshold: 'Connected',
        actual: 'Disconnected',
      });
    } else {
      passedRules.push('stale_data_disconnected');
    }

    // Rule 2: Tick Freshness (Customizable max_tick_age_ms)
    const tickAgeRule = getRule('max_tick_age_ms', 10000, true);
    if (tickAgeRule.enabled && tickAgeRule.value > 0) {
      if (dataQuality.lastTickAgeMs > tickAgeRule.value) {
        failedRules.push({
          ruleId: 'max_tick_age_ms',
          name: tickAgeRule.name,
          reason: `سن داده‌های آخرین تیک (${(dataQuality.lastTickAgeMs / 1000).toFixed(1)} ثانیه) بیش از سقف سفارشی کاربر (${(tickAgeRule.value / 1000).toFixed(1)} ثانیه) است.`,
          threshold: `${tickAgeRule.value}ms`,
          actual: `${dataQuality.lastTickAgeMs}ms`,
        });
      } else {
        passedRules.push('max_tick_age_ms');
      }
    }

    // Rule 3: Spread Limit (Customizable max_spread_limit)
    const spreadRule = getRule('max_spread_limit', 50, true);
    if (spreadRule.enabled && spreadRule.value > 0) {
      if (market.spread > spreadRule.value) {
        failedRules.push({
          ruleId: 'max_spread_limit',
          name: spreadRule.name,
          reason: `اسپرد فعلی نماد (${market.spread}) بیش از سقف سفارشی کاربر (${spreadRule.value}) است.`,
          threshold: spreadRule.value,
          actual: market.spread,
        });
      } else {
        passedRules.push('max_spread_limit');
      }
    }

    // Rule 4: Account Drawdown Limit (Customizable max_daily_drawdown / max_daily_loss)
    const drawdownRule = getRule('max_daily_drawdown', 3.0, true);
    if (drawdownRule.enabled && drawdownRule.value > 0) {
      const currentDrawdownPct = account.drawdown || 0;
      if (currentDrawdownPct >= drawdownRule.value) {
        failedRules.push({
          ruleId: 'max_daily_drawdown',
          name: drawdownRule.name,
          reason: `افت حساب جاری (${currentDrawdownPct.toFixed(2)}%) بیش از سقف سفارشی کاربر (${drawdownRule.value}%) است.`,
          threshold: `${drawdownRule.value}%`,
          actual: `${currentDrawdownPct.toFixed(2)}%`,
        });
      } else {
        passedRules.push('max_daily_drawdown');
      }
    }

    // Rule 5: Maximum Open Positions (Customizable max_open_positions)
    const maxPositionsRule = getRule('max_open_positions', 5, true);
    const maxAllowedPositions = maxPositionsRule.enabled ? maxPositionsRule.value : 10;

    if (proposedOrder && proposedOrder.type !== 'CLOSE' && proposedOrder.type !== 'CLOSE_ALL') {
      if (positions.length >= maxAllowedPositions) {
        failedRules.push({
          ruleId: 'max_open_positions',
          name: maxPositionsRule.name,
          reason: `تعداد پوزیشن‌های باز همزمان (${positions.length}) به حداکثر سقف سفارشی کاربر (${maxAllowedPositions}) رسیده است.`,
          threshold: maxAllowedPositions,
          actual: positions.length,
        });
      } else {
        passedRules.push('max_open_positions');
      }
    }

    // Rule 6: Require Stop-Loss (Customizable require_sl_tp)
    const requireSLRule = getRule('require_sl_tp', 1, true);
    if (proposedOrder && (proposedOrder.type === 'BUY' || proposedOrder.type === 'SELL')) {
      if (requireSLRule.enabled && (!proposedOrder.sl || proposedOrder.sl <= 0)) {
        failedRules.push({
          ruleId: 'require_sl_tp',
          name: requireSLRule.name,
          reason: 'ارسال معامله بدون تعیین حد ضرر (Stop-Loss) توسط قانون سفارشی کاربر ممنوع است.',
          threshold: 'SL > 0',
          actual: proposedOrder.sl || 0,
        });
      } else {
        passedRules.push('require_sl_tp');
      }
    }

    // Rule 7: Maximum Lot Size (Customizable max_lot_size)
    const maxLotRule = getRule('max_lot_size', 0.1, true);
    const maxAllowedLot = maxLotRule.enabled && maxLotRule.value > 0 ? maxLotRule.value : 100.0;

    if (proposedOrder && proposedOrder.lot && proposedOrder.lot > maxAllowedLot) {
      failedRules.push({
        ruleId: 'max_lot_size',
        name: maxLotRule.name,
        reason: `حجم درخواستی (${proposedOrder.lot}) بیش از سقف سفارشی کاربر (${maxAllowedLot} لات) است.`,
        threshold: maxAllowedLot,
        actual: proposedOrder.lot,
      });
    } else {
      passedRules.push('max_lot_size');
    }

    // Rule 8: Account Margin Health Level (Customizable min_margin_level)
    const minMarginRule = getRule('min_margin_level', 150, true);
    if (minMarginRule.enabled && account.margin > 0 && account.marginLevel !== undefined) {
      if (account.marginLevel < minMarginRule.value) {
        failedRules.push({
          ruleId: 'min_margin_level',
          name: minMarginRule.name,
          reason: `سطح مارجین حساب (${account.marginLevel.toFixed(1)}%) کمتر از حد آستانه ایمن کاربر (${minMarginRule.value}%) است.`,
          threshold: `${minMarginRule.value}%`,
          actual: `${account.marginLevel.toFixed(1)}%`,
        });
      } else {
        passedRules.push('min_margin_level');
      }
    }

    // Calculate dynamic Composite Risk Score (0 = Completely Safe, 100 = High Risk)
    let riskScore = 0;

    // A. Tick Age Risk
    if (tickAgeRule.enabled && tickAgeRule.value > 0) {
      const ageRatio = dataQuality.lastTickAgeMs / tickAgeRule.value;
      riskScore += Math.min(20, Math.floor(ageRatio * 20));
    }

    // B. Spread Risk
    if (spreadRule.enabled && spreadRule.value > 0) {
      const spreadRatio = market.spread / spreadRule.value;
      riskScore += Math.min(20, Math.floor(spreadRatio * 20));
    }

    // C. Drawdown Risk
    if (drawdownRule.enabled && drawdownRule.value > 0) {
      const ddRatio = (account.drawdown || 0) / drawdownRule.value;
      riskScore += Math.min(30, Math.floor(ddRatio * 30));
    }

    // D. Position Saturation Risk
    if (maxPositionsRule.enabled && maxAllowedPositions > 0) {
      const posRatio = positions.length / maxAllowedPositions;
      riskScore += Math.min(30, Math.floor(posRatio * 30));
    }

    riskScore = Math.min(100, Math.max(0, riskScore));

    const isAllowed = failedRules.length === 0;

    let recommendation: 'PROCEED' | 'REJECT' | 'REDUCE_SIZE' = 'PROCEED';
    if (!isAllowed) {
      recommendation = 'REJECT';
    } else if (riskScore > 65 || (proposedOrder && proposedOrder.lot && proposedOrder.lot > maxAllowedLot * 0.8)) {
      recommendation = 'REDUCE_SIZE';
    }

    return {
      isAllowed,
      riskScore,
      passedRules,
      failedRules,
      maxAllowedLot,
      recommendation,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export const riskEngine = new RiskEngine();
