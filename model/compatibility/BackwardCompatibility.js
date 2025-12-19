// Backward Compatibility Layer
// Maintains compatibility with older versions and API formats

import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'compatibility.log' })
    ]
});

export class BackwardCompatibility {
    constructor() {
        this.supportedVersions = ['1.0.0', '1.1.0', '1.2.0'];
        this.currentVersion = '1.2.0';
        this.deprecationWarnings = new Set();
        this.migrationRules = new Map();

        // Initialize migration rules
        this.initializeMigrationRules();
    }

    /**
     * Transform input to current format
     * @param {Object} input - Input data
     * @param {string} fromVersion - Source version
     * @returns {Object} - Transformed data
     */
    transformInput(input, fromVersion = '1.0.0') {
        try {
            if (fromVersion === this.currentVersion) {
                return input;
            }

            let transformedInput = { ...input };

            // Apply migration rules in sequence
            const migrationPath = this.getMigrationPath(fromVersion, this.currentVersion);

            for (const step of migrationPath) {
                const rule = this.migrationRules.get(step);
                if (rule && rule.transformInput) {
                    transformedInput = rule.transformInput(transformedInput);
                    this.logDeprecationWarning(step, 'input transformation');
                }
            }

            return transformedInput;
        } catch (error) {
            logger.error('Input transformation failed', {
                fromVersion: fromVersion,
                error: error.message
            });
            return input; // Return original on failure
        }
    }

    /**
     * Transform output to requested format
     * @param {Object} output - Output data
     * @param {string} toVersion - Target version
     * @returns {Object} - Transformed data
     */
    transformOutput(output, toVersion = '1.0.0') {
        try {
            if (toVersion === this.currentVersion) {
                return output;
            }

            let transformedOutput = { ...output };

            // Apply reverse migration rules
            const migrationPath = this.getMigrationPath(this.currentVersion, toVersion);

            for (const step of migrationPath.reverse()) {
                const rule = this.migrationRules.get(step);
                if (rule && rule.transformOutput) {
                    transformedOutput = rule.transformOutput(transformedOutput);
                    this.logDeprecationWarning(step, 'output transformation');
                }
            }

            return transformedOutput;
        } catch (error) {
            logger.error('Output transformation failed', {
                toVersion: toVersion,
                error: error.message
            });
            return output; // Return original on failure
        }
    }

    /**
     * Check if version is supported
     * @param {string} version - Version to check
     * @returns {boolean} - Support status
     */
    isVersionSupported(version) {
        return this.supportedVersions.includes(version);
    }

    /**
     * Get migration path between versions
     * @param {string} fromVersion - Source version
     * @param {string} toVersion - Target version
     * @returns {Array} - Migration steps
     * @private
     */
    getMigrationPath(fromVersion, toVersion) {
        // Simple version-to-version mapping
        // In a real implementation, this would be more sophisticated
        const versionIndex = {
            '1.0.0': 0,
            '1.1.0': 1,
            '1.2.0': 2
        };

        const fromIndex = versionIndex[fromVersion];
        const toIndex = versionIndex[toVersion];

        if (fromIndex === undefined || toIndex === undefined) {
            return [];
        }

        const steps = [];
        if (fromIndex < toIndex) {
            // Forward migration
            for (let i = fromIndex; i < toIndex; i++) {
                steps.push(`${this.supportedVersions[i]}_to_${this.supportedVersions[i + 1]}`);
            }
        } else if (fromIndex > toIndex) {
            // Backward migration
            for (let i = fromIndex; i > toIndex; i--) {
                steps.push(`${this.supportedVersions[i]}_to_${this.supportedVersions[i - 1]}`);
            }
        }

        return steps;
    }

    /**
     * Initialize migration rules
     * @private
     */
    initializeMigrationRules() {
        // Migration from 1.0.0 to 1.1.0
        this.migrationRules.set('1.0.0_to_1.1.0', {
            transformInput: (input) => {
                // In 1.1.0, we added support for confidence scores
                if (input.options && !input.options.hasOwnProperty('includeConfidence')) {
                    input.options.includeConfidence = true;
                }
                return input;
            },
            transformOutput: (output) => {
                // Add confidence scores to clauses if missing
                if (output.clauses) {
                    output.clauses = output.clauses.map(clause => ({
                        ...clause,
                        confidence: clause.confidence || 0.8
                    }));
                }
                return output;
            }
        });

        // Migration from 1.1.0 to 1.2.0
        this.migrationRules.set('1.1.0_to_1.2.0', {
            transformInput: (input) => {
                // In 1.2.0, we added plugin support
                if (input.options && !input.options.hasOwnProperty('preferredPlugin')) {
                    input.options.preferredPlugin = 'ollama-model';
                }
                return input;
            },
            transformOutput: (output) => {
                // Add plugin metadata if missing
                if (output.metadata && !output.metadata.pluginUsed) {
                    output.metadata.pluginUsed = 'legacy';
                    output.metadata.pluginVersion = '1.0.0';
                }
                return output;
            }
        });

        // Reverse migrations (1.2.0 to 1.1.0)
        this.migrationRules.set('1.2.0_to_1.1.0', {
            transformInput: (input) => {
                // Remove plugin-specific options
                if (input.options) {
                    delete input.options.preferredPlugin;
                }
                return input;
            },
            transformOutput: (output) => {
                // Remove plugin metadata
                if (output.metadata) {
                    delete output.metadata.pluginUsed;
                    delete output.metadata.pluginVersion;
                }
                return output;
            }
        });

        // Reverse migrations (1.1.0 to 1.0.0)
        this.migrationRules.set('1.1.0_to_1.0.0', {
            transformInput: (input) => {
                // Remove confidence-related options
                if (input.options) {
                    delete input.options.includeConfidence;
                }
                return input;
            },
            transformOutput: (output) => {
                // Remove confidence scores from clauses
                if (output.clauses) {
                    output.clauses = output.clauses.map(clause => {
                        const { confidence, ...clauseWithoutConfidence } = clause;
                        return clauseWithoutConfidence;
                    });
                }
                return output;
            }
        });
    }

    /**
     * Log deprecation warning
     * @param {string} feature - Deprecated feature
     * @param {string} context - Context of usage
     * @private
     */
    logDeprecationWarning(feature, context) {
        const warningKey = `${feature}_${context}`;

        if (!this.deprecationWarnings.has(warningKey)) {
            this.deprecationWarnings.add(warningKey);

            logger.warn('Deprecated feature used', {
                feature: feature,
                context: context,
                recommendation: 'Please update to the latest API version'
            });
        }
    }

    /**
     * Get compatibility report
     * @returns {Object} - Compatibility status
     */
    getCompatibilityReport() {
        return {
            currentVersion: this.currentVersion,
            supportedVersions: [...this.supportedVersions],
            migrationRulesCount: this.migrationRules.size,
            deprecationWarningsIssued: this.deprecationWarnings.size,
            recentWarnings: Array.from(this.deprecationWarnings).slice(-10)
        };
    }

    /**
     * Validate legacy format
     * @param {Object} data - Data to validate
     * @param {string} version - Expected version
     * @returns {Object} - Validation result
     */
    validateLegacyFormat(data, version) {
        const errors = [];
        const warnings = [];

        try {
            // Basic structure validation
            if (!data || typeof data !== 'object') {
                errors.push('Data must be an object');
                return { isValid: false, errors, warnings };
            }

            // Version-specific validation
            switch (version) {
                case '1.0.0':
                    if (data.clauses && data.clauses.some(c => c.hasOwnProperty('confidence'))) {
                        warnings.push('Confidence scores not supported in v1.0.0');
                    }
                    break;

                case '1.1.0':
                    if (data.metadata && data.metadata.pluginUsed) {
                        warnings.push('Plugin metadata not supported in v1.1.0');
                    }
                    break;

                case '1.2.0':
                    // Current version - no specific legacy validation needed
                    break;

                default:
                    warnings.push(`Unknown version: ${version}`);
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [`Validation failed: ${error.message}`],
                warnings
            };
        }
    }

    /**
     * Migrate configuration format
     * @param {Object} config - Configuration to migrate
     * @param {string} fromVersion - Source version
     * @param {string} toVersion - Target version
     * @returns {Object} - Migrated configuration
     */
    migrateConfiguration(config, fromVersion, toVersion = this.currentVersion) {
        try {
            if (fromVersion === toVersion) {
                return config;
            }

            let migratedConfig = { ...config };
            const migrationPath = this.getMigrationPath(fromVersion, toVersion);

            for (const step of migrationPath) {
                const rule = this.migrationRules.get(step);
                if (rule && rule.migrateConfig) {
                    migratedConfig = rule.migrateConfig(migratedConfig);
                }
            }

            // Add version metadata
            migratedConfig._version = toVersion;
            migratedConfig._migratedFrom = fromVersion;
            migratedConfig._migrationTimestamp = new Date().toISOString();

            return migratedConfig;
        } catch (error) {
            logger.error('Configuration migration failed', {
                fromVersion,
                toVersion,
                error: error.message
            });
            return config;
        }
    }

    /**
     * Clear deprecation warnings
     */
    clearDeprecationWarnings() {
        this.deprecationWarnings.clear();
        logger.info('Deprecation warnings cleared');
    }

    /**
     * Get supported features by version
     * @param {string} version - Version to check
     * @returns {Array} - List of supported features
     */
    getSupportedFeatures(version) {
        const features = {
            '1.0.0': [
                'basic-analysis',
                'clause-extraction',
                'risk-analysis'
            ],
            '1.1.0': [
                'basic-analysis',
                'clause-extraction',
                'risk-analysis',
                'confidence-scores',
                'enhanced-metadata'
            ],
            '1.2.0': [
                'basic-analysis',
                'clause-extraction',
                'risk-analysis',
                'confidence-scores',
                'enhanced-metadata',
                'plugin-architecture',
                'runtime-configuration',
                'backward-compatibility'
            ]
        };

        return features[version] || [];
    }
}

export default BackwardCompatibility;