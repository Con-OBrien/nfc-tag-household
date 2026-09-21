"use strict";
/**
 * Feature Flags Configuration
 * Enables/disables features for graceful degradation and A/B testing
 * Uses Firebase Remote Config for runtime flag updates
 *
 * Requirements: 22.1, 22.2, 22.3, 22.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagsService = void 0;
exports.getFeatureFlagsService = getFeatureFlagsService;
exports.resetFeatureFlagsService = resetFeatureFlagsService;
class FeatureFlagsService {
    constructor(initialConfig) {
        this.lastUpdatedAt = Date.now();
        this.updateIntervalMs = 60000; // Check for updates every minute
        // Set default configuration
        this.flags = {
            // NFC Features - enabled by default
            enableNFCScanning: true,
            enableNFCManualFallback: true,
            nfcScanTimeoutMs: 60000,
            nfcMaxRetries: 3,
            // Notification Features - enabled by default
            enableNotifications: true,
            enableNotificationQueueing: true,
            notificationQueueRetentionHours: 24,
            enableFCM: true,
            enableAPNs: true,
            // Database Features - enabled by default
            enablePrimaryDatabase: true,
            enableDatabaseCache: true,
            databaseCacheDurationMinutes: 30,
            databaseConnectionRetries: 3,
            // Rate Limiting - enabled by default
            enableRateLimiting: true,
            rateLimitLooseThreshold: 100, // Loose limit when limiter unavailable
            // Circuit Breaker - enabled by default
            enableCircuitBreaker: true,
            circuitBreakerThreshold: 5,
            // Consistency Checks - enabled by default
            enableConsistencyChecks: true,
            consistencyCheckIntervalHours: 1,
            // Graceful Degradation - enabled by default
            enableGracefulDegradation: true,
            // Override with provided config
            ...initialConfig,
        };
        console.log('[FeatureFlags] Initialized with config:', this.flags);
    }
    /**
     * Gets a specific feature flag value
     */
    isEnabled(featureName) {
        const value = this.flags[featureName];
        return typeof value === 'boolean' ? value : true;
    }
    /**
     * Gets a numeric configuration value
     */
    getNumericConfig(configName, defaultValue) {
        const value = this.flags[configName];
        return typeof value === 'number' ? value : defaultValue;
    }
    /**
     * Gets all current flags
     */
    getAllFlags() {
        return { ...this.flags };
    }
    /**
     * Updates a feature flag (for testing or admin operations)
     */
    setFlag(featureName, value) {
        const oldValue = this.flags[featureName];
        this.flags[featureName] = value;
        console.log(`[FeatureFlags] Updated ${featureName}: ${oldValue} -> ${value}`);
    }
    /**
     * Initializes Firebase Remote Config for remote flag management
     * Note: In production, integrate with actual Firebase Remote Config
     */
    async initializeRemoteConfig(remoteConfigRef) {
        this.remoteConfigRef = remoteConfigRef;
        if (!remoteConfigRef) {
            console.warn('[FeatureFlags] Firebase Remote Config not provided. Using local configuration only.');
            return;
        }
        try {
            console.log('[FeatureFlags] Initializing Firebase Remote Config');
            await this.syncWithRemoteConfig();
            // Start periodic sync
            setInterval(() => {
                this.syncWithRemoteConfig().catch(error => {
                    console.error('[FeatureFlags] Error syncing remote config:', error);
                });
            }, this.updateIntervalMs);
        }
        catch (error) {
            console.error('[FeatureFlags] Failed to initialize remote config:', error);
        }
    }
    /**
     * Syncs local flags with Firebase Remote Config
     * Downloads latest flag values from remote config
     */
    async syncWithRemoteConfig() {
        if (!this.remoteConfigRef) {
            return;
        }
        try {
            // Fetch and activate remote config
            await this.remoteConfigRef.fetchAndActivate();
            this.lastUpdatedAt = Date.now();
            // Update local flags from remote config
            const remoteFlags = this.remoteConfigRef.getAll();
            for (const [key, value] of Object.entries(remoteFlags)) {
                if (key in this.flags) {
                    // Convert string values from remote config to appropriate types
                    let convertedValue = value;
                    if (typeof this.flags[key] === 'boolean') {
                        convertedValue = value === 'true' || value === true;
                    }
                    else if (typeof this.flags[key] === 'number') {
                        convertedValue = Number(value);
                    }
                    this.flags[key] = convertedValue;
                }
            }
            console.log('[FeatureFlags] Synced with remote config');
        }
        catch (error) {
            console.error('[FeatureFlags] Error syncing remote config:', error);
        }
    }
    /**
     * Gets flag update status
     */
    getStatus() {
        return {
            lastUpdatedAt: new Date(this.lastUpdatedAt),
            isRemoteConfigEnabled: !!this.remoteConfigRef,
            flags: { ...this.flags },
        };
    }
}
exports.FeatureFlagsService = FeatureFlagsService;
// Global singleton instance
let featureFlagsInstance = null;
/**
 * Gets or creates the global FeatureFlagsService instance
 */
function getFeatureFlagsService(initialConfig) {
    if (!featureFlagsInstance) {
        featureFlagsInstance = new FeatureFlagsService(initialConfig);
    }
    return featureFlagsInstance;
}
/**
 * Resets the global instance (useful for testing)
 */
function resetFeatureFlagsService() {
    featureFlagsInstance = null;
}
