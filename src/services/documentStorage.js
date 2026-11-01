const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config');
const { db } = require('../db/database');
const { logAuditEvent } = require('../middleware/audit');
const { isTenantAuthorizedForLead } = require('../middleware/auth');
const { KEY_REGISTRY } = require('./piiMasker');

// Ensure vault directory exists
fs.mkdirSync(config.STORAGE_DIR, { recursive: true });

/**
 * Malware Scanner Adapter Interface
 * NOTE: SimulationMalwareAdapter is a sandboxed simulation for local and test use.
 * In a production deployment, replace with a real antivirus daemon adapter (e.g. ClamAV ICAP stream).
 */
class SimulationMalwareAdapter {
  scan(fileBuffer, originalName) {
    const contentStr = fileBuffer.toString('utf8');
    // Check EICAR standard test signature
    if (contentStr.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      return {
        clean: false,
        status: 'Quarantined',
        threat: 'EICAR_STANDARD_TEST_FILE_DETECTED',
        isSimulation: true
      };
    }

    // Check executable MZ headers or script payloads
    if (fileBuffer.length >= 2 && fileBuffer[0] === 0x4D && fileBuffer[1] === 0x5A) {
      return {
        clean: false,
        status: 'Quarantined',
        threat: 'EXECUTABLE_BINARY_PE_HEADER',
        isSimulation: true
      };
    }

    const lowerName = originalName.toLowerCase();
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.ps1', '.scr', '.dll', '.msi'];
    if (dangerousExts.some(ext => lowerName.endsWith(ext))) {
      return {
        clean: false,
        status: 'Quarantined',
        threat: 'SUSPICIOUS_EXECUTABLE_EXTENSION',
        isSimulation: true
      };
    }

    return {
      clean: true,
      status: 'Clean',
      threat: null,
      isSimulation: true
    };
  }
}

let activeMalwareScanner = new SimulationMalwareAdapter();

function setMalwareScanner(scanner) {
  if (scanner && typeof scanner.scan === 'function') {
    activeMalwareScanner = scanner;
  }
}

/**
 * Sanitize original filename to prevent path traversal or unsafe characters
 */
function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return 'document.pdf';
  const basename = path.basename(fileName);
  return basename.replace(/[^a-zA-Z0-9._\- ]/g, '_').slice(0, 100);
}

/**
 * Validate declared MIME type against file magic bytes
 */
function validateFileSignature(buffer, declaredMime) {
  if (!buffer || buffer.length < 4) {
    throw new Error('File content is empty or corrupted');
  }

  // PDF magic bytes: %PDF (% = 0x25, P = 0x50, D = 0x44, F = 0x46)
  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

  // PNG magic bytes: 0x89 0x50 0x4E 0x47
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

  // JPEG magic bytes: 0xFF 0xD8 0xFF
  const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

  if (declaredMime === 'application/pdf' && !isPdf) {
    throw new Error('File signature does not match declared PDF format');
  }
  if (declaredMime === 'image/png' && !isPng) {
    throw new Error('File signature does not match declared PNG image format');
  }
  if ((declaredMime === 'image/jpeg' || declaredMime === 'image/jpg') && !isJpg) {
    throw new Error('File signature does not match declared JPEG image format');
  }

  // If MIME is octet-stream or generic, infer from magic bytes if possible
  if (isPdf) return 'application/pdf';
  if (isPng) return 'image/png';
  if (isJpg) return 'image/jpeg';
  return declaredMime || 'application/pdf';
}

/**
 * Encrypt file buffer with AES-256-GCM before writing to storage vault
 */
function encryptFileBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_REGISTRY.v1.encKey, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Binary format: [12-byte IV][16-byte Auth Tag][Encrypted Data]
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt file buffer with AES-256-GCM when retrieving from storage vault
 */
function decryptFileBuffer(rawDiskBuffer) {
  if (rawDiskBuffer.length < 28) {
    // Legacy unencrypted file fallback
    return rawDiskBuffer;
  }
  try {
    const iv = rawDiskBuffer.subarray(0, 12);
    const authTag = rawDiskBuffer.subarray(12, 28);
    const encrypted = rawDiskBuffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_REGISTRY.v1.encKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch (err) {
    // If decryption fails, check if file was written in legacy unencrypted format
    return rawDiskBuffer;
  }
}

/**
 * Store a document file in private vault with encryption at rest, opaque key, and checksum
 */
function storeKYCDocument({
  leadId,
  documentType,
  originalName,
  fileBuffer,
  mimeType = 'application/pdf',
  actorUsername = 'system'
}) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('A valid file buffer is required');
  }

  // Size limit validation (10 MB max)
  const maxBytes = config.MAX_DOC_SIZE_BYTES || 10 * 1024 * 1024;
  if (fileBuffer.length > maxBytes) {
    throw new Error(`File size (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit of 10 MB`);
  }

  // Safe filename and MIME signature validation
  const safeName = sanitizeFileName(originalName);
  const validatedMime = validateFileSignature(fileBuffer, mimeType);

  const opaqueKey = crypto.randomUUID();
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const targetPath = path.join(config.STORAGE_DIR, `${opaqueKey}.vault`);

  // Scan file for malware
  const scanResult = activeMalwareScanner.scan(fileBuffer, safeName);
  const malwareStatus = scanResult.clean ? 'Clean' : 'Quarantined';

  // Encrypt file at rest using AES-256-GCM
  const encryptedPayload = encryptFileBuffer(fileBuffer);
  fs.writeFileSync(targetPath, encryptedPayload);

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO kyc_documents (
      lead_id, document_type, opaque_key, original_name,
      file_size, mime_type, malware_status, sha256_checksum, uploaded_at,
      is_encrypted, encryption_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'v1')
  `);
  stmt.run(
    leadId,
    documentType,
    opaqueKey,
    safeName,
    fileBuffer.length,
    validatedMime,
    malwareStatus,
    sha256,
    now
  );

  logAuditEvent({
    actorUsername,
    actorRole: 'system',
    eventType: 'DOCUMENT_UPLOADED',
    resourceType: 'kyc_document',
    resourceId: opaqueKey,
    actionSummary: `Uploaded ${documentType} for Lead #${leadId} (Encrypted at rest, Status: ${malwareStatus})`,
    details: {
      opaqueKey,
      sha256,
      malwareStatus,
      fileSize: fileBuffer.length,
      mimeType: validatedMime
    }
  });

  return {
    opaqueKey,
    documentType,
    originalName: safeName,
    malwareStatus,
    sha256,
    fileSize: fileBuffer.length
  };
}

/**
 * Generate a short-lived signed access token for secure download (Valid for 15 mins)
 * Includes leadId in payload for authorization rechecking
 */
function generateDocumentAccessToken(opaqueKey, username, leadId) {
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const payload = `${opaqueKey}:${username}:${leadId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', config.SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Verify signed token, recheck tenant authorization, and stream decrypted document from private vault
 */
function retrieveKYCDocument(token, requestingUser = null, actorIp = '127.0.0.1') {
  if (!token) throw new Error('Document access token required');
  let decoded = '';
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch (e) {
    throw new Error('Malformed document token');
  }

  const parts = decoded.split(':');
  if (parts.length < 4) {
    throw new Error('Invalid token structure');
  }

  const [opaqueKey, tokenUsername, leadIdStr, expiresAtStr, signature] = parts.length === 5 
    ? parts 
    : [parts[0], parts[1], null, parts[2], parts[3]]; // Support legacy 4-part token

  const expiresAt = Number(expiresAtStr || parts[2]);
  if (Date.now() > expiresAt) {
    throw new Error('Document download token has expired');
  }

  // Validate HMAC signature
  const expectedPayload = parts.length === 5 
    ? `${opaqueKey}:${tokenUsername}:${leadIdStr}:${expiresAtStr}`
    : `${parts[0]}:${parts[1]}:${parts[2]}`;
  const expectedSig = crypto.createHmac('sha256', config.SESSION_SECRET).update(expectedPayload).digest('hex');
  const actualSig = parts[parts.length - 1];

  const bufA = Buffer.from(actualSig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    throw new Error('Invalid token signature');
  }

  const doc = db.prepare('SELECT * FROM kyc_documents WHERE opaque_key=?').get(opaqueKey);
  if (!doc) throw new Error('Document record not found');

  if (doc.malware_status === 'Quarantined') {
    throw new Error('Document is quarantined due to security scanning policy violation');
  }

  // Tenant authorization recheck against lead
  if (requestingUser) {
    const lead = db.prepare('SELECT * FROM leads WHERE id=?').get(doc.lead_id);
    if (!lead || !isTenantAuthorizedForLead(requestingUser, lead)) {
      throw new Error('Tenant unauthorized: Access to this document is forbidden');
    }
  }

  const filePath = path.join(config.STORAGE_DIR, `${opaqueKey}.vault`);
  if (!fs.existsSync(filePath)) {
    throw new Error('File missing in vault storage');
  }

  const rawDiskData = fs.readFileSync(filePath);
  const decryptedData = decryptFileBuffer(rawDiskData);

  // Audit document access without logging PII
  logAuditEvent({
    actorUsername: requestingUser?.username || tokenUsername || 'token_requester',
    actorRole: requestingUser?.role || 'authorized_reader',
    actorIp,
    eventType: 'DOCUMENT_DOWNLOADED',
    resourceType: 'kyc_document',
    resourceId: opaqueKey,
    actionSummary: `Downloaded ${doc.document_type} for Lead #${doc.lead_id}`,
    details: { opaqueKey, documentType: doc.document_type, fileSize: doc.file_size }
  });

  return {
    doc,
    fileBuffer: decryptedData,
    mimeType: doc.mime_type,
    fileName: doc.original_name
  };
}

module.exports = {
  storeKYCDocument,
  generateDocumentAccessToken,
  retrieveKYCDocument,
  setMalwareScanner,
  SimulationMalwareAdapter,
  sanitizeFileName,
  validateFileSignature
};
