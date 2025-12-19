/**
 * AWS Service Logger for ClearClause End-to-End Testing
 * 
 * Provides comprehensive logging of AWS service calls, processing metrics,
 * and test report generation for performance analysis and debugging.
 */

export class AWSServiceLogger {
    constructor() {
        this.serviceCalls = [];
        this.processingMetrics = [];
        this.resourceUsage = [];
        this.testStartTime = new Date();
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    /**
     * Log AWS service call with timestamp and response details
     * @param {string} service - AWS service name (S3, Textract, Lambda, Bedrock)
     * @param {string} operation - Operation performed
     * @param {Object} metadata - Call metadata including response codes, timing
     */
    logServiceCall(service, operation, metadata = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            service,
            operation,
            responseCode: metadata.responseCode || null,
            duration: metadata.duration || null,
            requestId: metadata.requestId || null,
            success: metadata.success !== false,
            errorMessage: metadata.errorMessage || null,
            ...metadata
        };

        this.serviceCalls.push(logEntry);

        // Log to console for immediate feedback
        const status = logEntry.success ? 'SUCCESS' : 'FAILED';
        console.log(`[AWS-${service}] ${operation} - ${status} (${logEntry.duration}ms)`);

        if (!logEntry.success && logEntry.errorMessage) {
            console.error(`[AWS-${service}] Error: ${logEntry.errorMessage}`);
        }
    }

    /**
     * Log Textract-specific metrics including output size and processing duration
     * @param {Object} textractMetrics - Textract processing metrics
     */
    logTextractMetrics(textractMetrics) {
        const metrics = {
            timestamp: new Date().toISOString(),
            service: 'Textract',
            outputSize: textractMetrics.outputSize || 0,
            processingDuration: textractMetrics.processingDuration || 0,
            confidence: isNaN(textractMetrics.confidence) ? 0 : (textractMetrics.confidence || 0),
            pageCount: textractMetrics.pageCount || 0,
            blockCount: textractMetrics.blockCount || 0,
            extractedTextLength: textractMetrics.extractedTextLength || 0
        };

        this.processingMetrics.push(metrics);

        console.log(`[Textract] Processed ${metrics.pageCount} pages, ` +
            `extracted ${metrics.extractedTextLength} characters ` +
            `(confidence: ${(metrics.confidence * 100).toFixed(1)}%)`);
    }

    /**
     * Log Bedrock-specific metrics including token usage and inference time
     * @param {Object} bedrockMetrics - Bedrock processing metrics
     */
    logBedrockMetrics(bedrockMetrics) {
        const metrics = {
            timestamp: new Date().toISOString(),
            service: 'Bedrock',
            tokenUsage: {
                inputTokens: bedrockMetrics.inputTokens || 0,
                outputTokens: bedrockMetrics.outputTokens || 0,
                totalTokens: (bedrockMetrics.inputTokens || 0) + (bedrockMetrics.outputTokens || 0)
            },
            inferenceTime: bedrockMetrics.inferenceTime || 0,
            modelId: bedrockMetrics.modelId || 'unknown',
            requestSize: bedrockMetrics.requestSize || 0,
            responseSize: bedrockMetrics.responseSize || 0
        };

        this.processingMetrics.push(metrics);

        console.log(`[Bedrock] Model: ${metrics.modelId}, ` +
            `Tokens: ${metrics.tokenUsage.totalTokens} ` +
            `(${metrics.tokenUsage.inputTokens}→${metrics.tokenUsage.outputTokens}), ` +
            `Inference: ${metrics.inferenceTime}ms`);
    }

    /**
     * Log processing time per input type for performance analysis
     * @param {string} inputType - Type of input (PDF, Image, Excel, RawText, URL)
     * @param {number} processingTime - Total processing time in milliseconds
     * @param {Object} additionalMetrics - Additional performance metrics
     */
    logProcessingMetrics(inputType, processingTime, additionalMetrics = {}) {
        const metrics = {
            timestamp: new Date().toISOString(),
            inputType,
            processingTime,
            fileSize: additionalMetrics.fileSize || null,
            textLength: additionalMetrics.textLength || null,
            awsServiceCalls: additionalMetrics.awsServiceCalls || 0,
            totalAwsTime: additionalMetrics.totalAwsTime || 0,
            analysisTime: additionalMetrics.analysisTime || 0,
            ...additionalMetrics
        };

        this.processingMetrics.push(metrics);

        console.log(`[Performance] ${inputType}: ${processingTime}ms total ` +
            `(AWS: ${metrics.totalAwsTime}ms, Analysis: ${metrics.analysisTime}ms)`);
    }

    /**
     * Log resource usage for AWS services
     * @param {string} service - AWS service name
     * @param {Object} usage - Resource usage metrics
     */
    logResourceUsage(service, usage) {
        const resourceEntry = {
            timestamp: new Date().toISOString(),
            service,
            memoryUsage: usage.memoryUsage || null,
            cpuUsage: usage.cpuUsage || null,
            networkIO: usage.networkIO || null,
            storageIO: usage.storageIO || null,
            cost: usage.estimatedCost || null,
            ...usage
        };

        this.resourceUsage.push(resourceEntry);
    }

    /**
     * Record test result for reporting
     * @param {string} testName - Name of the test
     * @param {boolean} passed - Whether the test passed
     * @param {string} errorMessage - Error message if test failed
     */
    recordTestResult(testName, passed, errorMessage = null) {
        if (passed) {
            this.testResults.passed++;
        } else {
            this.testResults.failed++;
            this.testResults.errors.push({
                testName,
                errorMessage,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get service call statistics
     * @returns {Object} Service call statistics
     */
    getServiceCallStats() {
        const stats = {};

        this.serviceCalls.forEach(call => {
            if (!stats[call.service]) {
                stats[call.service] = {
                    totalCalls: 0,
                    successfulCalls: 0,
                    failedCalls: 0,
                    totalDuration: 0,
                    averageDuration: 0
                };
            }

            stats[call.service].totalCalls++;
            if (call.success) {
                stats[call.service].successfulCalls++;
            } else {
                stats[call.service].failedCalls++;
            }

            if (call.duration) {
                stats[call.service].totalDuration += call.duration;
            }
        });

        // Calculate averages
        Object.keys(stats).forEach(service => {
            const serviceStats = stats[service];
            serviceStats.averageDuration = serviceStats.totalCalls > 0
                ? serviceStats.totalDuration / serviceStats.totalCalls
                : 0;
            serviceStats.successRate = serviceStats.totalCalls > 0
                ? (serviceStats.successfulCalls / serviceStats.totalCalls) * 100
                : 0;
        });

        return stats;
    }

    /**
     * Get processing metrics by input type
     * @returns {Object} Processing metrics grouped by input type
     */
    getProcessingMetricsByType() {
        const metricsByType = {};

        this.processingMetrics.forEach(metric => {
            if (metric.inputType) {
                if (!metricsByType[metric.inputType]) {
                    metricsByType[metric.inputType] = {
                        count: 0,
                        totalTime: 0,
                        averageTime: 0,
                        minTime: Infinity,
                        maxTime: 0
                    };
                }

                const typeMetrics = metricsByType[metric.inputType];
                typeMetrics.count++;
                typeMetrics.totalTime += metric.processingTime || 0;
                typeMetrics.minTime = Math.min(typeMetrics.minTime, metric.processingTime || 0);
                typeMetrics.maxTime = Math.max(typeMetrics.maxTime, metric.processingTime || 0);
            }
        });

        // Calculate averages
        Object.keys(metricsByType).forEach(type => {
            const typeMetrics = metricsByType[type];
            typeMetrics.averageTime = typeMetrics.count > 0
                ? typeMetrics.totalTime / typeMetrics.count
                : 0;
            if (typeMetrics.minTime === Infinity) {
                typeMetrics.minTime = 0;
            }
        });

        return metricsByType;
    }

    /**
     * Generate comprehensive test report
     * @returns {Promise<Object>} Comprehensive test report
     */
    async generateTestReport() {
        const testEndTime = new Date();
        const totalTestDuration = testEndTime - this.testStartTime;

        const report = {
            executionSummary: {
                startTime: this.testStartTime.toISOString(),
                endTime: testEndTime.toISOString(),
                totalDuration: totalTestDuration,
                testsRun: this.testResults.passed + this.testResults.failed,
                testsPassed: this.testResults.passed,
                testsFailed: this.testResults.failed,
                successRate: this.testResults.passed + this.testResults.failed > 0
                    ? (this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100
                    : 0
            },

            awsServiceStats: this.getServiceCallStats(),

            processingMetrics: this.getProcessingMetricsByType(),

            serviceCallDetails: this.serviceCalls,

            textractMetrics: this.processingMetrics.filter(m => m.service === 'Textract'),

            bedrockMetrics: this.processingMetrics.filter(m => m.service === 'Bedrock'),

            resourceUsage: this.resourceUsage,

            failedTests: this.testResults.errors,

            recommendations: this.generateRecommendations()
        };

        // Log summary to console
        console.log('\n=== TEST EXECUTION SUMMARY ===');
        console.log(`Duration: ${Math.round(totalTestDuration / 1000)}s`);
        console.log(`Tests: ${report.executionSummary.testsPassed}/${report.executionSummary.testsRun} passed`);
        console.log(`Success Rate: ${report.executionSummary.successRate.toFixed(1)}%`);

        if (report.failedTests.length > 0) {
            console.log('\nFailed Tests:');
            report.failedTests.forEach(error => {
                console.log(`- ${error.testName}: ${error.errorMessage}`);
            });
        }

        return report;
    }

    /**
     * Generate actionable recommendations based on test results
     * @returns {Array<string>} Array of recommendation strings
     */
    generateRecommendations() {
        const recommendations = [];
        const serviceStats = this.getServiceCallStats();
        const processingMetrics = this.getProcessingMetricsByType();

        // Check for service reliability issues
        Object.keys(serviceStats).forEach(service => {
            const stats = serviceStats[service];
            if (stats.successRate < 95) {
                recommendations.push(
                    `${service} service has ${stats.successRate.toFixed(1)}% success rate. ` +
                    `Consider implementing retry logic or investigating service issues.`
                );
            }

            if (stats.averageDuration > 10000) {
                recommendations.push(
                    `${service} average response time is ${Math.round(stats.averageDuration)}ms. ` +
                    `Consider optimizing requests or implementing caching.`
                );
            }
        });

        // Check for performance issues
        Object.keys(processingMetrics).forEach(inputType => {
            const metrics = processingMetrics[inputType];
            if (metrics.averageTime > 30000) {
                recommendations.push(
                    `${inputType} processing takes ${Math.round(metrics.averageTime / 1000)}s on average. ` +
                    `Consider optimizing the processing pipeline.`
                );
            }
        });

        // Check for test failures
        if (this.testResults.failed > 0) {
            recommendations.push(
                `${this.testResults.failed} tests failed. Review error messages and ` +
                `fix underlying issues before production deployment.`
            );
        }

        // General recommendations
        if (recommendations.length === 0) {
            recommendations.push(
                'All tests passed successfully. System appears to be functioning correctly.'
            );
        }

        return recommendations;
    }

    /**
     * Clear all logged data (useful for test isolation)
     */
    clear() {
        this.serviceCalls = [];
        this.processingMetrics = [];
        this.resourceUsage = [];
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
        this.testStartTime = new Date();
    }

    /**
     * Export logs to JSON format
     * @returns {string} JSON string of all logged data
     */
    exportToJSON() {
        return JSON.stringify({
            serviceCalls: this.serviceCalls,
            processingMetrics: this.processingMetrics,
            resourceUsage: this.resourceUsage,
            testResults: this.testResults,
            testStartTime: this.testStartTime
        }, null, 2);
    }
}

export default AWSServiceLogger;