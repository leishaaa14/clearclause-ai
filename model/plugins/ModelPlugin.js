// Model Plugin Interface
// Base class for model plugins that can be swapped at runtime

export class ModelPlugin {
    constructor(config = {}) {
        this.name = config.name || 'unknown';
        this.version = config.version || '1.0.0';
        this.description = config.description || '';
        this.capabilities = config.capabilities || [];
        this.config = config;
        this.isInitialized = false;
    }

    /**
     * Initialize the plugin
     * @returns {Promise<boolean>} - Success status
     */
    async initialize() {
        throw new Error('initialize() must be implemented by plugin');
    }

    /**
     * Process contract text
     * @param {string} text - Contract text to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} - Analysis results
     */
    async processContract(text, options = {}) {
        throw new Error('processContract() must be implemented by plugin');
    }

    /**
     * Extract clauses from contract text
     * @param {string} text - Contract text
     * @param {Object} options - Extraction options
     * @returns {Promise<Array>} - Extracted clauses
     */
    async extractClauses(text, options = {}) {
        throw new Error('extractClauses() must be implemented by plugin');
    }

    /**
     * Analyze risks in contract
     * @param {Array} clauses - Contract clauses
     * @param {Object} options - Analysis options
     * @returns {Promise<Array>} - Risk analysis results
     */
    async analyzeRisks(clauses, options = {}) {
        throw new Error('analyzeRisks() must be implemented by plugin');
    }

    /**
     * Get plugin capabilities
     * @returns {Array} - List of capabilities
     */
    getCapabilities() {
        return this.capabilities;
    }

    /**
     * Check if plugin supports a specific capability
     * @param {string} capability - Capability to check
     * @returns {boolean} - Support status
     */
    supportsCapability(capability) {
        return this.capabilities.includes(capability);
    }

    /**
     * Get plugin metadata
     * @returns {Object} - Plugin metadata
     */
    getMetadata() {
        return {
            name: this.name,
            version: this.version,
            description: this.description,
            capabilities: this.capabilities,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Update plugin configuration
     * @param {Object} newConfig - New configuration
     * @returns {Promise<boolean>} - Success status
     */
    async updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return true;
    }

    /**
     * Validate plugin configuration
     * @param {Object} config - Configuration to validate
     * @returns {Object} - Validation result
     */
    validateConfiguration(config) {
        return {
            isValid: true,
            errors: []
        };
    }

    /**
     * Cleanup plugin resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        this.isInitialized = false;
    }
}

export default ModelPlugin;