/**
 * Metrics Collector for AI Contract Analysis System
 * 
 * This module collects and aggregates performance metrics, processing statistics,
 * and system health information for monitoring and optimization purposes.
 */

export class MetricsCollector {
    constructor() {
        this.metrics = {
            // Analysis metrics
            totalAnalyses: 0,
            successfulAnalyses: 0,
            failedAnalyses: 0,

            // Performance metrics
            processingTimes: [],
            tokenUsages: [],
            confidenceScores: [],

            // Component metrics
            clauseExtractionMetrics: {
                totalExtractions: 0,
                averageClausesPerDocument: 0,
                averageConfidence: 0,
                processingTimes: []
            },

            riskAnalysisMetrics: {
                totalAnalyses: 0,
                averageRisksPerDocument: 0,
                riskLevelDistribution: {
                    'Low': 0,
                    'Medium': 0,
                    'High': 0,
                    'Critical': 0
                },
                averageConfidence: 0,
                processingTimes: []
            },

            // System metrics
            modelMetrics: {
                inferenceCount: 0,
                totalInferenceTime: 0,
                averageInferenceTime: 0,
                failureCount: 0,
                fallbackCount: 0
            },

            // Error tracking
            errorCounts: {},
            fallbackReasons: {},

            // Performance benchmarks
            performanceBenchmarks: {
                fastest: null,
                slowest: null,
                averageProcessingTime: 0,
                medianProcessingTime: 0,
                p95ProcessingTime: 0,
                p99ProcessingTime: 0
            }
        };

        this.startTime = Date.now();
    }

    /**
     * Record analysis completion
     * @param {Object} analysisData - Analysis completion data
     */
    recordAnalysis(analysisData) {
        this.metrics.totalAnalyses++;

        if (analysisData.success) {
            this.metrics.successfulAnalyses++;
        } else {
            this.metrics.failedAnalyses++;

            if (analysisData.error) {
                this.metrics.errorCounts[analysisData.error] =
                    (this.metrics.errorCounts[analysisData.error] || 0) + 1;
            }
        }

        if (analysisData.processingTime) {
            this.metrics.processingTimes.push(analysisData.processingTime);
            this._updatePerformanceBenchmarks();
        }

        if (analysisData.tokenUsage) {
            this.metrics.tokenUsages.push(analysisData.tokenUsage);
        }

        if (analysisData.confidence) {
            this.metrics.confidenceScores.push(analysisData.confidence);
        }
    }

    /**
     * Record clause extraction metrics
     * @param {Object} extractionData - Clause extraction data
     */
    recordClauseExtraction(extractionData) {
        const metrics = this.metrics.clauseExtractionMetrics;

        metrics.totalExtractions++;

        if (extractionData.clauseCount) {
            const totalClauses = (metrics.averageClausesPerDocument * (metrics.totalExtractions - 1)) +
                extractionData.clauseCount;
            metrics.averageClausesPerDocument = totalClauses / metrics.totalExtractions;
        }

        if (extractionData.confidence) {
            const totalConfidence = (metrics.averageConfidence * (metrics.totalExtractions - 1)) +
                extractionData.confidence;
            metrics.averageConfidence = totalConfidence / metrics.totalExtractions;
        }

        if (extractionData.processingTime) {
            metrics.processingTimes.push(extractionData.processingTime);
        }
    }

    /**
     * Record risk analysis metrics
     * @param {Object} riskData - Risk analysis data
     */
    recordRiskAnalysis(riskData) {
        const metrics = this.metrics.riskAnalysisMetrics;

        metrics.totalAnalyses++;

        if (riskData.riskCount) {
            const totalRisks = (metrics.averageRisksPerDocument * (metrics.totalAnalyses - 1)) +
                riskData.riskCount;
            metrics.averageRisksPerDocument = totalRisks / metrics.totalAnalyses;
        }

        if (riskData.riskLevels) {
            for (const [level, count] of Object.entries(riskData.riskLevels)) {
                metrics.riskLevelDistribution[level] =
                    (metrics.riskLevelDistribution[level] || 0) + count;
            }
        }

        if (riskData.confidence) {
            const totalConfidence = (metrics.averageConfidence * (metrics.totalAnalyses - 1)) +
                riskData.confidence;
            metrics.averageConfidence = totalConfidence / metrics.totalAnalyses;
        }

        if (riskData.processingTime) {
            metrics.processingTimes.push(riskData.processingTime);
        }
    }

    /**
     * Record model inference metrics
     * @param {Object} inferenceData - Model inference data
     */
    recordModelInference(inferenceData) {
        const metrics = this.metrics.modelMetrics;

        metrics.inferenceCount++;

        if (inferenceData.inferenceTime) {
            metrics.totalInferenceTime += inferenceData.inferenceTime;
            metrics.averageInferenceTime = metrics.totalInferenceTime / metrics.inferenceCount;
        }

        if (inferenceData.failed) {
            metrics.failureCount++;
        }
    }

    /**
     * Record fallback event
     * @param {string} reason - Reason for fallback
     */
    recordFallback(reason) {
        this.metrics.modelMetrics.fallbackCount++;
        this.metrics.fallbackReasons[reason] = (this.metrics.fallbackReasons[reason] || 0) + 1;
    }

    /**
     * Get current metrics snapshot
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,

            // Calculated metrics
            successRate: this.metrics.totalAnalyses > 0 ?
                this.metrics.successfulAnalyses / this.metrics.totalAnalyses : 0,

            failureRate: this.metrics.totalAnalyses > 0 ?
                this.metrics.failedAnalyses / this.metrics.totalAnalyses : 0,

            averageProcessingTime: this._calculateAverage(this.metrics.processingTimes),
            averageTokenUsage: this._calculateAverage(this.metrics.tokenUsages),
            averageConfidenceScore: this._calculateAverage(this.metrics.confidenceScores),

            // System uptime
            uptime: Date.now() - this.startTime,

            // Data collection timestamp
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get performance summary
     * @returns {Object} Performance summary
     */
    getPerformanceSummary() {
        const processingTimes = this.metrics.processingTimes;

        if (processingTimes.length === 0) {
            return {
                totalAnalyses: 0,
                averageTime: 0,
                medianTime: 0,
                minTime: 0,
                maxTime: 0,
                p95Time: 0,
                p99Time: 0
            };
        }

        const sorted = [...processingTimes].sort((a, b) => a - b);

        return {
            totalAnalyses: this.metrics.totalAnalyses,
            successfulAnalyses: this.metrics.successfulAnalyses,
            averageTime: this._calculateAverage(processingTimes),
            medianTime: this._calculatePercentile(sorted, 50),
            minTime: Math.min(...processingTimes),
            maxTime: Math.max(...processingTimes),
            p95Time: this._calculatePercentile(sorted, 95),
            p99Time: this._calculatePercentile(sorted, 99),
            successRate: this.metrics.totalAnalyses > 0 ?
                this.metrics.successfulAnalyses / this.metrics.totalAnalyses : 0
        };
    }

    /**
     * Get error analysis
     * @returns {Object} Error analysis
     */
    getErrorAnalysis() {
        const totalErrors = Object.values(this.metrics.errorCounts)
            .reduce((sum, count) => sum + count, 0);

        return {
            totalErrors,
            errorRate: this.metrics.totalAnalyses > 0 ?
                totalErrors / this.metrics.totalAnalyses : 0,
            errorBreakdown: { ...this.metrics.errorCounts },
            fallbackBreakdown: { ...this.metrics.fallbackReasons },
            mostCommonError: this._getMostCommon(this.metrics.errorCounts),
            mostCommonFallbackReason: this._getMostCommon(this.metrics.fallbackReasons)
        };
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            totalAnalyses: 0,
            successfulAnalyses: 0,
            failedAnalyses: 0,
            processingTimes: [],
            tokenUsages: [],
            confidenceScores: [],
            clauseExtractionMetrics: {
                totalExtractions: 0,
                averageClausesPerDocument: 0,
                averageConfidence: 0,
                processingTimes: []
            },
            riskAnalysisMetrics: {
                totalAnalyses: 0,
                averageRisksPerDocument: 0,
                riskLevelDistribution: {
                    'Low': 0,
                    'Medium': 0,
                    'High': 0,
                    'Critical': 0
                },
                averageConfidence: 0,
                processingTimes: []
            },
            modelMetrics: {
                inferenceCount: 0,
                totalInferenceTime: 0,
                averageInferenceTime: 0,
                failureCount: 0,
                fallbackCount: 0
            },
            errorCounts: {},
            fallbackReasons: {},
            performanceBenchmarks: {
                fastest: null,
                slowest: null,
                averageProcessingTime: 0,
                medianProcessingTime: 0,
                p95ProcessingTime: 0,
                p99ProcessingTime: 0
            }
        };

        this.startTime = Date.now();
    }

    /**
     * Update performance benchmarks
     * @private
     */
    _updatePerformanceBenchmarks() {
        const times = this.metrics.processingTimes;
        const benchmarks = this.metrics.performanceBenchmarks;

        if (times.length === 0) return;

        const sorted = [...times].sort((a, b) => a - b);

        benchmarks.fastest = sorted[0];
        benchmarks.slowest = sorted[sorted.length - 1];
        benchmarks.averageProcessingTime = this._calculateAverage(times);
        benchmarks.medianProcessingTime = this._calculatePercentile(sorted, 50);
        benchmarks.p95ProcessingTime = this._calculatePercentile(sorted, 95);
        benchmarks.p99ProcessingTime = this._calculatePercentile(sorted, 99);
    }

    /**
     * Calculate average of array
     * @private
     */
    _calculateAverage(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    }

    /**
     * Calculate percentile
     * @private
     */
    _calculatePercentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;

        const index = (percentile / 100) * (sortedArray.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);

        if (lower === upper) {
            return sortedArray[lower];
        }

        const weight = index - lower;
        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
    }

    /**
     * Get most common item from counts object
     * @private
     */
    _getMostCommon(countsObj) {
        if (!countsObj || Object.keys(countsObj).length === 0) return null;

        return Object.entries(countsObj)
            .reduce((max, [key, count]) => count > max.count ? { key, count } : max,
                { key: null, count: 0 });
    }
}

// Create singleton metrics collector
export const metricsCollector = new MetricsCollector();

export default metricsCollector;