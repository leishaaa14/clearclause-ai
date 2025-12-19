// Property-based test for clause summary counts
// **Feature: ai-contract-analysis, Property 9: Clause extraction provides summary counts**
// **Validates: Requirements 4.5**

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ClauseExtractor } from '../../model/extractors/ClauseExtractor.js';
import { ModelManager } from '../../model/core/ModelManager.js';

describe('Clause Summary Counts Property Tests', () => {
    let clauseExtractor;
    let modelManager;

    beforeEach(() => {
        modelManager = new ModelManager();
        clauseExtractor = new ClauseExtractor(modelManager);
    });

    afterEach(async () => {
        if (modelManager.isLoaded) {
            await modelManager.unloadModel();
        }
    });

    it('Property 9: Clause extraction provides summary counts', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate contract text with known clause types and counts
                fc.record({
                    contractText: fc.oneof(
                        // Single clause type contracts
                        fc.constant("Payment shall be made within 30 days. All payments must be in USD. Late fees apply after 30 days."),
                        fc.constant("Either party may terminate this agreement. Termination requires 30 days notice. Upon termination, all rights cease."),
                        fc.constant("All information is confidential. Confidential data must not be disclosed. Confidentiality survives termination."),

                        // Multi-clause type contracts
                        fc.constant(`
              SERVICES AGREEMENT
              
              1. PAYMENT TERMS
              Payment shall be made within 30 days of invoice date.
              All payments must be made in US dollars.
              
              2. TERMINATION
              Either party may terminate this agreement with 30 days written notice.
              This agreement terminates automatically upon breach.
              
              3. LIABILITY LIMITATION
              In no event shall either party be liable for indirect damages.
              Total liability shall not exceed the contract value.
              
              4. CONFIDENTIALITY
              All confidential information shall be kept strictly confidential.
              
              5. INTELLECTUAL PROPERTY
              All intellectual property rights shall remain with the original owner.
            `),

                        // Complex contract with multiple instances of same clause types
                        fc.constant(`
              COMPREHENSIVE AGREEMENT
              
              Section 1: Payment Terms
              1.1 Payment shall be due within 30 days.
              1.2 Late payment fees of 1.5% per month apply.
              1.3 All payments must be in US dollars.
              
              Section 2: Termination Provisions
              2.1 Either party may terminate with 30 days notice.
              2.2 Immediate termination is allowed for material breach.
              2.3 Upon termination, all licenses terminate.
              
              Section 3: Liability and Indemnification
              3.1 Liability is limited to direct damages only.
              3.2 Each party indemnifies against third-party claims.
              3.3 Indemnification obligations survive termination.
              
              Section 4: Confidentiality
              4.1 All information is confidential.
              4.2 Confidentiality obligations last 5 years.
              
              Section 5: Additional Payment Terms
              5.1 Invoices must include detailed descriptions.
              5.2 Payment disputes must be raised within 10 days.
            `)
                    )
                }),
                async ({ contractText }) => {
                    // Extract and categorize clauses
                    const clauses = await clauseExtractor.identifyClauses(contractText);
                    const categorizedClauses = await clauseExtractor.categorizeClauses(clauses);

                    // Group clauses by type to get counts
                    const groupedClauses = clauseExtractor.groupClausesByType(categorizedClauses);

                    // Requirement 4.5: System should provide accurate counts of each clause type found
                    expect(typeof groupedClauses).toBe('object');
                    expect(groupedClauses).not.toBeNull();

                    // Verify that all supported clause types are represented in the grouped result
                    const supportedTypes = clauseExtractor.getSupportedClauseTypes();
                    for (const type of supportedTypes) {
                        expect(groupedClauses).toHaveProperty(type);
                        expect(groupedClauses[type]).toHaveProperty('type');
                        expect(groupedClauses[type]).toHaveProperty('clauses');
                        expect(groupedClauses[type]).toHaveProperty('count');

                        expect(groupedClauses[type].type).toBe(type);
                        expect(Array.isArray(groupedClauses[type].clauses)).toBe(true);
                        expect(typeof groupedClauses[type].count).toBe('number');
                        expect(groupedClauses[type].count).toBeGreaterThanOrEqual(0);

                        // Count should match the actual number of clauses in the array
                        expect(groupedClauses[type].count).toBe(groupedClauses[type].clauses.length);
                    }

                    // Verify that the total count matches the original number of categorized clauses
                    let totalCount = 0;
                    for (const type of Object.keys(groupedClauses)) {
                        totalCount += groupedClauses[type].count;
                    }
                    expect(totalCount).toBe(categorizedClauses.length);

                    // Verify that each clause appears in exactly one group
                    const allGroupedClauses = [];
                    for (const type of Object.keys(groupedClauses)) {
                        allGroupedClauses.push(...groupedClauses[type].clauses);
                    }
                    expect(allGroupedClauses.length).toBe(categorizedClauses.length);

                    // Verify that clause IDs are preserved and unique
                    const originalIds = categorizedClauses.map(c => c.id);
                    const groupedIds = allGroupedClauses.map(c => c.id);
                    expect(groupedIds.sort()).toEqual(originalIds.sort());

                    // Verify that clause text is preserved in grouped results
                    for (const type of Object.keys(groupedClauses)) {
                        for (const clause of groupedClauses[type].clauses) {
                            expect(clause).toHaveProperty('id');
                            expect(clause).toHaveProperty('text');
                            expect(clause).toHaveProperty('confidence');
                            expect(clause).toHaveProperty('startPosition');
                            expect(clause).toHaveProperty('endPosition');

                            expect(typeof clause.id).toBe('string');
                            expect(typeof clause.text).toBe('string');
                            expect(typeof clause.confidence).toBe('number');
                            expect(typeof clause.startPosition).toBe('number');
                            expect(typeof clause.endPosition).toBe('number');

                            expect(clause.text.length).toBeGreaterThan(0);
                            expect(clause.confidence).toBeGreaterThanOrEqual(0.0);
                            expect(clause.confidence).toBeLessThanOrEqual(1.0);
                        }
                    }

                    // Test specific clause type counting for known content
                    if (contractText.toLowerCase().includes('payment')) {
                        const paymentGroup = groupedClauses['payment_terms'];
                        expect(paymentGroup.count).toBeGreaterThan(0);
                        expect(paymentGroup.clauses.length).toBeGreaterThan(0);
                    }

                    if (contractText.toLowerCase().includes('terminate')) {
                        const terminationGroup = groupedClauses['termination_clause'];
                        expect(terminationGroup.count).toBeGreaterThan(0);
                        expect(terminationGroup.clauses.length).toBeGreaterThan(0);
                    }

                    if (contractText.toLowerCase().includes('confidential')) {
                        const confidentialityGroup = groupedClauses['confidentiality_agreement'];
                        expect(confidentialityGroup.count).toBeGreaterThan(0);
                        expect(confidentialityGroup.clauses.length).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 9a: Empty contract produces zero counts for all clause types', async () => {
        const emptyContract = "";
        const clauses = await clauseExtractor.identifyClauses(emptyContract);
        const categorizedClauses = await clauseExtractor.categorizeClauses(clauses);
        const groupedClauses = clauseExtractor.groupClausesByType(categorizedClauses);

        // All clause types should have zero count
        const supportedTypes = clauseExtractor.getSupportedClauseTypes();
        for (const type of supportedTypes) {
            expect(groupedClauses[type].count).toBe(0);
            expect(groupedClauses[type].clauses.length).toBe(0);
        }
    });

    it('Property 9b: Count consistency across multiple extractions', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 50, maxLength: 1000 }),
                async (contractText) => {
                    // Extract clauses multiple times
                    const extraction1 = await clauseExtractor.identifyClauses(contractText);
                    const extraction2 = await clauseExtractor.identifyClauses(contractText);

                    const categorized1 = await clauseExtractor.categorizeClauses(extraction1);
                    const categorized2 = await clauseExtractor.categorizeClauses(extraction2);

                    const grouped1 = clauseExtractor.groupClausesByType(categorized1);
                    const grouped2 = clauseExtractor.groupClausesByType(categorized2);

                    // Counts should be consistent across extractions
                    const supportedTypes = clauseExtractor.getSupportedClauseTypes();
                    for (const type of supportedTypes) {
                        expect(grouped1[type].count).toBe(grouped2[type].count);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property 9c: Clause type distribution is reasonable', async () => {
        const comprehensiveContract = `
      MASTER SERVICES AGREEMENT
      
      1. PAYMENT TERMS
      Payment shall be made within 30 days of invoice date.
      All payments must be made in US dollars via wire transfer.
      Late payment fees of 1.5% per month will be applied.
      
      2. TERMINATION PROVISIONS
      Either party may terminate this agreement with 30 days written notice.
      This agreement may be terminated immediately for material breach.
      Upon termination, all rights and obligations shall cease.
      
      3. LIABILITY AND INDEMNIFICATION
      In no event shall either party be liable for indirect damages.
      Total liability under this agreement shall not exceed the contract value.
      Each party shall indemnify the other against third-party claims.
      
      4. CONFIDENTIALITY
      All confidential information shall be kept strictly confidential.
      Confidentiality obligations shall survive termination for 5 years.
      
      5. INTELLECTUAL PROPERTY
      All intellectual property rights shall remain with the original owner.
      The Client grants a non-exclusive license to use their trademarks.
      
      6. GOVERNING LAW
      This agreement shall be governed by the laws of Delaware.
      Any disputes shall be resolved through binding arbitration.
      
      7. ASSIGNMENT
      Neither party may assign this agreement without written consent.
      
      8. ENTIRE AGREEMENT
      This agreement constitutes the entire agreement between the parties.
      
      9. NOTICES
      All notices must be in writing and delivered by certified mail.
    `;

        const clauses = await clauseExtractor.identifyClauses(comprehensiveContract);
        const categorizedClauses = await clauseExtractor.categorizeClauses(clauses);
        const groupedClauses = clauseExtractor.groupClausesByType(categorizedClauses);

        // Should have multiple clause types with non-zero counts
        let typesWithClauses = 0;
        const supportedTypes = clauseExtractor.getSupportedClauseTypes();

        for (const type of supportedTypes) {
            if (groupedClauses[type].count > 0) {
                typesWithClauses++;
            }
        }

        // Should identify at least 5 different clause types in this comprehensive contract
        expect(typesWithClauses).toBeGreaterThanOrEqual(5);

        // Specific types that should be found
        expect(groupedClauses['payment_terms'].count).toBeGreaterThan(0);
        expect(groupedClauses['termination_clause'].count).toBeGreaterThan(0);
        expect(groupedClauses['liability_limitation'].count).toBeGreaterThan(0);
        expect(groupedClauses['confidentiality_agreement'].count).toBeGreaterThan(0);
        expect(groupedClauses['intellectual_property'].count).toBeGreaterThan(0);
    });
});