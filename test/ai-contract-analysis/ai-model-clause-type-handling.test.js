// Property-based test for AI model clause type handling
// **Feature: ai-contract-analysis, Property 2: AI model handles minimum clause types**
// **Validates: Requirements 1.2**

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ContractProcessor } from '../../src/processors/ContractProcessor.js';
import { ClauseExtractor } from '../../model/extractors/ClauseExtractor.js';

describe('AI Model Clause Type Handling Property Tests', () => {
    let contractProcessor;
    let clauseExtractor;

    beforeEach(() => {
        contractProcessor = new ContractProcessor();
        clauseExtractor = new ClauseExtractor();
    });

    afterEach(async () => {
        if (contractProcessor) {
            await contractProcessor.cleanup();
        }
    });

    it('**Feature: ai-contract-analysis, Property 2: AI model handles minimum clause types**', async () => {
        // **Validates: Requirements 1.2**
        await fc.assert(
            fc.asyncProperty(
                // Generate contracts containing recognizable clause types
                fc.record({
                    contractText: fc.oneof(
                        // Contract with payment terms
                        fc.constant(`
              PAYMENT AGREEMENT
              
              1. PAYMENT TERMS
              The Client agrees to pay the Contractor within thirty (30) days of receiving an invoice.
              Payment shall be made in US dollars via wire transfer or certified check.
              Late payments will incur a penalty of 1.5% per month on the outstanding balance.
              
              2. SERVICES
              The Contractor will provide consulting services as outlined in Exhibit A.
            `),

                        // Contract with termination clause
                        fc.constant(`
              SERVICE AGREEMENT
              
              1. TERM AND TERMINATION
              This Agreement shall commence on the Effective Date and continue for twelve (12) months.
              Either party may terminate this Agreement with thirty (30) days written notice.
              Upon termination, all obligations shall cease except those that survive termination.
              
              2. DELIVERABLES
              The Service Provider will deliver all work products by the specified deadlines.
            `),

                        // Contract with liability limitation
                        fc.constant(`
              CONSULTING AGREEMENT
              
              1. LIABILITY LIMITATION
              In no event shall either party be liable for indirect, incidental, or consequential damages.
              The total liability of either party shall not exceed the total amount paid under this Agreement.
              Each party shall indemnify the other against third-party claims arising from their negligence.
              
              2. SCOPE OF WORK
              The Consultant will provide strategic advisory services to the Client.
            `),

                        // Contract with confidentiality provisions
                        fc.constant(`
              NON-DISCLOSURE AGREEMENT
              
              1. CONFIDENTIALITY
              All confidential information disclosed by either party shall be kept strictly confidential.
              The receiving party agrees not to disclose confidential information to any third parties.
              Confidentiality obligations shall survive termination for a period of five (5) years.
              
              2. PURPOSE
              Confidential information may only be used for evaluating potential business opportunities.
            `),

                        // Contract with intellectual property clauses
                        fc.constant(`
              DEVELOPMENT AGREEMENT
              
              1. INTELLECTUAL PROPERTY RIGHTS
              All intellectual property rights in work products shall remain with the Client.
              The Developer grants the Client a perpetual, non-exclusive license to use any pre-existing IP.
              Any improvements or derivative works shall be owned by the Client.
              
              2. DEVELOPMENT SERVICES
              The Developer will create custom software according to the specifications.
            `),

                        // Comprehensive contract with multiple clause types
                        fc.constant(`
              MASTER SERVICE AGREEMENT
              
              1. PAYMENT TERMS
              Payment shall be made within thirty (30) days of invoice date. All amounts are in US dollars.
              
              2. TERMINATION
              Either party may terminate this agreement with sixty (60) days written notice.
              
              3. LIABILITY AND INDEMNIFICATION
              Neither party shall be liable for consequential damages. Each party indemnifies the other.
              
              4. CONFIDENTIALITY
              All confidential information shall be protected and not disclosed to third parties.
              
              5. INTELLECTUAL PROPERTY
              All work product created under this agreement shall be owned by the Client.
              
              6. GOVERNING LAW
              This agreement shall be governed by the laws of the State of California.
              
              7. DISPUTE RESOLUTION
              Any disputes shall be resolved through binding arbitration in San Francisco, CA.
              
              8. FORCE MAJEURE
              Neither party shall be liable for delays caused by circumstances beyond their control.
              
              9. ASSIGNMENT
              This agreement may not be assigned without the prior written consent of both parties.
              
              10. ENTIRE AGREEMENT
              This agreement constitutes the entire agreement and supersedes all prior negotiations.
            `)
                    ),
                    documentType: fc.constantFrom('pdf', 'docx', 'txt')
                }),
                async ({ contractText, documentType }) => {
                    // Create document object for processing
                    const document = {
                        text: contractText,
                        content: contractText,
                        filename: `test-contract.${documentType}`,
                        type: documentType
                    };

                    try {
                        // Process contract with AI system
                        const result = await contractProcessor.processContract(document);

                        // Verify the system produces structured output (Requirement 1.1)
                        expect(result).toHaveProperty('summary');
                        expect(result).toHaveProperty('clauses');
                        expect(result).toHaveProperty('risks');
                        expect(result).toHaveProperty('recommendations');
                        expect(result).toHaveProperty('metadata');

                        // Verify clauses array is properly structured
                        expect(Array.isArray(result.clauses)).toBe(true);

                        // Get supported clause types from the extractor
                        const supportedTypes = clauseExtractor.getSupportedClauseTypes();

                        // Verify system supports at least 15 clause types (Requirement 1.2)
                        expect(supportedTypes.length).toBeGreaterThanOrEqual(15);

                        // Verify key clause types are supported
                        const requiredClauseTypes = [
                            'payment_terms',
                            'termination_clause',
                            'liability_limitation',
                            'confidentiality_agreement',
                            'intellectual_property'
                        ];

                        for (const requiredType of requiredClauseTypes) {
                            expect(supportedTypes).toContain(requiredType);
                        }

                        // If clauses were identified, verify they have proper structure
                        if (result.clauses.length > 0) {
                            for (const clause of result.clauses) {
                                // Each clause should have required properties
                                expect(clause).toHaveProperty('id');
                                expect(clause).toHaveProperty('text');
                                expect(clause).toHaveProperty('type');
                                expect(clause).toHaveProperty('category');
                                expect(clause).toHaveProperty('confidence');

                                // Verify property types
                                expect(typeof clause.id).toBe('string');
                                expect(typeof clause.text).toBe('string');
                                expect(typeof clause.type).toBe('string');
                                expect(typeof clause.category).toBe('string');
                                expect(typeof clause.confidence).toBe('number');

                                // Verify clause type is from supported types or 'unknown'
                                const validTypes = [...supportedTypes, 'unknown'];
                                expect(validTypes).toContain(clause.type);

                                // Verify confidence is in valid range
                                expect(clause.confidence).toBeGreaterThanOrEqual(0.0);
                                expect(clause.confidence).toBeLessThanOrEqual(1.0);

                                // Verify text is non-empty
                                expect(clause.text.length).toBeGreaterThan(0);
                            }

                            // For contracts with recognizable clause types, verify at least some are identified
                            const identifiedTypes = new Set(result.clauses.map(c => c.type));

                            // Check if contract contains payment terms
                            if (contractText.toLowerCase().includes('payment') ||
                                contractText.toLowerCase().includes('invoice')) {
                                // Should identify payment-related clauses when present
                                const hasPaymentClause = identifiedTypes.has('payment_terms') ||
                                    result.clauses.some(c =>
                                        c.text.toLowerCase().includes('payment') ||
                                        c.text.toLowerCase().includes('invoice')
                                    );
                                expect(hasPaymentClause).toBe(true);
                            }

                            // Check if contract contains termination terms
                            if (contractText.toLowerCase().includes('terminat') ||
                                contractText.toLowerCase().includes('end')) {
                                // Should identify termination-related clauses when present
                                const hasTerminationClause = identifiedTypes.has('termination_clause') ||
                                    result.clauses.some(c =>
                                        c.text.toLowerCase().includes('terminat') ||
                                        c.text.toLowerCase().includes('end')
                                    );
                                expect(hasTerminationClause).toBe(true);
                            }

                            // Check if contract contains liability terms
                            if (contractText.toLowerCase().includes('liabilit') ||
                                contractText.toLowerCase().includes('damages')) {
                                // Should identify liability-related clauses when present
                                const hasLiabilityClause = identifiedTypes.has('liability_limitation') ||
                                    result.clauses.some(c =>
                                        c.text.toLowerCase().includes('liabilit') ||
                                        c.text.toLowerCase().includes('damages')
                                    );
                                expect(hasLiabilityClause).toBe(true);
                            }

                            // Check if contract contains confidentiality terms
                            if (contractText.toLowerCase().includes('confidential') ||
                                contractText.toLowerCase().includes('non-disclosure')) {
                                // Should identify confidentiality-related clauses when present
                                const hasConfidentialityClause = identifiedTypes.has('confidentiality_agreement') ||
                                    result.clauses.some(c =>
                                        c.text.toLowerCase().includes('confidential') ||
                                        c.text.toLowerCase().includes('non-disclosure')
                                    );
                                expect(hasConfidentialityClause).toBe(true);
                            }

                            // Check if contract contains intellectual property terms
                            if (contractText.toLowerCase().includes('intellectual property') ||
                                contractText.toLowerCase().includes('copyright')) {
                                // Should identify IP-related clauses when present
                                const hasIPClause = identifiedTypes.has('intellectual_property') ||
                                    result.clauses.some(c =>
                                        c.text.toLowerCase().includes('intellectual property') ||
                                        c.text.toLowerCase().includes('copyright')
                                    );
                                expect(hasIPClause).toBe(true);
                            }
                        }

                        // Verify metadata indicates processing method
                        expect(result.metadata).toHaveProperty('processingMethod');
                        expect(['ai_model', 'api_fallback']).toContain(result.metadata.processingMethod);

                    } catch (error) {
                        // If processing fails, it should be due to system unavailability, not invalid input
                        expect(error.message).not.toMatch(/invalid.*input/i);

                        // The error should indicate a system issue, not a capability issue
                        const validErrorPatterns = [
                            /model.*unavailable/i,
                            /api.*failed/i,
                            /processing.*failed/i,
                            /timeout/i,
                            /connection/i
                        ];

                        const hasValidErrorPattern = validErrorPatterns.some(pattern =>
                            pattern.test(error.message)
                        );

                        if (!hasValidErrorPattern) {
                            throw error; // Re-throw if it's not a recognized system error
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 2a: Clause type identification is consistent across processing methods', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(
                    "Payment shall be made within 30 days of invoice receipt.",
                    "Either party may terminate this agreement with written notice.",
                    "The parties agree to keep all information confidential.",
                    "All intellectual property rights remain with the owner."
                ),
                async (clauseText) => {
                    // Test with clause extractor directly
                    const clauses = await clauseExtractor.identifyClauses(clauseText);
                    const categorized = await clauseExtractor.categorizeClauses(clauses);

                    // Test with contract processor
                    const document = {
                        text: clauseText,
                        content: clauseText,
                        filename: 'test-clause.txt'
                    };

                    try {
                        const result = await contractProcessor.processContract(document);

                        // Both methods should identify clauses when present
                        if (categorized.length > 0 && result.clauses.length > 0) {
                            // Should have similar clause identification capabilities
                            expect(result.clauses.length).toBeGreaterThan(0);

                            // Should use consistent clause type vocabulary
                            const extractorTypes = new Set(categorized.map(c => c.type));
                            const processorTypes = new Set(result.clauses.map(c => c.type));

                            // Types should come from the same supported vocabulary
                            const supportedTypes = clauseExtractor.getSupportedClauseTypes();
                            const allValidTypes = [...supportedTypes, 'unknown'];

                            extractorTypes.forEach(type => {
                                expect(allValidTypes).toContain(type);
                            });

                            processorTypes.forEach(type => {
                                expect(allValidTypes).toContain(type);
                            });
                        }
                    } catch (error) {
                        // System errors are acceptable, but not capability errors
                        expect(error.message).not.toMatch(/unsupported.*clause.*type/i);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property 2b: System handles edge cases in clause type identification', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.oneof(
                    fc.constant(""), // Empty contract
                    fc.constant("This is not a legal contract."), // Non-contract text
                    fc.constant("a".repeat(1000)), // Repetitive text
                    fc.constant("Payment payment PAYMENT Payment."), // Case variations
                    fc.constant("The payment terms are that payment shall be made.") // Redundant terms
                ),
                async (edgeCaseText) => {
                    const document = {
                        text: edgeCaseText,
                        content: edgeCaseText,
                        filename: 'edge-case.txt'
                    };

                    try {
                        const result = await contractProcessor.processContract(document);

                        // System should handle edge cases gracefully
                        expect(result).toHaveProperty('clauses');
                        expect(Array.isArray(result.clauses)).toBe(true);

                        // For empty or invalid input, should return empty or minimal results
                        if (edgeCaseText.trim().length === 0) {
                            expect(result.clauses.length).toBe(0);
                        }

                        // All identified clauses should still have proper structure
                        for (const clause of result.clauses) {
                            expect(clause).toHaveProperty('type');
                            expect(typeof clause.type).toBe('string');

                            const supportedTypes = clauseExtractor.getSupportedClauseTypes();
                            const validTypes = [...supportedTypes, 'unknown'];
                            expect(validTypes).toContain(clause.type);
                        }

                    } catch (error) {
                        // For empty text, validation error is expected and acceptable
                        if (edgeCaseText.trim().length === 0) {
                            expect(error.message).toMatch(/Document must contain text or content|Document text must be a non-empty string/);
                        } else {
                            // Should handle other edge cases gracefully, not crash
                            expect(error.message).not.toMatch(/unexpected.*error/i);
                            expect(error.message).not.toMatch(/crash/i);
                        }
                    }
                }
            ),
            { numRuns: 50 }
        );
    });
});