/**
 * Comprehensive Logging and Metrics System
 * 
 * This module provides structured logging and metrics collection for the AI contract analysis system.
 * It captures processing time, token usage, confidence scores, error information, and fallback events.
 */

import winston from 'winston';

export class Logger {
    constructor(config = {}) {
        this.config = {
            level: config.level || 'info',
            enableConsole: config.enableConsole !== false,
            enableFile: config.enableFile !== false,
            filename: config.filename || 'ai-contract-analysis.log',
            maxFiles: config.maxFiles || 5,
            maxSize: config.maxSize || '10m',
            ...config
        };

        this.logger = this._createLogger();
        this.metrics = {
            totalAnalyses: 0,
            successfulAnalyses: 0,
            failedAnalyses: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            totalTokenUsage: 0,
            averageTokenUsage: 0,
            totalConfidenceScore: 0,
            averageConfidenceScore: 0,
            errorCounts: {},
            fallbackCounts: {},
            performanceMetrics: []
        };
    }

    /**
     * Log analysis start event
     * @param {string} analysisId - Unique analysis identifier
     * @param {Object} context - Analysis context information
     */
    logAnalysisStart(analysisId, context = {}) {
        this.logger.info('Starting contract analysis', {
            analysisId,
            documentType: context.documentType || 'unknown',
            enabledFeatures: {
                clauseExtraction: context.enableClauseExtraction || false,
                riskAnalysis: context.enableRiskAnalysis || false,
                recommendations: context.enableRecommendations || false
            },
            textLength: context.textLength,
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log analysis completion event
     * @param {string} analysisId - Unique analysis identifier
     * @param {Object} results - Analysis results
     * @param {number} processingTime - Processing time in milliseconds
     */
    logAnalysisComplete(analysisId, results, processingTime) {
        const metadata = {
            analysisId,
            processingTime,
            totalClauses: results.clauses?.length || 0,
            totalRisks: results.risks?.length || 0,
            totalRecommendations: results.recommendations?.length || 0,
            confidence: results.metadata?.confidence || 0,
            tokenUsage: results.metadata?.tokenUsage || 0,
            timestamp: new Date().toISOString()
        };

        this.logger.info('Contract analysis completed successfully', metadata);

        // Update metrics
        this._updateMetrics({
            success: true,
            processingTime,
            tokenUsage: metadata.tokenUsage,
            confidence: metadata.confidence
        });
    }

    /**
     * Log analysis failure event
     * @param {string} analysisId - Unique analysis identifier
     * @param {Error} error - Error that occurred
     * @param {number} processingTime - Processing time before failure
     * @param {Object} context - Additional context
     */
    logAnalysisFailure(analysisId, error, processingTime, context = {}) {
        const errorMetadata = {
            analysisId,
            error: error.message,
            processingTime,
            textLength: context.textLength,
            documentType: context.documentType,
            enabledFeatures: context.enabledFeatures,
            timestamp: new Date().toISOString(),
            stackTrace: error.stack,
            ...context
        };

        this.logger.error('Contract analysis failed', errorMetadata);

        // Update metrics
        this._updateMetrics({
            success: false,
            processingTime,
            error: error.message
        });
    }

    /**
     * Log model inference event
     * @param {string} modelName - Name of the model used
     * @param {Object} inferenceData - Inference details
     */
    logModelInference(modelName, inferenceData) {
        this.logger.debug('Model inference performed', {
            modelName,
            promptLength: inferenceData.promptLength,
            responseLength: inferenceData.responseLength,
            inferenceTime: inferenceData.inferenceTime,
            temperature: inferenceData.temperature,
            maxTokens: inferenceData.maxTokens,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Log fallback event
     * @param {string} reason - Reason for fallback
     * @param {Object} systemState - Current system state
     * @param {Object} context - Additional context
     */
    logFallback(reason, systemState = {}, context = {}) {
        const fallbackMetadata = {
            reason,
            systemState: {
                modelLoaded: systemState.modelLoaded || false,
                memoryUsage: systemState.memoryUsage || 0,
                memoryLimit: systemState.memoryLimit || 0,
                healthStatus: systemState.healthStatus || 'unknown',
                ...systemState
            },
            analysisId: context.analysisId,
            timestamp: new Date().toISOString(),
            ...context
        };

        this.logger.warn('System fallback triggered', fallbackMetadata);

        // Update fallback metrics
        this.metrics.fallbackCounts[reason] = (this.metrics.fallbackCounts[reason] || 0) + 1;
    }

    /**
     * Log performance metrics
     * @param {Object} performanceData - Performance metrics
     */
    logPerformanceMetrics(performanceData) {
        const metricsData = {
            memoryUsage: performanceData.memoryUsage,
            memoryUtilization: performanceData.memoryUtilization,
            averageInferenceTime: performanceData.averageInferenceTime,
            successRate: performanceData.successRate,
            totalRequests: performanceData.totalRequests,
            failedRequests: performanceData.failedRequests,
            uptime: performanceData.uptime,
            timestamp: new Date().toISOString()
        };

        this.logger.info('Performance metrics collected', metricsData);

        // Store performance metrics for analysis
        this.metrics.performanceMetrics.push({
            ...metricsData,
            timestamp: Date.now()
        });

        // Keep only last 100 performance metrics
        if (this.metrics.performanceMetrics.length > 100) {
            this.metrics.performanceMetrics = this.metrics.performanceMetrics.slice(-100);
        }
    }

    /**
     * Log workflow step
     * @param {string} step - Workflow step name
     * @param {Object} stepData - Step-specific data
     */
    logWorkflowStep(step, stepData = {}) {
        this.logger.debug(`Workflow step: ${step}`, {
            step,
            analysisId: stepData.analysisId,
            duration: stepData.duration,
            success: stepData.success,
            itemsProcessed: stepData.itemsProcessed,
            timestamp: new Date().toISOString(),
            ...stepData
        });
    }

    /**
     * Log clause extraction details
     * @param {Array} clauses - Extracted clauses
     * @param {Object} extractionMetrics - Extraction metrics
     */
    logClauseExtraction(clauses, extractionMetrics = {}) {
        const clauseMetrics = {
            totalClauses: clauses.length,
            clauseTypes: this._getClauseTypeCounts(clauses),
            averageConfidence: this._calculateAverageConfidence(clauses),
            extractionTime: extractionMetrics.extractionTime,
            method: extractionMetrics.method || 'ai_model',
            timestamp: new Date().toISOString()
        };

        this.logger.debug('Clause extraction completed', clauseMetrics);
    }

    /**
     * Log risk analysis details
     * @param {Array} risks - Identified risks
     * @param {Object} analysisMetrics - Risk analysis metrics
     */
    logRiskAnalysis(risks, analysisMetrics = {}) {
        const riskMetrics = {
            totalRisks: risks.length,
            riskLevels: this._getRiskLevelCounts(risks),
            averageConfidence: this._calculateAverageConfidence(risks),
            analysisTime: analysisMetrics.analysisTime,
            method: analysisMetrics.method || 'ai_model',
            timestamp: new Date().toISOString()
        };

        this.logger.debug('Risk analysis completed', riskMetrics);
    }

    /**
     * Get comprehensive metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalAnalyses > 0 ?
                this.metrics.successfulAnalyses / this.metrics.totalAnalyses : 0,
            failureRate: this.metrics.totalAnalyses > 0 ?
                this.metrics.failedAnalyses / this.metrics.totalAnalyses : 0,
            recentPerformance: this.metrics.performanceMetrics.slice(-10)
        };
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            totalAnalyses: 0,
            successfulAnalyses: 0,
            failedAnalyses: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            totalTokenUsage: 0,
            averageTokenUsage: 0,
            totalConfidenceScore: 0,
            averageConfidenceScore: 0,
            errorCounts: {},
            fallbackCounts: {},
            performanceMetrics: []
        };

        this.logger.info('Metrics reset', { timestamp: new Date().toISOString() });
    }

    /**
     * Create Winston logger instance
     * @private
     */
    _createLogger() {
        const transports = [];

        if (this.config.enableConsole) {
            transports.push(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }));
        }

        if (this.config.enableFile) {
            transports.push(new winston.transports.File({
                filename: this.config.filename,
                maxFiles: this.config.maxFiles,
                maxsize: this.config.maxSize,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                )
            }));
        }

        return winston.createLogger({
            level: this.config.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports,
            exitOnError: false
        });
    }

    /**
     * Update internal metrics
     * @private
     */
    _updateMetrics(data) {
        this.metrics.totalAnalyses++;

        if (data.success) {
            this.metrics.successfulAnalyses++;
        } else {
            this.metrics.failedAnalyses++;

            if (data.error) {
                this.metrics.errorCounts[data.error] = (this.metrics.errorCounts[data.error] || 0) + 1;
            }
        }

        if (data.processingTime) {
            this.metrics.totalProcessingTime += data.processingTime;
            this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalAnalyses;
        }

        if (data.tokenUsage) {
            this.metrics.totalTokenUsage += data.tokenUsage;
            this.metrics.averageTokenUsage = this.metrics.totalTokenUsage / this.metrics.totalAnalyses;
        }

        if (data.confidence) {
            this.metrics.totalConfidenceScore += data.confidence;
            this.metrics.averageConfidenceScore = this.metrics.totalConfidenceScore / this.metrics.totalAnalyses;
        }
    }

    /**
     * Get clause type counts
     * @private
     */
    _getClauseTypeCounts(clauses) {
        return clauses.reduce((counts, clause) => {
            const type = clause.type || 'unknown';
            counts[type] = (counts[type] || 0) + 1;
            return counts;
        }, {});
    }

    /**
     * Get risk level counts
     * @private
     */
    _getRiskLevelCounts(risks) {
        return risks.reduce((counts, risk) => {
            const level = risk.severity || 'unknown';
            counts[level] = (counts[level] || 0) + 1;
            return counts;
        }, {});
    }

    /**
     * Calculate average confidence
     * @private
     */
    _calculateAverageConfidence(items) {
        if (!items || items.length === 0) return 0;

        const confidences = items.map(item => item.confidence || 0);
        return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    }
}

// Create singleton logger instance
export const logger = new Logger({
    level: process.env.LOG_LEVEL || 'info',
    filename: 'ai-contract-analysis.log'
});

export default logger;