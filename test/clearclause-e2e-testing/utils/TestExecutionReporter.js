/**
 * Test Execution Reporter for ClearClause End-to-End Testing
 * 
 * Provides comprehensive test execution reporting including feature functionality status,
 * failed input type reporting, dataset processing coverage, sample analysis outputs,
 * and actionable recommendations for identified issues.
 */

import { AWSServiceLogger } from './AWSServiceLogger.js';

export class TestExecutionReporter {
    constructor() {
        this.logger = new AWSServiceLogger();
        this.testPhases = [];
        this.inputTypeResults = new Map();
        this.datasetProcessingResults = [];
        this.sampleOutputs = [];
        this.featureStatus = new Map();
        this.executionStartTime = new Date();
        this.executionEndTime = null;
    }

    /**
     * Initialize test execution reporting
     */
    initialize() {
        this.executionStartTime = new Date();
        this.logger.clear();
        console.log('Test Execution Reporter initialized');
    }

    /**
     * Record test phase execution
     * @param {string} phaseName - Name of the test phase
     * @param {string} status - Phase status (started, completed, failed)
     * @param {Object} metadata - Additional phase metadata
     */
    recordTestPhase(phaseName, status, metadata = {}) {
        const phaseRecord = {
            name: phaseName,
            status,
            timestamp: new Date().toISOString(),
            duration: metadata.duration || null,
            testsRun: metadata.testsRun || 0,
            testsPassed: metadata.testsPassed || 0,
            testsFailed: metadata.testsFailed || 0,
            errorMessages: metadata.errorMessages || [],
            ...metadata
        };

        // Update or add phase record
        const existingIndex = this.testPhases.findIndex(p => p.name === phaseName);
        if (existingIndex >= 0) {
            this.testPhases[existingIndex] = phaseRecord;
        } else {
            this.testPhases.push(phaseRecord);
        }

        console.log(`[Phase] ${phaseName}: ${status}`);
    }

    /**
     * Record input type processing result
     * @param {string} inputType - Type of input (PDF, Image, Excel, RawText, URL)
     * @param {boolean} success - Whether processing succeeded
     * @param {string} errorMessage - Error message if processing failed
     * @param {Object} processingMetrics - Processing performance metrics
     */
    recordInputTypeResult(inputType, success, errorMessage = null, processingMetrics = {}) {
        const result = {
            inputType,
            success,
            errorMessage,
            timestamp: new Date().toISOString(),
            processingTime: processingMetrics.processingTime || null,
            fileSize: processingMetrics.fileSize || null,
            textLength: processingMetrics.textLength || null,
            awsServiceCalls: processingMetrics.awsServiceCalls || 0,
            analysisQuality: processingMetrics.analysisQuality || null,
            ...processingMetrics
        };

        this.inputTypeResults.set(inputType, result);

        if (!success && errorMessage) {
            console.error(`[Input Type] ${inputType} failed: ${errorMessage}`);
        } else {
            console.log(`[Input Type] ${inputType}: ${success ? 'SUCCESS' : 'FAILED'}`);
        }
    }

    /**
     * Record dataset file processing result
     * @param {string} fileName - Name of the processed file
     * @param {string} fileType - Type of file (PDF, Image, Excel)
     * @param {boolean} success - Whether processing succeeded
     * @param {Object} processingDetails - Detailed processing information
     */
    recordDatasetProcessing(fileName, fileType, success, processingDetails = {}) {
        const result = {
            fileName,
            fileType,
            success,
            timestamp: new Date().toISOString(),
            fileSize: processingDetails.fileSize || null,
            extractedTextLength: processingDetails.extractedTextLength || null,
            textractConfidence: processingDetails.textractConfidence || null,
            processingTime: processingDetails.processingTime || null,
            errorMessage: processingDetails.errorMessage || null,
            analysisResult: processingDetails.analysisResult || null,
            ...processingDetails
        };

        this.datasetProcessingResults.push(result);

        console.log(`[Dataset] ${fileName} (${fileType}): ${success ? 'SUCCESS' : 'FAILED'}`);
    }

    /**
     * Record sample analysis output for inclusion in reports
     * @param {string} inputType - Type of input that generated this output
     * @param {Object} analysisOutput - The analysis result to include as sample
     * @param {Object} metadata - Additional metadata about the analysis
     */
    recordSampleOutput(inputType, analysisOutput, metadata = {}) {
        const sampleOutput = {
            inputType,
            timestamp: new Date().toISOString(),
            inputSource: metadata.inputSource || 'unknown',
            inputSize: metadata.inputSize || null,
            processingTime: metadata.processingTime || null,
            analysis: {
                summary: analysisOutput.summary || null,
                clauses: analysisOutput.clauses || [],
                risks: analysisOutput.risks || [],
                recommendations: analysisOutput.recommendations || [],
                metadata: analysisOutput.metadata || {}
            },
            qualityMetrics: {
                summaryLength: analysisOutput.summary ? analysisOutput.summary.length : 0,
                clauseCount: analysisOutput.clauses ? analysisOutput.clauses.length : 0,
                riskCount: analysisOutput.risks ? analysisOutput.risks.length : 0,
                recommendationCount: analysisOutput.recommendations ? analysisOutput.recommendations.length : 0
            },
            ...metadata
        };

        this.sampleOutputs.push(sampleOutput);

        console.log(`[Sample] Recorded ${inputType} analysis output with ` +
            `${sampleOutput.qualityMetrics.clauseCount} clauses, ` +
            `${sampleOutput.qualityMetrics.riskCount} risks`);
    }

    /**
     * Record feature functionality status
     * @param {string} featureName - Name of the feature
     * @param {boolean} working - Whether the feature is working correctly
     * @param {string} description - Description of feature status
     * @param {Array} testResults - Related test results
     */
    recordFeatureStatus(featureName, working, description = '', testResults = []) {
        const status = {
            working,
            description,
            timestamp: new Date().toISOString(),
            testResults,
            testsRun: testResults.length,
            testsPassed: testResults.filter(r => r.passed).length,
            testsFailed: testResults.filter(r => !r.passed).length
        };

        this.featureStatus.set(featureName, status);

        console.log(`[Feature] ${featureName}: ${working ? 'WORKING' : 'NOT WORKING'} - ${description}`);
    }

    /**
     * Get failed input types with exact error messages
     * @returns {Array} Array of failed input type details
     */
    getFailedInputTypes() {
        const failedTypes = [];

        this.inputTypeResults.forEach((result, inputType) => {
            if (!result.success) {
                failedTypes.push({
                    inputType,
                    errorMessage: result.errorMessage || 'Unknown error',
                    timestamp: result.timestamp,
                    processingTime: result.processingTime,
                    context: {
                        fileSize: result.fileSize,
                        textLength: result.textLength,
                        awsServiceCalls: result.awsServiceCalls
                    }
                });
            }
        });

        return failedTypes;
    }

    /**
     * Get dataset processing coverage report
     * @returns {Object} Dataset processing coverage statistics
     */
    getDatasetCoverage() {
        const coverage = {
            totalFiles: this.datasetProcessingResults.length,
            successfulFiles: this.datasetProcessingResults.filter(r => r.success).length,
            failedFiles: this.datasetProcessingResults.filter(r => !r.success).length,
            fileTypeBreakdown: {},
            processingStats: {
                totalProcessingTime: 0,
                averageProcessingTime: 0,
                totalTextExtracted: 0,
                averageTextractConfidence: 0
            }
        };

        // Calculate file type breakdown
        this.datasetProcessingResults.forEach(result => {
            if (!coverage.fileTypeBreakdown[result.fileType]) {
                coverage.fileTypeBreakdown[result.fileType] = {
                    total: 0,
                    successful: 0,
                    failed: 0
                };
            }

            coverage.fileTypeBreakdown[result.fileType].total++;
            if (result.success) {
                coverage.fileTypeBreakdown[result.fileType].successful++;
            } else {
                coverage.fileTypeBreakdown[result.fileType].failed++;
            }

            // Accumulate processing stats
            if (result.processingTime) {
                coverage.processingStats.totalProcessingTime += result.processingTime;
            }
            if (result.extractedTextLength) {
                coverage.processingStats.totalTextExtracted += result.extractedTextLength;
            }
        });

        // Calculate averages
        if (coverage.totalFiles > 0) {
            coverage.processingStats.averageProcessingTime =
                coverage.processingStats.totalProcessingTime / coverage.totalFiles;

            const confidenceResults = this.datasetProcessingResults
                .filter(r => r.textractConfidence !== null && r.textractConfidence !== undefined);

            if (confidenceResults.length > 0) {
                coverage.processingStats.averageTextractConfidence =
                    confidenceResults.reduce((sum, r) => sum + r.textractConfidence, 0) / confidenceResults.length;
            }
        }

        coverage.successRate = coverage.totalFiles > 0
            ? (coverage.successfulFiles / coverage.totalFiles) * 100
            : 0;

        return coverage;
    }

    /**
     * Generate actionable recommendations based on test results
     * @returns {Array} Array of actionable recommendations
     */
    generateActionableRecommendations() {
        const recommendations = [];
        const failedInputTypes = this.getFailedInputTypes();
        const datasetCoverage = this.getDatasetCoverage();

        // Recommendations for failed input types
        if (failedInputTypes.length > 0) {
            recommendations.push({
                category: 'Input Type Failures',
                priority: 'HIGH',
                description: `${failedInputTypes.length} input type(s) are failing`,
                actions: failedInputTypes.map(failure =>
                    `Fix ${failure.inputType} processing: ${failure.errorMessage}`
                ),
                impact: 'Critical - Users cannot process certain input types'
            });
        }

        // Recommendations for dataset processing issues
        if (datasetCoverage.successRate < 90) {
            recommendations.push({
                category: 'Dataset Processing',
                priority: 'MEDIUM',
                description: `Dataset processing success rate is ${datasetCoverage.successRate.toFixed(1)}%`,
                actions: [
                    'Review failed file processing logs',
                    'Improve error handling for unsupported file formats',
                    'Optimize Textract OCR accuracy'
                ],
                impact: 'Moderate - Some document types may not process correctly'
            });
        }

        // Recommendations for performance issues
        const avgProcessingTime = datasetCoverage.processingStats.averageProcessingTime;
        if (avgProcessingTime > 30000) {
            recommendations.push({
                category: 'Performance',
                priority: 'MEDIUM',
                description: `Average processing time is ${Math.round(avgProcessingTime / 1000)}s`,
                actions: [
                    'Optimize AWS service call patterns',
                    'Implement parallel processing where possible',
                    'Consider caching for repeated operations'
                ],
                impact: 'Moderate - Users may experience slow response times'
            });
        }

        // Recommendations for feature completeness
        const nonWorkingFeatures = Array.from(this.featureStatus.entries())
            .filter(([_, status]) => !status.working);

        if (nonWorkingFeatures.length > 0) {
            recommendations.push({
                category: 'Feature Completeness',
                priority: 'HIGH',
                description: `${nonWorkingFeatures.length} feature(s) are not working correctly`,
                actions: nonWorkingFeatures.map(([feature, status]) =>
                    `Fix ${feature}: ${status.description}`
                ),
                impact: 'Critical - Core functionality is not available'
            });
        }

        // Recommendations for test coverage
        const totalPhases = this.testPhases.length;
        const completedPhases = this.testPhases.filter(p => p.status === 'completed').length;

        if (completedPhases < totalPhases) {
            recommendations.push({
                category: 'Test Coverage',
                priority: 'MEDIUM',
                description: `Only ${completedPhases}/${totalPhases} test phases completed`,
                actions: [
                    'Complete all test phases for comprehensive validation',
                    'Investigate why some test phases did not complete'
                ],
                impact: 'Moderate - Incomplete testing may miss issues'
            });
        }

        // Success recommendations
        if (recommendations.length === 0) {
            recommendations.push({
                category: 'System Status',
                priority: 'INFO',
                description: 'All tests passed successfully',
                actions: [
                    'System is ready for production deployment',
                    'Continue monitoring performance in production'
                ],
                impact: 'Positive - System is functioning correctly'
            });
        }

        return recommendations;
    }

    /**
     * Generate comprehensive final test report
     * @returns {Promise<Object>} Complete test execution report
     */
    async generateFinalReport() {
        this.executionEndTime = new Date();
        const totalExecutionTime = this.executionEndTime - this.executionStartTime;

        // Get AWS service logging data
        const awsReport = await this.logger.generateTestReport();

        const report = {
            // Requirement 10.1: Final report confirming feature functionality status
            executionSummary: {
                startTime: this.executionStartTime.toISOString(),
                endTime: this.executionEndTime.toISOString(),
                totalDuration: totalExecutionTime,
                durationFormatted: `${Math.round(totalExecutionTime / 1000)}s`,
                allFeaturesWorking: Array.from(this.featureStatus.values()).every(s => s.working),
                testPhasesCompleted: this.testPhases.filter(p => p.status === 'completed').length,
                totalTestPhases: this.testPhases.length,
                overallSuccess: this.getFailedInputTypes().length === 0 &&
                    Array.from(this.featureStatus.values()).every(s => s.working)
            },

            // Feature functionality status
            featureStatus: Array.from(this.featureStatus.values()),

            // Test phase results
            testPhases: this.testPhases,

            // Requirement 10.2: Failed input types with exact error messages
            failedInputTypes: this.getFailedInputTypes(),

            // Input type processing results
            inputTypeResults: Object.fromEntries(this.inputTypeResults),

            // Requirement 10.3: Dataset processing coverage
            datasetCoverage: this.getDatasetCoverage(),
            datasetProcessingResults: this.datasetProcessingResults,

            // Requirement 10.4: Sample analysis outputs
            sampleOutputs: this.sampleOutputs,

            // AWS service metrics from logger
            awsServiceMetrics: {
                serviceCallStats: awsReport.awsServiceStats,
                processingMetrics: awsReport.processingMetrics,
                textractMetrics: awsReport.textractMetrics,
                bedrockMetrics: awsReport.bedrockMetrics,
                resourceUsage: awsReport.resourceUsage
            },

            // Requirement 10.5: Actionable recommendations
            recommendations: this.generateActionableRecommendations(),

            // Additional metadata
            metadata: {
                reportGeneratedAt: new Date().toISOString(),
                nodeVersion: process.version,
                testEnvironment: process.env.NODE_ENV || 'test',
                totalSampleOutputs: this.sampleOutputs.length,
                totalDatasetFiles: this.datasetProcessingResults.length
            }
        };

        // Log summary to console
        this.logReportSummary(report);

        return report;
    }

    /**
     * Log report summary to console
     * @param {Object} report - The generated report
     */
    logReportSummary(report) {
        console.log('\n' + '='.repeat(60));
        console.log('CLEARCLAUSE END-TO-END TEST EXECUTION REPORT');
        console.log('='.repeat(60));

        console.log(`\nExecution Time: ${report.executionSummary.durationFormatted}`);
        console.log(`Test Phases: ${report.executionSummary.testPhasesCompleted}/${report.executionSummary.totalTestPhases} completed`);
        console.log(`Overall Success: ${report.executionSummary.overallSuccess ? 'YES' : 'NO'}`);
        console.log(`All Features Working: ${report.executionSummary.allFeaturesWorking ? 'YES' : 'NO'}`);

        if (report.failedInputTypes.length > 0) {
            console.log(`\nFAILED INPUT TYPES (${report.failedInputTypes.length}):`);
            report.failedInputTypes.forEach(failure => {
                console.log(`- ${failure.inputType}: ${failure.errorMessage}`);
            });
        }

        console.log(`\nDataset Coverage: ${report.datasetCoverage.successRate.toFixed(1)}% ` +
            `(${report.datasetCoverage.successfulFiles}/${report.datasetCoverage.totalFiles} files)`);

        console.log(`Sample Outputs: ${report.sampleOutputs.length} recorded`);

        console.log(`\nRecommendations: ${report.recommendations.length}`);
        report.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. [${rec.priority}] ${rec.category}: ${rec.description}`);
        });

        console.log('\n' + '='.repeat(60));
    }

    /**
     * Export report to JSON file
     * @param {Object} report - The report to export
     * @param {string} filePath - Path to save the report
     */
    async exportReportToFile(report, filePath) {
        const fs = await import('fs/promises');
        const reportJson = JSON.stringify(report, null, 2);
        await fs.writeFile(filePath, reportJson, 'utf8');
        console.log(`Report exported to: ${filePath}`);
    }

    /**
     * Clear all recorded data (useful for test isolation)
     */
    clear() {
        this.logger.clear();
        this.testPhases = [];
        this.inputTypeResults.clear();
        this.datasetProcessingResults = [];
        this.sampleOutputs = [];
        this.featureStatus.clear();
        this.executionStartTime = new Date();
        this.executionEndTime = null;
    }
}

export default TestExecutionReporter;