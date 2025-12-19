/**
 * Output Validation Unit Tests
 * 
 * Unit tests for individual output validation components including
 * summary quality, clause extraction, risk assessment, and recommendation validation.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { OutputValidator } from './utils/OutputValidator.js';
import { VALIDATION_THRESHOLDS } from './config/test-config.js';

describe('Output Validation Unit Tests', () => {
    let outputValidator;

    beforeEach(() => {
        outputValidator = new OutputValidator(VALIDATION_THRESHOLDS);
    });

    describe('Summary Quality Validation', () => {
        test('should validate a good quality summary', () => {
            const goodSummary = 'This document contains important legal provisions that establish the terms and conditions for the agreement between the parties. The contract includes various clauses that require careful review.';

            const result = outputValidator.validateSummaryQuality(goodSummary);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metrics.length).toBeGreaterThanOrEqual(50);
            expect(result.metrics.hasPunctuation).toBe(true);
            expect(result.metrics.wordCount).toBeGreaterThanOrEqual(10);
        });

        test('should reject summary that is too short', () => {
            const shortSummary = 'Short summary.';

            const result = outputValidator.validateSummaryQuality(shortSummary);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Summary too short (14 chars, minimum 50)');
        });

        test('should reject summary without punctuation', () => {
            const noPunctuationSummary = 'This is a very long summary without any punctuation marks at all which makes it hard to read and understand properly';

            const result = outputValidator.validateSummaryQuality(noPunctuationSummary);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Summary lacks proper punctuation');
        });

        test('should reject summary that is too brief to be meaningful', () => {
            const briefSummary = 'Contract terms.';

            const result = outputValidator.validateSummaryQuality(briefSummary);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Summary too brief to be meaningful');
        });

        test('should handle null or undefined summary', () => {
            const result1 = outputValidator.validateSummaryQuality(null);
            const result2 = outputValidator.validateSummaryQuality(undefined);

            expect(result1.isValid).toBe(false);
            expect(result1.errors).toContain('Summary is missing or not a string');
            expect(result2.isValid).toBe(false);
            expect(result2.errors).toContain('Summary is missing or not a string');
        });
    });

    describe('Clause Extraction Validation', () => {
        test('should validate well-formed clauses', () => {
            const goodClauses = [
                {
                    type: 'termination',
                    text: 'This clause allows either party to terminate the agreement with 30 days notice.',
                    confidence: 0.85
                },
                {
                    type: 'payment',
                    text: 'Payment terms require settlement within 30 days of invoice date.',
                    confidence: 0.92
                }
            ];

            const result = outputValidator.validateClauseExtraction(goodClauses);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metrics.clauseCount).toBe(2);
            expect(result.metrics.averageConfidence).toBeGreaterThan(0.8);
            expect(result.metrics.typesFound).toContain('termination');
            expect(result.metrics.typesFound).toContain('payment');
        });

        test('should reject clauses with invalid types', () => {
            const invalidClauses = [
                {
                    type: 'invalid_type',
                    text: 'Some clause text',
                    confidence: 0.8
                }
            ];

            const result = outputValidator.validateClauseExtraction(invalidClauses);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Clause 0 has invalid type: invalid_type');
        });

        test('should reject clauses with missing required fields', () => {
            const incompleteClauses = [
                {
                    // missing type
                    text: 'Some clause text',
                    confidence: 0.8
                },
                {
                    type: 'payment',
                    // missing text
                    confidence: 0.8
                },
                {
                    type: 'liability',
                    text: 'Some clause text'
                    // missing confidence
                }
            ];

            const result = outputValidator.validateClauseExtraction(incompleteClauses);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Clause 0 missing type classification');
            expect(result.errors).toContain('Clause 1 missing or invalid text');
            expect(result.errors).toContain('Clause 2 missing confidence score');
        });

        test('should reject clauses with invalid confidence scores', () => {
            const invalidConfidenceClauses = [
                {
                    type: 'termination',
                    text: 'Some clause text',
                    confidence: 1.5 // > 1
                },
                {
                    type: 'payment',
                    text: 'Some clause text',
                    confidence: -0.1 // < 0
                },
                {
                    type: 'liability',
                    text: 'Some clause text',
                    confidence: 0.3 // < minimum threshold
                }
            ];

            const result = outputValidator.validateClauseExtraction(invalidConfidenceClauses);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Clause 0 has invalid confidence score: 1.5');
            expect(result.errors).toContain('Clause 1 has invalid confidence score: -0.1');
            expect(result.errors).toContain('Clause 2 has low confidence: 0.3');
        });

        test('should handle non-array input', () => {
            const result = outputValidator.validateClauseExtraction('not an array');

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Clauses is not an array');
        });
    });

    describe('Risk Assessment Validation', () => {
        test('should validate well-formed risks', () => {
            const goodRisks = [
                {
                    level: 'High',
                    description: 'This clause creates significant liability exposure for the company.',
                    explanation: 'This risk exists because the indemnification clause is overly broad and may result in unlimited liability.',
                    recommendation: 'Consider negotiating a cap on liability and excluding certain types of damages.'
                },
                {
                    level: 'Medium',
                    description: 'Payment terms may create cash flow issues.',
                    explanation: 'This risk arises due to extended payment periods that could impact working capital.',
                    recommendation: 'Negotiate shorter payment terms or request progress payments.'
                }
            ];

            const result = outputValidator.validateRiskAssessment(goodRisks);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metrics.riskCount).toBe(2);
            expect(result.metrics.riskLevels).toContain('High');
            expect(result.metrics.riskLevels).toContain('Medium');
        });

        test('should reject risks with invalid levels', () => {
            const invalidRisks = [
                {
                    level: 'Extreme', // invalid level
                    description: 'Some risk description',
                    explanation: 'Some explanation',
                    recommendation: 'Some recommendation'
                }
            ];

            const result = outputValidator.validateRiskAssessment(invalidRisks);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Risk 0 has invalid level: Extreme');
        });

        test('should reject risks with missing or inadequate descriptions', () => {
            const inadequateRisks = [
                {
                    level: 'High',
                    // missing description
                    explanation: 'Some explanation',
                    recommendation: 'Some recommendation'
                },
                {
                    level: 'Medium',
                    description: 'Too short', // too brief
                    explanation: 'Some explanation',
                    recommendation: 'Some recommendation'
                }
            ];

            const result = outputValidator.validateRiskAssessment(inadequateRisks);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Risk 0 missing or invalid description');
            expect(result.errors).toContain('Risk 1 description too brief');
        });

        test('should reject risks with inadequate explanations', () => {
            const inadequateRisks = [
                {
                    level: 'High',
                    description: 'This is a significant risk that needs attention.',
                    explanation: 'Short', // too brief
                    recommendation: 'Some recommendation'
                }
            ];

            const result = outputValidator.validateRiskAssessment(inadequateRisks);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Risk 0 explanation too brief');
        });

        test('should handle non-array input', () => {
            const result = outputValidator.validateRiskAssessment('not an array');

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Risks is not an array');
        });
    });

    describe('Recommendation Validation', () => {
        test('should validate actionable recommendations', () => {
            const goodRisks = [
                {
                    level: 'High',
                    description: 'Liability exposure',
                    explanation: 'This risk exists because of broad indemnification clauses',
                    recommendation: 'Review and negotiate liability caps to mitigate exposure'
                },
                {
                    level: 'Medium',
                    description: 'Payment terms',
                    explanation: 'Extended payment periods may impact cash flow',
                    recommendation: 'Consider requesting shorter payment terms or progress payments'
                }
            ];

            const result = outputValidator.validateRecommendations(goodRisks);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metrics.recommendationCount).toBe(2);
        });

        test('should reject non-actionable recommendations', () => {
            const poorRisks = [
                {
                    level: 'High',
                    description: 'Some risk',
                    explanation: 'Some explanation',
                    recommendation: 'This is bad' // not actionable
                }
            ];

            const result = outputValidator.validateRecommendations(poorRisks);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Risk 0 recommendation lacks actionable guidance');
        });

        test('should reject recommendations that are too brief', () => {
            const briefRisks = [
                {
                    level: 'High',
                    description: 'Some risk',
                    explanation: 'Some explanation',
                    recommendation: 'Fix it' // too brief
                }
            ];

            const result = outputValidator.validateRecommendations(briefRisks);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Risk 0 recommendation too brief to be actionable');
        });

        test('should handle missing recommendations', () => {
            const missingRecs = [
                {
                    level: 'High',
                    description: 'Some risk',
                    explanation: 'Some explanation'
                    // missing recommendation
                }
            ];

            const result = outputValidator.validateRecommendations(missingRecs);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Risk 0 missing or invalid recommendation');
        });
    });

    describe('Metadata Validation', () => {
        test('should validate complete metadata', () => {
            const goodMetadata = {
                processing_time: 5000,
                input_type: 'text',
                model_used: 'anthropic.claude-3-sonnet-20240229-v1:0',
                timestamp: new Date()
            };

            const result = outputValidator.validateMetadata(goodMetadata);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metrics.hasAllRequiredFields).toBe(true);
        });

        test('should reject metadata with missing required fields', () => {
            const incompleteMetadata = {
                processing_time: 5000
                // missing input_type and model_used
            };

            const result = outputValidator.validateMetadata(incompleteMetadata);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Metadata missing required field: input_type');
            expect(result.errors).toContain('Metadata missing required field: model_used');
        });

        test('should reject invalid processing_time', () => {
            const invalidMetadata = {
                processing_time: -100, // negative
                input_type: 'text',
                model_used: 'anthropic.claude-3-sonnet-20240229-v1:0'
            };

            const result = outputValidator.validateMetadata(invalidMetadata);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid processing_time in metadata');
        });

        test('should reject invalid input_type', () => {
            const invalidMetadata = {
                processing_time: 5000,
                input_type: 'invalid_type',
                model_used: 'anthropic.claude-3-sonnet-20240229-v1:0'
            };

            const result = outputValidator.validateMetadata(invalidMetadata);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid input_type in metadata: invalid_type');
        });

        test('should handle null or non-object metadata', () => {
            const result1 = outputValidator.validateMetadata(null);
            const result2 = outputValidator.validateMetadata('not an object');

            expect(result1.isValid).toBe(false);
            expect(result1.errors).toContain('Metadata is missing or not an object');
            expect(result2.isValid).toBe(false);
            expect(result2.errors).toContain('Metadata is missing or not an object');
        });
    });

    describe('Consistency Validation', () => {
        test('should validate consistent outputs', () => {
            const consistentOutputs = [
                {
                    summary: 'First summary',
                    clauses: [],
                    risks: [],
                    metadata: {}
                },
                {
                    summary: 'Second summary',
                    clauses: [],
                    risks: [],
                    metadata: {}
                }
            ];

            const result = outputValidator.validateConsistency(consistentOutputs);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.metrics.structureConsistent).toBe(true);
        });

        test('should reject inconsistent structure', () => {
            const inconsistentOutputs = [
                {
                    summary: 'First summary',
                    clauses: [],
                    risks: [],
                    metadata: {}
                },
                {
                    summary: 'Second summary',
                    clauses: 'not an array', // inconsistent type
                    risks: [],
                    metadata: {}
                }
            ];

            const result = outputValidator.validateConsistency(inconsistentOutputs);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Output 1 has inconsistent clauses type');
        });

        test('should handle insufficient outputs for comparison', () => {
            const result = outputValidator.validateConsistency([]);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Need at least 2 outputs to validate consistency');
        });
    });

    describe('Complete Analysis Output Validation', () => {
        test('should validate complete valid analysis output', () => {
            const completeOutput = {
                summary: 'This document contains important legal provisions that establish comprehensive terms and conditions for the business agreement between the contracting parties.',
                clauses: [
                    {
                        type: 'termination',
                        text: 'Either party may terminate this agreement with thirty days written notice.',
                        confidence: 0.9
                    }
                ],
                risks: [
                    {
                        level: 'Medium',
                        description: 'Termination clause allows for relatively short notice period.',
                        explanation: 'This risk exists because thirty days may not provide sufficient time to transition services.',
                        recommendation: 'Consider negotiating a longer notice period for critical services.'
                    }
                ],
                metadata: {
                    processing_time: 5000,
                    input_type: 'text',
                    model_used: 'anthropic.claude-3-sonnet-20240229-v1:0'
                }
            };

            const result = outputValidator.validateAnalysisOutput(completeOutput);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.validations.summary.isValid).toBe(true);
            expect(result.validations.clauses.isValid).toBe(true);
            expect(result.validations.risks.isValid).toBe(true);
            expect(result.validations.recommendations.isValid).toBe(true);
            expect(result.validations.metadata.isValid).toBe(true);
        });

        test('should collect errors from all validation components', () => {
            const invalidOutput = {
                summary: 'Too short', // invalid
                clauses: 'not an array', // invalid
                risks: [], // insufficient
                metadata: null // invalid
            };

            const result = outputValidator.validateAnalysisOutput(invalidOutput);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.component === 'summary')).toBe(true);
            expect(result.errors.some(e => e.component === 'clauses')).toBe(true);
            expect(result.errors.some(e => e.component === 'risks')).toBe(true);
            expect(result.errors.some(e => e.component === 'metadata')).toBe(true);
        });
    });
});