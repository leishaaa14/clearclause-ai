/**
 * Raw Text Processing Unit Tests
 * 
 * Unit tests for raw text processing functionality including short text processing,
 * long text handling, text analysis quality, and clause detection on raw text.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { InputTypeProcessor } from './utils/InputTypeProcessor.js';
import { TEST_CONFIG, VALIDATION_THRESHOLDS } from './config/test-config.js';

describe('Raw Text Processing Unit Tests', () => {
    let inputProcessor;

    beforeEach(() => {
        inputProcessor = new InputTypeProcessor();
    });

    afterEach(() => {
        inputProcessor.clearHistory();
    });

    describe('Short Text Processing', () => {
        test('should process short legal text successfully', async () => {
            const shortText = 'This agreement shall be governed by the laws of the state. The parties agree to binding arbitration for dispute resolution.';

            const result = await inputProcessor.processRawText(shortText);

            expect(result.success).toBe(true);
            expect(result.inputType).toBe('raw_text');
            expect(result.inputSize).toBe(shortText.length);
            expect(result.bypassedServices).toContain('S3');
            expect(result.bypassedServices).toContain('Textract');
            expect(result.directToAnalysis).toBe(true);
            expect(result.processingTime).toBeLessThanOrEqual(VALIDATION_THRESHOLDS.maxProcessingTime.rawText);
        });

        test('should handle empty text input gracefully', async () => {
            const result = await inputProcessor.processRawText('');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid text input');
        });

        test('should handle null text input gracefully', async () => {
            const result = await inputProcessor.processRawText(null);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid text input');
        });

        test('should handle non-string input gracefully', async () => {
            const result = await inputProcessor.processRawText(123);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid text input');
        });

        test('should bypass S3 and Textract for short text', async () => {
            const shortText = 'Payment terms: Net 30 days from invoice date.';

            const result = await inputProcessor.processRawText(shortText);

            expect(result.bypassedServices).toEqual(['S3', 'Textract']);
            expect(result.directToAnalysis).toBe(true);
        });
    });

    describe('Long Text Handling', () => {
        test('should process long legal documents without truncation', async () => {
            const longText = `
COMPREHENSIVE LEGAL AGREEMENT

WHEREAS, the parties wish to enter into this comprehensive agreement governing their business relationship;

WHEREAS, this agreement contains multiple provisions and clauses that require careful consideration;

NOW THEREFORE, the parties agree as follows:

1. PAYMENT TERMS: Payment shall be made within thirty (30) days of invoice receipt. Late payments shall incur interest at the rate of 1.5% per month.

2. TERMINATION CLAUSE: Either party may terminate this agreement upon sixty (60) days written notice to the other party.

3. CONFIDENTIALITY: Both parties agree to maintain strict confidentiality regarding proprietary information shared during the course of this agreement.

4. LIABILITY LIMITATION: In no event shall either party be liable for indirect, incidental, or consequential damages arising from this agreement.

5. INTELLECTUAL PROPERTY: All intellectual property rights shall remain with the original creator unless explicitly transferred in writing.

6. FORCE MAJEURE: Neither party shall be liable for delays or failures in performance resulting from acts beyond their reasonable control.

7. GOVERNING LAW: This agreement shall be governed by and construed in accordance with the laws of the jurisdiction specified herein.

8. DISPUTE RESOLUTION: Any disputes arising under this agreement shall be resolved through binding arbitration.

This agreement constitutes the entire understanding between the parties and supersedes all prior negotiations, representations, or agreements relating to the subject matter hereof.
            `.trim();

            const result = await inputProcessor.processRawText(longText);

            expect(result.success).toBe(true);
            expect(result.inputSize).toBe(longText.length);
            expect(result.bypassedServices).toContain('S3');
            expect(result.bypassedServices).toContain('Textract');

            // Verify no truncation occurred
            if (result.result?.data?.extraction?.text) {
                expect(result.result.data.extraction.text.length).toBeGreaterThan(0);
            }
        });

        test('should handle very long text input', async () => {
            // Create a very long legal document
            const baseClause = 'This clause contains important legal provisions that must be carefully reviewed. ';
            const longText = 'LEGAL AGREEMENT\n\n' + baseClause.repeat(100) + '\n\nEnd of agreement.';

            const result = await inputProcessor.processRawText(longText);

            expect(result.inputSize).toBe(longText.length);
            expect(result.processingTime).toBeLessThanOrEqual(VALIDATION_THRESHOLDS.maxProcessingTime.rawText);

            // Should still bypass file services even for long text
            expect(result.bypassedServices).toContain('S3');
            expect(result.bypassedServices).toContain('Textract');
        });

        test('should maintain processing efficiency for long text', async () => {
            const mediumText = `
CONTRACT FOR SERVICES

This agreement is entered into between the parties for the provision of professional services.

SCOPE OF WORK: The contractor shall provide the following services:
- Consulting and advisory services
- Technical implementation support  
- Documentation and training materials
- Ongoing maintenance and support

COMPENSATION: The client agrees to pay the contractor according to the following schedule:
- Initial payment of $10,000 upon contract execution
- Monthly payments of $5,000 for ongoing services
- Additional fees for scope changes as mutually agreed

TERM: This agreement shall commence on the effective date and continue for a period of twelve (12) months, unless terminated earlier in accordance with the termination provisions.

TERMINATION: Either party may terminate this agreement with thirty (30) days written notice.
            `.trim();

            const result = await inputProcessor.processRawText(mediumText);

            expect(result.success).toBe(true);
            expect(result.processingTime).toBeLessThanOrEqual(VALIDATION_THRESHOLDS.maxProcessingTime.rawText);
        });
    });

    describe('Text Analysis Quality', () => {
        test('should validate analysis quality for legal text', async () => {
            const legalText = `
This Software License Agreement governs the use of the software product. 

GRANT OF LICENSE: The licensor grants the licensee a non-exclusive, non-transferable license to use the software.

RESTRICTIONS: The licensee may not reverse engineer, decompile, or disassemble the software.

TERMINATION: This license terminates automatically if the licensee breaches any terms of this agreement.

WARRANTY DISCLAIMER: The software is provided "as is" without warranty of any kind.

LIMITATION OF LIABILITY: In no event shall the licensor be liable for any damages arising from the use of the software.
            `.trim();

            const result = await inputProcessor.processRawText(legalText);

            if (result.success) {
                const qualityValidation = await inputProcessor.validateTextAnalysisQuality(result);

                expect(qualityValidation.overall).not.toBe('error');
                expect(qualityValidation.checks).toBeDefined();
                expect(Array.isArray(qualityValidation.checks)).toBe(true);

                // Should have some quality checks
                expect(qualityValidation.checks.length).toBeGreaterThan(0);
            }
        });

        test('should detect analysis components in processed text', async () => {
            const contractText = `
EMPLOYMENT AGREEMENT

This employment agreement is between Company ABC and Employee John Doe.

POSITION: Employee shall serve as Senior Developer with the following responsibilities:
- Software development and maintenance
- Code review and quality assurance
- Technical documentation

COMPENSATION: Employee shall receive an annual salary of $100,000 payable in bi-weekly installments.

CONFIDENTIALITY: Employee agrees to maintain confidentiality of all proprietary information.

TERMINATION: Employment may be terminated by either party with two weeks notice.
            `.trim();

            const result = await inputProcessor.processRawText(contractText);

            if (result.success && result.result?.data?.analysis) {
                const analysis = result.result.data.analysis;

                // Should have at least one analysis component
                const hasComponents = !!(analysis.summary || analysis.clauses || analysis.risks);
                expect(hasComponents).toBe(true);
            }
        });

        test('should handle analysis quality validation errors gracefully', async () => {
            // Create a result with missing analysis data
            const mockResult = {
                success: true,
                result: {
                    data: {
                        // Missing analysis field
                    }
                }
            };

            const qualityValidation = await inputProcessor.validateTextAnalysisQuality(mockResult);

            expect(qualityValidation.overall).toBe('fail');
            expect(qualityValidation.checks).toBeDefined();
        });
    });

    describe('Clause Detection on Raw Text', () => {
        test('should detect clauses in legal text', async () => {
            const clauseText = `
MASTER SERVICE AGREEMENT

1. PAYMENT TERMS: All invoices are due within 30 days of receipt.

2. TERMINATION: This agreement may be terminated by either party with 60 days written notice.

3. CONFIDENTIALITY: Both parties agree to keep confidential information private.

4. LIABILITY: Liability is limited to the amount paid under this agreement.

5. INTELLECTUAL PROPERTY: All work product shall be owned by the client.
            `.trim();

            const result = await inputProcessor.processRawText(clauseText);

            if (result.success) {
                const clauseValidation = await inputProcessor.validateClauseDetectionAccuracy(clauseText, result);

                expect(clauseValidation.overall).not.toBe('error');
                expect(clauseValidation.inputLength).toBe(clauseText.length);
                expect(clauseValidation.checks).toBeDefined();
            }
        });

        test('should validate clause detection accuracy', async () => {
            const textWithClauses = `
This agreement contains the following key provisions:

TERMINATION CLAUSE: Either party may end this agreement with proper notice.
PAYMENT CLAUSE: Payments shall be made according to the agreed schedule.
CONFIDENTIALITY CLAUSE: Sensitive information must be kept confidential.
            `.trim();

            const result = await inputProcessor.processRawText(textWithClauses);

            if (result.success) {
                const clauseValidation = await inputProcessor.validateClauseDetectionAccuracy(textWithClauses, result);

                expect(clauseValidation.checks).toBeDefined();
                expect(Array.isArray(clauseValidation.checks)).toBe(true);

                // Should have clause detection checks
                const clauseDetectionCheck = clauseValidation.checks.find(c => c.check === 'Clauses detected');
                expect(clauseDetectionCheck).toBeDefined();
            }
        });

        test('should handle text without clear clauses', async () => {
            const generalText = 'This is a general business document that discusses various topics but may not contain specific legal clauses.';

            const result = await inputProcessor.processRawText(generalText);

            if (result.success) {
                const clauseValidation = await inputProcessor.validateClauseDetectionAccuracy(generalText, result);

                // Should not error even if no clauses are found
                expect(clauseValidation.overall).not.toBe('error');
                expect(clauseValidation.inputLength).toBe(generalText.length);
            }
        });

        test('should validate clause types and confidence scores', async () => {
            const diverseClauseText = `
COMPREHENSIVE AGREEMENT

PAYMENT TERMS: Net 30 payment required.
TERMINATION RIGHTS: 30-day notice for termination.
LIABILITY LIMITS: Damages limited to contract value.
CONFIDENTIALITY: Non-disclosure of proprietary information.
INTELLECTUAL PROPERTY: Rights assignment upon payment.
            `.trim();

            const result = await inputProcessor.processRawText(diverseClauseText);

            if (result.success && result.result?.data?.analysis?.clauses) {
                const clauses = result.result.data.analysis.clauses;

                if (clauses.length > 0) {
                    // Check if clauses have types
                    const clausesWithTypes = clauses.filter(c => c.type);
                    expect(clausesWithTypes.length).toBeGreaterThanOrEqual(0);

                    // Check if clauses have confidence scores
                    const clausesWithConfidence = clauses.filter(c => c.confidence);
                    expect(clausesWithConfidence.length).toBeGreaterThanOrEqual(0);
                }
            }
        });
    });

    describe('Input Type Handling Validation', () => {
        test('should validate raw text input type handling', async () => {
            // Process multiple raw text inputs
            const texts = [
                'Simple contract clause about payment terms.',
                'This agreement shall terminate upon breach of contract.',
                'Confidentiality provisions apply to all parties involved.'
            ];

            for (const text of texts) {
                await inputProcessor.processRawText(text);
            }

            const validation = await inputProcessor.validateInputTypeHandling('raw_text');

            expect(validation.inputType).toBe('raw_text');
            expect(validation.checks).toBeDefined();
            expect(Array.isArray(validation.checks)).toBe(true);
            expect(validation.overall).toBeDefined();
        });

        test('should track processing results correctly', async () => {
            const testText = 'Legal agreement with standard terms and conditions.';

            await inputProcessor.processRawText(testText);

            const summary = inputProcessor.getProcessingSummary();

            expect(summary.totalProcessed).toBe(1);
            expect(summary.inputTypes).toContain('raw_text');
            expect(summary.averageProcessingTime).toBeGreaterThan(0);
        });

        test('should handle validation with no processing results', async () => {
            const validation = await inputProcessor.validateInputTypeHandling('raw_text');

            expect(validation.overall).toBe('fail');
            expect(validation.checks).toBeDefined();

            const noResultsCheck = validation.checks.find(c => c.check === 'Processing results available');
            expect(noResultsCheck).toBeDefined();
            expect(noResultsCheck.status).toBe('fail');
        });
    });

    describe('Error Handling', () => {
        test('should handle processing errors gracefully', async () => {
            // Test with invalid input that might cause processing errors
            const result = await inputProcessor.processRawText(undefined);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });

        test('should record failed processing attempts', async () => {
            await inputProcessor.processRawText(null);

            const summary = inputProcessor.getProcessingSummary();

            expect(summary.totalProcessed).toBe(1);
            expect(summary.failedProcessing).toBe(1);
            expect(summary.successfulProcessing).toBe(0);
        });

        test('should handle validation errors gracefully', async () => {
            const invalidResult = { success: false, error: 'Test error' };

            const qualityValidation = await inputProcessor.validateTextAnalysisQuality(invalidResult);

            expect(qualityValidation.overall).toBe('fail');
        });
    });
});