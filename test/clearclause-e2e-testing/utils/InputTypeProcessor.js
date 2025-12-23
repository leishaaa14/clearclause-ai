/**
 * Input Type Processor for ClearClause End-to-End Testing
 * 
 * This module provides processing and validation for different input types
 * including raw text, URL content, and file uploads.
 */

import { processTextInput, processURLContent } from '../../../src/utils/documentProcessor.js';
import { AWS_CONFIG, TEST_CONFIG, VALIDATION_THRESHOLDS } from '../config/test-config.js';

/**
 * InputTypeProcessor class for handling different input types
 */
export class InputTypeProcessor {
    constructor() {
        this.processingResults = [];
        this.validationResults = [];
    }

    /**
     * Process raw text input directly (bypassing S3/Textract)
     */
    async processRawText(text) {
        const startTime = Date.now();

        try {
            // Validate input
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid text input: must be a non-empty string');
            }

            // Process text directly through the analysis pipeline
            const result = await processTextInput(text, {
                bypassFileProcessing: true,
                inputType: 'raw_text'
            });

            const processingTime = Date.now() - startTime;

            const processedResult = {
                inputType: 'raw_text',
                inputSize: text.length,
                processingTime: processingTime,
                success: result.stage === 'complete',
                result: result,
                timestamp: new Date().toISOString(),
                bypassedServices: ['S3', 'Textract'],
                directToAnalysis: true
            };

            this.processingResults.push(processedResult);
            return processedResult;

        } catch (error) {
            const processingTime = Date.now() - startTime;
            const errorResult = {
                inputType: 'raw_text',
                inputSize: text?.length || 0,
                processingTime: processingTime,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.processingResults.push(errorResult);
            return errorResult;
        }
    }

    /**
     * Process URL content through URL Fetcher Lambda
     */
    async processURLContent(url) {
        const startTime = Date.now();

        try {
            // Validate URL input
            if (!url || typeof url !== 'string') {
                throw new Error('Invalid URL input: must be a non-empty string');
            }

            // Basic URL validation
            try {
                new URL(url);
            } catch {
                throw new Error('Invalid URL format');
            }

            // Process URL through the URL content pipeline
            const result = await processURLContent(url, {
                inputType: 'url_content'
            });

            const processingTime = Date.now() - startTime;

            const processedResult = {
                inputType: 'url_content',
                inputUrl: url,
                processingTime: processingTime,
                success: result.stage === 'complete',
                result: result,
                timestamp: new Date().toISOString(),
                usedServices: ['URLFetcher', 'Bedrock'],
                contentFetched: result.data?.extraction?.text?.length > 0
            };

            this.processingResults.push(processedResult);
            return processedResult;

        } catch (error) {
            const processingTime = Date.now() - startTime;
            const errorResult = {
                inputType: 'url_content',
                inputUrl: url,
                processingTime: processingTime,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.processingResults.push(errorResult);
            return errorResult;
        }
    }

    /**
     * Validate input type handling consistency
     */
    async validateInputTypeHandling(inputType) {
        try {
            const validation = {
                inputType: inputType,
                timestamp: new Date().toISOString(),
                checks: []
            };

            // Get recent results for this input type
            const recentResults = this.processingResults
                .filter(r => r.inputType === inputType)
                .slice(-5); // Last 5 results

            if (recentResults.length === 0) {
                validation.checks.push({
                    check: 'Processing results available',
                    status: 'fail',
                    message: 'No processing results found for this input type'
                });
                validation.overall = 'fail';
                this.validationResults.push(validation);
                return validation;
            }

            // Check success rate
            const successCount = recentResults.filter(r => r.success).length;
            const successRate = successCount / recentResults.length;

            validation.checks.push({
                check: 'Success rate',
                status: successRate >= 0.8 ? 'pass' : 'fail',
                value: `${Math.round(successRate * 100)}%`,
                threshold: '80%'
            });

            // Check processing time consistency
            const processingTimes = recentResults
                .filter(r => r.success)
                .map(r => r.processingTime);

            if (processingTimes.length > 0) {
                const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
                const maxThreshold = VALIDATION_THRESHOLDS.maxProcessingTime[inputType === 'raw_text' ? 'rawText' : 'smallFile'];

                validation.checks.push({
                    check: 'Processing time',
                    status: avgProcessingTime <= maxThreshold ? 'pass' : 'fail',
                    value: `${Math.round(avgProcessingTime)}ms`,
                    threshold: `${maxThreshold}ms`
                });
            }

            // Check output structure consistency
            const successfulResults = recentResults.filter(r => r.success && r.result?.data);
            if (successfulResults.length > 0) {
                const structureCheck = this.validateOutputStructure(successfulResults[0].result.data);
                validation.checks.push({
                    check: 'Output structure',
                    status: structureCheck.valid ? 'pass' : 'fail',
                    message: structureCheck.message
                });
            }

            // Determine overall validation status
            validation.overall = validation.checks.every(c => c.status === 'pass') ? 'pass' : 'fail';

            this.validationResults.push(validation);
            return validation;

        } catch (error) {
            const validation = {
                inputType: inputType,
                timestamp: new Date().toISOString(),
                overall: 'error',
                error: error.message
            };

            this.validationResults.push(validation);
            return validation;
        }
    }

    /**
     * Validate output structure consistency
     */
    validateOutputStructure(outputData) {
        try {
            const requiredFields = ['document', 'extraction', 'analysis', 'metadata'];
            const missingFields = requiredFields.filter(field => !outputData[field]);

            if (missingFields.length > 0) {
                return {
                    valid: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`
                };
            }

            // Check analysis structure
            const analysis = outputData.analysis;
            if (!analysis.summary && !analysis.clauses && !analysis.risks) {
                return {
                    valid: false,
                    message: 'Analysis missing required components (summary, clauses, or risks)'
                };
            }

            return {
                valid: true,
                message: 'Output structure is valid'
            };

        } catch (error) {
            return {
                valid: false,
                message: `Structure validation error: ${error.message}`
            };
        }
    }

    /**
     * Validate text analysis quality
     */
    async validateTextAnalysisQuality(analysisResult) {
        try {
            const validation = {
                timestamp: new Date().toISOString(),
                checks: []
            };

            const analysis = analysisResult.result?.data?.analysis;
            if (!analysis) {
                validation.checks.push({
                    check: 'Analysis data present',
                    status: 'fail',
                    message: 'No analysis data found in result'
                });
                validation.overall = 'fail';
                return validation;
            }

            // Check summary quality
            if (analysis.summary) {
                const summaryLength = typeof analysis.summary === 'string'
                    ? analysis.summary.length
                    : (analysis.summary.title || '').length;

                validation.checks.push({
                    check: 'Summary length',
                    status: summaryLength >= VALIDATION_THRESHOLDS.minimumSummaryLength ? 'pass' : 'fail',
                    value: `${summaryLength} characters`,
                    threshold: `${VALIDATION_THRESHOLDS.minimumSummaryLength} characters`
                });
            }

            // Check clause extraction
            const clauses = analysis.clauses || [];
            validation.checks.push({
                check: 'Clauses extracted',
                status: clauses.length >= VALIDATION_THRESHOLDS.minimumClauseCount ? 'pass' : 'fail',
                value: `${clauses.length} clauses`,
                threshold: `${VALIDATION_THRESHOLDS.minimumClauseCount} minimum`
            });

            // Check clause confidence scores
            if (clauses.length > 0) {
                const clausesWithConfidence = clauses.filter(c =>
                    c.confidence && c.confidence >= VALIDATION_THRESHOLDS.minimumClauseConfidence
                );

                validation.checks.push({
                    check: 'Clause confidence scores',
                    status: clausesWithConfidence.length === clauses.length ? 'pass' : 'warn',
                    value: `${clausesWithConfidence.length}/${clauses.length} above threshold`,
                    threshold: `${VALIDATION_THRESHOLDS.minimumClauseConfidence} minimum confidence`
                });
            }

            // Check risk assessment
            const risks = analysis.risks || [];
            validation.checks.push({
                check: 'Risks identified',
                status: risks.length >= VALIDATION_THRESHOLDS.minimumRiskCount ? 'pass' : 'fail',
                value: `${risks.length} risks`,
                threshold: `${VALIDATION_THRESHOLDS.minimumRiskCount} minimum`
            });

            // Check risk levels
            if (risks.length > 0) {
                const validRiskLevels = ['Low', 'Medium', 'High', 'Critical'];
                const risksWithValidLevels = risks.filter(r =>
                    r.level && validRiskLevels.includes(r.level)
                );

                validation.checks.push({
                    check: 'Risk level classification',
                    status: risksWithValidLevels.length === risks.length ? 'pass' : 'fail',
                    value: `${risksWithValidLevels.length}/${risks.length} properly classified`,
                    threshold: 'All risks must have valid levels'
                });
            }

            // Determine overall validation status
            validation.overall = validation.checks.every(c => c.status === 'pass') ? 'pass' :
                validation.checks.some(c => c.status === 'fail') ? 'fail' : 'warn';

            return validation;

        } catch (error) {
            return {
                timestamp: new Date().toISOString(),
                overall: 'error',
                error: error.message
            };
        }
    }

    /**
     * Validate clause detection accuracy for raw text
     */
    async validateClauseDetectionAccuracy(textInput, analysisResult) {
        try {
            const validation = {
                inputLength: textInput.length,
                timestamp: new Date().toISOString(),
                checks: []
            };

            const analysis = analysisResult.result?.data?.analysis;
            if (!analysis || !analysis.clauses) {
                validation.checks.push({
                    check: 'Clause detection',
                    status: 'fail',
                    message: 'No clauses detected in analysis result'
                });
                validation.overall = 'fail';
                return validation;
            }

            const clauses = analysis.clauses;

            // Check if clauses were detected
            validation.checks.push({
                check: 'Clauses detected',
                status: clauses.length > 0 ? 'pass' : 'fail',
                value: `${clauses.length} clauses found`
            });

            // Check clause type diversity
            const clauseTypes = [...new Set(clauses.map(c => c.type).filter(Boolean))];
            validation.checks.push({
                check: 'Clause type diversity',
                status: clauseTypes.length >= Math.min(3, clauses.length) ? 'pass' : 'warn',
                value: `${clauseTypes.length} different types`,
                message: `Types: ${clauseTypes.join(', ')}`
            });

            // Check clause text extraction
            const clausesWithText = clauses.filter(c => c.text && c.text.length > 10);
            validation.checks.push({
                check: 'Clause text extraction',
                status: clausesWithText.length === clauses.length ? 'pass' : 'warn',
                value: `${clausesWithText.length}/${clauses.length} with meaningful text`
            });

            // Check confidence scores
            const clausesWithConfidence = clauses.filter(c =>
                c.confidence && typeof c.confidence === 'number' && c.confidence > 0
            );
            validation.checks.push({
                check: 'Confidence scores',
                status: clausesWithConfidence.length === clauses.length ? 'pass' : 'warn',
                value: `${clausesWithConfidence.length}/${clauses.length} with confidence scores`
            });

            // Determine overall validation status
            validation.overall = validation.checks.every(c => c.status === 'pass') ? 'pass' :
                validation.checks.some(c => c.status === 'fail') ? 'fail' : 'warn';

            return validation;

        } catch (error) {
            return {
                inputLength: textInput?.length || 0,
                timestamp: new Date().toISOString(),
                overall: 'error',
                error: error.message
            };
        }
    }

    /**
     * Compare consistency between raw text and file input results
     */
    async validateConsistencyBetweenInputTypes(rawTextResult, fileResult) {
        try {
            const validation = {
                timestamp: new Date().toISOString(),
                checks: []
            };

            // Check if both results are successful
            if (!rawTextResult.success || !fileResult.success) {
                validation.checks.push({
                    check: 'Both processing successful',
                    status: 'fail',
                    message: 'Cannot compare - one or both processing attempts failed'
                });
                validation.overall = 'fail';
                return validation;
            }

            const rawAnalysis = rawTextResult.result?.data?.analysis;
            const fileAnalysis = fileResult.result?.data?.analysis;

            if (!rawAnalysis || !fileAnalysis) {
                validation.checks.push({
                    check: 'Analysis data available',
                    status: 'fail',
                    message: 'Missing analysis data for comparison'
                });
                validation.overall = 'fail';
                return validation;
            }

            // Compare clause counts
            const rawClauseCount = rawAnalysis.clauses?.length || 0;
            const fileClauseCount = fileAnalysis.clauses?.length || 0;
            const clauseCountDiff = Math.abs(rawClauseCount - fileClauseCount);

            validation.checks.push({
                check: 'Clause count consistency',
                status: clauseCountDiff <= 2 ? 'pass' : 'warn', // Allow small differences
                value: `Raw: ${rawClauseCount}, File: ${fileClauseCount}`,
                difference: clauseCountDiff
            });

            // Compare risk counts
            const rawRiskCount = rawAnalysis.risks?.length || 0;
            const fileRiskCount = fileAnalysis.risks?.length || 0;
            const riskCountDiff = Math.abs(rawRiskCount - fileRiskCount);

            validation.checks.push({
                check: 'Risk count consistency',
                status: riskCountDiff <= 1 ? 'pass' : 'warn', // Allow small differences
                value: `Raw: ${rawRiskCount}, File: ${fileRiskCount}`,
                difference: riskCountDiff
            });

            // Compare processing times
            const rawProcessingTime = rawTextResult.processingTime;
            const fileProcessingTime = fileResult.processingTime;

            validation.checks.push({
                check: 'Processing time comparison',
                status: rawProcessingTime <= fileProcessingTime ? 'pass' : 'info',
                value: `Raw: ${rawProcessingTime}ms, File: ${fileProcessingTime}ms`,
                message: 'Raw text should be faster than file processing'
            });

            // Compare output structure
            const rawStructure = this.validateOutputStructure(rawTextResult.result.data);
            const fileStructure = this.validateOutputStructure(fileResult.result.data);

            validation.checks.push({
                check: 'Output structure consistency',
                status: rawStructure.valid && fileStructure.valid ? 'pass' : 'fail',
                message: 'Both outputs should have consistent structure'
            });

            // Determine overall validation status
            validation.overall = validation.checks.every(c => c.status === 'pass') ? 'pass' :
                validation.checks.some(c => c.status === 'fail') ? 'fail' : 'warn';

            return validation;

        } catch (error) {
            return {
                timestamp: new Date().toISOString(),
                overall: 'error',
                error: error.message
            };
        }
    }

    /**
     * Get processing summary
     */
    getProcessingSummary() {
        return {
            totalProcessed: this.processingResults.length,
            successfulProcessing: this.processingResults.filter(r => r.success).length,
            failedProcessing: this.processingResults.filter(r => !r.success).length,
            inputTypes: [...new Set(this.processingResults.map(r => r.inputType))],
            averageProcessingTime: this.calculateAverageProcessingTime(),
            validationResults: this.validationResults.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calculate average processing time
     */
    calculateAverageProcessingTime() {
        const successfulResults = this.processingResults.filter(r => r.success);
        if (successfulResults.length === 0) return 0;

        const totalTime = successfulResults.reduce((sum, r) => sum + r.processingTime, 0);
        return Math.round(totalTime / successfulResults.length);
    }

    /**
     * Clear processing history
     */
    clearHistory() {
        this.processingResults = [];
        this.validationResults = [];
    }
}

export default InputTypeProcessor;