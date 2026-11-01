const { db } = require('../db/database');

const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'phone', 'email', 'pan', 
  'filebuffer', 'contentbase64', 'authorization', 'cookie'
];

/**
 * Redact sensitive PII and credential keys from audit details before persistence
 */
function sanitizeAuditDetails(details) {
  if (!details) return null;
  let obj = details;
  if (typeof details === 'string') {
    try {
      obj = JSON.parse(details);
    } catch (e) {
      return details;
    }
  }

  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj);
  }

  const clean = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s));
    if (isSensitive) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = JSON.parse(sanitizeAuditDetails(val));
    } else {
      clean[key] = val;
    }
  }
  return JSON.stringify(clean);
}

/**
 * Record an immutable system audit event without leaking customer PII or credentials
 */
function logAuditEvent({
  actorUsername = 'system',
  actorRole = 'system',
  actorIp = '127.0.0.1',
  eventType,
  resourceType,
  resourceId = null,
  actionSummary,
  details = null
}) {
  try {
    const detailsJson = sanitizeAuditDetails(details);
    const stmt = db.prepare(`
      INSERT INTO audit_events (
        actor_username, actor_role, actor_ip, event_type, 
        resource_type, resource_id, action_summary, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      actorUsername,
      actorRole,
      actorIp,
      eventType,
      resourceType,
      resourceId ? String(resourceId) : null,
      actionSummary,
      detailsJson,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('CRITICAL: Failed to write audit event:', err.message);
  }
}

/**
 * Record an append-only lead lifecycle event
 */
function logLeadEvent({
  leadId,
  actorUsername,
  actorRole,
  fromStatus,
  toStatus,
  actionName,
  notes = '',
  reasonCode = ''
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO lead_events (
        lead_id, actor_username, actor_role, from_status, 
        to_status, action_name, notes, reason_code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      leadId,
      actorUsername,
      actorRole,
      fromStatus,
      toStatus,
      actionName,
      notes,
      reasonCode,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('CRITICAL: Failed to log lead lifecycle event:', err.message);
  }
}

module.exports = {
  logAuditEvent,
  logLeadEvent,
  sanitizeAuditDetails
};
