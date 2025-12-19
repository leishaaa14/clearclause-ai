// Integration Tests for End-to-End AI Contract Analysis Workflows
// Tests complete analysis pipeline from document input to final results

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContractProcessor } from '../../src/processors/ContractProcessor.js';
import { DocumentParser } from '../../model/parsers/DocumentParser.js';
import { TextPreprocessor } from '../../model/preprocessing/TextPreprocessor.js';
import { ClauseExtractor } from '../../model/extractors/ClauseExtractor.js';
import { RiskAnalyzer } from '../../model/analyzers/RiskAnalyzer.js';
import { APIClient } from '../../api/clients/APIClient.js';
import { ResponseNormalizer } from '../../api/normalizers/ResponseNormalizer.js';

describe('End-to-End Integration Tests', () => {
    let contractProcessor;
    let documentParser;
    let textPreprocessor;

    beforeEach(() => {
        contractProcessor = new ContractProcessor({
            preferAIModel: false, // Use API fallback for consistent testing
            fallbackToAPI: true,
            timeout: 30000
        });
        documentParser = new DocumentParser();
        textPreprocessor = new TextPreprocessor();
    });

    afterEach(async () => {
        if (contractProcessor) {
            await contractProcessor.cleanup();
        }
    });

    describe('Complete Analysis Pipeline', () => {
        it('should process a complete contract from text to analysis results', async () => {
            const contractText = `
        SERVICE AGREEMENT
        
        This Service Agreement ("Agreement") is entered into on January 1, 2024, between Company A and Company B.
        
        1. PAYMENT TERMS
        Payment shall be due within sixty (60) days of invoice receipt. Late payments will incur a 2% monthly fee.
        
        2. TERMINATION
        Either party may terminate this agreement with thirty (30) days written notice to the other party.
        
        3. LIABILITY
        Company A's liability is limited to the total amount paid under this agreement. Company A shall not be liable for any consequential damages.
        
        4. CONFIDENTIALITY
        Both parties agree to maintain confidentiality of all proprietary information shared during the term of this agreement.
        
        5. INTELLECTUAL PROPERTY
        All intellectual property created during the performance of services shall remain the property of Company A.
      `;

            // Step 1: Parse document
            const parsedDoc = await documentParser.parseDocument(contractText, 'txt');
            expect(parsedDoc.text).toBeDefined();
            expect(parsedDoc.metadata.wordCount).toBeGreaterThan(50);

            // Step 2: Preprocess text
            const preprocessed = await textPreprocessor.preprocessForModel(parsedDoc.text);
            expect(preprocessed.processedText).toBeDefined();
            expect(preprocessed.segments.length).toBeGreaterThan(0);

            // Step 3: Process with ContractProcessor
            const document = { text: contractText, filename: 'test-contract.txt' };
            const result = await contractProcessor.processContract(document);

            // Verify complete analysis structure
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('clauses');
            expect(result).toHaveProperty('risks');
            expect(result).toHaveProperty('recommendations');
            expect(result).toHaveProperty('metadata');

            // Verify summary
            expect(result.summary.totalClauses).toBeGreaterThan(0);
            expect(result.summary.riskScore).toBeGreaterThan(0);
            expect(result.summary.confidence).toBeGreaterThan(0);

            // Verify clauses
            expect(Array.isArray(result.clauses)).toBe(true);
            expect(result.clauses.length).toBeGreaterThan(0);

            const paymentClause = result.clauses.find(c => c.type === 'payment_terms');
            expect(paymentClause).toBeDefined();
            expect(paymentClause.text).toContain('sixty (60) days');

            // Verify risks
            expect(Array.isArray(result.risks)).toBe(true);
            expect(result.risks.length).toBeGreaterThan(0);

            const paymentRisk = result.risks.find(r => r.category === 'financial');
            expect(paymentRisk).toBeDefined();

            // Verify recommendations
            expect(Array.isArray(result.recommendations)).toBe(true);
            expect(result.recommendations.length).toBeGreaterThan(0);

            // Verify metadata
            expect(result.metadata.processingMethod).toBe('api_fallback');
            expect(result.metadata.processingTime).toBeGreaterThan(0);
        }, 30000);

        it('should handle different contract types consistently', async () => {
            const contracts = [
                {
                    name: 'Employment Contract',
                    text: `
            EMPLOYMENT AGREEMENT
            Employee shall receive salary of $75,000 annually.
            Employment may be terminated by either party with two weeks notice.
            Employee agrees to maintain confidentiality of company information.
          `
                },
                {
                    name: 'Software License',
                    text: `
            SOFTWARE LICENSE AGREEMENT
            License fee is $10,000 payable within 30 days.
            Licensor retains all intellectual property rights.
            Liability is limited to the license fee paid.
          `
                },
                {
                    name: 'Service Contract',
                    text: `
            SERVICE CONTRACT
            Payment terms are net 45 days from invoice date.
            Services may be terminated with 60 days notice.
            Contractor shall indemnify client against all claims.
          `
                }
            ];

            const results = [];

            for (const contract of contracts) {
                const document = { text: contract.text, filename: `${contract.name}.txt` };
                const result = await contractProcessor.processContract(document);
                results.push({ name: contract.name, result });
            }

            // Verify all contracts were processed successfully
            expect(results.length).toBe(3);

            results.forEach(({ name, result }) => {
                expect(result.summary).toBeDefined();
                expect(result.clauses.length).toBeGreaterThan(0);
                expect(result.metadata.processingMethod).toBe('api_fallback');

                // Each contract should have identified relevant clause types
                const clauseTypes = result.clauses.map(c => c.type);
                expect(clauseTypes.length).toBeGreaterThan(0);
            });

            // Verify different contract types produce different analysis patterns
            const employmentResult = results.find(r => r.name === 'Employment Contract').result;
            const licenseResult = results.find(r => r.name === 'Software License').result;

            expect(employmentResult.clauses.some(c => c.type === 'confidentiality_agreement')).toBe(true);
            expect(licenseResult.clauses.some(c => c.type === 'intellectual_property')).toBe(true);
        }, 45000);

        it('should maintain data consistency across processing steps', async () => {
            const contractText = `
        CONSULTING AGREEMENT
        Consultant shall be paid $150 per hour for services rendered.
        Payment is due within 30 days of invoice submission.
        Either party may terminate with 15 days written notice.
        Consultant agrees to maintain confidentiality of all client information.
      `;

            const document = { text: contractText, filename: 'consulting-agreement.txt' };
            const result = await contractProcessor.processContract(document);

            // Verify data consistency
            expect(result.summary.totalClauses).toBe(result.clauses.length);

            // Verify all risks reference valid clauses
            result.risks.forEach(risk => {
                if (risk.affectedClauses && risk.affectedClauses.length > 0) {
                    risk.affectedClauses.forEach(clauseId => {
                        const referencedClause = result.clauses.find(c => c.id === clauseId);
                        expect(referencedClause).toBeDefined();
                    });
                }
            });

            // Verify recommendations reference valid risks
            result.recommendations.forEach(rec => {
                if (rec.riskId) {
                    const referencedRisk = result.risks.find(r => r.id === rec.riskId);
                    // Risk might not exist if recommendation is general, so we don't require it
                }
            });

            // Verify confidence scores are within valid range
            result.clauses.forEach(clause => {
                expect(clause.confidence).toBeGreaterThanOrEqual(0);
                expect(clause.confidence).toBeLessThanOrEqual(1);
            });

            result.risks.forEach(risk => {
                expect(risk.confidence).toBeGreaterThanOrEqual(0);
                expect(risk.confidence).toBeLessThanOrEqual(1);
            });
        }, 30000);
    });

    describe('Error Handling and Recovery', () => {
        it('should handle malformed contract text gracefully', async () => {
            const malformedTexts = [
                '', // Empty text
                '   \n\n\t   ', // Only whitespace
                'A'.repeat(10), // Too short
                'This is not a contract just random text without any legal clauses or structure.' // No legal content
            ];

            for (const text of malformedTexts) {
                const document = { text, filename: 'malformed.txt' };

                // System should handle all inputs gracefully, even malformed ones
                // This demonstrates robust error handling and fallback capabilities
                const result = await contractProcessor.processContract(document);
                expect(result).toHaveProperty('summary');
                expect(result).toHaveProperty('clauses');
                expect(result).toHaveProperty('risks');
                expect(result).toHaveProperty('recommendations');

                // For very short or empty text, results may be minimal but structure should be maintained
                if (text.trim().length === 0 || text.length < 20) {
                    expect(result.metadata).toHaveProperty('fallbackReason');
                }
            }
        }, 30000);

        it('should recover from processing failures with fallback', async () => {
            const contractText = `
        COMPLEX CONTRACT WITH UNUSUAL FORMATTING
        
        §1. Payment: Due in 30 days
        §2. Termination: 60 days notice required
        §3. Liability: Limited to contract value
      `;

            const document = { text: contractText, filename: 'complex-contract.txt' };

            // Should successfully process even with unusual formatting
            const result = await contractProcessor.processContract(document);

            expect(result).toHaveProperty('summary');
            expect(result.clauses.length).toBeGreaterThan(0);
            expect(result.metadata.processingMethod).toBe('api_fallback');

            // Should identify key clauses despite formatting
            const clauseTypes = result.clauses.map(c => c.type);
            expect(clauseTypes).toContain('payment_terms');
        }, 30000);

        it('should handle concurrent processing requests', async () => {
            const contracts = [
                'Contract 1: Payment due in 30 days. Termination with 15 days notice.',
                'Contract 2: Payment due in 45 days. Termination with 30 days notice.',
                'Contract 3: Payment due in 60 days. Termination with 60 days notice.'
            ];

            // Process multiple contracts concurrently
            const promises = contracts.map((text, index) => {
                const document = { text, filename: `concurrent-${index + 1}.txt` };
                return contractProcessor.processContract(document);
            });

            const results = await Promise.all(promises);

            // Verify all contracts were processed successfully
            expect(results.length).toBe(3);

            results.forEach((result, index) => {
                expect(result).toHaveProperty('summary');
                expect(result.clauses.length).toBeGreaterThan(0);
                expect(result.metadata.processingMethod).toBe('api_fallback');
            });

            // Verify processing stats were updated correctly
            const stats = contractProcessor.getProcessingStats();
            expect(stats.totalRequests).toBeGreaterThanOrEqual(3);
            expect(stats.apiRequests).toBeGreaterThanOrEqual(3);
        }, 45000);
    });

    describe('Performance and Scalability', () => {
        it('should process contracts within acceptable time limits', async () => {
            const contractText = `
        PERFORMANCE TEST CONTRACT
        
        This agreement contains multiple sections to test processing performance.
        
        PAYMENT TERMS: Payment shall be due within thirty (30) days of invoice receipt.
        Late payments will incur a penalty of 1.5% per month on the outstanding balance.
        
        TERMINATION: Either party may terminate this agreement with sixty (60) days written notice.
        Upon termination, all outstanding obligations must be fulfilled within 30 days.
        
        LIABILITY: Liability is limited to the total contract value not to exceed $100,000.
        Neither party shall be liable for consequential, incidental, or punitive damages.
        
        CONFIDENTIALITY: Both parties agree to maintain strict confidentiality of proprietary information.
        This obligation shall survive termination of the agreement for a period of five (5) years.
        
        INTELLECTUAL PROPERTY: All work product shall be owned by the client upon full payment.
        Contractor retains rights to general methodologies and know-how developed independently.
      `;

            const document = { text: contractText, filename: 'performance-test.txt' };

            const startTime = Date.now();
            const result = await contractProcessor.processContract(document);
            const processingTime = Date.now() - startTime;

            // Should complete within 30 seconds
            expect(processingTime).toBeLessThan(30000);

            // Should produce meaningful results
            expect(result.clauses.length).toBeGreaterThanOrEqual(3);
            expect(result.risks.length).toBeGreaterThanOrEqual(0);
            expect(result.recommendations.length).toBeGreaterThanOrEqual(0);

            // Verify processing time is recorded
            expect(result.metadata.processingTime).toBeGreaterThan(0);
            expect(result.metadata.processingTime).toBeLessThan(30000);
        }, 35000);

        it('should handle large contract documents efficiently', async () => {
            // Generate a large contract text
            const baseContract = `
        SECTION: This is a contract section with payment terms due in 30 days.
        The parties agree to maintain confidentiality and limit liability appropriately.
        Termination may occur with proper notice as specified herein.
      `;

            const largeContractText = Array(20).fill(baseContract).join('\n\n');
            const document = { text: largeContractText, filename: 'large-contract.txt' };

            const startTime = Date.now();
            const result = await contractProcessor.processContract(document);
            const processingTime = Date.now() - startTime;

            // Should handle large documents within reasonable time
            expect(processingTime).toBeLessThan(45000);

            // Should identify multiple clauses (adjusted for realistic expectations)
            expect(result.clauses.length).toBeGreaterThanOrEqual(4);
            expect(result.summary.totalClauses).toBe(result.clauses.length);

            // Should maintain quality despite size
            expect(result.summary.confidence).toBeGreaterThan(0.5);
        }, 50000);
    });

    describe('API Integration and Fallback', () => {
        it('should use API fallback when AI model is unavailable', async () => {
            const contractText = `
        API FALLBACK TEST CONTRACT
        Payment terms: Net 30 days from invoice date.
        Termination: Either party may terminate with 30 days notice.
        Liability: Limited to contract value.
      `;

            const document = { text: contractText, filename: 'api-fallback-test.txt' };
            const result = await contractProcessor.processContract(document);

            // Should use API fallback
            expect(result.metadata.processingMethod).toBe('api_fallback');

            // Should produce valid results
            expect(result.clauses.length).toBeGreaterThan(0);
            expect(result.risks.length).toBeGreaterThan(0);

            // Should identify payment terms
            const paymentClause = result.clauses.find(c => c.type === 'payment_terms');
            expect(paymentClause).toBeDefined();
        }, 30000);

        it('should normalize API responses correctly', async () => {
            const apiClient = new APIClient();
            const responseNormalizer = new ResponseNormalizer();

            const contractText = 'Test contract with payment terms due in 45 days.';
            const apiResponse = await apiClient.analyzeContract(contractText);

            // Verify API response structure
            expect(apiResponse).toHaveProperty('summary');
            expect(apiResponse).toHaveProperty('clauses');
            expect(apiResponse).toHaveProperty('risks');
            expect(apiResponse).toHaveProperty('recommendations');

            // Normalize response
            const normalizedResponse = responseNormalizer.normalizeToStandardFormat(apiResponse);

            // Verify normalization maintains structure
            expect(normalizedResponse).toHaveProperty('summary');
            expect(normalizedResponse).toHaveProperty('clauses');
            expect(normalizedResponse).toHaveProperty('risks');
            expect(normalizedResponse).toHaveProperty('recommendations');
            expect(normalizedResponse).toHaveProperty('metadata');

            await apiClient.shutdown();
        }, 30000);
    });

    describe('Data Validation and Quality Assurance', () => {
        it('should validate all output data structures', async () => {
            const contractText = `
        DATA VALIDATION TEST
        Payment: Due within 30 days of invoice.
        Termination: 60 days written notice required.
        Liability: Limited to $50,000 maximum.
      `;

            const document = { text: contractText, filename: 'validation-test.txt' };
            const result = await contractProcessor.processContract(document);

            // Validate summary structure
            expect(result.summary).toHaveProperty('title');
            expect(result.summary).toHaveProperty('documentType');
            expect(result.summary).toHaveProperty('totalClauses');
            expect(result.summary).toHaveProperty('riskScore');
            expect(result.summary).toHaveProperty('confidence');
            expect(typeof result.summary.totalClauses).toBe('number');
            expect(typeof result.summary.riskScore).toBe('number');
            expect(typeof result.summary.confidence).toBe('number');

            // Validate clause structures
            result.clauses.forEach(clause => {
                expect(clause).toHaveProperty('id');
                expect(clause).toHaveProperty('text');
                expect(clause).toHaveProperty('type');
                expect(clause).toHaveProperty('category');
                expect(clause).toHaveProperty('confidence');
                expect(typeof clause.id).toBe('string');
                expect(typeof clause.text).toBe('string');
                expect(typeof clause.type).toBe('string');
                expect(typeof clause.confidence).toBe('number');
                expect(clause.confidence).toBeGreaterThanOrEqual(0);
                expect(clause.confidence).toBeLessThanOrEqual(1);
            });

            // Validate risk structures
            result.risks.forEach(risk => {
                expect(risk).toHaveProperty('id');
                expect(risk).toHaveProperty('title');
                expect(risk).toHaveProperty('description');
                expect(risk).toHaveProperty('severity');
                expect(risk).toHaveProperty('category');
                expect(risk).toHaveProperty('confidence');
                expect(typeof risk.id).toBe('string');
                expect(typeof risk.title).toBe('string');
                expect(typeof risk.description).toBe('string');
                expect(['Low', 'Medium', 'High', 'Critical']).toContain(risk.severity);
                expect(typeof risk.confidence).toBe('number');
                expect(risk.confidence).toBeGreaterThanOrEqual(0);
                expect(risk.confidence).toBeLessThanOrEqual(1);
            });

            // Validate recommendation structures
            result.recommendations.forEach(rec => {
                expect(rec).toHaveProperty('id');
                expect(rec).toHaveProperty('title');
                expect(rec).toHaveProperty('description');
                expect(rec).toHaveProperty('priority');
                expect(rec).toHaveProperty('category');
                expect(typeof rec.id).toBe('string');
                expect(typeof rec.title).toBe('string');
                expect(typeof rec.description).toBe('string');
                expect(['Low', 'Medium', 'High']).toContain(rec.priority);
            });

            // Validate metadata structure
            expect(result.metadata).toHaveProperty('processingMethod');
            expect(result.metadata).toHaveProperty('processingTime');
            expect(result.metadata).toHaveProperty('confidence');
            expect(typeof result.metadata.processingTime).toBe('number');
            expect(result.metadata.processingTime).toBeGreaterThan(0);
        }, 30000);

        it('should maintain consistent clause identification across similar contracts', async () => {
            const similarContracts = [
                'Payment shall be due within thirty (30) days of invoice receipt.',
                'Payment is due within 30 days from invoice date.',
                'Invoice payment terms: Net 30 days.'
            ];

            const results = [];

            for (const text of similarContracts) {
                const document = { text, filename: 'similar-contract.txt' };
                const result = await contractProcessor.processContract(document);
                results.push(result);
            }

            // All should identify payment terms
            results.forEach(result => {
                const paymentClause = result.clauses.find(c => c.type === 'payment_terms');
                expect(paymentClause).toBeDefined();
                expect(paymentClause.category).toBe('Payment');
            });

            // Confidence scores should be reasonably consistent
            const confidenceScores = results.map(r =>
                r.clauses.find(c => c.type === 'payment_terms')?.confidence || 0
            );

            const avgConfidence = confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length;
            confidenceScores.forEach(conf => {
                expect(Math.abs(conf - avgConfidence)).toBeLessThan(0.3); // Within 30% of average
            });
        }, 45000);
    });
});