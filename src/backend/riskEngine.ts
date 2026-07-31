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

    // Helper to check if a specific risk rule is enabled in system settings
    const isRuleEnabled = (ruleId: string): { enabled: boolean; value: number } => {
      const found = activeRiskRules.find((r) => r.id === ruleId);
      return {
        enabled: found ? found.isEnabled : true,
        value: found ? Number(found.value) : 0,
      };
    };

    // Rule 1: Data Quality & Data Freshness (STALE_DATA)
    const MAX_TICK_AGE_MS = 5000;
    if (!dataQuality.isConnected) {
      failedRules.push({
        ruleId: 'stale_data_disconnected',
        name: 'اتصال متاتریدر',
        reason: 'اتصال متاتریدر ۵ یا پل ارتباطی قطعی دارد.',
        threshold: 'Connected',
        actual: 'Disconnected',
      });
    } else if (dataQuality.lastTickAgeMs > MAX_TICK_AGE_MS) {
      failedRules.push({
        ruleId: 'stale_data_age',
        name: 'تازه بودن داده‌ها (Data Freshness)',
        reason: `سن داده‌های آخرین تیک (${(dataQuality.lastTickAgeMs / 1000).toFixed(1)} ثانیه) بیش از حد مجاز 5 ثانیه است.`,
        threshold: `${MAX_TICK_AGE_MS}ms`,
        actual: `${dataQuality.lastTickAgeMs}ms`,
      });
    } else {
      passedRules.push('stale_data_check');
    }

    // Rule 2: Spread Limit (ABNORMAL_SPREAD)
    const maxSpreadLimit = 5.0; // Max allowed spread for XAUUSD (5.0 points / $5)
    if (market.spread > maxSpreadLimit) {
      failedRules.push({
        ruleId: 'abnormal_spread',
        name: 'اسپرد غیرعادی نماد',
        reason: `اسپرد فعلی (${market.spread}) بیش از حد مجاز (${maxSpreadLimit}) است.`,
        threshold: maxSpreadLimit,
        actual: market.spread,
      });
    } else {
      passedRules.push('abnormal_spread');
    }

    // Rule 3: Account Drawdown Limit (MAX_DRAWDOWN)
    const maxDrawdownRule = isRuleEnabled('max_daily_loss');
    if (maxDrawdownRule.enabled && maxDrawdownRule.value > 0) {
      const currentDrawdownPct = account.drawdown || 0;
      if (currentDrawdownPct >= maxDrawdownRule.value) {
        failedRules.push({
          ruleId: 'max_daily_loss',
          name: 'سقف افت حساب (Drawdown Limit)',
          reason: `افت حساب جاری (${currentDrawdownPct.toFixed(2)}%) بیش از سقف مجاز (${maxDrawdownRule.value}%) است.`,
          threshold: `${maxDrawdownRule.value}%`,
          actual: `${currentDrawdownPct.toFixed(2)}%`,
        });
      } else {
        passedRules.push('max_daily_loss');
      }
    }

    // Rule 4: Maximum Open Positions (MAX_OPEN_POSITIONS)
    const maxPositionsRule = isRuleEnabled('max_open_positions');
    const maxAllowedPositions = maxPositionsRule.enabled ? maxPositionsRule.value : 2;

    if (proposedOrder && proposedOrder.type !== 'CLOSE' && proposedOrder.type !== 'CLOSE_ALL') {
      if (positions.length >= maxAllowedPositions) {
        failedRules.push({
          ruleId: 'max_open_positions',
          name: 'سقف پوزیشن‌های همزمان باز',
          reason: `تعداد پوزیشن‌های باز (${positions.length}) به حداکثر مجاز (${maxAllowedPositions}) رسیده است.`,
          threshold: maxAllowedPositions,
          actual: positions.length,
        });
      } else {
        passedRules.push('max_open_positions');
      }
    }

    // Rule 5: Require Stop-Loss (REQUIRE_SL_TP)
    const requireSLRule = isRuleEnabled('require_sl_tp');
    if (proposedOrder && (proposedOrder.type === 'BUY' || proposedOrder.type === 'SELL')) {
      if (requireSLRule.enabled && (!proposedOrder.sl || proposedOrder.sl <= 0)) {
        failedRules.push({
          ruleId: 'require_sl_tp',
          name: 'الزامی بودن حد ضرر (Stop-Loss)',
          reason: 'ارسال معامله بدون تعیین حد ضرر (Stop-Loss) توسط قوانین غیرقابل مذاکره ریسک ممنوع است.',
          threshold: 'SL > 0',
          actual: proposedOrder.sl || 0,
        });
      } else {
        passedRules.push('require_sl_tp');
      }
    }

    // Rule 6: Maximum Lot Size (MAX_LOT_SIZE)
    const maxLotRule = isRuleEnabled('max_lot_size');
    const maxAllowedLot = maxLotRule.enabled && maxLotRule.value > 0 ? maxLotRule.value : 0.1;

    if (proposedOrder && proposedOrder.lot && proposedOrder.lot > maxAllowedLot) {
      failedRules.push({
        ruleId: 'max_lot_size',
        name: 'سقف حجم معامله (Max Lot)',
        reason: `حجم درخواستی (${proposedOrder.lot}) بیش از سقف مجاز (${maxAllowedLot} لات) است.`,
        threshold: maxAllowedLot,
        actual: proposedOrder.lot,
      });
    } else {
      passedRules.push('max_lot_size');
    }

    // Rule 7: Account Margin Health Level
    if (account.margin > 0 && account.marginLevel !== undefined) {
      if (account.marginLevel < 150) {
        failedRules.push({
          ruleId: 'low_margin_level',
          name: 'سطح مارجین بحرانی (Low Margin Level)',
          reason: `سطح مارجین حساب (${account.marginLevel.toFixed(1)}%) کمتر از 150% ایمن است.`,
          threshold: '150%',
          actual: `${account.marginLevel.toFixed(1)}%`,
        });
      } else {
        passedRules.push('low_margin_level');
      }
    }

    // Calculate composite Risk Score (0 = Extremely Safe, 100 = Extremely High Risk)
    let riskScore = 0;

    // Component A: Data Age Risk (0-20)
    const ageRisk = Math.min(20, Math.floor((dataQuality.lastTickAgeMs / MAX_TICK_AGE_MS) * 20));
    riskScore += ageRisk;

    // Component B: Spread & Volatility Risk (0-20)
    const spreadRisk = Math.min(20, Math.floor((market.spread / maxSpreadLimit) * 20));
    riskScore += spreadRisk;

    // Component C: Account Drawdown Risk (0-30)
    const drawdownPct = account.drawdown || 0;
    const drawdownRisk = Math.min(30, Math.floor((drawdownPct / (maxDrawdownRule.value || 3)) * 30));
    riskScore += drawdownRisk;

    // Component D: Position Saturation Risk (0-30)
    const posRatio = positions.length / Math.max(1, maxAllowedPositions);
    const posRisk = Math.min(30, Math.floor(posRatio * 30));
    riskScore += posRisk;

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
