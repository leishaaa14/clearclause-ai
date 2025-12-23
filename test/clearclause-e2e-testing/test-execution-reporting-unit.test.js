/**
 * ClearClause End-to-End Testing: Test Execution Reporting Unit Tests
 * 
 * Unit tests for test execution reporting components including final report generation,
 * failure reporting, dataset coverage reporting, and sample output inclusion.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TestExecutionReporter } from './utils/TestExecutionReporter.js';

describe('Test Execution Reporting Unit Tests', () => {
    let reporter;

    beforeEach(() => {
        reporter = new TestExecutionReporter();
        reporter.initialize();
    });

    describe('Final Report Generation', () => {
        test('should generate complete final report structure', async () => {
            // Setup test data
            reporter.recordTestPhase('AWS Connectivity', 'completed', {
                duration: 5000,
                testsRun: 10,
                testsPassed: 10,
                testsFailed: 0
            });

            reporter.recordFeatureStatus('File Upload Processing', true, 'Working correctly');
            reporter.recordInputTypeResult('PDF', true, null, { processingTime: 2000 });
            reporter.recordDatasetProcessing('test.pdf', 'PDF', true, { processingTime: 3000 });

            const sampleAnalysis = {
                summary: 'Test contract summary',
                clauses: [{ type: 'termination', text: 'Test clause' }],
                risks: [{ level: 'Medium', description: 'Test risk' }]
            };
            reporter.recordSampleOutput('PDF', sampleAnalysis, { inputSource: 'test.pdf' });

            // Generate report
            const report = await reporter.generateFinalReport();

            // Validate report structure - Requirement 10.1
            expect(report).toBeDefined();
            expect(report.executionSummary).toBeDefined();
            expect(report.executionSummary.startTime).toBeDefined();
            expect(report.executionSummary.endTime).toBeDefined();
            expect(report.executionSummary.totalDuration).toBeGreaterThanOrEqual(0);
            expect(typeof report.executionSummary.allFeaturesWorking).toBe('boolean');
            expect(typeof report.executionSummary.overallSuccess).toBe('boolean');

            expect(report.featureStatus).toBeDefined();
            expect(report.testPhases).toBeDefined();
            expect(Array.isArray(report.testPhases)).toBe(true);
            expect(report.failedInputTypes).toBeDefined();
            expect(Array.isArray(report.failedInputTypes)).toBe(true);
            expect(report.datasetCoverage).toBeDefined();
            expect(report.sampleOutputs).toBeDefined();
            expect(Array.isArray(report.sampleOutputs)).toBe(true);
            expect(report.recommendations).toBeDefined();
            expect(Array.isArray(report.recommendations)).toBe(true);
            expect(report.metadata).toBeDefined();
        });

        test('should calculate execution summary correctly', async () => {
            // Setup successful scenario
            reporter.recordFeatureStatus('Feature A', true, 'Working');
            reporter.recordFeatureStatus('Feature B', true, 'Working');
            reporter.recordTestPhase('Phase 1', 'completed');
            reporter.recordTestPhase('Phase 2', 'completed');

            const report = await reporter.generateFinalReport();

            expect(report.executionSummary.allFeaturesWorking).toBe(true);
            expect(report.executionSummary.testPhasesCompleted).toBe(2);
            expect(report.executionSummary.totalTestPhases).toBe(2);
            expect(report.executionSummary.overallSuccess).toBe(true);
        });

        test('should handle failed features in execution summary', async () => {
            // Setup failed scenario
            reporter.recordFeatureStatus('Feature A', true, 'Working');
            reporter.recordFeatureStatus('Feature B', false, 'Not working');
            reporter.recordInputTypeResult('PDF', false, 'Processing failed');

            const report = await reporter.generateFinalReport();

            expect(report.executionSummary.allFeaturesWorking).toBe(false);
            expect(report.executionSummary.overallSuccess).toBe(false);
        });

        test('should include metadata in final report', async () => {
            reporter.recordSampleOutput('PDF', { summary: 'Test' }, {});
            reporter.recordDatasetProcessing('test.pdf', 'PDF', true);

            const report = await reporter.generateFinalReport();

            expect(report.metadata.reportGeneratedAt).toBeDefined();
            expect(report.metadata.nodeVersion).toBeDefined();
            expect(report.metadata.totalSampleOutputs).toBe(1);
            expect(report.metadata.totalDatasetFiles).toBe(1);
        });

        test('should include AWS service metrics in final report', async () => {
            const report = await reporter.generateFinalReport();

            expect(report.awsServiceMetrics).toBeDefined();
            expect(report.awsServiceMetrics.serviceCallStats).toBeDefined();
            expect(report.awsServiceMetrics.processingMetrics).toBeDefined();
            expect(report.awsServiceMetrics.textractMetrics).toBeDefined();
            expect(report.awsServiceMetrics.bedrockMetrics).toBeDefined();
            expect(report.awsServiceMetrics.resourceUsage).toBeDefined();
        });

        test('should format execution duration correctly', async () => {
            const report = await reporter.generateFinalReport();

            expect(report.executionSummary.durationFormatted).toBeDefined();
            expect(report.executionSummary.durationFormatted).toMatch(/^\d+s$/);
        });
    });

    describe('Failure Reporting', () => {
        test('should record and report failed input types with exact error messages', () => {
            // Record failed input types - Requirement 10.2
            reporter.recordInputTypeResult('PDF', false, 'PDF processing failed due to corrupted file', {
                processingTime: 1500,
                fileSize: 1024000
            });
            reporter.recordInputTypeResult('Excel', false, 'Excel parsing error: invalid format', {
                processingTime: 800,
                textLength: 5000
            });
            reporter.recordInputTypeResult('RawText', true, null, { processingTime: 500 });

            const failedTypes = reporter.getFailedInputTypes();

            expect(failedTypes).toHaveLength(2);

            const pdfFailure = failedTypes.find(f => f.inputType === 'PDF');
            expect(pdfFailure).toBeDefined();
            expect(pdfFailure.errorMessage).toBe('PDF processing failed due to corrupted file');
            expect(pdfFailure.processingTime).toBe(1500);
            expect(pdfFailure.context.fileSize).toBe(1024000);
            expect(pdfFailure.timestamp).toBeDefined();

            const excelFailure = failedTypes.find(f => f.inputType === 'Excel');
            expect(excelFailure).toBeDefined();
            expect(excelFailure.errorMessage).toBe('Excel parsing error: invalid format');
            expect(excelFailure.processingTime).toBe(800);
            expect(excelFailure.context.textLength).toBe(5000);
        });

        test('should handle input types with no error message', () => {
            reporter.recordInputTypeResult('URL', false, null);

            const failedTypes = reporter.getFailedInputTypes();

            expect(failedTypes).toHaveLength(1);
            expect(failedTypes[0].inputType).toBe('URL');
            expect(failedTypes[0].errorMessage).toBe('Unknown error');
        });

        test('should not include successful input types in failure report', () => {
            reporter.recordInputTypeResult('PDF', true, null);
            reporter.recordInputTypeResult('RawText', true, null);
            reporter.recordInputTypeResult('URL', false, 'URL fetch failed');

            const failedTypes = reporter.getFailedInputTypes();

            expect(failedTypes).toHaveLength(1);
            expect(failedTypes[0].inputType).toBe('URL');
        });

        test('should update existing input type results when recorded multiple times', () => {
            // First record a failure
            reporter.recordInputTypeResult('PDF', false, 'Initial failure');

            // Then record a success for the same type
            reporter.recordInputTypeResult('PDF', true, null);

            const failedTypes = reporter.getFailedInputTypes();

            expect(failedTypes).toHaveLength(0);
        });

        test('should include processing context in failure reports', () => {
            reporter.recordInputTypeResult('Image', false, 'OCR failed', {
                processingTime: 5000,
                fileSize: 2048000,
                awsServiceCalls: 3
            });

            const failedTypes = reporter.getFailedInputTypes();

            expect(failedTypes).toHaveLength(1);
            expect(failedTypes[0].context.fileSize).toBe(2048000);
            expect(failedTypes[0].context.awsServiceCalls).toBe(3);
        });
    });

    describe('Dataset Coverage Reporting', () => {
        test('should calculate dataset coverage statistics correctly', () => {
            // Record dataset processing results - Requirement 10.3
            reporter.recordDatasetProcessing('contract1.pdf', 'PDF', true, {
                processingTime: 2000,
                fileSize: 1024000,
                extractedTextLength: 5000,
                textractConfidence: 0.95
            });
            reporter.recordDatasetProcessing('contract2.pdf', 'PDF', false, {
                processingTime: 1500,
                fileSize: 512000,
                errorMessage: 'OCR failed'
            });
            reporter.recordDatasetProcessing('spreadsheet1.xlsx', 'Excel', true, {
                processingTime: 800,
                fileSize: 256000,
                extractedTextLength: 2000
            });
            reporter.recordDatasetProcessing('image1.png', 'Image', true, {
                processingTime: 3000,
                fileSize: 2048000,
                extractedTextLength: 1500,
                textractConfidence: 0.88
            });

            const coverage = reporter.getDatasetCoverage();

            expect(coverage.totalFiles).toBe(4);
            expect(coverage.successfulFiles).toBe(3);
            expect(coverage.failedFiles).toBe(1);
            expect(coverage.successRate).toBe(75);

            // Validate file type breakdown
            expect(coverage.fileTypeBreakdown.PDF).toEqual({
                total: 2,
                successful: 1,
                failed: 1
            });
            expect(coverage.fileTypeBreakdown.Excel).toEqual({
                total: 1,
                successful: 1,
                failed: 0
            });
            expect(coverage.fileTypeBreakdown.Image).toEqual({
                total: 1,
                successful: 1,
                failed: 0
            });

            // Validate processing statistics
            expect(coverage.processingStats.totalProcessingTime).toBe(7300);
            expect(coverage.processingStats.averageProcessingTime).toBe(1825);
            expect(coverage.processingStats.totalTextExtracted).toBe(8500);
            expect(coverage.processingStats.averageTextractConfidence).toBeCloseTo(0.915, 3);
        });

        test('should handle empty dataset correctly', () => {
            const coverage = reporter.getDatasetCoverage();

            expect(coverage.totalFiles).toBe(0);
            expect(coverage.successfulFiles).toBe(0);
            expect(coverage.failedFiles).toBe(0);
            expect(coverage.successRate).toBe(0);
            expect(coverage.fileTypeBreakdown).toEqual({});
            expect(coverage.processingStats.totalProcessingTime).toBe(0);
            expect(coverage.processingStats.averageProcessingTime).toBe(0);
        });

        test('should calculate success rate correctly for edge cases', () => {
            // All successful
            reporter.recordDatasetProcessing('file1.pdf', 'PDF', true);
            reporter.recordDatasetProcessing('file2.pdf', 'PDF', true);

            let coverage = reporter.getDatasetCoverage();
            expect(coverage.successRate).toBe(100);

            // Clear and test all failed
            reporter.clear();
            reporter.recordDatasetProcessing('file1.pdf', 'PDF', false);
            reporter.recordDatasetProcessing('file2.pdf', 'PDF', false);

            coverage = reporter.getDatasetCoverage();
            expect(coverage.successRate).toBe(0);
        });

        test('should handle missing processing metrics gracefully', () => {
            reporter.recordDatasetProcessing('file1.pdf', 'PDF', true, {
                // No processingTime or textractConfidence
            });
            reporter.recordDatasetProcessing('file2.pdf', 'PDF', true, {
                processingTime: 2000,
                textractConfidence: 0.9
            });

            const coverage = reporter.getDatasetCoverage();

            expect(coverage.processingStats.totalProcessingTime).toBe(2000);
            expect(coverage.processingStats.averageProcessingTime).toBe(1000); // 2000 / 2 files
            expect(coverage.processingStats.averageTextractConfidence).toBe(0.9); // Only one file had confidence
        });

        test('should include dataset processing results in coverage report', () => {
            reporter.recordDatasetProcessing('test.pdf', 'PDF', true, {
                processingTime: 1000,
                analysisResult: { summary: 'Test analysis' }
            });

            const coverage = reporter.getDatasetCoverage();

            expect(coverage.totalFiles).toBe(1);
            expect(reporter.datasetProcessingResults).toHaveLength(1);
            expect(reporter.datasetProcessingResults[0].fileName).toBe('test.pdf');
            expect(reporter.datasetProcessingResults[0].analysisResult).toEqual({ summary: 'Test analysis' });
        });
    });

    describe('Sample Output Inclusion', () => {
        test('should record and include sample analysis outputs correctly', async () => {
            // Record sample outputs - Requirement 10.4
            const sampleAnalysis1 = {
                summary: 'This is a comprehensive contract analysis summary with detailed findings.',
                clauses: [
                    { type: 'termination', text: 'Contract may be terminated with 30 days notice' },
                    { type: 'liability', text: 'Liability is limited to direct damages only' }
                ],
                risks: [
                    { level: 'High', description: 'Unlimited liability exposure' },
                    { level: 'Medium', description: 'Ambiguous termination clause' }
                ],
                recommendations: [
                    { action: 'Add liability cap', priority: 'High' }
                ]
            };

            const sampleAnalysis2 = {
                summary: 'Brief analysis',
                clauses: [{ type: 'payment', text: 'Payment due within 30 days' }],
                risks: [{ level: 'Low', description: 'Standard payment terms' }]
            };

            reporter.recordSampleOutput('PDF', sampleAnalysis1, {
                inputSource: 'contract_sample.pdf',
                inputSize: 1024000,
                processingTime: 5000
            });

            reporter.recordSampleOutput('RawText', sampleAnalysis2, {
                inputSource: 'pasted_text',
                inputSize: 2048,
                processingTime: 1500
            });

            const report = await reporter.generateFinalReport();

            expect(report.sampleOutputs).toHaveLength(2);

            const pdfSample = report.sampleOutputs.find(s => s.inputType === 'PDF');
            expect(pdfSample).toBeDefined();
            expect(pdfSample.inputSource).toBe('contract_sample.pdf');
            expect(pdfSample.inputSize).toBe(1024000);
            expect(pdfSample.processingTime).toBe(5000);
            expect(pdfSample.analysis.summary).toBe(sampleAnalysis1.summary);
            expect(pdfSample.analysis.clauses).toEqual(sampleAnalysis1.clauses);
            expect(pdfSample.analysis.risks).toEqual(sampleAnalysis1.risks);
            expect(pdfSample.analysis.recommendations).toEqual(sampleAnalysis1.recommendations);

            // Validate quality metrics calculation
            expect(pdfSample.qualityMetrics.summaryLength).toBe(sampleAnalysis1.summary.length);
            expect(pdfSample.qualityMetrics.clauseCount).toBe(2);
            expect(pdfSample.qualityMetrics.riskCount).toBe(2);
            expect(pdfSample.qualityMetrics.recommendationCount).toBe(1);

            const textSample = report.sampleOutputs.find(s => s.inputType === 'RawText');
            expect(textSample).toBeDefined();
            expect(textSample.qualityMetrics.summaryLength).toBe(sampleAnalysis2.summary.length);
            expect(textSample.qualityMetrics.clauseCount).toBe(1);
            expect(textSample.qualityMetrics.riskCount).toBe(1);
            expect(textSample.qualityMetrics.recommendationCount).toBe(0);
        });

        test('should handle sample outputs with missing fields', async () => {
            const incompleteAnalysis = {
                summary: 'Basic summary'
                // Missing clauses, risks, recommendations
            };

            reporter.recordSampleOutput('URL', incompleteAnalysis, {
                inputSource: 'https://example.com/contract'
            });

            const report = await reporter.generateFinalReport();

            expect(report.sampleOutputs).toHaveLength(1);
            const sample = report.sampleOutputs[0];

            expect(sample.analysis.summary).toBe('Basic summary');
            expect(sample.analysis.clauses).toEqual([]);
            expect(sample.analysis.risks).toEqual([]);
            expect(sample.analysis.recommendations).toEqual([]);

            expect(sample.qualityMetrics.summaryLength).toBe(13);
            expect(sample.qualityMetrics.clauseCount).toBe(0);
            expect(sample.qualityMetrics.riskCount).toBe(0);
            expect(sample.qualityMetrics.recommendationCount).toBe(0);
        });

        test('should handle null/undefined analysis fields', async () => {
            const nullAnalysis = {
                summary: null,
                clauses: null,
                risks: undefined,
                recommendations: undefined
            };

            reporter.recordSampleOutput('Image', nullAnalysis);

            const report = await reporter.generateFinalReport();

            const sample = report.sampleOutputs[0];
            expect(sample.analysis.summary).toBeNull();
            expect(sample.analysis.clauses).toEqual([]);
            expect(sample.analysis.risks).toEqual([]);
            expect(sample.analysis.recommendations).toEqual([]);

            expect(sample.qualityMetrics.summaryLength).toBe(0);
            expect(sample.qualityMetrics.clauseCount).toBe(0);
            expect(sample.qualityMetrics.riskCount).toBe(0);
            expect(sample.qualityMetrics.recommendationCount).toBe(0);
        });

        test('should include timestamp and metadata for sample outputs', async () => {
            const analysis = {
                summary: 'Test summary',
                clauses: [],
                risks: []
            };

            const beforeTime = new Date();
            reporter.recordSampleOutput('Excel', analysis, {
                inputSource: 'test.xlsx',
                processingTime: 2000
            });
            const afterTime = new Date();

            const report = await reporter.generateFinalReport();

            const sample = report.sampleOutputs[0];
            expect(sample.timestamp).toBeDefined();

            const sampleTime = new Date(sample.timestamp);
            expect(sampleTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(sampleTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());

            expect(sample.inputSource).toBe('test.xlsx');
            expect(sample.processingTime).toBe(2000);
        });

        test('should handle analysis metadata correctly', async () => {
            const analysisWithMetadata = {
                summary: 'Test summary',
                clauses: [],
                risks: [],
                metadata: {
                    modelUsed: 'claude-3-sonnet',
                    processingVersion: '1.0.0',
                    confidence: 0.95
                }
            };

            reporter.recordSampleOutput('PDF', analysisWithMetadata);

            const report = await reporter.generateFinalReport();

            const sample = report.sampleOutputs[0];
            expect(sample.analysis.metadata).toEqual(analysisWithMetadata.metadata);
        });
    });

    describe('Test Phase Management', () => {
        test('should record and update test phases correctly', () => {
            reporter.recordTestPhase('AWS Connectivity', 'started', { testsRun: 5 });
            reporter.recordTestPhase('AWS Connectivity', 'completed', {
                testsRun: 10,
                testsPassed: 8,
                testsFailed: 2,
                duration: 5000
            });

            expect(reporter.testPhases).toHaveLength(1);
            const phase = reporter.testPhases[0];
            expect(phase.name).toBe('AWS Connectivity');
            expect(phase.status).toBe('completed');
            expect(phase.testsRun).toBe(10);
            expect(phase.testsPassed).toBe(8);
            expect(phase.testsFailed).toBe(2);
            expect(phase.duration).toBe(5000);
        });

        test('should handle multiple different test phases', () => {
            reporter.recordTestPhase('Phase 1', 'completed');
            reporter.recordTestPhase('Phase 2', 'failed');
            reporter.recordTestPhase('Phase 3', 'started');

            expect(reporter.testPhases).toHaveLength(3);
            expect(reporter.testPhases.map(p => p.name)).toEqual(['Phase 1', 'Phase 2', 'Phase 3']);
            expect(reporter.testPhases.map(p => p.status)).toEqual(['completed', 'failed', 'started']);
        });

        test('should include error messages in failed phases', () => {
            reporter.recordTestPhase('Failed Phase', 'failed', {
                errorMessages: ['Connection timeout', 'Service unavailable']
            });

            const phase = reporter.testPhases[0];
            expect(phase.errorMessages).toEqual(['Connection timeout', 'Service unavailable']);
        });
    });

    describe('Feature Status Management', () => {
        test('should record and update feature status correctly', () => {
            reporter.recordFeatureStatus('File Upload', false, 'Not working', [
                { testName: 'Upload PDF', passed: false },
                { testName: 'Upload Image', passed: true }
            ]);

            const status = reporter.featureStatus.get('File Upload');
            expect(status.working).toBe(false);
            expect(status.description).toBe('Not working');
            expect(status.testResults).toHaveLength(2);
            expect(status.testsRun).toBe(2);
            expect(status.testsPassed).toBe(1);
            expect(status.testsFailed).toBe(1);
        });

        test('should update existing feature status when recorded multiple times', () => {
            reporter.recordFeatureStatus('Feature A', false, 'Initial failure');
            reporter.recordFeatureStatus('Feature A', true, 'Fixed and working');

            const status = reporter.featureStatus.get('Feature A');
            expect(status.working).toBe(true);
            expect(status.description).toBe('Fixed and working');
        });

        test('should handle features with no test results', () => {
            reporter.recordFeatureStatus('Simple Feature', true, 'Working correctly');

            const status = reporter.featureStatus.get('Simple Feature');
            expect(status.testResults).toEqual([]);
            expect(status.testsRun).toBe(0);
            expect(status.testsPassed).toBe(0);
            expect(status.testsFailed).toBe(0);
        });
    });

    describe('Reporter State Management', () => {
        test('should clear all data when clear() is called', () => {
            // Add some data
            reporter.recordTestPhase('Test Phase', 'completed');
            reporter.recordInputTypeResult('PDF', true);
            reporter.recordDatasetProcessing('file.pdf', 'PDF', true);
            reporter.recordSampleOutput('PDF', { summary: 'Test' });
            reporter.recordFeatureStatus('Feature', true, 'Working');

            // Clear the reporter
            reporter.clear();

            // Verify all data is cleared
            expect(reporter.testPhases).toHaveLength(0);
            expect(reporter.inputTypeResults.size).toBe(0);
            expect(reporter.datasetProcessingResults).toHaveLength(0);
            expect(reporter.sampleOutputs).toHaveLength(0);
            expect(reporter.featureStatus.size).toBe(0);
        });

        test('should reset execution times when cleared', () => {
            const originalStartTime = reporter.executionStartTime;

            // Wait a bit and clear
            setTimeout(() => {
                reporter.clear();
                expect(reporter.executionStartTime.getTime()).toBeGreaterThan(originalStartTime.getTime());
                expect(reporter.executionEndTime).toBeNull();
            }, 10);
        });

        test('should maintain logger state integration', () => {
            expect(reporter.logger).toBeDefined();

            // Clear should also clear logger
            reporter.clear();

            // Logger should still be accessible
            expect(reporter.logger).toBeDefined();
        });
    });

    describe('Report Export and Logging', () => {
        test('should log report summary to console', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            reporter.recordFeatureStatus('Test Feature', true, 'Working');
            reporter.recordInputTypeResult('PDF', true);

            const report = await reporter.generateFinalReport();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CLEARCLAUSE END-TO-END TEST EXECUTION REPORT'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Overall Success: YES'));

            consoleSpy.mockRestore();
        });

        test('should export report to file', async () => {
            const mockWriteFile = vi.fn().mockResolvedValue();
            const mockFs = { writeFile: mockWriteFile };

            // Mock dynamic import
            vi.doMock('fs/promises', () => mockFs);

            const report = { test: 'data' };
            await reporter.exportReportToFile(report, 'test-report.json');

            expect(mockWriteFile).toHaveBeenCalledWith(
                'test-report.json',
                JSON.stringify(report, null, 2),
                'utf8'
            );
        });

        test('should handle console logging for failed scenarios', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            reporter.recordInputTypeResult('PDF', false, 'Processing failed');
            reporter.recordFeatureStatus('Broken Feature', false, 'Not working');

            const report = await reporter.generateFinalReport();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Overall Success: NO'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('FAILED INPUT TYPES'));

            consoleSpy.mockRestore();
        });
    });
});