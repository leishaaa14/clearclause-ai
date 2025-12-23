/**
 * Output Quality Validation Property-Based Tests
 * 
 * **Feature: clearclause-e2e-testing, Property 3: Output Quality and Consistency**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * This test suite validates that analysis outputs contain proper summaries,
 * clause extraction with type classification and confidence scores, risk levels
 * with explanations, and actionable mitigation recommendations.
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { OutputValidator } from './utils/OutputValidator.js';
import { analysisOutputGenerator } from './utils/test-data-generators.js';
import { TEST_CONFIG } from './config/test-config.js';

describe('Output Quality Validation - Property Tests', () => {
    const outputValidator = new OutputValidator();

    /**
     * Property 3: Output Quality and Consistency
     * For any successful document analysis, the output should contain a plain-language summary,
     * extracted clauses with type classification and confidence scores, risk levels 
     * (Low/Medium/High/Critical) with explanations, and actionable mitigation recommendations
     */
    test('Property 3: Output Quality and Consistency', () => {
        fc.assert(
            fc.property(analysisOutputGenerator, (analysisOutput) => {
                // Validate the complete analysis output
                const validation = outputValidator.validateAnalysisOutput(analysisOutput);

                // The output should be valid according to our quality standards
                if (!validation.isValid) {
                    console.log('Validation failed for output:', JSON.stringify(analysisOutput, null, 2));
                    console.log('Validation errors:', validation.errors);
                }

                expect(validation.isValid).toBe(true);

                // Verify specific quality requirements
                expect(validation.validations.summary.isValid).toBe(true);
                expect(validation.validations.clauses.isValid).toBe(true);
                expect(validation.validations.risks.isValid).toBe(true);
                expect(validation.validations.recommendations.isValid).toBe(true);
                expect(validation.validations.metadata.isValid).toBe(true);

                // Verify summary quality (Requirement 3.1)
                expect(analysisOutput.summary).toBeDefined();
                expect(typeof analysisOutput.summary).toBe('string');
                expect(analysisOutput.summary.length).toBeGreaterThanOrEqual(50);

                // Verify clause extraction (Requirement 3.2)
                expect(Array.isArray(analysisOutput.clauses)).toBe(true);
                expect(analysisOutput.clauses.length).toBeGreaterThanOrEqual(1);

                analysisOutput.clauses.forEach(clause => {
                    expect(clause.type).toBeDefined();
                    expect(clause.text).toBeDefined();
                    expect(typeof clause.confidence).toBe('number');
                    expect(clause.confidence).toBeGreaterThanOrEqual(0);
                    expect(clause.confidence).toBeLessThanOrEqual(1);
                });

                // Verify risk assessment (Requirements 3.3, 3.4)
                expect(Array.isArray(analysisOutput.risks)).toBe(true);
                expect(analysisOutput.risks.length).toBeGreaterThanOrEqual(1);

                const validRiskLevels = ['Low', 'Medium', 'High', 'Critical'];
                analysisOutput.risks.forEach(risk => {
                    expect(validRiskLevels).toContain(risk.level);
                    expect(risk.description).toBeDefined();
                    expect(typeof risk.description).toBe('string');
                    expect(risk.explanation).toBeDefined();
                    expect(typeof risk.explanation).toBe('string');
                    expect(risk.explanation.length).toBeGreaterThanOrEqual(30);
                });

                // Verify recommendations (Requirement 3.5)
                analysisOutput.risks.forEach(risk => {
                    expect(risk.recommendation).toBeDefined();
                    expect(typeof risk.recommendation).toBe('string');
                    expect(risk.recommendation.length).toBeGreaterThanOrEqual(20);
                });

                // Verify metadata completeness
                expect(analysisOutput.metadata).toBeDefined();
                expect(typeof analysisOutput.metadata.processing_time).toBe('number');
                expect(analysisOutput.metadata.input_type).toBeDefined();
                expect(analysisOutput.metadata.model_used).toBeDefined();

                return true;
            }),
            {
                numRuns: TEST_CONFIG.propertyTestIterations,
                verbose: true
            }
        );
    });

    /**
     * Property: Output Consistency Across Input Types
     * For any set of analysis outputs, they should maintain consistent structure
     * and quality standards regardless of input type
     */
    test('Property: Output Consistency Across Input Types', () => {
        fc.assert(
            fc.property(
                fc.array(analysisOutputGenerator, { minLength: 2, maxLength: 5 }),
                (outputs) => {
                    // Validate consistency across multiple outputs
                    const consistencyValidation = outputValidator.validateConsistency(outputs);

                    if (!consistencyValidation.isValid) {
                        console.log('Consistency validation failed for outputs:', outputs.length);
                        console.log('Consistency errors:', consistencyValidation.errors);
                    }

                    expect(consistencyValidation.isValid).toBe(true);

                    // All outputs should have the same structure
                    const requiredKeys = ['summary', 'clauses', 'risks', 'metadata'];
                    outputs.forEach(output => {
                        requiredKeys.forEach(key => {
                            expect(output).toHaveProperty(key);
                        });
                    });

                    // All outputs should pass individual validation
                    outputs.forEach((output, index) => {
                        const validation = outputValidator.validateAnalysisOutput(output);
                        if (!validation.isValid) {
                            console.log(`Output ${index} failed validation:`, validation.errors);
                        }
                        expect(validation.isValid).toBe(true);
                    });

                    return true;
                }
            ),
            {
                numRuns: TEST_CONFIG.propertyTestIterations / 2, // Fewer runs for multi-output tests
                verbose: true
            }
        );
    });

    /**
     * Property: Summary Quality Standards
     * For any analysis summary, it should meet clarity and accuracy standards
     */
    test('Property: Summary Quality Standards', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 20, maxLength: 200 }).filter(text => text.trim().length > 10).map(text =>
                    `This document contains ${text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()} and provides important legal analysis. The contract includes various clauses that require careful review and consideration by legal professionals.`
                ),
                (summary) => {
                    const validation = outputValidator.validateSummaryQuality(summary);

                    if (!validation.isValid) {
                        console.log('Summary validation failed:', summary);
                        console.log('Summary errors:', validation.errors);
                    }

                    expect(validation.isValid).toBe(true);
                    expect(validation.metrics.length).toBeGreaterThanOrEqual(50);
                    expect(validation.metrics.hasPunctuation).toBe(true);
                    expect(validation.metrics.wordCount).toBeGreaterThanOrEqual(10);

                    return true;
                }
            ),
            {
                numRuns: TEST_CONFIG.propertyTestIterations,
                verbose: true
            }
        );
    });

    /**
     * Property: Risk Assessment Completeness
     * For any risk assessment, it should include proper levels and explanations
     */
    test('Property: Risk Assessment Completeness', () => {
        fc.assert(
            fc.property(
                fc.array(fc.record({
                    level: fc.constantFrom('Low', 'Medium', 'High', 'Critical'),
                    description: fc.string({ minLength: 30, maxLength: 200 }),
                    explanation: fc.string({ minLength: 50, maxLength: 300 }).map(text =>
                        `This risk exists because ${text} and may result in significant issues.`
                    ),
                    recommendation: fc.string({ minLength: 30, maxLength: 200 }).map(text =>
                        `To mitigate this risk, consider ${text} and review the relevant clauses.`
                    )
                }), { minLength: 1, maxLength: 5 }),
                (risks) => {
                    const validation = outputValidator.validateRiskAssessment(risks);

                    if (!validation.isValid) {
                        console.log('Risk validation failed:', risks);
                        console.log('Risk errors:', validation.errors);
                    }

                    expect(validation.isValid).toBe(true);
                    expect(validation.metrics.riskCount).toBeGreaterThanOrEqual(1);

                    // Verify each risk has proper structure
                    risks.forEach(risk => {
                        expect(['Low', 'Medium', 'High', 'Critical']).toContain(risk.level);
                        expect(risk.description.length).toBeGreaterThanOrEqual(20);
                        expect(risk.explanation.length).toBeGreaterThanOrEqual(30);
                    });

                    return true;
                }
            ),
            {
                numRuns: TEST_CONFIG.propertyTestIterations,
                verbose: true
            }
        );
    });
});