// Property-based test for comprehensive logging and metrics
// **Feature: ai-contract-analysis, Property 21: Comprehensive logging and metrics**
// **Validates: Requirements 10.1, 10.4, 10.5**

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { ContractAnalyzer } from '../../model/analyzers/ContractAnalyzer.js';
import { ModelManager } from '../../model/core/ModelManager.js';
import winston from 'winston';

describe('Comprehensive Logging and Metrics Property Tests', () => {
    let contractAnalyzer;
    let modelManager;
    let logSpy;
    let logMessages;

    beforeEach(() => {
        // Capture log messages
        logMessages = [];
        logSpy = vi.spyOn(winston, 'createLogger').mockImplementation(() => ({
            info: vi.fn((message, meta) => logMessages.push({ level: 'info', message, meta })),
            debug: vi.fn((message, meta) => logMessages.push({ level: 'debug', message, meta })),
            warn: vi.fn((message, meta) => logMessages.push({ level: 'warn', message, meta })),
            error: vi.fn((message, meta) => logMessages.push({ level: 'error', message, meta }))
        }));

        modelManager = new ModelManager();
        contractAnalyzer = new ContractAnalyzer({ model: { modelManager } });
    });

    afterEach(async () => {
        if (contractAnalyzer) {
            await contractAnalyzer.cleanup();
        }
        vi.restoreAllMocks();
    });

    it('Property 21: Comprehensive logging and metrics - system logs processing time, token usage, and confidence scores', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    contractText: fc.oneof(
                        fc.constant("PAYMENT TERMS: Payment shall be made within 30 days. LIABILITY: Limited liability clause. TERMINATION: 60 days notice required."),
                        fc.constant("CONFIDENTIALITY: Information must remain confidential. IP RIGHTS: All intellectual property belongs to client."),
                        fc.constant("GOVERNING LAW: This agreement is governed by state law. DISPUTE RESOLUTION: Arbitration required for disputes.")
                    ),
                    analysisOptions: fc.record({
                        enableClauseExtraction: fc.constant(true), // Always enable at least one feature
                        enableRiskAnalysis: fc.boolean(),
                        enableRecommendations: fc.boolean(),
                        confidenceThreshold: fc.float({ min: Math.fround(0.1), max: Math.fround(0.9) })
                    }),
                    modelConfig: fc.record({
                        modelName: fc.constant("llama3.1:8b"),
                        temperature: fc.float({ min: 0.0, max: 0.5 }),
                        maxTokens: fc.integer({ min: 1000, max: 4000 })
                    })
                }),
                async ({ contractText, analysisOptions, modelConfig }) => {
                    // Mock model manager for consistent testing
                    modelManager.isLoaded = true;
                    modelManager.modelConfig = modelConfig;

                    let inferenceCallCount = 0;
                    let totalTokensUsed = 0;

                    modelManager.inference = async (prompt, options) => {
                        inferenceCallCount++;
                        const estimatedTokens = Math.ceil(prompt.length / 4) + (options?.maxTokens || 1000);
                        totalTokensUsed += estimatedTokens;

                        // Simulate processing time
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

                        if (prompt.includes('clause')) {
                            return JSON.stringify({
                                clauses: [
                                    {
                                        id: "clause_1",
                                        text: "Sample clause text",
                                        type: "payment_terms",
                                        category: "Financial",
                                        confidence: 0.85,
                                        startPosition: 0,
                                        endPosition: 50
                                    }
                                ]
                            });
                        }

                        if (prompt.includes('risk')) {
                            return JSON.stringify({
                                risks: [
                                    {
                                        id: "risk_1",
                                        title: "Sample Risk",
                                        description: "Risk description",
                                        severity: "Medium",
                                        category: "Financial",
                                        affectedClauses: ["clause_1"],
                                        confidence: 0.75
                                    }
                                ]
                            });
                        }

                        return JSON.stringify({ recommendations: [] });
                    };

                    modelManager.getPerformanceMetrics = () => ({
                        averageInferenceTime: 150,
                        successRate: 0.95,
                        totalRequests: inferenceCallCount,
                        failedRequests: 0,
                        memoryUsage: 4000,
                        memoryLimit: 8000,
                        memoryUtilization: 0.5,
                        uptime: 30000,
                        healthStatus: 'healthy'
                    });

                    // Clear previous log messages
                    logMessages = [];

                    // Perform analysis
                    const startTime = Date.now();
                    const result = await contractAnalyzer.analyzeContract(contractText, analysisOptions);
                    const endTime = Date.now();
                    const actualProcessingTime = endTime - startTime;

                    // Requirement 10.1: System SHALL log processing time, token usage, and model confidence scores

                    // Check that processing time is logged (in completion logs)
                    const processingTimeLogs = logMessages.filter(log =>
                        log.message.includes('completed successfully') &&
                        log.meta &&
                        typeof log.meta.processingTime === 'number'
                    );
                    expect(processingTimeLogs.length).toBeGreaterThan(0);

                    // Verify processing time is reasonable
                    const loggedProcessingTime = processingTimeLogs[0].meta.processingTime;
                    expect(loggedProcessingTime).toBeGreaterThan(0);
                    expect(loggedProcessingTime).toBeLessThan(actualProcessingTime + 100); // Allow some tolerance

                    // Check that token usage information is available in result metadata
                    expect(result.metadata.tokenUsage).toBeDefined();
                    expect(typeof result.metadata.tokenUsage).toBe('number');
                    expect(result.metadata.tokenUsage).toBeGreaterThan(0);

                    // Check that confidence scores are logged and present in results
                    expect(result.metadata.confidence).toBeDefined();
                    expect(typeof result.metadata.confidence).toBe('number');
                    expect(result.metadata.confidence).toBeGreaterThanOrEqual(0);
                    expect(result.metadata.confidence).toBeLessThanOrEqual(1);

                    // Requirement 10.4: System SHALL provide metrics on clause extraction accuracy and risk assessment confidence

                    if (analysisOptions.enableClauseExtraction && result.clauses.length > 0) {
                        // Check clause confidence scores are logged
                        for (const clause of result.clauses) {
                            expect(clause.confidence).toBeDefined();
                            expect(typeof clause.confidence).toBe('number');
                            expect(clause.confidence).toBeGreaterThanOrEqual(0);
                            expect(clause.confidence).toBeLessThanOrEqual(1);
                        }
                    }

                    if (analysisOptions.enableRiskAnalysis && result.risks.length > 0) {
                        // Check risk confidence scores are logged
                        for (const risk of result.risks) {
                            expect(risk.confidence).toBeDefined();
                            expect(typeof risk.confidence).toBe('number');
                            expect(risk.confidence).toBeGreaterThanOrEqual(0);
                            expect(risk.confidence).toBeLessThanOrEqual(1);
                        }
                    }

                    // Requirement 10.5: System SHALL structure logs for easy analysis and performance monitoring

                    // Check that logs are structured with proper metadata
                    const structuredLogs = logMessages.filter(log =>
                        log.meta &&
                        typeof log.meta === 'object' &&
                        Object.keys(log.meta).length > 0
                    );
                    expect(structuredLogs.length).toBeGreaterThan(0);

                    // Check for analysis start/completion logs
                    const analysisStartLogs = logMessages.filter(log =>
                        log.message.includes('Starting contract analysis') &&
                        log.meta &&
                        log.meta.analysisId
                    );
                    expect(analysisStartLogs.length).toBeGreaterThan(0);

                    const analysisCompleteLogs = logMessages.filter(log =>
                        log.message.includes('completed successfully') &&
                        log.meta &&
                        typeof log.meta.processingTime === 'number'
                    );
                    expect(analysisCompleteLogs.length).toBeGreaterThan(0);

                    // Check that performance metrics are available
                    const performanceMetrics = contractAnalyzer.getPerformanceMetrics();
                    expect(performanceMetrics).toBeDefined();
                    expect(typeof performanceMetrics.totalAnalyses).toBe('number');
                    expect(typeof performanceMetrics.successfulAnalyses).toBe('number');
                    expect(typeof performanceMetrics.averageProcessingTime).toBe('number');
                    expect(typeof performanceMetrics.successRate).toBe('number');

                    // Verify model performance metrics are included
                    expect(performanceMetrics.modelStatus).toBeDefined();
                    expect(performanceMetrics.modelStatus.performanceMetrics).toBeDefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 21a: Logging captures detailed analysis workflow steps', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    contractText: fc.oneof(
                        fc.constant("PAYMENT TERMS: Payment within 30 days. LIABILITY: Limited liability clause."),
                        fc.constant("CONFIDENTIALITY: Information confidential. TERMINATION: 60 days notice."),
                        fc.constant("GOVERNING LAW: State law applies. DISPUTE: Arbitration required.")
                    ),
                    enabledFeatures: fc.record({
                        enableClauseExtraction: fc.constant(true), // Always enable at least one feature
                        enableRiskAnalysis: fc.boolean(),
                        enableRecommendations: fc.boolean()
                    })
                }),
                async ({ contractText, enabledFeatures }) => {
                    modelManager.isLoaded = true;
                    modelManager.inference = async () => JSON.stringify({ clauses: [], risks: [], recommendations: [] });

                    logMessages = [];

                    await contractAnalyzer.analyzeContract(contractText, enabledFeatures);

                    // Should log workflow steps - but only check for steps that are actually enabled
                    const expectedSteps = ['Starting contract analysis', 'completed successfully'];

                    if (enabledFeatures.enableClauseExtraction) {
                        expectedSteps.push('clause extraction');
                    }
                    if (enabledFeatures.enableRiskAnalysis) {
                        expectedSteps.push('risk assessment');
                    }
                    if (enabledFeatures.enableRecommendations) {
                        expectedSteps.push('recommendation generation');
                    }

                    for (const step of expectedSteps) {
                        const stepLogs = logMessages.filter(log =>
                            log.message.toLowerCase().includes(step.toLowerCase())
                        );
                        expect(stepLogs.length).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 21b: Metrics collection includes performance benchmarks', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        contractText: fc.oneof(
                            fc.constant("PAYMENT TERMS: Payment within 30 days."),
                            fc.constant("LIABILITY: Limited liability clause."),
                            fc.constant("CONFIDENTIALITY: Information confidential.")
                        ),
                        processingDelay: fc.integer({ min: 10, max: 100 })
                    }),
                    { minLength: 2, maxLength: 5 }
                ),
                async (analysisRequests) => {
                    modelManager.isLoaded = true;

                    // Mock inference with variable processing times
                    modelManager.inference = async (prompt, options) => {
                        const request = analysisRequests[Math.floor(Math.random() * analysisRequests.length)];
                        await new Promise(resolve => setTimeout(resolve, request.processingDelay));
                        return JSON.stringify({ clauses: [], risks: [], recommendations: [] });
                    };

                    // Perform multiple analyses
                    for (const request of analysisRequests) {
                        await contractAnalyzer.analyzeContract(request.contractText);
                    }

                    // Check performance metrics accumulation
                    const metrics = contractAnalyzer.getPerformanceMetrics();

                    expect(metrics.totalAnalyses).toBe(analysisRequests.length);
                    expect(metrics.successfulAnalyses).toBe(analysisRequests.length);
                    expect(metrics.averageProcessingTime).toBeGreaterThan(0);
                    expect(metrics.successRate).toBe(1.0);

                    // Check that processing times are being tracked
                    expect(typeof metrics.averageProcessingTime).toBe('number');
                    expect(metrics.averageProcessingTime).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 21c: Structured logging includes analysis context and metadata', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    contractText: fc.oneof(
                        fc.constant("PAYMENT TERMS: Payment within 30 days. LIABILITY: Limited liability."),
                        fc.constant("CONFIDENTIALITY: Information confidential. TERMINATION: 60 days notice."),
                        fc.constant("GOVERNING LAW: State law applies. DISPUTE: Arbitration required.")
                    ),
                    documentType: fc.constant('txt'), // Use only 'txt' to avoid buffer issues in tests
                    analysisId: fc.constant("test_analysis_123")
                }),
                async ({ contractText, documentType, analysisId }) => {
                    modelManager.isLoaded = true;
                    modelManager.inference = async () => JSON.stringify({ clauses: [], risks: [], recommendations: [] });

                    logMessages = [];

                    await contractAnalyzer.analyzeContract(contractText, {
                        documentType,
                        title: `Test Contract ${analysisId}`
                    });

                    // Check that logs include contextual information
                    const contextualLogs = logMessages.filter(log =>
                        log.meta && (
                            log.meta.analysisId ||
                            log.meta.documentType ||
                            log.meta.enabledFeatures ||
                            log.meta.textLength ||
                            log.meta.processingTime
                        )
                    );

                    expect(contextualLogs.length).toBeGreaterThan(0);

                    // Verify structured metadata is present
                    const analysisStartLog = logMessages.find(log =>
                        log.message.includes('Starting contract analysis')
                    );

                    if (analysisStartLog && analysisStartLog.meta) {
                        expect(analysisStartLog.meta.analysisId).toBeDefined();
                        expect(typeof analysisStartLog.meta.analysisId).toBe('string');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});