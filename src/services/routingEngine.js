const { db, transaction } = require('../db/database');
const { logLeadEvent, logAuditEvent } = require('../middleware/audit');

const CURRENT_RULE_VERSION = 'RULE-v2.4-AUTO';

/**
 * Evaluate all eligible connector partners for a given lead
 * @param {Object} lead - Lead record with requested_amount, city, state, product_id
 * @param {Array<number>} excludePartnerIds - Partner IDs to exclude (e.g. already offered/declined/timed out)
 * @returns {Object} Evaluation result with candidates, scores, and disqualifications
 */
function evaluateEligiblePartners(lead, excludePartnerIds = []) {
  const excludeSet = new Set(excludePartnerIds.map(Number));

  // Fetch product category
  const product = db.prepare('SELECT * FROM loan_products WHERE id=?').get(lead.product_id);
  if (!product) {
    return {
      ruleVersion: CURRENT_RULE_VERSION,
      candidates: [],
      disqualified: [],
      error: 'Invalid or missing loan product'
    };
  }

  // Fetch all partners
  const partners = db.prepare('SELECT * FROM partners ORDER BY id').all();
  const candidates = [];
  const disqualified = [];

  for (const partner of partners) {
    const reasons = [];

    // Check exclusion list
    if (excludeSet.has(partner.id)) {
      reasons.push('Partner previously assigned, timed out, or declined this lead');
    }

    // Check approval status
    if (partner.status !== 'Approved') {
      reasons.push(`Partner status is '${partner.status}' (requires Approved)`);
    }

    // Check product authorization
    const authProducts = (partner.authorized_products || '').split(',').map(s => s.trim().toLowerCase());
    const leadCategory = (product.category || '').toLowerCase();
    const isProductAuthorized = authProducts.some(p => leadCategory.includes(p) || p.includes(leadCategory) || p === 'all');
    if (!isProductAuthorized) {
      reasons.push(`Not authorized for category '${product.category}'`);
    }

    // Check territory coverage
    const partnerTerritories = (partner.territory || '').split(',').map(s => s.trim().toLowerCase());
    const leadState = (lead.state || '').toLowerCase();
    const leadCity = (lead.city || '').toLowerCase();
    const isTerritoryMatched = partnerTerritories.some(t => 
      t === 'india' || t === 'all india' || t === leadState || t === leadCity
    );
    if (!isTerritoryMatched) {
      reasons.push(`Territory '${partner.territory}' does not cover ${lead.city}, ${lead.state}`);
    }

    // Check capacity limit
    if (partner.active_leads_count >= partner.capacity_limit) {
      reasons.push(`At maximum capacity (${partner.active_leads_count}/${partner.capacity_limit} active leads)`);
    }

    if (reasons.length > 0) {
      disqualified.push({
        partnerId: partner.id,
        partnerName: partner.name,
        reasons
      });
      continue;
    }

    // Candidate is eligible! Calculate suitability score (0 - 100)
    let score = 0;
    
    // 1. Tier score (Max 30)
    if (partner.tier.includes('Platinum') || partner.tier.includes('Tier 1')) score += 30;
    else if (partner.tier.includes('Gold') || partner.tier.includes('Tier 2')) score += 20;
    else score += 10;

    // 2. Capacity headroom score (Max 40)
    const headroomRatio = Math.max(0, (partner.capacity_limit - partner.active_leads_count) / partner.capacity_limit);
    score += Math.round(headroomRatio * 40);

    // 3. Proximity score (Max 30)
    if (partnerTerritories.includes(leadCity)) score += 30;
    else if (partnerTerritories.includes(leadState)) score += 20;
    else score += 10;

    candidates.push({
      partnerId: partner.id,
      partnerName: partner.name,
      tier: partner.tier,
      territory: partner.territory,
      activeLeads: partner.active_leads_count,
      capacityLimit: partner.capacity_limit,
      score
    });
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  return {
    ruleVersion: CURRENT_RULE_VERSION,
    leadId: lead.id,
    productCategory: product.category,
    leadLocation: `${lead.city}, ${lead.state}`,
    candidates,
    disqualified,
    recommendedPartner: candidates.length > 0 ? candidates[0] : null
  };
}

/**
 * Dispatch an offer to a partner inside an atomic transaction enforcing concurrency & capacity limits
 */
function dispatchLeadOffer({
  leadId,
  partnerId,
  routingMethod = 'Priority',
  assignedBy = 'system',
  ruleVersion = CURRENT_RULE_VERSION,
  evaluationTrace = null
}) {
  return transaction((dbSync) => {
    const lead = dbSync.prepare('SELECT * FROM leads WHERE id=?').get(leadId);
    if (!lead) throw new Error('Lead not found');

    // Consent Verification Guard
    const activeConsent = dbSync.prepare(`
      SELECT id, consent_version, expires_at 
      FROM consent_receipts 
      WHERE customer_id = ? AND status = 'Active' AND expires_at > ?
      ORDER BY id DESC LIMIT 1
    `).get(lead.customer_id, new Date().toISOString());

    if (!activeConsent) {
      throw new Error('Customer consent verification failed: Valid active consent is mandatory before lead routing');
    }

    // Capacity & Status Check on Partner with lock
    const partner = dbSync.prepare('SELECT * FROM partners WHERE id=?').get(partnerId);
    if (!partner) throw new Error('Selected partner organization not found');
    if (partner.status !== 'Approved') {
      throw new Error(`Partner '${partner.name}' is not in Approved status (${partner.status})`);
    }

    // Strict real-time capacity check
    if (partner.active_leads_count >= partner.capacity_limit) {
      throw new Error(`Partner '${partner.name}' has reached its maximum capacity limit (${partner.active_leads_count}/${partner.capacity_limit})`);
    }

    // Default offer timeout: 24 hours
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Update lead record
    dbSync.prepare(`
      UPDATE leads 
      SET status = 'Offered', 
          assigned_partner_id = ?, 
          offer_sent_at = ?, 
          offer_expires_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(partnerId, now.toISOString(), expiresAt, now.toISOString(), leadId);

    // Increment partner active leads count
    dbSync.prepare('UPDATE partners SET active_leads_count = active_leads_count + 1 WHERE id=?').run(partnerId);

    // Build comprehensive candidate scores & trace payload
    const traceJson = JSON.stringify({
      ruleVersion,
      routingMethod,
      assignedAt: now.toISOString(),
      acceptanceDeadline: expiresAt,
      consentVersionUsed: activeConsent.consent_version,
      candidates: evaluationTrace?.candidates || [],
      disqualified: evaluationTrace?.disqualified || []
    });

    // Record assignment audit record
    dbSync.prepare(`
      INSERT INTO lead_assignments (
        lead_id, partner_id, rule_version_id, routing_method,
        candidate_scores_json, assigned_by, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Offered', ?)
    `).run(
      leadId,
      partnerId,
      ruleVersion,
      routingMethod,
      traceJson,
      assignedBy,
      now.toISOString()
    );

    return {
      ok: true,
      leadId,
      partnerId,
      partnerName: partner.name,
      offerSentAt: now.toISOString(),
      offerExpiresAt: expiresAt,
      ruleVersion
    };
  });
}

/**
 * Detect expired offers and safely reroute to next eligible partner with full traceability
 */
function processExpiredOffers() {
  const now = new Date().toISOString();
  const expiredLeads = db.prepare(`
    SELECT * FROM leads 
    WHERE status = 'Offered' AND offer_expires_at IS NOT NULL AND offer_expires_at <= ?
  `).all(now);

  const results = [];

  for (const lead of expiredLeads) {
    try {
      const outcome = transaction((dbSync) => {
        const formerPartnerId = lead.assigned_partner_id;

        // 1. Mark active assignment as Timed Out
        dbSync.prepare(`
          UPDATE lead_assignments 
          SET status = 'Timed Out' 
          WHERE lead_id = ? AND partner_id = ? AND status = 'Offered'
        `).run(lead.id, formerPartnerId);

        // 2. Decrement former partner's active leads count
        if (formerPartnerId) {
          dbSync.prepare('UPDATE partners SET active_leads_count = MAX(0, active_leads_count - 1) WHERE id=?').run(formerPartnerId);
        }

        // 3. Log Offer Timed Out event
        logLeadEvent({
          leadId: lead.id,
          actorUsername: 'system_sla_worker',
          actorRole: 'system',
          fromStatus: 'Offered',
          toStatus: 'Offered (Expired)',
          actionName: 'offer_sla_timed_out',
          notes: `Offer to Partner #${formerPartnerId} expired past 24h SLA deadline`,
          reasonCode: 'SLA_TIMEOUT'
        });

        // 4. Find all previously offered partners for this lead to avoid looping
        const priorAssignments = dbSync.prepare('SELECT partner_id FROM lead_assignments WHERE lead_id = ?').all(lead.id);
        const excludedPartnerIds = priorAssignments.map(a => a.partner_id);

        // 5. Evaluate next eligible candidate
        const evalResult = evaluateEligiblePartners(lead, excludedPartnerIds);

        if (evalResult.recommendedPartner) {
          const nextPartner = evalResult.recommendedPartner;
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

          // Re-offer to next candidate
          dbSync.prepare(`
            UPDATE leads 
            SET status = 'Offered',
                assigned_partner_id = ?,
                offer_sent_at = ?,
                offer_expires_at = ?,
                updated_at = ?
            WHERE id = ?
          `).run(nextPartner.partnerId, now, expiresAt, now, lead.id);

          dbSync.prepare('UPDATE partners SET active_leads_count = active_leads_count + 1 WHERE id=?').run(nextPartner.partnerId);

          const traceJson = JSON.stringify({
            ruleVersion: CURRENT_RULE_VERSION,
            routingMethod: 'Auto Fallback Reroute',
            assignedAt: now,
            acceptanceDeadline: expiresAt,
            candidates: evalResult.candidates,
            disqualified: evalResult.disqualified
          });

          dbSync.prepare(`
            INSERT INTO lead_assignments (
              lead_id, partner_id, rule_version_id, routing_method,
              candidate_scores_json, assigned_by, status, created_at
            ) VALUES (?, ?, ?, 'Priority', ?, 'system_reroute', 'Offered', ?)
          `).run(lead.id, nextPartner.partnerId, CURRENT_RULE_VERSION, traceJson, now);

          logLeadEvent({
            leadId: lead.id,
            actorUsername: 'system_sla_worker',
            actorRole: 'system',
            fromStatus: 'Offered (Expired)',
            toStatus: 'Offered',
            actionName: 'auto_fallback_dispatched',
            notes: `Rerouted to next candidate '${nextPartner.partnerName}' (Score: ${nextPartner.score})`,
            reasonCode: 'FALLBACK_REROUTE'
          });

          return { leadId: lead.id, rerouted: true, newPartnerId: nextPartner.partnerId, newPartnerName: nextPartner.partnerName };
        } else {
          // No remaining candidates: reset lead to Eligible for manual operator intervention
          dbSync.prepare(`
            UPDATE leads 
            SET status = 'Eligible',
                assigned_partner_id = null,
                offer_sent_at = null,
                offer_expires_at = null,
                updated_at = ?
            WHERE id = ?
          `).run(now, lead.id);

          logLeadEvent({
            leadId: lead.id,
            actorUsername: 'system_sla_worker',
            actorRole: 'system',
            fromStatus: 'Offered (Expired)',
            toStatus: 'Eligible',
            actionName: 'returned_to_network_pool',
            notes: 'No alternative eligible partners available; returned to network pool',
            reasonCode: 'NO_CANDIDATES_AVAILABLE'
          });

          return { leadId: lead.id, rerouted: false, status: 'Eligible' };
        }
      });

      results.push(outcome);
    } catch (err) {
      console.warn(`Error processing expired lead #${lead.id}:`, err.message);
    }
  }

  return results;
}

module.exports = {
  CURRENT_RULE_VERSION,
  evaluateEligiblePartners,
  dispatchLeadOffer,
  processExpiredOffers
};
