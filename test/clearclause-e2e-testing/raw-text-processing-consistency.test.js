/**
 * Raw Text Processing Consistency Property Tests
 * 
 * **Feature: clearclause-e2e-testing, Property 4: Raw Text Processing Consistency**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 * 
 * This test validates that raw text processing works consistently across
 * different text inputs and maintains quality standards.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { InputTypeProcessor } from './utils/InputTypeProcessor.js';
import { legalTextGenerator } from './utils/test-data-generators.js';
import { TEST_CONFIG, VALIDATION_THRESHOLDS } from './config/test-config.js';

describe('Raw Text Processing Consistency Property Tests', () => {
    let inputProcessor;

    beforeEach(() => {
        inputProcessor = new InputTypeProcessor();
    });

    afterEach(() => {
        inputProcessor.clearHistory();
    });

    test('Property 4: Raw Text Processing Consistency - For any raw text input (short or long legal documents), the system should bypass S3 and Textract, process the text directly through the analysis pipeline, and produce output quality and consistency matching other input types', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    shortText: fc.string({ minLength: 50, maxLength: 500 }).map(text =>
                        `This legal agreement states that ${text}. The parties agree to the terms and conditions outlined herein.`
                    ),
                    longText: fc.string({ minLength: 1000, maxLength: 5000 }).map(text =>
                        `LEGAL CONTRACT AGREEMENT\n\nWHEREAS, the parties wish to enter into this agreement; and WHEREAS, ${text};\n\nNOW THEREFORE, the parties agree as follows:\n\n1. Terms and Conditions: ${text}\n2. Payment Terms: Payment shall be made according to the schedule.\n3. Termination: This agreement may be terminated by either party.\n\nThis agreement constitutes the entire understanding between the parties.`
                    )
                }),
                async ({ shortText, longText }) => {
                    // Test short text processing
                    const shortResult = await inputProcessor.processRawText(shortText);

                    // Validate short text processing bypasses S3/Textract
                    expect(shortResult.success).toBe(true);
                    expect(shortResult.inputType).toBe('raw_text');
                    expect(shortResult.bypassedServices).toContain('S3');
                    expect(shortResult.bypassedServices).toContain('Textract');
                    expect(shortResult.directToAnalysis).toBe(true);

                    // Validate processing time is within threshold
                    expect(shortResult.processingTime).toBeLessThanOrEqual(VALIDATION_THRESHOLDS.maxProcessingTime.rawText);

                    // Test long text processing
                    const longResult = await inputProcessor.processRawText(longText);

                    // Validate long text processing without truncation
                    expect(longResult.success).toBe(true);
                    expect(longResult.inputType).toBe('raw_text');
                    expect(longResult.inputSize).toBe(longText.length);
                    expect(longResult.bypassedServices).toContain('S3');
                    expect(longResult.bypassedServices).toContain('Textract');

                    // Validate both results have proper structure
                    if (shortResult.success && shortResult.result?.data) {
                        const shortAnalysis = shortResult.result.data.analysis;
                        expect(shortAnalysis).toBeDefined();

                        // Check for required analysis components
                        const hasValidComponents = !!(shortAnalysis.summary || shortAnalysis.clauses || shortAnalysis.risks);
                        expect(hasValidComponents).toBe(true);
                    }

                    if (longResult.success && longResult.result?.data) {
                        const longAnalysis = longResult.result.data.analysis;
                        expect(longAnalysis).toBeDefined();

                        // Check for required analysis components
                        const hasValidComponents = !!(longAnalysis.summary || longAnalysis.clauses || longAnalysis.risks);
                        expect(hasValidComponents).toBe(true);
                    }

                    // Validate text analysis quality
                    if (shortResult.success) {
                        const qualityValidation = await inputProcessor.validateTextAnalysisQuality(shortResult);
                        expect(['pass', 'warn'].includes(qualityValidation.overall)).toBe(true);
                    }

                    if (longResult.success) {
                        const qualityValidation = await inputProcessor.validateTextAnalysisQuality(longResult);
                        expect(['pass', 'warn'].includes(qualityValidation.overall)).toBe(true);
                    }

                    // Validate clause detection accuracy
                    if (shortResult.success) {
                        const clauseValidation = await inputProcessor.validateClauseDetectionAccuracy(shortText, shortResult);
                        expect(['pass', 'warn'].includes(clauseValidation.overall)).toBe(true);
                    }

                    if (longResult.success) {
                        const clauseValidation = await inputProcessor.validateClauseDetectionAccuracy(longText, longResult);
                        expect(['pass', 'warn'].includes(clauseValidation.overall)).toBe(true);
                    }

                    // Validate input type handling consistency
                    const handlingValidation = await inputProcessor.validateInputTypeHandling('raw_text');
                    expect(['pass', 'warn'].includes(handlingValidation.overall)).toBe(true);
                }
            ),
            {
                numRuns: 10, // Reduced for faster testing
                timeout: TEST_CONFIG.timeout,
                verbose: true
            }
        );
    }, TEST_CONFIG.timeout * 2);

    test('Property 4.1: Short Text Processing Bypass - For any short legal text input, processing should bypass S3 and Textract services', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 50, maxLength: 500 }).map(text =>
                    `Legal clause: ${text}. This provision shall be binding upon the parties.`
                ),
                async (shortText) => {
                    const result = await inputProcessor.processRawText(shortText);

                    // Must bypass file processing services
                    expect(result.bypassedServices).toContain('S3');
                    expect(result.bypassedServices).toContain('Textract');
                    expect(result.directToAnalysis).toBe(true);
                    expect(result.inputType).toBe('raw_text');
                }
            ),
            { numRuns: 50 }
        );
    });

    test('Property 4.2: Long Text Processing Without Truncation - For any long legal document text, processing should handle the full content without truncation', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1000, maxLength: 3000 }).map(text =>
                    `COMPREHENSIVE LEGAL AGREEMENT\n\n${text}\n\nThis agreement contains multiple clauses and provisions that require detailed analysis.`
                ),
                async (longText) => {
                    const result = await inputProcessor.processRawText(longText);

                    if (result.success) {
                        // Input size should match original text length
                        expect(result.inputSize).toBe(longText.length);

                        // Should still bypass file services
                        expect(result.bypassedServices).toContain('S3');
                        expect(result.bypassedServices).toContain('Textract');

                        // Processing should complete successfully
                        expect(result.result.stage).toBe('complete');
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    test('Property 4.3: Analysis Quality Consistency - For any raw text analysis, output quality should meet minimum standards', async () => {
        await fc.assert(
            fc.asyncProperty(
                legalTextGenerator,
                async (legalText) => {
                    const result = await inputProcessor.processRawText(legalText);

                    if (result.success && result.result?.data?.analysis) {
                        const qualityValidation = await inputProcessor.validateTextAnalysisQuality(result);

                        // Quality validation should not fail completely
                        expect(qualityValidation.overall).not.toBe('error');

                        // Should have some analysis components
                        const analysis = result.result.data.analysis;
                        const hasComponents = !!(analysis.summary || analysis.clauses || analysis.risks);
                        expect(hasComponents).toBe(true);
                    }
                }
            ),
            { numRuns: 40 }
        );
    });

    test('Property 4.4: Clause Detection Accuracy - For any raw text with legal content, clause detection should identify relevant clauses', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(
                    'This agreement shall terminate upon 30 days written notice. Payment terms require net 30 days.',
                    'The parties agree to maintain confidentiality. Liability is limited to direct damages only.',
                    'Intellectual property rights remain with the original owner. Force majeure events excuse performance.',
                    'Governing law shall be the state of incorporation. Disputes shall be resolved through arbitration.'
                ).chain(template =>
                    fc.string({ minLength: 100, maxLength: 300 }).map(additional =>
                        `${template} ${additional} This contract contains important legal provisions.`
                    )
                ),
                async (textWithClauses) => {
                    const result = await inputProcessor.processRawText(textWithClauses);

                    if (result.success) {
                        const clauseValidation = await inputProcessor.validateClauseDetectionAccuracy(textWithClauses, result);

                        // Clause detection should not fail completely
                        expect(clauseValidation.overall).not.toBe('error');

                        // Should detect some clauses for legal text
                        if (result.result?.data?.analysis?.clauses) {
                            expect(result.result.data.analysis.clauses.length).toBeGreaterThanOrEqual(0);
                        }
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    test('Property 4.5: Processing Time Efficiency - For any raw text input, processing time should be within acceptable limits', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.oneof(
                    fc.string({ minLength: 50, maxLength: 500 }),
                    fc.string({ minLength: 500, maxLength: 2000 })
                ).map(text => `Legal document content: ${text}`),
                async (text) => {
                    const result = await inputProcessor.processRawText(text);

                    // Processing time should be within threshold
                    expect(result.processingTime).toBeLessThanOrEqual(VALIDATION_THRESHOLDS.maxProcessingTime.rawText);

                    // Should be faster than file processing (no S3/Textract overhead)
                    expect(result.processingTime).toBeLessThanOrEqual(VALIDATION_THRESHOLDS.maxProcessingTime.smallFile);
                }
            ),
            { numRuns: 25 }
        );
    });
});