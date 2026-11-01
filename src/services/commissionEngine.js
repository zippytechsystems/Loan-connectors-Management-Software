const { db, transaction } = require('../db/database');

/**
 * Calculate commission for a lead based on an effective-date-versioned plan
 */
function calculateCommission({ leadId, triggerEvent = 'Disbursed', planId = null, asOfDate = null }) {
  const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(leadId);
  if (!lead) throw new Error('Lead not found');

  const effectiveDateThreshold = asOfDate || lead.updated_at || lead.created_at || new Date().toISOString();

  // Find plan matching the trigger event and effective date
  let plan = null;
  if (planId) {
    plan = db.prepare('SELECT * FROM commission_plans WHERE id=?').get(planId);
  } else {
    plan = db.prepare(`
      SELECT * FROM commission_plans 
      WHERE trigger_event = ? AND is_active = 1 AND effective_date <= ? 
      ORDER BY effective_date DESC, id DESC LIMIT 1
    `).get(triggerEvent, effectiveDateThreshold.slice(0, 10));

    // Fallback to latest active plan if no historical effective date matches
    if (!plan) {
      plan = db.prepare('SELECT * FROM commission_plans WHERE trigger_event = ? AND is_active = 1 ORDER BY id DESC LIMIT 1').get(triggerEvent);
    }
  }

  // Fallback default if no explicit plan is found in catalog
  if (!plan) {
    plan = {
      id: 0,
      name: 'Default Fallback 1.25% Plan',
      version: 'v1.0-FALLBACK',
      plan_type: 'Percentage',
      rules_config_json: JSON.stringify({ rate: 1.25 }),
      trigger_event: triggerEvent,
      holdback_percent: 10,
      cap_amount: 150000
    };
  }

  const rules = JSON.parse(plan.rules_config_json || '{}');
  const basisAmount = lead.disbursed_amount > 0 ? lead.disbursed_amount : lead.requested_amount;
  let gross = 0;
  let rateApplied = null;

  switch (plan.plan_type) {
    case 'Fixed': {
      gross = Number(rules.fixedAmount || 5000);
      rateApplied = 'Fixed';
      break;
    }
    case 'Percentage': {
      const rate = Number(rules.rate || 1.25);
      rateApplied = `${rate}%`;
      gross = Math.round((basisAmount * rate) / 100);
      break;
    }
    case 'Tiered Slabs': {
      const slabs = rules.slabs || [
        { max: 1000000, rate: 1.0 },
        { max: 5000000, rate: 1.5 },
        { max: 999999999, rate: 2.0 }
      ];
      let matchedRate = 1.0;
      for (const slab of slabs) {
        if (basisAmount <= slab.max) {
          matchedRate = slab.rate;
          break;
        }
      }
      rateApplied = `Tiered (${matchedRate}%)`;
      gross = Math.round((basisAmount * matchedRate) / 100);
      break;
    }
    case 'Referral Split': {
      const totalRate = Number(rules.baseRate || 1.5);
      const partnerShare = Number(rules.partnerSharePercent || 70);
      const totalPool = (basisAmount * totalRate) / 100;
      rateApplied = `Split (${totalRate}% pool @ ${partnerShare}% share)`;
      gross = Math.round((totalPool * partnerShare) / 100);
      break;
    }
    default:
      rateApplied = '1.0%';
      gross = Math.round((basisAmount * 1.0) / 100);
  }

  const preCapGross = gross;
  // Apply cap if defined
  let capApplied = false;
  if (plan.cap_amount > 0 && gross > plan.cap_amount) {
    gross = plan.cap_amount;
    capApplied = true;
  }

  // Calculate holdback
  const holdbackPercent = plan.holdback_percent || 0;
  const holdbackAmount = Math.round((gross * holdbackPercent) / 100);
  const netPayable = gross - holdbackAmount;

  return {
    planId: plan.id,
    planName: plan.name,
    planVersion: plan.version,
    planType: plan.plan_type,
    basisAmount,
    grossAmount: gross,
    holdbackPercent,
    holdbackAmount,
    netPayable,
    calculationTrace: {
      planType: plan.plan_type,
      rateApplied,
      basisAmount,
      preCapGross,
      capAmount: plan.cap_amount,
      capApplied,
      holdbackPercent,
      holdbackAmount,
      netPayable
    }
  };
}

/**
 * Post an immutable commission ledger entry with retry idempotency protection
 */
function postCommissionEntry({ leadId, partnerId, triggerEvent, calculatedData }) {
  return transaction((dbSync) => {
    // Retry Idempotency: Check if an active commission entry already exists for this lead and trigger
    const existing = dbSync.prepare(`
      SELECT * FROM commission_ledger 
      WHERE lead_id = ? AND partner_id = ? AND trigger_event = ? AND status != 'Reversed'
    `).get(leadId, partnerId, triggerEvent);

    if (existing) {
      return {
        ledgerCode: existing.ledger_code,
        status: existing.status,
        netPayable: existing.net_payable,
        isIdempotentRetry: true
      };
    }

    const ledgerCode = `COM-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();

    dbSync.prepare(`
      INSERT INTO commission_ledger (
        ledger_code, lead_id, partner_id, trigger_event,
        gross_amount, holdback_amount, net_payable,
        status, plan_version_applied, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Accrued', ?, ?)
    `).run(
      ledgerCode,
      leadId,
      partnerId,
      triggerEvent,
      calculatedData.grossAmount,
      calculatedData.holdbackAmount,
      calculatedData.netPayable,
      calculatedData.planVersion,
      now
    );

    return {
      ledgerCode,
      status: 'Accrued',
      netPayable: calculatedData.netPayable,
      isIdempotentRetry: false
    };
  });
}

/**
 * Post an append-only reversal / clawback entry linking to the original entry by reference
 * Historical financial amounts on the original row are strictly preserved.
 */
function postReversalEntry({ originalLedgerId, actorUsername, reason }) {
  return transaction((dbSync) => {
    const orig = dbSync.prepare('SELECT * FROM commission_ledger WHERE id=?').get(originalLedgerId);
    if (!orig) throw new Error('Original commission ledger entry not found');

    if (orig.status === 'Reversed') {
      throw new Error(`Ledger entry '${orig.ledger_code}' has already been reversed`);
    }

    const reversalCode = `REV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();

    // Update status and audit note on original entry without changing historical financial amounts
    dbSync.prepare(`
      UPDATE commission_ledger 
      SET status = 'Reversed', reversal_reason = ?, settled_at = ? 
      WHERE id = ?
    `).run(reason, now, originalLedgerId);

    // Insert append-only offsetting entry referencing original ledger row
    dbSync.prepare(`
      INSERT INTO commission_ledger (
        ledger_code, lead_id, partner_id, trigger_event,
        gross_amount, holdback_amount, net_payable,
        status, plan_version_applied, payout_reference, 
        approved_by, reversal_reason, created_at, settled_at,
        original_ledger_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Reversed', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reversalCode,
      orig.lead_id,
      orig.partner_id,
      `Clawback: ${orig.trigger_event}`,
      -orig.gross_amount,
      -orig.holdback_amount,
      -orig.net_payable,
      orig.plan_version_applied,
      `CLAWBACK_OF_${orig.ledger_code}`,
      actorUsername,
      reason,
      now,
      now,
      orig.id
    );

    return {
      reversalCode,
      originalLedgerCode: orig.ledger_code,
      reversedAmount: orig.net_payable,
      originalLedgerId: orig.id
    };
  });
}

module.exports = {
  calculateCommission,
  postCommissionEntry,
  postReversalEntry
};
