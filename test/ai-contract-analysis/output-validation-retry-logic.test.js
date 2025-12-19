// Property-based test for output validation and retry logic
// **Feature: ai-contract-analysis, Property 19: Output validation and retry logic**
// **Validates: Requirements 9.2, 9.3, 9.4**

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ContractAnalyzer } from '../../model/analyzers/ContractAnalyzer.js';
import { ModelManager } from '../../model/core/ModelManager.js';

describe('Output Validation and Retry Logic Property Tests', () => {
  let contractAnalyzer;
  let modelManager;

  beforeEach(() => {
    modelManager = new ModelManager();
    contractAnalyzer = new ContractAnalyzer({
      model: { modelManager }
    });
  });

  afterEach(async () => {
    if (modelManager.isLoaded) {
      await modelManager.unloadModel();
    }
  });

  it('Property 19: Output validation and retry logic', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various contract inputs and failure scenarios
        fc.record({
          contractText: fc.oneof(
            fc.constant("Valid contract with payment terms and termination clauses."),
            fc.constant("SERVICES AGREEMENT\n\n1. Payment Terms\nPayment due within 30 days.\n\n2. Termination\nEither party may terminate with notice."),
            fc.string({ minLength: 50, maxLength: 500 }).filter(s => s.trim().length >= 20)
          ),
          failureScenario: fc.oneof(
            fc.constant('invalid_json'),
            fc.constant('missing_fields'),
            fc.constant('network_error'),
            fc.constant('timeout'),
            fc.constant('success')
          ),
          retryCount: fc.integer({ min: 0, max: 3 })
        }),
        async ({ contractText, failureScenario, retryCount }) => {
          let attemptCount = 0;
          let lastError = null;

          // Mock the model manager to simulate different failure scenarios
          modelManager.isLoaded = true;
          modelManager.inference = async (prompt, options) => {
            attemptCount++;

            // Simulate failures based on scenario
            if (failureScenario === 'invalid_json' && attemptCount <= retryCount) {
              return "This is not valid JSON output from the model";
            }

            if (failureScenario === 'missing_fields' && attemptCount <= retryCount) {
              return JSON.stringify({
                // Missing required fields like 'clauses' or 'risks'
                summary: { title: "Test" }
              });
            }

            if (failureScenario === 'network_error' && attemptCount <= retryCount) {
              throw new Error('Network connection failed');
            }

            if (failureScenario === 'timeout' && attemptCount <= retryCount) {
              throw new Error('Request timeout');
            }

            // Return valid response after retries or on success scenario
            return JSON.stringify({
              summary: {
                title: "Contract Analysis",
                documentType: "contract",
                totalClauses: 2,
                riskScore: 30,
                confidence: 0.85
              },
              clauses: [
                {
                  id: "clause_1",
                  text: "Payment shall be made within 30 days",
                  type: "payment_terms",
                  category: "payment_terms",
                  confidence: 0.9,
                  startPosition: 0,
                  endPosition: 35
                },
                {
                  id: "clause_2",
                  text: "Either party may terminate with notice",
                  type: "termination_clause",
                  category: "termination_clause",
                  confidence: 0.8,
                  startPosition: 36,
                  endPosition: 73
                }
              ],
              risks: [
                {
                  id: "risk_1",
                  title: "Payment Risk",
                  description: "30-day payment terms may impact cash flow",
                  severity: "Medium",
                  category: "Financial",
                  mitigation: "Consider shorter payment terms",
                  confidence: 0.75
                }
              ],
              recommendations: [
                {
                  id: "rec_1",
                  title: "Review Payment Terms",
                  description: "Consider negotiating shorter payment terms",
                  priority: "Medium",
                  category: "Financial"
                }
              ]
            });
          };

          try {
            // Test the contract analysis with validation and retry logic
            const result = await contractAnalyzer.analyzeContract(contractText);

            // Requirement 9.2: System should validate output format before returning results
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('clauses');
            expect(result).toHaveProperty('risks');
            expect(result).toHaveProperty('recommendations');
            expect(result).toHaveProperty('metadata');

            // Validate summary structure
            expect(result.summary).toHaveProperty('title');
            expect(result.summary).toHaveProperty('documentType');
            expect(result.summary).toHaveProperty('totalClauses');
            expect(result.summary).toHaveProperty('riskScore');
            expect(result.summary).toHaveProperty('confidence');

            expect(typeof result.summary.title).toBe('string');
            expect(typeof result.summary.documentType).toBe('string');
            expect(typeof result.summary.totalClauses).toBe('number');
            expect(typeof result.summary.riskScore).toBe('number');
            expect(typeof result.summary.confidence).toBe('number');

            expect(result.summary.totalClauses).toBeGreaterThanOrEqual(0);
            expect(result.summary.riskScore).toBeGreaterThanOrEqual(0);
            expect(result.summary.riskScore).toBeLessThanOrEqual(100);
            expect(result.summary.confidence).toBeGreaterThanOrEqual(0);
            expect(result.summary.confidence).toBeLessThanOrEqual(1);

            // Validate clauses array
            expect(Array.isArray(result.clauses)).toBe(true);
            for (const clause of result.clauses) {
              expect(clause).toHaveProperty('id');
              expect(clause).toHaveProperty('text');
              expect(clause).toHaveProperty('type');
              expect(clause).toHaveProperty('category');
              expect(clause).toHaveProperty('confidence');

              expect(typeof clause.id).toBe('string');
              expect(typeof clause.text).toBe('string');
              expect(typeof clause.type).toBe('string');
              expect(typeof clause.category).toBe('string');
              expect(typeof clause.confidence).toBe('number');

              expect(clause.id.length).toBeGreaterThan(0);
              expect(clause.text.length).toBeGreaterThan(0);
              expect(clause.confidence).toBeGreaterThanOrEqual(0);
              expect(clause.confidence).toBeLessThanOrEqual(1);
            }

            // Validate risks array
            expect(Array.isArray(result.risks)).toBe(true);
            for (const risk of result.risks) {
              expect(risk).toHaveProperty('id');
              expect(risk).toHaveProperty('title');
              expect(risk).toHaveProperty('description');
              expect(risk).toHaveProperty('severity');
              expect(risk).toHaveProperty('category');

              expect(typeof risk.id).toBe('string');
              expect(typeof risk.title).toBe('string');
              expect(typeof risk.description).toBe('string');
              expect(typeof risk.severity).toBe('string');
              expect(typeof risk.category).toBe('string');

              expect(['Low', 'Medium', 'High', 'Critical']).toContain(risk.severity);
            }

            // Validate recommendations array
            expect(Array.isArray(result.recommendations)).toBe(true);
            for (const recommendation of result.recommendations) {
              expect(recommendation).toHaveProperty('id');
              expect(recommendation).toHaveProperty('title');
              expect(recommendation).toHaveProperty('description');
              expect(recommendation).toHaveProperty('priority');
              expect(recommendation).toHaveProperty('category');

              expect(typeof recommendation.id).toBe('string');
              expect(typeof recommendation.title).toBe('string');
              expect(typeof recommendation.description).toBe('string');
              expect(typeof recommendation.priority).toBe('string');
              expect(typeof recommendation.category).toBe('string');

              expect(['Low', 'Medium', 'High']).toContain(recommendation.priority);
            }

            // Validate metadata
            expect(result.metadata).toHaveProperty('processingMethod');
            expect(result.metadata).toHaveProperty('processingTime');
            expect(result.metadata).toHaveProperty('confidence');

            expect(typeof result.metadata.processingMethod).toBe('string');
            expect(typeof result.metadata.processingTime).toBe('number');
            expect(typeof result.metadata.confidence).toBe('number');

            expect(result.metadata.processingTime).toBeGreaterThan(0);
            expect(result.metadata.confidence).toBeGreaterThanOrEqual(0);
            expect(result.metadata.confidence).toBeLessThanOrEqual(1);

            // Requirement 9.3: System should automatically retry analysis with adjusted parameters
            // If we had failures that required retries, verify the system eventually succeeded
            if (failureScenario !== 'success' && retryCount > 0) {
              expect(attemptCount).toBeGreaterThan(1);
              expect(attemptCount).toBeLessThanOrEqual(retryCount + 1);
            }

          } catch (error) {
            // Requirement 9.4: System should fallback to API if retries fail
            // In this test, we simulate the retry logic within the analyzer
            // If all retries failed, the error should be meaningful
            if (failureScenario !== 'success' && attemptCount > retryCount) {
              expect(error.message).toContain('analysis failed');
              expect(attemptCount).toBeGreaterThan(retryCount);
            } else {
              // Unexpected error - re-throw for test failure
              throw error;
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 19a: Output validation catches malformed responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('{"invalid": "json"'), // Malformed JSON
          fc.constant('null'), // Null response
          fc.constant(''), // Empty response
          fc.constant('{"summary": {}}'), // Missing required fields
          fc.constant('{"clauses": "not_an_array"}'), // Wrong data types
          fc.constant('{"risks": [{"severity": "Invalid"}]}') // Invalid enum values
        ),
        async (malformedResponse) => {
          modelManager.isLoaded = true;
          modelManager.inference = async () => malformedResponse;

          const contractText = "Test contract with payment and termination clauses.";

          try {
            const result = await contractAnalyzer.analyzeContract(contractText);

            // Even with malformed input, the system should return a valid structure
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('clauses');
            expect(result).toHaveProperty('risks');
            expect(result).toHaveProperty('recommendations');
            expect(result).toHaveProperty('metadata');

            // Arrays should be valid arrays even if empty
            expect(Array.isArray(result.clauses)).toBe(true);
            expect(Array.isArray(result.risks)).toBe(true);
            expect(Array.isArray(result.recommendations)).toBe(true);

          } catch (error) {
            // If the system cannot recover, it should provide a meaningful error
            expect(error.message).toContain('analysis failed');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 19b: Retry logic respects maximum attempts', async () => {
    const maxRetries = 3;
    let attemptCount = 0;

    modelManager.isLoaded = true;
    modelManager.inference = async () => {
      attemptCount++;
      throw new Error('Simulated failure');
    };

    const contractText = "Test contract for retry logic validation.";

    try {
      await contractAnalyzer.analyzeContract(contractText);
      // Should not reach here if retries are working
      expect(false).toBe(true);
    } catch (error) {
      // Should have attempted the maximum number of retries
      expect(attemptCount).toBeLessThanOrEqual(maxRetries + 1); // Initial attempt + retries
      expect(error.message).toContain('analysis failed');
    }
  });

  it('Property 19c: Successful analysis on first attempt requires no retries', async () => {
    let attemptCount = 0;

    modelManager.isLoaded = true;
    modelManager.inference = async () => {
      attemptCount++;
      return JSON.stringify({
        summary: {
          title: "Test Contract",
          documentType: "contract",
          totalClauses: 1,
          riskScore: 25,
          confidence: 0.9
        },
        clauses: [{
          id: "clause_1",
          text: "Test clause",
          type: "general",
          category: "general",
          confidence: 0.9
        }],
        risks: [],
        recommendations: []
      });
    };

    const contractText = "Test contract with valid analysis.";
    const result = await contractAnalyzer.analyzeContract(contractText);

    // Should succeed on first attempt
    expect(attemptCount).toBe(1);
    expect(result).toHaveProperty('summary');
    expect(result.summary.title).toBe('Test Contract');
  });

  it('Property 19d: Output validation ensures data integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          summary: fc.record({
            title: fc.string(),
            totalClauses: fc.integer({ min: -10, max: 1000 }),
            riskScore: fc.integer({ min: -50, max: 150 }),
            confidence: fc.float({ min: -1, max: 2, noNaN: true })
          }),
          clauses: fc.array(fc.record({
            id: fc.string(),
            text: fc.string(),
            confidence: fc.float({ min: -1, max: 2, noNaN: true })
          })),
          risks: fc.array(fc.record({
            severity: fc.oneof(
              fc.constant('Low'),
              fc.constant('Medium'),
              fc.constant('High'),
              fc.constant('Critical'),
              fc.constant('Invalid'), // Invalid severity
              fc.string()
            )
          }))
        }),
        async (mockResponse) => {
          modelManager.isLoaded = true;
          modelManager.inference = async () => JSON.stringify(mockResponse);

          const contractText = "Test contract for data integrity validation.";
          const result = await contractAnalyzer.analyzeContract(contractText);

          // Validate that output normalization occurred
          expect(result.summary.totalClauses).toBeGreaterThanOrEqual(0);
          expect(result.summary.riskScore).toBeGreaterThanOrEqual(0);
          expect(result.summary.riskScore).toBeLessThanOrEqual(100);
          expect(result.summary.confidence).toBeGreaterThanOrEqual(0);
          expect(result.summary.confidence).toBeLessThanOrEqual(1);

          // Validate clause confidence scores are normalized
          for (const clause of result.clauses) {
            expect(clause.confidence).toBeGreaterThanOrEqual(0);
            expect(clause.confidence).toBeLessThanOrEqual(1);
          }

          // Validate risk severity values are valid
          for (const risk of result.risks) {
            expect(['Low', 'Medium', 'High', 'Critical']).toContain(risk.severity);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});