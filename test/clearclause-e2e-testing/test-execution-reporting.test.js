/**
 * ClearClause End-to-End Testing: Test Execution Reporting Property Tests
 * 
 * **Feature: clearclause-e2e-testing, Property 10: Test Execution Reporting**
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**
 * 
 * Property-based tests to validate comprehensive test execution reporting including
 * feature functionality status, failed input type reporting, dataset processing coverage,
 * sample analysis outputs, and actionable recommendations for identified issues.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { TestExecutionReporter } from './utils/TestExecutionReporter.js';
import {
    analysisOutputGenerator,
    testScenarioGenerator,
    errorScenarioGenerator
} from './utils/test-data-generators.js';

describe('Test Execution Reporting Property Tests', () => {
    let reporter;

    beforeEach(() => {
        reporter = new TestExecutionReporter();
        reporter.initialize();
    });

    /**
     * **Feature: clearclause-e2e-testing, Property 10: Test Execution Reporting**
     * 
     * Property: For any completed test execution, the system should generate a final report 
     * confirming feature functionality status, list failed input types with exact error messages, 
     * report on representative files tested from each format, include sample summaries and risk assessments, 
     * and provide actionable recommendations for identified issues
     */
    test('Property 10: Test Execution Reporting', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate random test phases
                fc.array(
                    fc.record({
                        name: fc.constantFrom(
                            'AWS Connectivity Validation',
                            'Dataset File Processing',
                            'Raw Text Processing',
                            'URL Content Processing',
                            'API Endpoint Validation',
                            'Output Quality Validation',
                            'Error Handling Validation',
                            'Security Validation'
                        ),
                        status: fc.constantFrom('started', 'completed', 'failed'),
                        testsRun: fc.integer({ min: 1, max: 20 }),
                        testsPassed: fc.integer({ min: 0, max: 20 }),
                        duration: fc.integer({ min: 1000, max: 60000 })
                    }),
                    { minLength: 3, maxLength: 8 }
                ).map(phases => {
                    // Ensure testsPassed <= testsRun
                    return phases.map(phase => ({
                        ...phase,
                        testsPassed: Math.min(phase.testsPassed, phase.testsRun),
                        testsFailed: phase.testsRun - Math.min(phase.testsPassed, phase.testsRun)
                    }));
                }),

                // Generate random input type results
                fc.array(
                    fc.record({
                        inputType: fc.constantFrom('PDF', 'Image', 'Excel', 'RawText', 'URL'),
                        success: fc.boolean(),
                        errorMessage: fc.option(fc.string({ minLength: 10, max: 100 })),
                        processingTime: fc.integer({ min: 500, max: 30000 }),
                        fileSize: fc.option(fc.integer({ min: 1000, max: 10000000 })),
                        textLength: fc.option(fc.integer({ min: 100, max: 100000 }))
                    }),
                    { minLength: 1, maxLength: 5 }
                ),

                // Generate random dataset processing results
                fc.array(
                    fc.record({
                        fileName: fc.string({ minLength: 5, maxLength: 50 }).map(name => `${name}.pdf`),
                        fileType: fc.constantFrom('PDF', 'Image', 'Excel'),
                        success: fc.boolean(),
                        fileSize: fc.integer({ min: 1000, max: 10000000 }),
                        extractedTextLength: fc.option(fc.integer({ min: 100, max: 50000 })),
                        textractConfidence: fc.option(fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })),
                        processingTime: fc.integer({ min: 1000, max: 60000 }),
                        errorMessage: fc.option(fc.string({ minLength: 10, max: 100 }))
                    }),
                    { minLength: 2, maxLength: 10 }
                ),

                // Generate random sample outputs
                fc.array(
                    fc.record({
                        inputType: fc.constantFrom('PDF', 'Image', 'Excel', 'RawText', 'URL'),
                        analysisOutput: analysisOutputGenerator,
                        inputSource: fc.string({ minLength: 5, maxLength: 30 }),
                        inputSize: fc.integer({ min: 1000, max: 1000000 }),
                        processingTime: fc.integer({ min: 500, max: 30000 })
                    }),
                    { minLength: 1, maxLength: 8 }
                ),

                // Generate random feature status
                fc.array(
                    fc.record({
                        featureName: fc.constantFrom(
                            'File Upload Processing',
                            'Raw Text Analysis',
                            'URL Content Fetching',
                            'Clause Extraction',
                            'Risk Assessment',
                            'AWS Integration',
                            'Error Handling',
                            'Security Validation'
                        ),
                        working: fc.boolean(),
                        description: fc.string({ minLength: 10, maxLength: 100 }),
                        testResults: fc.array(
                            fc.record({
                                testName: fc.string({ minLength: 5, maxLength: 30 }),
                                passed: fc.boolean()
                            }),
                            { minLength: 1, maxLength: 5 }
                        )
                    }),
                    { minLength: 3, maxLength: 8 }
                ),

                async (testPhases, inputTypeResults, datasetResults, sampleOutputs, featureStatuses) => {
                    // Clear reporter state for each test iteration
                    reporter.clear();

                    // Record test phases
                    testPhases.forEach(phase => {
                        reporter.recordTestPhase(phase.name, phase.status, {
                            duration: phase.duration,
                            testsRun: phase.testsRun,
                            testsPassed: phase.testsPassed,
                            testsFailed: phase.testsFailed,
                            errorMessages: phase.status === 'failed' ? ['Phase failed'] : []
                        });
                    });

                    // Record input type results
                    inputTypeResults.forEach(result => {
                        reporter.recordInputTypeResult(
                            result.inputType,
                            result.success,
                            result.success ? null : (result.errorMessage || 'Processing failed'),
                            {
                                processingTime: result.processingTime,
                                fileSize: result.fileSize,
                                textLength: result.textLength
                            }
                        );
                    });

                    // Record dataset processing results
                    datasetResults.forEach(result => {
                        reporter.recordDatasetProcessing(
                            result.fileName,
                            result.fileType,
                            result.success,
                            {
                                fileSize: result.fileSize,
                                extractedTextLength: result.extractedTextLength,
                                textractConfidence: result.textractConfidence,
                                processingTime: result.processingTime,
                                errorMessage: result.success ? null : (result.errorMessage || 'Processing failed')
                            }
                        );
                    });

                    // Record sample outputs
                    sampleOutputs.forEach(sample => {
                        reporter.recordSampleOutput(
                            sample.inputType,
                            sample.analysisOutput,
                            {
                                inputSource: sample.inputSource,
                                inputSize: sample.inputSize,
                                processingTime: sample.processingTime
                            }
                        );
                    });

                    // Record feature statuses
                    featureStatuses.forEach(feature => {
                        reporter.recordFeatureStatus(
                            feature.featureName,
                            feature.working,
                            feature.description,
                            feature.testResults
                        );
                    });

                    // Generate final report
                    const report = await reporter.generateFinalReport();

                    // Requirement 10.1: Final report confirming feature functionality status
                    expect(report.executionSummary).toBeDefined();
                    expect(report.executionSummary.startTime).toBeDefined();
                    expect(report.executionSummary.endTime).toBeDefined();
                    expect(report.executionSummary.totalDuration).toBeGreaterThanOrEqual(0);
                    expect(report.executionSummary.allFeaturesWorking).toBeDefined();
                    expect(typeof report.executionSummary.allFeaturesWorking).toBe('boolean');
                    expect(report.executionSummary.overallSuccess).toBeDefined();
                    expect(typeof report.executionSummary.overallSuccess).toBe('boolean');

                    // Validate feature status reporting
                    expect(report.featureStatus).toBeDefined();
                    expect(typeof report.featureStatus).toBe('object');

                    // Calculate expected all features working (accounting for deduplication by feature name)
                    const featuresByNameForWorking = featureStatuses.reduce((acc, feature) => {
                        acc[feature.featureName] = feature; // Last feature with this name wins
                        return acc;
                    }, {});
                    const expectedAllFeaturesWorking = Object.values(featuresByNameForWorking).every(f => f.working);
                    expect(report.executionSummary.allFeaturesWorking).toBe(expectedAllFeaturesWorking);

                    // Calculate unique features (TestExecutionReporter deduplicates by feature name)
                    const featuresByName = featureStatuses.reduce((acc, feature) => {
                        acc[feature.featureName] = feature; // Last feature with this name wins
                        return acc;
                    }, {});

                    Object.values(featuresByName).forEach(expectedFeature => {
                        expect(report.featureStatus[expectedFeature.featureName]).toBeDefined();
                        expect(report.featureStatus[expectedFeature.featureName].working).toBe(expectedFeature.working);
                        expect(report.featureStatus[expectedFeature.featureName].description).toBe(expectedFeature.description);
                    });

                    // Requirement 10.2: Failed input types with exact error messages
                    expect(report.failedInputTypes).toBeDefined();
                    expect(Array.isArray(report.failedInputTypes)).toBe(true);

                    // Calculate expected failed types (accounting for deduplication by inputType)
                    const failedResultsByType = inputTypeResults.reduce((acc, result) => {
                        acc[result.inputType] = result; // Last result with this inputType wins
                        return acc;
                    }, {});
                    const expectedFailedTypes = Object.values(failedResultsByType).filter(r => !r.success);
                    expect(report.failedInputTypes).toHaveLength(expectedFailedTypes.length);

                    expectedFailedTypes.forEach((expectedFailure) => {
                        const reportedFailure = report.failedInputTypes.find(f => f.inputType === expectedFailure.inputType);
                        expect(reportedFailure).toBeDefined();
                        expect(reportedFailure.inputType).toBe(expectedFailure.inputType);
                        expect(reportedFailure.errorMessage).toBeDefined();
                        expect(reportedFailure.timestamp).toBeDefined();

                        if (expectedFailure.errorMessage) {
                            expect(reportedFailure.errorMessage).toBe(expectedFailure.errorMessage);
                        }
                    });

                    // Requirement 10.3: Dataset processing coverage
                    expect(report.datasetCoverage).toBeDefined();
                    expect(report.datasetCoverage.totalFiles).toBe(datasetResults.length);
                    expect(report.datasetCoverage.successfulFiles).toBe(datasetResults.filter(r => r.success).length);
                    expect(report.datasetCoverage.failedFiles).toBe(datasetResults.filter(r => !r.success).length);
                    expect(report.datasetCoverage.fileTypeBreakdown).toBeDefined();
                    expect(report.datasetCoverage.successRate).toBeGreaterThanOrEqual(0);
                    expect(report.datasetCoverage.successRate).toBeLessThanOrEqual(100);

                    // Validate file type breakdown
                    const fileTypeGroups = datasetResults.reduce((groups, result) => {
                        if (!groups[result.fileType]) {
                            groups[result.fileType] = { total: 0, successful: 0, failed: 0 };
                        }
                        groups[result.fileType].total++;
                        if (result.success) {
                            groups[result.fileType].successful++;
                        } else {
                            groups[result.fileType].failed++;
                        }
                        return groups;
                    }, {});

                    Object.keys(fileTypeGroups).forEach(fileType => {
                        const expected = fileTypeGroups[fileType];
                        const reported = report.datasetCoverage.fileTypeBreakdown[fileType];
                        expect(reported).toBeDefined();
                        expect(reported.total).toBe(expected.total);
                        expect(reported.successful).toBe(expected.successful);
                        expect(reported.failed).toBe(expected.failed);
                    });

                    expect(report.datasetProcessingResults).toBeDefined();
                    expect(report.datasetProcessingResults).toHaveLength(datasetResults.length);

                    // Requirement 10.4: Sample analysis outputs
                    expect(report.sampleOutputs).toBeDefined();
                    expect(Array.isArray(report.sampleOutputs)).toBe(true);
                    expect(report.sampleOutputs).toHaveLength(sampleOutputs.length);

                    report.sampleOutputs.forEach((reportedSample, index) => {
                        const expectedSample = sampleOutputs[index];
                        expect(reportedSample.inputType).toBe(expectedSample.inputType);
                        expect(reportedSample.analysis).toBeDefined();
                        expect(reportedSample.analysis.summary).toBeDefined();
                        expect(reportedSample.analysis.clauses).toBeDefined();
                        expect(reportedSample.analysis.risks).toBeDefined();
                        expect(reportedSample.qualityMetrics).toBeDefined();
                        expect(reportedSample.qualityMetrics.summaryLength).toBeGreaterThanOrEqual(0);
                        expect(reportedSample.qualityMetrics.clauseCount).toBeGreaterThanOrEqual(0);
                        expect(reportedSample.qualityMetrics.riskCount).toBeGreaterThanOrEqual(0);
                    });

                    // Requirement 10.5: Actionable recommendations
                    expect(report.recommendations).toBeDefined();
                    expect(Array.isArray(report.recommendations)).toBe(true);
                    expect(report.recommendations.length).toBeGreaterThan(0);

                    report.recommendations.forEach(recommendation => {
                        expect(recommendation.category).toBeDefined();
                        expect(recommendation.priority).toBeDefined();
                        expect(recommendation.description).toBeDefined();
                        expect(recommendation.actions).toBeDefined();
                        expect(Array.isArray(recommendation.actions)).toBe(true);
                        expect(recommendation.impact).toBeDefined();

                        // Validate priority levels
                        expect(['HIGH', 'MEDIUM', 'LOW', 'INFO']).toContain(recommendation.priority);
                    });

                    // Validate that recommendations are contextually appropriate (accounting for deduplication)
                    const hasFailedInputTypes = expectedFailedTypes.length > 0;

                    // Check for non-working features after deduplication
                    const finalFeaturesByName = featureStatuses.reduce((acc, feature) => {
                        acc[feature.featureName] = feature; // Last feature with this name wins
                        return acc;
                    }, {});
                    const hasNonWorkingFeatures = Object.values(finalFeaturesByName).some(f => !f.working);

                    const datasetSuccessRate = datasetResults.length > 0
                        ? (datasetResults.filter(r => r.success).length / datasetResults.length) * 100
                        : 100;

                    if (hasFailedInputTypes) {
                        const inputTypeRecommendation = report.recommendations.find(r =>
                            r.category === 'Input Type Failures'
                        );
                        expect(inputTypeRecommendation).toBeDefined();
                        expect(inputTypeRecommendation.priority).toBe('HIGH');
                    }

                    if (hasNonWorkingFeatures) {
                        const featureRecommendation = report.recommendations.find(r =>
                            r.category === 'Feature Completeness'
                        );
                        expect(featureRecommendation).toBeDefined();
                        expect(featureRecommendation.priority).toBe('HIGH');
                    }

                    if (datasetSuccessRate < 90 && datasetResults.length > 0) {
                        const datasetRecommendation = report.recommendations.find(r =>
                            r.category === 'Dataset Processing'
                        );
                        expect(datasetRecommendation).toBeDefined();
                    }

                    // Validate metadata
                    expect(report.metadata).toBeDefined();
                    expect(report.metadata.reportGeneratedAt).toBeDefined();
                    expect(report.metadata.totalSampleOutputs).toBe(sampleOutputs.length);
                    expect(report.metadata.totalDatasetFiles).toBe(datasetResults.length);

                    // Validate test phases reporting (accounting for deduplication by phase name)
                    expect(report.testPhases).toBeDefined();
                    expect(Array.isArray(report.testPhases)).toBe(true);

                    // Calculate unique phases (TestExecutionReporter deduplicates by phase name)
                    const uniquePhaseNames = [...new Set(testPhases.map(p => p.name))];
                    const expectedUniquePhases = uniquePhaseNames.length;
                    expect(report.testPhases).toHaveLength(expectedUniquePhases);

                    // For completed phases, we need to check the final status of each unique phase
                    const phasesByName = testPhases.reduce((acc, phase) => {
                        acc[phase.name] = phase; // Last phase with this name wins
                        return acc;
                    }, {});
                    const completedPhases = Object.values(phasesByName).filter(p => p.status === 'completed').length;
                    expect(report.executionSummary.testPhasesCompleted).toBe(completedPhases);
                    expect(report.executionSummary.totalTestPhases).toBe(expectedUniquePhases);

                    // Validate input type results reporting (accounting for deduplication by inputType)
                    expect(report.inputTypeResults).toBeDefined();
                    expect(typeof report.inputTypeResults).toBe('object');

                    // Calculate unique input types (TestExecutionReporter deduplicates by inputType)
                    const uniqueResultsByType = inputTypeResults.reduce((acc, result) => {
                        acc[result.inputType] = result; // Last result with this inputType wins
                        return acc;
                    }, {});

                    Object.values(uniqueResultsByType).forEach(expectedResult => {
                        const reportedResult = report.inputTypeResults[expectedResult.inputType];
                        expect(reportedResult).toBeDefined();
                        expect(reportedResult.success).toBe(expectedResult.success);
                        expect(reportedResult.processingTime).toBe(expectedResult.processingTime);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    test('Property: Failed input type reporting accuracy', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        inputType: fc.constantFrom('PDF', 'Image', 'Excel', 'RawText', 'URL'),
                        success: fc.boolean(),
                        errorMessage: fc.string({ minLength: 10, maxLength: 100 }),
                        processingTime: fc.integer({ min: 100, max: 30000 })
                    }),
                    { minLength: 1, maxLength: 5 }
                ),

                async (inputTypeResults) => {
                    // Clear reporter state for each test iteration
                    reporter.clear();

                    // Record input type results
                    inputTypeResults.forEach(result => {
                        reporter.recordInputTypeResult(
                            result.inputType,
                            result.success,
                            result.success ? null : result.errorMessage,
                            { processingTime: result.processingTime }
                        );
                    });

                    const failedTypes = reporter.getFailedInputTypes();

                    // Calculate expected failures (accounting for deduplication by inputType)
                    const accuracyResultsByType = inputTypeResults.reduce((acc, result) => {
                        acc[result.inputType] = result; // Last result with this inputType wins
                        return acc;
                    }, {});
                    const expectedFailures = Object.values(accuracyResultsByType).filter(r => !r.success);

                    expect(failedTypes).toHaveLength(expectedFailures.length);

                    expectedFailures.forEach(expectedFailure => {
                        const reportedFailure = failedTypes.find(f => f.inputType === expectedFailure.inputType);
                        expect(reportedFailure).toBeDefined();
                        expect(reportedFailure.errorMessage).toBe(expectedFailure.errorMessage);
                        expect(reportedFailure.processingTime).toBe(expectedFailure.processingTime);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    test('Property: Dataset coverage calculation accuracy', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        fileName: fc.string({ minLength: 5, maxLength: 30 }).map(name => `${name}.pdf`),
                        fileType: fc.constantFrom('PDF', 'Image', 'Excel'),
                        success: fc.boolean(),
                        processingTime: fc.integer({ min: 1000, max: 60000 }),
                        textractConfidence: fc.option(fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }))
                    }),
                    { minLength: 3, maxLength: 15 }
                ),

                async (datasetResults) => {
                    // Clear reporter state for each test iteration
                    reporter.clear();

                    // Record dataset processing results
                    datasetResults.forEach(result => {
                        reporter.recordDatasetProcessing(
                            result.fileName,
                            result.fileType,
                            result.success,
                            {
                                processingTime: result.processingTime,
                                textractConfidence: result.textractConfidence
                            }
                        );
                    });

                    const coverage = reporter.getDatasetCoverage();

                    // Validate basic counts
                    expect(coverage.totalFiles).toBe(datasetResults.length);
                    expect(coverage.successfulFiles).toBe(datasetResults.filter(r => r.success).length);
                    expect(coverage.failedFiles).toBe(datasetResults.filter(r => !r.success).length);

                    // Validate success rate calculation
                    const expectedSuccessRate = datasetResults.length > 0
                        ? (coverage.successfulFiles / coverage.totalFiles) * 100
                        : 0;
                    expect(coverage.successRate).toBeCloseTo(expectedSuccessRate, 2);

                    // Validate file type breakdown
                    const typeGroups = datasetResults.reduce((groups, result) => {
                        if (!groups[result.fileType]) {
                            groups[result.fileType] = { total: 0, successful: 0, failed: 0 };
                        }
                        groups[result.fileType].total++;
                        if (result.success) {
                            groups[result.fileType].successful++;
                        } else {
                            groups[result.fileType].failed++;
                        }
                        return groups;
                    }, {});

                    Object.keys(typeGroups).forEach(fileType => {
                        const expected = typeGroups[fileType];
                        const reported = coverage.fileTypeBreakdown[fileType];
                        expect(reported.total).toBe(expected.total);
                        expect(reported.successful).toBe(expected.successful);
                        expect(reported.failed).toBe(expected.failed);
                    });

                    // Validate processing statistics
                    const expectedTotalTime = datasetResults.reduce((sum, r) => sum + r.processingTime, 0);
                    expect(coverage.processingStats.totalProcessingTime).toBe(expectedTotalTime);

                    if (datasetResults.length > 0) {
                        const expectedAvgTime = expectedTotalTime / datasetResults.length;
                        expect(coverage.processingStats.averageProcessingTime).toBeCloseTo(expectedAvgTime, 2);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('Property: Sample output recording and quality metrics', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        inputType: fc.constantFrom('PDF', 'Image', 'Excel', 'RawText', 'URL'),
                        analysisOutput: analysisOutputGenerator,
                        inputSource: fc.string({ minLength: 5, maxLength: 20 }),
                        processingTime: fc.integer({ min: 500, max: 30000 })
                    }),
                    { minLength: 1, maxLength: 8 }
                ),

                async (sampleOutputs) => {
                    // Clear reporter state for each test iteration
                    reporter.clear();

                    // Record sample outputs
                    sampleOutputs.forEach(sample => {
                        reporter.recordSampleOutput(
                            sample.inputType,
                            sample.analysisOutput,
                            {
                                inputSource: sample.inputSource,
                                processingTime: sample.processingTime
                            }
                        );
                    });

                    const report = await reporter.generateFinalReport();

                    expect(report.sampleOutputs).toHaveLength(sampleOutputs.length);

                    report.sampleOutputs.forEach((reportedSample, index) => {
                        const expectedSample = sampleOutputs[index];

                        expect(reportedSample.inputType).toBe(expectedSample.inputType);
                        expect(reportedSample.inputSource).toBe(expectedSample.inputSource);
                        expect(reportedSample.processingTime).toBe(expectedSample.processingTime);

                        // Validate analysis structure
                        expect(reportedSample.analysis.summary).toBe(expectedSample.analysisOutput.summary);
                        expect(reportedSample.analysis.clauses).toEqual(expectedSample.analysisOutput.clauses);
                        expect(reportedSample.analysis.risks).toEqual(expectedSample.analysisOutput.risks);

                        // Validate quality metrics calculation
                        const expectedSummaryLength = expectedSample.analysisOutput.summary
                            ? expectedSample.analysisOutput.summary.length
                            : 0;
                        expect(reportedSample.qualityMetrics.summaryLength).toBe(expectedSummaryLength);

                        const expectedClauseCount = expectedSample.analysisOutput.clauses
                            ? expectedSample.analysisOutput.clauses.length
                            : 0;
                        expect(reportedSample.qualityMetrics.clauseCount).toBe(expectedClauseCount);

                        const expectedRiskCount = expectedSample.analysisOutput.risks
                            ? expectedSample.analysisOutput.risks.length
                            : 0;
                        expect(reportedSample.qualityMetrics.riskCount).toBe(expectedRiskCount);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    test('Property: Actionable recommendations generation logic', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    hasFailedInputTypes: fc.boolean(),
                    hasNonWorkingFeatures: fc.boolean(),
                    datasetSuccessRate: fc.float({ min: Math.fround(0), max: Math.fround(100) }),
                    avgProcessingTime: fc.integer({ min: 1000, max: 60000 })
                }),

                async (scenario) => {
                    // Clear reporter state for each test iteration
                    reporter.clear();

                    // Set up scenario based on test parameters
                    if (scenario.hasFailedInputTypes) {
                        reporter.recordInputTypeResult('PDF', false, 'PDF processing failed');
                    } else {
                        reporter.recordInputTypeResult('PDF', true);
                    }

                    if (scenario.hasNonWorkingFeatures) {
                        reporter.recordFeatureStatus('File Upload Processing', false, 'Feature not working');
                    } else {
                        reporter.recordFeatureStatus('File Upload Processing', true, 'Feature working correctly');
                    }

                    // Create dataset results to match success rate
                    const totalFiles = 10;
                    const successfulFiles = Math.round((scenario.datasetSuccessRate / 100) * totalFiles);

                    for (let i = 0; i < totalFiles; i++) {
                        const success = i < successfulFiles;
                        reporter.recordDatasetProcessing(
                            `file_${i}.pdf`,
                            'PDF',
                            success,
                            {
                                processingTime: scenario.avgProcessingTime,
                                errorMessage: success ? null : 'Processing failed'
                            }
                        );
                    }

                    const recommendations = reporter.generateActionableRecommendations();

                    expect(Array.isArray(recommendations)).toBe(true);
                    expect(recommendations.length).toBeGreaterThan(0);

                    // Validate recommendation logic
                    if (scenario.hasFailedInputTypes) {
                        const inputTypeRec = recommendations.find(r => r.category === 'Input Type Failures');
                        expect(inputTypeRec).toBeDefined();
                        expect(inputTypeRec.priority).toBe('HIGH');
                    }

                    if (scenario.hasNonWorkingFeatures) {
                        const featureRec = recommendations.find(r => r.category === 'Feature Completeness');
                        expect(featureRec).toBeDefined();
                        expect(featureRec.priority).toBe('HIGH');
                    }

                    if (scenario.datasetSuccessRate < 90) {
                        const datasetRec = recommendations.find(r => r.category === 'Dataset Processing');
                        expect(datasetRec).toBeDefined();
                        expect(['HIGH', 'MEDIUM'].includes(datasetRec.priority)).toBe(true);
                    }

                    if (scenario.avgProcessingTime > 30000) {
                        const performanceRec = recommendations.find(r => r.category === 'Performance');
                        expect(performanceRec).toBeDefined();
                        expect(performanceRec.priority).toBe('MEDIUM');
                    }

                    // If no issues, should have success recommendation
                    if (!scenario.hasFailedInputTypes && !scenario.hasNonWorkingFeatures &&
                        scenario.datasetSuccessRate >= 90 && scenario.avgProcessingTime <= 30000) {
                        const successRec = recommendations.find(r => r.category === 'System Status');
                        expect(successRec).toBeDefined();
                        expect(successRec.priority).toBe('INFO');
                    }

                    // Validate recommendation structure
                    recommendations.forEach(rec => {
                        expect(rec.category).toBeDefined();
                        expect(rec.priority).toBeDefined();
                        expect(rec.description).toBeDefined();
                        expect(Array.isArray(rec.actions)).toBe(true);
                        expect(rec.actions.length).toBeGreaterThan(0);
                        expect(rec.impact).toBeDefined();
                        expect(['HIGH', 'MEDIUM', 'LOW', 'INFO']).toContain(rec.priority);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });
});