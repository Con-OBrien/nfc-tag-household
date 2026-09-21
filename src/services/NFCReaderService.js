"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NFCReaderService = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * NFCReaderService - Handles NFC tag detection, data extraction, and HMAC signature validation
 * Provides secure validation of NFC tags to prevent spoofing attacks
 * Includes comprehensive error handling, retry logic, and detailed logging
 *
 * Requirements: 1.5, 14.1
 */
class NFCReaderService {
    constructor() {
        this.nfcErrorLog = [];
        this.maxLogSize = 1000;
        this.DEFAULT_SCAN_TIMEOUT_MS = 60000; // 60 seconds
        this.MAX_RETRIES = 3;
        this.RETRY_BACKOFF_MS = [100, 200, 400]; // Exponential backoff
    }
    /**
     * Validates the HMAC signature of NFC tag data to ensure authenticity
     * Uses constant-time comparison to prevent timing attacks
     * Includes comprehensive error handling and logging
     *
     * @param tagData - The NFC tag data to validate
     * @param householdSecret - The household-specific secret key for HMAC
     * @param userId - User ID for context logging
     * @param deviceInfo - Device information for error context
     * @returns object with validation result and error details if validation fails
     *
     * Requirements: 1.3, 14.1, 16.2, 16.5
     */
    validateTagSignature(tagData, householdSecret, userId, deviceInfo) {
        try {
            // If no signature provided, cannot validate
            if (!tagData.signature) {
                const error = this.createNFCError('MISSING_SIGNATURE', 'NFC tag signature is missing. Tag may be corrupted or unsigned.', 'error', { userId, deviceInfo, tagId: tagData.tagId });
                this.logNFCError(error);
                return { isValid: false, error };
            }
            // Create signature data (all fields except signature itself)
            const { signature, ...dataToSign } = tagData;
            const signatureData = this.createSignatureData(dataToSign);
            // Calculate expected HMAC-SHA256
            const expectedSignature = crypto_1.default
                .createHmac('sha256', householdSecret)
                .update(signatureData)
                .digest('hex');
            // Use constant-time comparison to prevent timing attacks
            const isValid = this.constantTimeCompare(signature, expectedSignature);
            if (!isValid) {
                const error = this.createNFCError('INVALID_SIGNATURE', 'NFC tag signature verification failed. Tag may be spoofed or tampered with.', 'error', { userId, deviceInfo, tagId: tagData.tagId });
                this.logNFCError(error);
            }
            return { isValid };
        }
        catch (error) {
            const nfcError = this.createNFCError('SIGNATURE_VALIDATION_ERROR', `Unexpected error during signature validation: ${error instanceof Error ? error.message : String(error)}`, 'error', { userId, deviceInfo, tagId: tagData.tagId, originalError: String(error) });
            this.logNFCError(nfcError);
            return { isValid: false, error: nfcError };
        }
    }
    /**
     * Generates an HMAC signature for NFC tag data
     * Used when creating new NFC tags
     *
     * @param tagData - The NFC tag data to sign
     * @param householdSecret - The household-specific secret key
     * @returns The HMAC-SHA256 signature as hex string
     *
     * Requirements: 16.1, 16.4
     */
    generateTagSignature(tagData, householdSecret) {
        const signatureData = this.createSignatureData(tagData);
        return crypto_1.default
            .createHmac('sha256', householdSecret)
            .update(signatureData)
            .digest('hex');
    }
    /**
     * Extracts and validates NFC tag data with comprehensive error handling
     * Ensures data is properly formatted and contains required fields
     * Includes detailed error messages for different failure modes
     *
     * @param rawTagData - Raw data from NFC tag read
     * @param userId - User ID for context logging
     * @param deviceInfo - Device information for error context
     * @returns object with parsed NFCTagData if valid, error details if validation fails
     *
     * Requirements: 1.2, 1.5, 14.1
     */
    extractTagData(rawTagData, userId, deviceInfo) {
        try {
            // Handle both parsed objects and JSON strings
            let data = rawTagData;
            if (typeof rawTagData === 'string') {
                try {
                    data = JSON.parse(rawTagData);
                }
                catch (parseError) {
                    const error = this.createNFCError('INVALID_JSON', 'NFC tag data contains invalid JSON. Tag may be corrupted.', 'error', { userId, deviceInfo, originalError: String(parseError) });
                    this.logNFCError(error);
                    return { error };
                }
            }
            // Validate required fields
            const validation = this.validateTagData(data, userId, deviceInfo);
            if (!validation.isValid) {
                return { error: validation.error };
            }
            const tagData = {
                tagId: String(data.tagId).trim(),
                taskId: String(data.taskId).trim(),
                timestamp: Number(data.timestamp),
                signature: data.signature ? String(data.signature).trim() : undefined,
            };
            return { data: tagData };
        }
        catch (error) {
            const nfcError = this.createNFCError('EXTRACTION_ERROR', `Unexpected error extracting tag data: ${error instanceof Error ? error.message : String(error)}`, 'error', { userId, deviceInfo, originalError: String(error) });
            this.logNFCError(nfcError);
            return { error: nfcError };
        }
    }
    /**
     * Validates tag data structure with detailed error reporting
     *
     * Requirements: 1.5, 14.1
     */
    validateTagData(data, userId, deviceInfo) {
        if (!data || typeof data !== 'object') {
            const error = this.createNFCError('INVALID_DATA_TYPE', 'NFC tag data must be a valid object.', 'error', { userId, deviceInfo, receivedType: typeof data });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        const obj = data;
        // Check required fields
        if (!obj.tagId) {
            const error = this.createNFCError('MISSING_TAG_ID', 'NFC tag is missing required tagId field.', 'error', { userId, deviceInfo });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        if (!obj.taskId) {
            const error = this.createNFCError('MISSING_TASK_ID', 'NFC tag is missing required taskId field.', 'error', { userId, deviceInfo, tagId: obj.tagId });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        if (!obj.timestamp) {
            const error = this.createNFCError('MISSING_TIMESTAMP', 'NFC tag is missing required timestamp field.', 'error', { userId, deviceInfo, tagId: obj.tagId });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        // Check field types
        if (typeof obj.tagId !== 'string' || obj.tagId.trim().length === 0) {
            const error = this.createNFCError('INVALID_TAG_ID_FORMAT', 'NFC tag tagId must be a non-empty string.', 'error', { userId, deviceInfo, receivedType: typeof obj.tagId });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        if (typeof obj.taskId !== 'string' || obj.taskId.trim().length === 0) {
            const error = this.createNFCError('INVALID_TASK_ID_FORMAT', 'NFC tag taskId must be a non-empty string.', 'error', { userId, deviceInfo, tagId: obj.tagId, receivedType: typeof obj.taskId });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        if (typeof obj.timestamp !== 'number' || !Number.isFinite(obj.timestamp)) {
            const error = this.createNFCError('INVALID_TIMESTAMP_FORMAT', 'NFC tag timestamp must be a valid number.', 'error', { userId, deviceInfo, tagId: obj.tagId, receivedType: typeof obj.timestamp });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        // Timestamp should be recent (within last 5 minutes)
        const now = Date.now();
        const fiveMinutesInMs = 5 * 60 * 1000;
        if (obj.timestamp > now) {
            const error = this.createNFCError('FUTURE_TIMESTAMP', 'NFC tag timestamp is in the future. System clock may be incorrect.', 'warning', { userId, deviceInfo, tagId: obj.tagId, timestamp: obj.timestamp });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        if (now - obj.timestamp > fiveMinutesInMs) {
            const error = this.createNFCError('STALE_TIMESTAMP', 'NFC tag is too old (>5 minutes). Tag may have been read previously.', 'error', { userId, deviceInfo, tagId: obj.tagId, ageMs: now - obj.timestamp });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        // Signature is optional but if provided should be a string
        if (obj.signature && typeof obj.signature !== 'string') {
            const error = this.createNFCError('INVALID_SIGNATURE_FORMAT', 'NFC tag signature must be a string if provided.', 'error', { userId, deviceInfo, tagId: obj.tagId, receivedType: typeof obj.signature });
            this.logNFCError(error);
            return { isValid: false, error };
        }
        return { isValid: true };
    }
    /**
     * Checks if a tag has been deactivated
     * In a real implementation, this would check against a database
     *
     * @param tagId - The tag ID to check
     * @param deactivatedTags - Set of deactivated tag IDs
     * @returns true if tag is active, false if deactivated
     *
     * Requirements: 16.6
     */
    isTagActive(tagId, deactivatedTags) {
        return !deactivatedTags.has(tagId);
    }
    /**
     * Creates a structured NFC error with context
     *
     * Requirements: 14.1
     */
    createNFCError(code, message, severity, context) {
        return {
            code,
            message,
            severity,
            timestamp: Date.now(),
            context,
        };
    }
    /**
     * Logs NFC errors with context for debugging and monitoring
     * Maintains a rolling log of recent errors (max 1000 entries)
     *
     * Requirements: 14.1
     */
    logNFCError(error) {
        this.nfcErrorLog.push(error);
        // Keep log size manageable - remove oldest entries if exceeding max
        if (this.nfcErrorLog.length > this.maxLogSize) {
            this.nfcErrorLog = this.nfcErrorLog.slice(-this.maxLogSize);
        }
        // Log to console with appropriate severity
        const logFn = error.severity === 'critical' ? console.error :
            error.severity === 'error' ? console.error :
                console.warn;
        logFn(`[NFC Error] ${error.code}: ${error.message}`, {
            timestamp: new Date(error.timestamp).toISOString(),
            ...error.context,
        });
    }
    /**
     * Retrieves NFC error log for debugging and monitoring
     * Used for observability and post-incident analysis
     *
     * Requirements: 14.1
     */
    getNFCErrorLog(limit = 100) {
        return this.nfcErrorLog.slice(-limit);
    }
    /**
     * Clears NFC error log (useful for testing)
     *
     * Requirements: 14.1
     */
    clearNFCErrorLog() {
        this.nfcErrorLog = [];
    }
    /**
     * Executes tag reading with timeout and retry logic
     * Implements exponential backoff for transient failures
     *
     * @param readFn - Function that performs the actual NFC read
     * @param timeoutMs - Timeout in milliseconds (default: 60000)
     * @param userId - User ID for context logging
     * @returns Tag data or error
     *
     * Requirements: 14.1
     */
    async readTagWithRetry(readFn, timeoutMs = this.DEFAULT_SCAN_TIMEOUT_MS, userId, deviceInfo) {
        let lastError;
        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                // Execute read with timeout
                const rawData = await Promise.race([
                    readFn(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('NFC read timeout')), timeoutMs)),
                ]);
                // Extract and validate
                return this.extractTagData(rawData, userId, deviceInfo);
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                lastError = this.createNFCError('NFC_READ_FAILED', `NFC read failed (attempt ${attempt + 1}/${this.MAX_RETRIES}): ${errorMsg}`, attempt === this.MAX_RETRIES - 1 ? 'critical' : 'warning', { userId, deviceInfo, attempt: attempt + 1, maxAttempts: this.MAX_RETRIES });
                this.logNFCError(lastError);
                if (attempt < this.MAX_RETRIES - 1) {
                    // Wait before retry with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_BACKOFF_MS[attempt]));
                }
            }
        }
        return { error: lastError };
    }
    /**
     * Creates a consistent signature data string from tag data
     * This is used for both signing and verification
     *
     * @param data - The NFC tag data to create signature data from
     * @returns Formatted string suitable for HMAC
     */
    createSignatureData(data) {
        // Create deterministic string by sorting fields
        // Format: tagId:taskId:timestamp
        return `${data.tagId}:${data.taskId}:${data.timestamp}`;
    }
    /**
     * Constant-time string comparison to prevent timing attacks
     * Compares two strings without revealing their length through timing
     *
     * @param a - First string to compare
     * @param b - Second string to compare
     * @returns true if strings are equal, false otherwise
     *
     * Requirements: 16.5
     */
    constantTimeCompare(a, b) {
        if (a.length !== b.length) {
            // Use a dummy comparison to take consistent time
            try {
                crypto_1.default.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
            }
            catch {
                // Ignore - just used for timing consistency
            }
            return false;
        }
        try {
            return crypto_1.default.timingSafeEqual(Buffer.from(a), Buffer.from(b));
        }
        catch (error) {
            // If comparison fails (shouldn't happen with same length), return false
            return false;
        }
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use the new validateTagSignature with error context instead
     */
    validateTagSignatureLegacy(tagData, householdSecret) {
        const result = this.validateTagSignature(tagData, householdSecret);
        return result.isValid;
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use the new extractTagData with error context instead
     */
    extractTagDataLegacy(rawTagData) {
        const result = this.extractTagData(rawTagData);
        return result.data || null;
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use validateTagData or extractTagData instead
     */
    isValidTagData(data) {
        const result = this.validateTagData(data);
        return result.isValid;
    }
}
exports.NFCReaderService = NFCReaderService;
