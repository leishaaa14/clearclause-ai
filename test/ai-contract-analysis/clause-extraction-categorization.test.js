// Property-based test for clause extraction with categorization
// **Feature: ai-contract-analysis, Property 7: Clause extraction with categorization and confidence**
// **Validates: Requirements 4.1, 4.2, 4.3**

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ClauseExtractor } from '../../model/extractors/ClauseExtractor.js';
import { ModelManager } from '../../model/core/ModelManager.js';

describe('Clause Extraction with Categorization Property Tests', () => {
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

  it('Property 7: Clause extraction with categorization and confidence', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate contract text with various clause types
        fc.record({
          contractText: fc.oneof(
            // Payment terms clauses
            fc.constant("Payment shall be made within 30 days of invoice date. Late payments will incur a 1.5% monthly fee."),
            fc.constant("The Client agrees to pay the full amount due within fifteen (15) business days."),
            fc.constant("All payments must be made in US dollars via wire transfer or certified check."),

            // Termination clauses
            fc.constant("Either party may terminate this agreement with 30 days written notice."),
            fc.constant("This contract may be terminated immediately for cause, including breach of material terms."),
            fc.constant("Upon termination, all obligations shall cease except those that survive termination."),

            // Liability clauses
            fc.constant("In no event shall either party be liable for indirect, incidental, or consequential damages."),
            fc.constant("Total liability under this agreement shall not exceed the total amount paid hereunder."),
            fc.constant("Each party shall indemnify the other against third-party claims arising from their negligence."),

            // Confidentiality clauses
            fc.constant("All confidential information shall be kept strictly confidential and not disclosed to third parties."),
            fc.constant("The receiving party agrees to use confidential information solely for the purposes of this agreement."),
            fc.constant("Confidentiality obligations shall survive termination of this agreement for a period of five years."),

            // Intellectual property clauses
            fc.constant("All intellectual property rights shall remain with the original owner."),
            fc.constant("The Client grants a non-exclusive license to use their trademarks for the duration of this agreement."),
            fc.constant("Any work product created under this agreement shall be owned by the Client."),

            // Mixed contract with multiple clause types
            fc.constant(`
              SERVICES AGREEMENT
              
              1. PAYMENT TERMS
              Payment shall be made within 30 days of invoice date. All payments must be in US dollars.
              
              2. TERMINATION
              Either party may terminate this agreement with 30 days written notice to the other party.
              
              3. LIABILITY LIMITATION
              In no event shall either party be liable for indirect, incidental, or consequential damages.
              
              4. CONFIDENTIALITY
              All confidential information shall be kept strictly confidential and not disclosed to third parties.
              
              5. INTELLECTUAL PROPERTY
              All intellectual property rights shall remain with the original owner unless otherwise specified.
            `)
          )
        }),
        async ({ contractText }) => {
          // Test clause extraction (Requirement 4.1)
          const clauses = await clauseExtractor.identifyClauses(contractText);

          // System should identify and extract individual clauses with their full text
          expect(Array.isArray(clauses)).toBe(true);
          expect(clauses.length).toBeGreaterThan(0);

          for (const clause of clauses) {
            // Each clause should have full text
            expect(clause).toHaveProperty('text');
            expect(typeof clause.text).toBe('string');
            expect(clause.text.length).toBeGreaterThan(0);

            // Each clause should have an ID
            expect(clause).toHaveProperty('id');
            expect(typeof clause.id).toBe('string');
            expect(clause.id.length).toBeGreaterThan(0);

            // Each clause should have position information
            expect(clause).toHaveProperty('startPosition');
            expect(clause).toHaveProperty('endPosition');
            expect(typeof clause.startPosition).toBe('number');
            expect(typeof clause.endPosition).toBe('number');
            expect(clause.startPosition).toBeGreaterThanOrEqual(0);
            expect(clause.endPosition).toBeGreaterThan(clause.startPosition);
          }

          // Test categorization (Requirement 4.2)
          const categorizedClauses = await clauseExtractor.categorizeClauses(clauses);

          // System should categorize each clause into predefined types
          const supportedTypes = clauseExtractor.getSupportedClauseTypes();
          expect(Array.isArray(supportedTypes)).toBe(true);
          expect(supportedTypes.length).toBeGreaterThanOrEqual(15); // At least 15 clause types

          for (const clause of categorizedClauses) {
            expect(clause).toHaveProperty('type');
            expect(typeof clause.type).toBe('string');
            expect(clause.type.length).toBeGreaterThan(0);

            expect(clause).toHaveProperty('category');
            expect(typeof clause.category).toBe('string');
            expect(clause.category.length).toBeGreaterThan(0);
          }

          // Test confidence scoring (Requirement 4.3)
          for (const clause of categorizedClauses) {
            expect(clause).toHaveProperty('confidence');
            expect(typeof clause.confidence).toBe('number');
            expect(clause.confidence).toBeGreaterThanOrEqual(0.0);
            expect(clause.confidence).toBeLessThanOrEqual(1.0);
          }

          // Test confidence calculation consistency
          for (const clause of categorizedClauses) {
            const confidenceResult = await clauseExtractor.calculateConfidence(clause, clause.type);
            expect(typeof confidenceResult).toBe('number');
            expect(confidenceResult).toBeGreaterThanOrEqual(0.0);
            expect(confidenceResult).toBeLessThanOrEqual(1.0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7a: Clause extraction handles empty or invalid input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(""),
          fc.constant("   "),
          fc.constant(null),
          fc.constant(undefined),
          fc.string({ minLength: 0, maxLength: 10 }) // Very short strings
        ),
        async (invalidInput) => {
          if (invalidInput === null || invalidInput === undefined) {
            // Should throw error for null/undefined input
            await expect(clauseExtractor.identifyClauses(invalidInput)).rejects.toThrow();
          } else if (typeof invalidInput === 'string' && invalidInput.trim().length === 0) {
            // Should return empty result for empty strings
            const result = await clauseExtractor.identifyClauses(invalidInput);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
          } else {
            // Should handle short strings gracefully
            const result = await clauseExtractor.identifyClauses(invalidInput);
            expect(Array.isArray(result)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7b: Supported clause types meet minimum requirements', async () => {
    const supportedTypes = clauseExtractor.getSupportedClauseTypes();

    // Should have at least 15 different clause types
    expect(supportedTypes.length).toBeGreaterThanOrEqual(15);

    // Should include key clause types mentioned in requirements
    const requiredTypes = [
      'payment_terms',
      'termination_clause',
      'liability_limitation',
      'confidentiality_agreement',
      'intellectual_property'
    ];

    for (const requiredType of requiredTypes) {
      expect(supportedTypes).toContain(requiredType);
    }

    // All types should be non-empty strings
    for (const type of supportedTypes) {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    }
  });
});