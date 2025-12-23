/**
 * Dataset File Processing Pipeline Property-Based Tests
 * 
 * Tests the complete dataset file processing pipeline including file selection,
 * S3 upload, Textract OCR, Excel text extraction, text normalization,
 * and Bedrock analysis integration.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { DatasetFileProcessor } from './utils/DatasetFileProcessor.js';
import { TestEnvironmentSetup } from './utils/aws-test-utilities.js';
import { TEST_CONFIG, VALIDATION_THRESHOLDS } from './config/test-config.js';

describe('Dataset File Processing Pipeline', () => {
    let testEnvironment;
    let processor;

    beforeAll(async () => {
        testEnvironment = new TestEnvironmentSetup();
        await testEnvironment.initializeMockServices();
        processor = new DatasetFileProcessor(false); // Use mock services for testing
    });

    afterAll(async () => {
        await testEnvironment.cleanup();
    });

    /**
     * **Feature: clearclause-e2e-testing, Property 2: Dataset File Processing Pipeline**
     * 
     * For any representative file from the archive dataset (PDF, Image, Excel),
     * the complete processing pipeline should successfully upload to S3,
     * extract text via appropriate AWS services, normalize the text,
     * and produce analysis results.
     */
    test('Property 2: Dataset File Processing Pipeline', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('pdf', 'txt', 'xlsx'),
                fc.integer({ min: 1, max: 3 }),
                async (fileType, fileCount) => {
                    // Select representative files of the specified type
                    const files = await processor.selectRepresentativeFiles([fileType], fileCount);

                    // Verify files were selected
                    expect(files).toBeDefined();
                    expect(files.length).toBeGreaterThan(0);
                    expect(files.length).toBeLessThanOrEqual(fileCount);

                    // Process each file through the complete pipeline
                    const results = await processor.processFiles(files);

                    // Verify all files were processed
                    expect(results).toBeDefined();
                    expect(results.length).toBe(files.length);

                    // Verify each processing result
                    for (const result of results) {
                        // Pipeline should complete successfully
                        expect(result.success).toBe(true);
                        expect(result.error).toBeUndefined();

                        // Should have processing steps
                        expect(result.steps).toBeDefined();
                        expect(result.steps.textExtraction).toBeDefined();
                        expect(result.steps.textExtraction.success).toBe(true);
                        expect(result.steps.textNormalization).toBeDefined();
                        expect(result.steps.textNormalization.success).toBe(true);
                        expect(result.steps.bedrockAnalysis).toBeDefined();
                        expect(result.steps.bedrockAnalysis.success).toBe(true);

                        // Should have extracted and normalized text
                        expect(result.steps.textExtraction.extractedText).toBeDefined();
                        expect(typeof result.steps.textExtraction.extractedText).toBe('string');
                        expect(result.steps.textExtraction.extractedText.length).toBeGreaterThan(0);

                        expect(result.steps.textNormalization.normalizedText).toBeDefined();
                        expect(typeof result.steps.textNormalization.normalizedText).toBe('string');
                        expect(result.steps.textNormalization.normalizedText.length).toBeGreaterThan(0);

                        // Should have analysis results
                        expect(result.analysis).toBeDefined();
                        expect(result.analysis.summary).toBeDefined();
                        expect(typeof result.analysis.summary).toBe('string');
                        expect(result.analysis.summary.length).toBeGreaterThanOrEqual(VALIDATION_THRESHOLDS.minimumSummaryLength);

                        expect(result.analysis.clauses).toBeDefined();
                        expect(Array.isArray(result.analysis.clauses)).toBe(true);
                        expect(result.analysis.clauses.length).toBeGreaterThanOrEqual(VALIDATION_THRESHOLDS.minimumClauseCount);

                        expect(result.analysis.risks).toBeDefined();
                        expect(Array.isArray(result.analysis.risks)).toBe(true);
                        expect(result.analysis.risks.length).toBeGreaterThanOrEqual(VALIDATION_THRESHOLDS.minimumRiskCount);

                        // Verify clause structure
                        for (const clause of result.analysis.clauses) {
                            expect(clause.type).toBeDefined();
                            expect(typeof clause.type).toBe('string');
                            expect(clause.text).toBeDefined();
                            expect(typeof clause.text).toBe('string');
                            expect(clause.confidence).toBeDefined();
                            expect(typeof clause.confidence).toBe('number');
                            expect(clause.confidence).toBeGreaterThanOrEqual(0);
                            expect(clause.confidence).toBeLessThanOrEqual(1);
                        }

                        // Verify risk structure
                        for (const risk of result.analysis.risks) {
                            expect(risk.level).toBeDefined();
                            expect(['Low', 'Medium', 'High', 'Critical']).toContain(risk.level);
                            expect(risk.description).toBeDefined();
                            expect(typeof risk.description).toBe('string');
                            expect(risk.explanation).toBeDefined();
                            expect(typeof risk.explanation).toBe('string');
                            expect(risk.recommendation).toBeDefined();
                            expect(typeof risk.recommendation).toBe('string');
                        }

                        // Should have reasonable processing time
                        expect(result.processingTime).toBeDefined();
                        expect(typeof result.processingTime).toBe('number');
                        expect(result.processingTime).toBeGreaterThan(0);

                        // For PDF files, should have S3 upload step
                        if (fileType === 'pdf') {
                            expect(result.steps.s3Upload).toBeDefined();
                            expect(result.steps.s3Upload.success).toBe(true);
                            expect(result.steps.s3Upload.s3Key).toBeDefined();
                            expect(typeof result.steps.s3Upload.s3Key).toBe('string');
                        }
                    }

                    // Verify processing summary
                    const summary = processor.getProcessingSummary();
                    expect(summary.total).toBeGreaterThan(0);
                    expect(summary.successful).toBe(summary.total);
                    expect(summary.failed).toBe(0);
                    expect(summary.averageProcessingTime).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100, timeout: 30000 }
        );
    }, 60000);

    test('File selection handles different file types correctly', async () => {
        const fileTypes = ['pdf', 'txt', 'xlsx'];

        for (const fileType of fileTypes) {
            const files = await processor.selectRepresentativeFiles([fileType], 2);

            expect(files).toBeDefined();
            expect(Array.isArray(files)).toBe(true);

            for (const file of files) {
                expect(file.name).toBeDefined();
                expect(file.path).toBeDefined();
                expect(file.type).toBeDefined();
                expect(file.size).toBeDefined();
                expect(file.category).toBe(fileType);
                expect(typeof file.size).toBe('number');
                expect(file.size).toBeGreaterThan(0);
            }
        }
    });

    test('Text extraction works for different file types', async () => {
        const testFiles = [
            {
                name: 'test.pdf',
                path: '/mock/test.pdf',
                type: 'application/pdf',
                size: 50000,
                category: 'pdf',
                isMock: true
            },
            {
                name: 'test.txt',
                path: '/mock/test.txt',
                type: 'text/plain',
                size: 10000,
                category: 'txt',
                isMock: true
            },
            {
                name: 'test.xlsx',
                path: '/mock/test.xlsx',
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 25000,
                category: 'xlsx',
                isMock: true
            }
        ];

        for (const file of testFiles) {
            const result = await processor.processFile(file);

            expect(result.success).toBe(true);
            expect(result.steps.textExtraction.success).toBe(true);
            expect(result.steps.textExtraction.extractedText).toBeDefined();
            expect(typeof result.steps.textExtraction.extractedText).toBe('string');
            expect(result.steps.textExtraction.extractedText.length).toBeGreaterThan(0);
        }
    });

    test('Text normalization produces consistent output', async () => {
        const testTexts = [
            'This   is   a   test   document   with   multiple   spaces.',
            'This\n\n\nis\n\na\n\ntest\n\ndocument\n\nwith\n\nmultiple\n\nnewlines.',
            '   Leading and trailing spaces   ',
            'Normal text without issues.',
            'Short'
        ];

        for (const text of testTexts) {
            const result = await processor.normalizeExtractedText(text);

            expect(result.success).toBe(true);
            expect(result.normalizedText).toBeDefined();
            expect(typeof result.normalizedText).toBe('string');
            expect(result.normalizedText.length).toBeGreaterThan(0);
            expect(result.originalLength).toBe(text.length);
            expect(result.normalizedLength).toBe(result.normalizedText.length);

            // Should not have multiple consecutive spaces
            expect(result.normalizedText).not.toMatch(/  +/);

            // Should not start or end with whitespace
            expect(result.normalizedText).toBe(result.normalizedText.trim());

            // Should meet minimum length requirement
            expect(result.normalizedText.length).toBeGreaterThanOrEqual(VALIDATION_THRESHOLDS.minimumSummaryLength);
        }
    });

    test('Bedrock analysis produces structured output', async () => {
        const testTexts = [
            'This agreement shall be governed by the laws of the state. Either party may terminate this agreement with 30 days notice.',
            'The contractor agrees to provide services as outlined in Schedule A. Payment terms are net 30 days.',
            'Confidential information shall not be disclosed to third parties without written consent.'
        ];

        for (const text of testTexts) {
            const result = await processor.sendToBedrockAnalysis(text);

            expect(result.success).toBe(true);
            expect(result.analysis).toBeDefined();

            // Verify analysis structure
            expect(result.analysis.summary).toBeDefined();
            expect(typeof result.analysis.summary).toBe('string');
            expect(result.analysis.summary.length).toBeGreaterThan(0);

            expect(result.analysis.clauses).toBeDefined();
            expect(Array.isArray(result.analysis.clauses)).toBe(true);

            expect(result.analysis.risks).toBeDefined();
            expect(Array.isArray(result.analysis.risks)).toBe(true);

            // Verify token usage tracking
            expect(result.tokenUsage).toBeDefined();
            expect(result.tokenUsage.input_tokens).toBeDefined();
            expect(result.tokenUsage.output_tokens).toBeDefined();
            expect(typeof result.tokenUsage.input_tokens).toBe('number');
            expect(typeof result.tokenUsage.output_tokens).toBe('number');
        }
    });

    test('Processing handles errors gracefully', async () => {
        // Test with invalid file
        const invalidFile = {
            name: 'invalid.txt',
            path: '/nonexistent/path.txt',
            type: 'text/plain',
            size: 1000,
            category: 'txt',
            isMock: false // This will cause file read to fail
        };

        const result = await processor.processFile(invalidFile);

        // Should handle error gracefully
        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.processingTime).toBeGreaterThan(0);
    });
});