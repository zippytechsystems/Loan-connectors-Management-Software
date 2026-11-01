/**
 * Idempotency service to guarantee that retried mutation requests produce identical results
 * without duplicate side effects (e.g. duplicate customer creation, double dispatch, duplicate commissions)
 */

function checkIdempotency(db, idempotencyKey, scope) {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') return null;
  const cleanKey = idempotencyKey.trim();
  if (!cleanKey) return null;

  const now = new Date().toISOString();
  const row = db.prepare(`
    SELECT response_code, response_body 
    FROM idempotency_keys 
    WHERE idempotency_key = ? AND scope = ? AND expires_at > ?
  `).get(cleanKey, scope, now);

  if (!row) return null;

  try {
    return {
      found: true,
      statusCode: row.response_code,
      body: JSON.parse(row.response_body)
    };
  } catch (err) {
    return {
      found: true,
      statusCode: row.response_code,
      body: row.response_body
    };
  }
}

function recordIdempotency(db, idempotencyKey, scope, statusCode, body, ttlMinutes = 1440) {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') return;
  const cleanKey = idempotencyKey.trim();
  if (!cleanKey) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
  const bodyJson = typeof body === 'string' ? body : JSON.stringify(body);

  try {
    db.prepare(`
      INSERT INTO idempotency_keys (idempotency_key, scope, response_code, response_body, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(scope, idempotency_key) DO UPDATE SET
        response_code = excluded.response_code,
        response_body = excluded.response_body,
        expires_at = excluded.expires_at
    `).run(cleanKey, scope, statusCode, bodyJson, now.toISOString(), expiresAt);
  } catch (err) {
    console.warn('Notice: Failed to record idempotency entry:', err.message);
  }
}

module.exports = {
  checkIdempotency,
  recordIdempotency
};
