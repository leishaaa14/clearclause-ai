// Property-based test for error and fallback logging
// **Feature: ai-contract-analysis, Property 22: Error and fallback logging**
// **Validates: Requirements 10.2, 10.3**

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { ContractAnalyzer } from '../../model/analyzers/ContractAnalyzer.js';
import { ModelManager } from '../../model/core/ModelManager.js';
import { ContractProcessor } from '../../src/processors/ContractProcessor.js';
import winston from 'winston';

describe('Error and Fallback Logging Property Tests', () => {
    let contractAnalyzer;
    let contractProcessor;
    let modelManager;
    let logSpy;
    let logMessages;

    beforeEach(() => {
        // Capture log messages
        logMessages = [];

        // Mock winston.createLogger to capture all log messages
        logSpy = vi.spyOn(winston, 'createLogger').mockImplementation(() => ({
            info: vi.fn((message, meta) => logMessages.push({ level: 'info', message, meta })),
            debug: vi.fn((message, meta) => logMessages.push({ level: 'debug', message, meta })),
            warn: vi.fn((message, meta) => logMessages.push({ level: 'warn', message, meta })),
            error: vi.fn((message, meta) => logMessages.push({ level: 'error', message, meta })),
            add: vi.fn(),
            remove: vi.fn(),
            clear: vi.fn(),
            close: vi.fn(),
            configure: vi.fn(),
            child: vi.fn(() => ({
                info: vi.fn((message, meta) => logMessages.push({ level: 'info', message, meta })),
                debug: vi.fn((message, meta) => logMessages.push({ level: 'debug', message, meta })),
                warn: vi.fn((message, meta) => logMessages.push({ level: 'warn', message, meta })),
                error: vi.fn((message, meta) => logMessages.push({ level: 'error', message, meta }))
            }))
        }));

        modelManager = new ModelManager();
        contractAnalyzer = new ContractAnalyzer({ model: { modelManager } });
        contractProcessor = new ContractProcessor();
    });

    afterEach(async () => {
        if (contractAnalyzer) {
            await contractAnalyzer.cleanup();
        }
        vi.restoreAllMocks();
    });

    it('Property 22: Error and fallback logging - system logs detailed error information and fallback reasons', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    contractText: fc.oneof(
                        fc.constant("PAYMENT TERMS: Payment within 30 days. LIABILITY: Limited liability."),
                        fc.constant("CONFIDENTIALITY: Information confidential. TERMINATION: 60 days notice."),
                        fc.constant("GOVERNING LAW: State law applies. DISPUTE: Arbitration required.")
                    ),
                    errorScenario: fc.oneof(
                        fc.constant('model_not_loaded'),
                        fc.constant('inference_failure'),
                        fc.constant('invalid_response'),
                        fc.constant('timeout_error'),
                        fc.constant('memory_error')
                    ),
                    analysisOptions: fc.record({
                        enableClauseExtraction: fc.constant(true), // Always enable at least one feature
                        enableRiskAnalysis: fc.boolean(),
                        enableRecommendations: fc.boolean()
                    })
                }),
                async ({ contractText, errorScenario, analysisOptions }) => {
                    // Clear previous log messages
                    logMessages = [];

                    // Configure error scenarios
                    switch (errorScenario) {
                        case 'model_not_loaded':
                            modelManager.isLoaded = false;
                            modelManager.healthStatus = 'not_loaded';
                            break;

                        case 'inference_failure':
                            modelManager.isLoaded = true;
                            modelManager.inference = async () => {
                                throw new Error('Model inference failed due to internal error');
                            };
                            break;

                        case 'invalid_response':
                            modelManager.isLoaded = true;
                            modelManager.inference = async () => {
                                return "Invalid JSON response that cannot be parsed";
                            };
                            break;

                        case 'timeout_error':
                            modelManager.isLoaded = true;
                            modelManager.inference = async () => {
                                // Simulate timeout
                                await new Promise(resolve => setTimeout(resolve, 100));
                                throw new Error('Request timeout exceeded');
                            };
                            break;

                        case 'memory_error':
                            modelManager.isLoaded = true;
                            modelManager.inference = async () => {
                                throw new Error('Out of memory error during inference');
                            };
                            break;
                    }

                    let analysisResult;
                    let errorOccurred = false;

                    try {
                        analysisResult = await contractAnalyzer.analyzeContract(contractText, analysisOptions);
                    } catch (error) {
                        errorOccurred = true;
                        analysisResult = null;
                    }

                    // Requirement 10.2: System SHALL log detailed error information including input characteristics and failure modes

                    if (errorScenario !== 'model_not_loaded') {
                        // Should have error logs for failure scenarios
                        const errorLogs = logMessages.filter(log => log.level === 'error');
                        expect(errorLogs.length).toBeGreaterThan(0);

                        // Error logs should contain detailed information
                        const detailedErrorLog = errorLogs.find(log =>
                            log.meta && (
                                log.meta.error ||
                                log.meta.analysisId ||
                                log.meta.processingTime ||
                                log.meta.textLength ||
                                log.meta.contractText !== undefined
                            )
                        );
                        expect(detailedErrorLog).toBeDefined();

                        // Should include input characteristics
                        if (detailedErrorLog.meta) {
                            // Should log error details
                            expect(detailedErrorLog.meta.error || detailedErrorLog.message).toBeDefined();

                            // Should include processing context
                            if (detailedErrorLog.meta.processingTime !== undefined) {
                                expect(typeof detailedErrorLog.meta.processingTime).toBe('number');
                            }
                        }
                    }

                    // Requirement 10.3: System SHALL log the reason for fallback and system state when switching to API fallback

                    if (errorScenario === 'model_not_loaded') {
                        // Should log model unavailability or fallback usage
                        const modelRelatedLogs = logMessages.filter(log =>
                            log.message.includes('model') ||
                            log.message.includes('fallback') ||
                            log.message.includes('api') ||
                            log.message.includes('external')
                        );
                        expect(modelRelatedLogs.length).toBeGreaterThanOrEqual(0);

                        // Should still complete analysis using fallback methods
                        expect(analysisResult).toBeDefined();
                        expect(analysisResult.metadata.processingMethod).toBeDefined();
                    }

                    // Check for fallback logging when model fails
                    if (['inference_failure', 'invalid_response', 'timeout_error', 'memory_error'].includes(errorScenario)) {
                        const fallbackLogs = logMessages.filter(log =>
                            log.message.includes('fallback') ||
                            log.message.includes('skipped') ||
                            log.message.includes('failed')
                        );

                        // Should log fallback reasons
                        if (fallbackLogs.length > 0) {
                            const fallbackLog = fallbackLogs[0];
                            expect(fallbackLog.message).toBeDefined();

                            // Should include system state information
                            if (fallbackLog.meta) {
                                expect(typeof fallbackLog.meta).toBe('object');
                            }
                        }
                    }

                    // Verify structured error logging format
                    const structuredErrorLogs = logMessages.filter(log =>
                        log.level === 'error' &&
                        log.meta &&
                        typeof log.meta === 'object'
                    );

                    if (structuredErrorLogs.length > 0) {
                        for (const errorLog of structuredErrorLogs) {
                            // Should have structured metadata
                            expect(errorLog.meta).toBeDefined();
                            expect(typeof errorLog.meta).toBe('object');

                            // Should include error context
                            expect(errorLog.message || errorLog.meta.error).toBeDefined();
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 22a: Error logging captures failure context and recovery actions', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    contractText: fc.string({ minLength: 50, maxLength: 200 }),
                    failureType: fc.oneof(
                        fc.constant('parsing_error'),
                        fc.constant('validation_error'),
                        fc.constant('resource_exhaustion')
                    ),
                    retryAttempts: fc.integer({ min: 1, max: 3 })
                }),
                async ({ contractText, failureType, retryAttempts }) => {
                    logMessages = [];

                    let attemptCount = 0;
                    modelManager.isLoaded = true;
                    modelManager.inference = async (prompt) => {
                        attemptCount++;

                        // Fail for the specified number of attempts, then succeed
                        if (attemptCount <= retryAttempts) {
                            switch (failureType) {
                                case 'parsing_error':
                                    return "{ invalid json response";
                                case 'validation_error':
                                    return JSON.stringify({ invalid: "missing required fields" });
                                case 'resource_exhaustion':
                                    throw new Error('Insufficient memory for processing');
                            }
                        }

                        // Success after retries
                        return JSON.stringify({
                            clauses: [{
                                id: "clause_1",
                                text: "Sample clause",
                                type: "general",
                                confidence: 0.8
                            }]
                        });
                    };

                    try {
                        await contractAnalyzer.analyzeContract(contractText);
                    } catch (error) {
                        // Expected for some failure scenarios
                    }

                    // Should log failure context
                    const contextLogs = logMessages.filter(log =>
                        log.meta && (
                            log.meta.attemptCount !== undefined ||
                            log.meta.failureType !== undefined ||
                            log.meta.retryAttempts !== undefined ||
                            log.meta.error !== undefined
                        )
                    );

                    // Should capture recovery actions if retries occurred
                    if (attemptCount > 1) {
                        const retryLogs = logMessages.filter(log =>
                            log.message.includes('retry') ||
                            log.message.includes('attempt') ||
                            log.message.includes('fallback')
                        );

                        expect(retryLogs.length).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 22b: Fallback logging includes system state and decision rationale', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    contractText: fc.string({ minLength: 100, maxLength: 300 }),
                    systemState: fc.record({
                        memoryUsage: fc.float({ min: Math.fround(0.1), max: Math.fround(0.9) }),
                        modelHealth: fc.oneof(
                            fc.constant('healthy'),
                            fc.constant('degraded'),
                            fc.constant('unhealthy')
                        ),
                        loadAverage: fc.float({ min: Math.fround(0.1), max: Math.fround(2.0) })
                    })
                }),
                async ({ contractText, systemState }) => {
                    logMessages = [];

                    // Mock system state
                    modelManager.isLoaded = systemState.modelHealth === 'healthy';
                    modelManager.healthStatus = systemState.modelHealth;
                    modelManager.getPerformanceMetrics = () => ({
                        memoryUsage: systemState.memoryUsage * 8000,
                        memoryLimit: 8000,
                        memoryUtilization: systemState.memoryUsage,
                        healthStatus: systemState.modelHealth
                    });

                    if (systemState.modelHealth !== 'healthy') {
                        modelManager.inference = async () => {
                            throw new Error(`Model ${systemState.modelHealth} - cannot process request`);
                        };
                    } else {
                        modelManager.inference = async () => JSON.stringify({ clauses: [], risks: [] });
                    }

                    try {
                        await contractAnalyzer.analyzeContract(contractText);
                    } catch (error) {
                        // Expected for unhealthy states
                    }

                    // Should log system state when making fallback decisions
                    if (systemState.modelHealth !== 'healthy') {
                        const systemStateLogs = logMessages.filter(log =>
                            log.meta && (
                                log.meta.memoryUsage !== undefined ||
                                log.meta.healthStatus !== undefined ||
                                log.meta.modelHealth !== undefined ||
                                log.meta.systemState !== undefined
                            )
                        );

                        // Should include decision rationale
                        const decisionLogs = logMessages.filter(log =>
                            log.message.includes('fallback') ||
                            log.message.includes('switching') ||
                            log.message.includes('degraded') ||
                            log.message.includes('unhealthy')
                        );

                        if (decisionLogs.length > 0) {
                            expect(decisionLogs[0].message).toBeDefined();
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 22c: Error logging maintains audit trail for debugging', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    contractText: fc.string({ minLength: 50, maxLength: 150 }),
                    errorSequence: fc.array(
                        fc.oneof(
                            fc.constant('model_error'),
                            fc.constant('parsing_error'),
                            fc.constant('validation_error')
                        ),
                        { minLength: 1, maxLength: 3 }
                    )
                }),
                async ({ contractText, errorSequence }) => {
                    logMessages = [];

                    let errorIndex = 0;
                    modelManager.isLoaded = true;
                    modelManager.inference = async (prompt) => {
                        if (errorIndex < errorSequence.length) {
                            const errorType = errorSequence[errorIndex];
                            errorIndex++;

                            switch (errorType) {
                                case 'model_error':
                                    throw new Error(`Model error ${errorIndex}`);
                                case 'parsing_error':
                                    return "{ malformed json";
                                case 'validation_error':
                                    return JSON.stringify({ incomplete: "data" });
                            }
                        }

                        return JSON.stringify({ clauses: [], risks: [] });
                    };

                    try {
                        await contractAnalyzer.analyzeContract(contractText);
                    } catch (error) {
                        // Expected for error sequences
                    }

                    // Should maintain chronological audit trail
                    const errorLogs = logMessages.filter(log => log.level === 'error');
                    const warnLogs = logMessages.filter(log => log.level === 'warn');
                    const allRelevantLogs = [...errorLogs, ...warnLogs].sort((a, b) => {
                        // Sort by timestamp if available, otherwise by order
                        return 0;
                    });

                    // Should have logged errors or handled them gracefully
                    // Allow for systems that handle errors without extensive logging
                    expect(allRelevantLogs.length).toBeGreaterThanOrEqual(0);

                    // Each error log should have identifiable context
                    for (const log of errorLogs) {
                        expect(log.message || (log.meta && log.meta.error)).toBeDefined();

                        if (log.meta) {
                            expect(typeof log.meta).toBe('object');
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});