// Configuration Manager
// Manages runtime configuration for analysis methods and system settings

import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'configuration-manager.log' })
    ]
});

export class ConfigurationManager {
    constructor(configPath = './config') {
        this.configPath = configPath;
        this.configurations = new Map();
        this.watchers = new Map();
        this.changeListeners = new Map();
        this.backups = new Map();

        // Default configurations
        this.defaultConfigs = {
            analysis: {
                methods: ['ai_model', 'api_fallback'],
                primaryMethod: 'ai_model',
                fallbackEnabled: true,
                timeout: 30000,
                retryAttempts: 3
            },
            model: {
                temperature: 0.1,
                maxTokens: 2048,
                contextWindow: 128000,
                memoryOptimization: true
            },
            extraction: {
                minConfidence: 0.7,
                maxClauses: 100,
                enableCategorization: true,
                supportedTypes: [
                    'payment_terms',
                    'termination_clause',
                    'liability_limitation',
                    'confidentiality_agreement',
                    'intellectual_property'
                ]
            },
            risk: {
                severityLevels: ['Low', 'Medium', 'High', 'Critical'],
                riskCategories: ['legal', 'financial', 'operational', 'compliance'],
                enableMitigation: true,
                prioritizeByImpact: true
            },
            compatibility: {
                version: '1.0.0',
                supportLegacyFormats: true,
                migrationEnabled: true,
                deprecationWarnings: true
            }
        };
    }

    /**
     * Initialize configuration manager
     * @returns {Promise<boolean>} - Success status
     */
    async initialize() {
        try {
            // Ensure config directory exists
            await this.ensureConfigDirectory();

            // Load all configurations
            await this.loadAllConfigurations();

            // Set up file watchers for hot reloading
            await this.setupFileWatchers();

            logger.info('Configuration manager initialized successfully', {
                configPath: this.configPath,
                configurationsLoaded: this.configurations.size
            });

            return true;
        } catch (error) {
            logger.error('Configuration manager initialization failed', {
                error: error.message
            });
            return false;
        }
    }

    /**
     * Get configuration by name
     * @param {string} name - Configuration name
     * @returns {Object} - Configuration object
     */
    getConfiguration(name) {
        const config = this.configurations.get(name);
        if (!config) {
            // Return default if available
            return this.defaultConfigs[name] || {};
        }
        return { ...config };
    }

    /**
     * Set configuration
     * @param {string} name - Configuration name
     * @param {Object} config - Configuration object
     * @param {boolean} persist - Whether to persist to file
     * @returns {Promise<boolean>} - Success status
     */
    async setConfiguration(name, config, persist = true) {
        try {
            // Validate configuration
            const validation = this.validateConfiguration(name, config);
            if (!validation.isValid) {
                throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
            }

            // Create backup of current configuration
            const currentConfig = this.configurations.get(name);
            if (currentConfig) {
                this.backups.set(name, {
                    config: { ...currentConfig },
                    timestamp: new Date().toISOString()
                });
            }

            // Update configuration
            this.configurations.set(name, { ...config });

            // Persist to file if requested
            if (persist) {
                await this.saveConfiguration(name, config);
            }

            // Notify listeners
            await this.notifyConfigurationChange(name, config, currentConfig);

            logger.info('Configuration updated successfully', {
                name: name,
                persist: persist,
                hasBackup: !!currentConfig
            });

            return true;
        } catch (error) {
            logger.error('Failed to set configuration', {
                name: name,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Update partial configuration
     * @param {string} name - Configuration name
     * @param {Object} updates - Partial configuration updates
     * @param {boolean} persist - Whether to persist to file
     * @returns {Promise<boolean>} - Success status
     */
    async updateConfiguration(name, updates, persist = true) {
        const currentConfig = this.getConfiguration(name);
        const mergedConfig = this.deepMerge(currentConfig, updates);
        return await this.setConfiguration(name, mergedConfig, persist);
    }

    /**
     * Reset configuration to default
     * @param {string} name - Configuration name
     * @returns {Promise<boolean>} - Success status
     */
    async resetConfiguration(name) {
        const defaultConfig = this.defaultConfigs[name];
        if (!defaultConfig) {
            logger.warn('No default configuration available', { name: name });
            return false;
        }

        return await this.setConfiguration(name, defaultConfig, true);
    }

    /**
     * Restore configuration from backup
     * @param {string} name - Configuration name
     * @returns {Promise<boolean>} - Success status
     */
    async restoreConfiguration(name) {
        const backup = this.backups.get(name);
        if (!backup) {
            logger.warn('No backup available for configuration', { name: name });
            return false;
        }

        return await this.setConfiguration(name, backup.config, true);
    }

    /**
     * List all configurations
     * @returns {Array} - List of configuration names and metadata
     */
    listConfigurations() {
        const configs = [];

        for (const [name, config] of this.configurations) {
            const backup = this.backups.get(name);
            configs.push({
                name: name,
                hasBackup: !!backup,
                backupTimestamp: backup?.timestamp,
                lastModified: config.lastModified || null,
                size: JSON.stringify(config).length
            });
        }

        return configs;
    }

    /**
     * Add configuration change listener
     * @param {string} name - Configuration name to watch
     * @param {Function} callback - Callback function
     * @returns {string} - Listener ID
     */
    addChangeListener(name, callback) {
        if (!this.changeListeners.has(name)) {
            this.changeListeners.set(name, new Map());
        }

        const listenerId = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.changeListeners.get(name).set(listenerId, callback);

        return listenerId;
    }

    /**
     * Remove configuration change listener
     * @param {string} name - Configuration name
     * @param {string} listenerId - Listener ID
     * @returns {boolean} - Success status
     */
    removeChangeListener(name, listenerId) {
        const listeners = this.changeListeners.get(name);
        if (!listeners) return false;

        return listeners.delete(listenerId);
    }

    /**
     * Validate configuration
     * @param {string} name - Configuration name
     * @param {Object} config - Configuration to validate
     * @returns {Object} - Validation result
     * @private
     */
    validateConfiguration(name, config) {
        const errors = [];

        // Basic validation
        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be an object');
            return { isValid: false, errors };
        }

        // Specific validation by configuration type
        switch (name) {
            case 'analysis':
                if (config.methods && !Array.isArray(config.methods)) {
                    errors.push('Analysis methods must be an array');
                }
                if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
                    errors.push('Timeout must be a positive number');
                }
                break;

            case 'model':
                if (config.temperature !== undefined &&
                    (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) {
                    errors.push('Temperature must be a number between 0 and 2');
                }
                if (config.maxTokens !== undefined &&
                    (typeof config.maxTokens !== 'number' || config.maxTokens <= 0)) {
                    errors.push('MaxTokens must be a positive number');
                }
                break;

            case 'extraction':
                if (config.minConfidence !== undefined &&
                    (typeof config.minConfidence !== 'number' || config.minConfidence < 0 || config.minConfidence > 1)) {
                    errors.push('MinConfidence must be a number between 0 and 1');
                }
                break;

            case 'risk':
                if (config.severityLevels && !Array.isArray(config.severityLevels)) {
                    errors.push('Severity levels must be an array');
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Deep merge two objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} - Merged object
     * @private
     */
    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    /**
     * Ensure config directory exists
     * @private
     */
    async ensureConfigDirectory() {
        try {
            await fs.access(this.configPath);
        } catch {
            await fs.mkdir(this.configPath, { recursive: true });
        }
    }

    /**
     * Load all configurations from files
     * @private
     */
    async loadAllConfigurations() {
        try {
            const files = await fs.readdir(this.configPath);
            const configFiles = files.filter(file => file.endsWith('.json'));

            for (const file of configFiles) {
                const name = path.basename(file, '.json');
                await this.loadConfiguration(name);
            }

            // Load defaults for missing configurations
            for (const [name, defaultConfig] of Object.entries(this.defaultConfigs)) {
                if (!this.configurations.has(name)) {
                    this.configurations.set(name, { ...defaultConfig });
                }
            }
        } catch (error) {
            logger.warn('Failed to load configurations from files', {
                error: error.message
            });
        }
    }

    /**
     * Load configuration from file
     * @param {string} name - Configuration name
     * @private
     */
    async loadConfiguration(name) {
        try {
            const filePath = path.join(this.configPath, `${name}.json`);
            const content = await fs.readFile(filePath, 'utf8');
            const config = JSON.parse(content);

            config.lastModified = new Date().toISOString();
            this.configurations.set(name, config);
        } catch (error) {
            logger.warn('Failed to load configuration file', {
                name: name,
                error: error.message
            });
        }
    }

    /**
     * Save configuration to file
     * @param {string} name - Configuration name
     * @param {Object} config - Configuration object
     * @private
     */
    async saveConfiguration(name, config) {
        try {
            const filePath = path.join(this.configPath, `${name}.json`);
            const configWithMetadata = {
                ...config,
                lastModified: new Date().toISOString()
            };

            await fs.writeFile(filePath, JSON.stringify(configWithMetadata, null, 2));
        } catch (error) {
            logger.error('Failed to save configuration file', {
                name: name,
                error: error.message
            });
        }
    }

    /**
     * Setup file watchers for hot reloading
     * @private
     */
    async setupFileWatchers() {
        // File watching implementation would go here
        // For now, we'll skip this to avoid complexity
        logger.info('File watchers setup skipped (not implemented)');
    }

    /**
     * Notify configuration change listeners
     * @param {string} name - Configuration name
     * @param {Object} newConfig - New configuration
     * @param {Object} oldConfig - Previous configuration
     * @private
     */
    async notifyConfigurationChange(name, newConfig, oldConfig) {
        const listeners = this.changeListeners.get(name);
        if (!listeners) return;

        for (const [listenerId, callback] of listeners) {
            try {
                await callback(newConfig, oldConfig, name);
            } catch (error) {
                logger.error('Configuration change listener failed', {
                    name: name,
                    listenerId: listenerId,
                    error: error.message
                });
            }
        }
    }

    /**
     * Get manager status
     * @returns {Object} - Manager status
     */
    getStatus() {
        return {
            configPath: this.configPath,
            configurationsLoaded: this.configurations.size,
            backupsAvailable: this.backups.size,
            activeListeners: Array.from(this.changeListeners.entries()).reduce(
                (total, [name, listeners]) => total + listeners.size, 0
            ),
            availableConfigurations: Array.from(this.configurations.keys())
        };
    }

    /**
     * Cleanup configuration manager
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            // Clear watchers
            for (const [name, watcher] of this.watchers) {
                if (watcher && typeof watcher.close === 'function') {
                    watcher.close();
                }
            }

            // Clear all data
            this.configurations.clear();
            this.watchers.clear();
            this.changeListeners.clear();
            this.backups.clear();

            logger.info('Configuration manager cleanup completed');
        } catch (error) {
            logger.error('Configuration manager cleanup failed', {
                error: error.message
            });
        }
    }
}

export default ConfigurationManager;