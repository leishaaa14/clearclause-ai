// Ollama Model Plugin
// Plugin implementation for Ollama-based AI models

import { ModelPlugin } from './ModelPlugin.js';
import { ModelManager } from '../core/ModelManager.js';
import { ClauseExtractor } from '../extractors/ClauseExtractor.js';
import { RiskAnalyzer } from '../analyzers/RiskAnalyzer.js';

export class OllamaModelPlugin extends ModelPlugin {
    constructor(config = {}) {
        super({
            name: 'ollama-model',
            version: '1.0.0',
            description: 'Ollama-based AI model plugin for contract analysis',
            capabilities: [
                'contract-analysis',
                'clause-extraction',
                'risk-analysis',
                'text-processing',
                'structured-output'
            ],
            ...config
        });

        this.modelManager = null;
        this.clauseExtractor = null;
        this.riskAnalyzer = null;
    }

    /**
     * Initialize the plugin
     * @returns {Promise<boolean>} - Success status
     */
    async initialize() {
        try {
            // Initialize components
            this.modelManager = new ModelManager(this.config.model || {});
            this.clauseExtractor = new ClauseExtractor(this.config.extractor || {});
            this.riskAnalyzer = new RiskAnalyzer(this.config.analyzer || {});

            // Load model if configured
            if (this.config.autoLoad !== false) {
                try {
                    await this.modelManager.loadModel();
                } catch (error) {
                    // Model loading failure is not fatal for plugin initialization
                    console.warn('Model loading failed during plugin initialization:', error.message);
                }
            }

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Ollama plugin initialization failed:', error);
            return false;
        }
    }

    /**
     * Process contract text
     * @param {string} text - Contract text to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} - Analysis results
     */
    async processContract(text, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Plugin not initialized');
        }

        try {
            const startTime = Date.now();

            // Extract clauses
            const clauses = await this.extractClauses(text, options);

            // Analyze risks
            const risks = await this.analyzeRisks(clauses, options);

            // Generate recommendations
            const recommendations = this.generateRecommendations(risks, clauses);

            // Create summary
            const summary = this.generateSummary(text, clauses, risks);

            const processingTime = Date.now() - startTime;

            return {
                summary: summary,
                clauses: clauses,
                risks: risks,
                recommendations: recommendations,
                metadata: {
                    processingMethod: 'ollama_plugin',
                    modelUsed: this.modelManager.modelConfig?.modelName || 'unknown',
                    processingTime: processingTime,
                    confidence: this.calculateOverallConfidence(clauses, risks),
                    pluginName: this.name,
                    pluginVersion: this.version
                }
            };
        } catch (error) {
            throw new Error(`Ollama plugin processing failed: ${error.message}`);
        }
    }

    /**
     * Extract clauses from contract text
     * @param {string} text - Contract text
     * @param {Object} options - Extraction options
     * @returns {Promise<Array>} - Extracted clauses
     */
    async extractClauses(text, options = {}) {
        if (!this.clauseExtractor) {
            throw new Error('Clause extractor not initialized');
        }

        try {
            // Use AI model if available, otherwise use rule-based extraction
            if (this.modelManager.isLoaded) {
                return await this.clauseExtractor.extractWithAI(text, this.modelManager, options);
            } else {
                return await this.clauseExtractor.extractWithRules(text, options);
            }
        } catch (error) {
            throw new Error(`Clause extraction failed: ${error.message}`);
        }
    }

    /**
     * Analyze risks in contract
     * @param {Array} clauses - Contract clauses
     * @param {Object} options - Analysis options
     * @returns {Promise<Array>} - Risk analysis results
     */
    async analyzeRisks(clauses, options = {}) {
        if (!this.riskAnalyzer) {
            throw new Error('Risk analyzer not initialized');
        }

        try {
            // Use AI model if available, otherwise use rule-based analysis
            if (this.modelManager.isLoaded) {
                return await this.riskAnalyzer.analyzeWithAI(clauses, this.modelManager, options);
            } else {
                return await this.riskAnalyzer.analyzeWithRules(clauses, options);
            }
        } catch (error) {
            throw new Error(`Risk analysis failed: ${error.message}`);
        }
    }

    /**
     * Generate recommendations based on risks
     * @param {Array} risks - Identified risks
     * @param {Array} clauses - Contract clauses
     * @returns {Array} - Recommendations
     * @private
     */
    generateRecommendations(risks, clauses) {
        const recommendations = [];
        let recId = 1;

        risks.forEach(risk => {
            if (risk.severity === 'High' || risk.severity === 'Critical') {
                recommendations.push({
                    id: `ollama_rec_${recId++}`,
                    title: `Address ${risk.title}`,
                    description: risk.mitigation || `Review and mitigate ${risk.title.toLowerCase()}`,
                    priority: risk.severity,
                    category: risk.category || 'general',
                    actionRequired: true,
                    relatedRisk: risk.id
                });
            }
        });

        return recommendations;
    }

    /**
     * Generate contract summary
     * @param {string} text - Original contract text
     * @param {Array} clauses - Extracted clauses
     * @param {Array} risks - Identified risks
     * @returns {Object} - Contract summary
     * @private
     */
    generateSummary(text, clauses, risks) {
        const riskScore = this.calculateRiskScore(risks);

        return {
            title: 'Ollama AI Contract Analysis',
            documentType: 'contract',
            totalClauses: clauses.length,
            riskScore: riskScore,
            keyFindings: [
                `Analyzed ${clauses.length} contract clauses`,
                `Identified ${risks.length} potential risks`,
                `Overall risk score: ${riskScore}/100`,
                `Processing method: Ollama AI model`
            ]
        };
    }

    /**
     * Calculate overall confidence score
     * @param {Array} clauses - Extracted clauses
     * @param {Array} risks - Identified risks
     * @returns {number} - Confidence score (0-1)
     * @private
     */
    calculateOverallConfidence(clauses, risks) {
        if (clauses.length === 0) return 0.5;

        const clauseConfidences = clauses.map(c => c.confidence || 0.5);
        const riskConfidences = risks.map(r => r.confidence || 0.5);

        const allConfidences = [...clauseConfidences, ...riskConfidences];
        const avgConfidence = allConfidences.reduce((sum, conf) => sum + conf, 0) / allConfidences.length;

        return Math.round(avgConfidence * 100) / 100;
    }

    /**
     * Calculate risk score
     * @param {Array} risks - Identified risks
     * @returns {number} - Risk score (0-100)
     * @private
     */
    calculateRiskScore(risks) {
        if (risks.length === 0) return 0;

        const severityWeights = {
            'Critical': 25,
            'High': 15,
            'Medium': 8,
            'Low': 3
        };

        const totalScore = risks.reduce((sum, risk) => {
            const weight = severityWeights[risk.severity] || 5;
            return sum + weight;
        }, 0);

        return Math.min(totalScore, 100);
    }

    /**
     * Update plugin configuration
     * @param {Object} newConfig - New configuration
     * @returns {Promise<boolean>} - Success status
     */
    async updateConfiguration(newConfig) {
        try {
            await super.updateConfiguration(newConfig);

            // Update model manager configuration if provided
            if (newConfig.model && this.modelManager) {
                await this.modelManager.updateConfiguration(newConfig.model);
            }

            return true;
        } catch (error) {
            console.error('Failed to update Ollama plugin configuration:', error);
            return false;
        }
    }

    /**
     * Get plugin status
     * @returns {Object} - Plugin status
     */
    getStatus() {
        return {
            ...this.getMetadata(),
            modelLoaded: this.modelManager?.isLoaded || false,
            modelHealth: this.modelManager?.healthStatus || 'unknown',
            components: {
                modelManager: !!this.modelManager,
                clauseExtractor: !!this.clauseExtractor,
                riskAnalyzer: !!this.riskAnalyzer
            }
        };
    }

    /**
     * Cleanup plugin resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            if (this.modelManager) {
                await this.modelManager.unloadModel();
            }

            this.modelManager = null;
            this.clauseExtractor = null;
            this.riskAnalyzer = null;

            await super.cleanup();
        } catch (error) {
            console.error('Ollama plugin cleanup failed:', error);
        }
    }
}

export default OllamaModelPlugin;