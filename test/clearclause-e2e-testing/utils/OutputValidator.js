/**
 * OutputValidator - Validates analysis output quality and consistency
 * 
 * This class provides comprehensive validation for ClearClause analysis outputs,
 * ensuring summaries, clause extraction, risk assessments, and recommendations
 * meet quality standards across all input types.
 */

import { VALIDATION_THRESHOLDS } from '../config/test-config.js';

export class OutputValidator {
    constructor(thresholds = VALIDATION_THRESHOLDS) {
        this.thresholds = thresholds;
    }

    /**
     * Validate complete analysis output structure and quality
     * @param {Object} output - The analysis output to validate
     * @returns {Object} Validation result with detailed feedback
     */
    validateAnalysisOutput(output) {
        const validations = {
            summary: this.validateSummaryQuality(output.summary),
            clauses: this.validateClauseExtraction(output.clauses),
            risks: this.validateRiskAssessment(output.risks),
            recommendations: this.validateRecommendations(output.risks),
            metadata: this.validateMetadata(output.metadata)
        };

        const allPassed = Object.values(validations).every(v => v.isValid);

        return {
            isValid: allPassed,
            validations,
            errors: this._collectErrors(validations)
        };
    }

    /**
     * Validate summary quality with clarity and accuracy checks
     * Requirements: 3.1
     */
    validateSummaryQuality(summary) {
        const errors = [];

        // Check summary exists
        if (!summary || typeof summary !== 'string') {
            errors.push('Summary is missing or not a string');
            return { isValid: false, errors };
        }

        // Check minimum length for meaningful content
        if (summary.length < this.thresholds.minimumSummaryLength) {
            errors.push(`Summary too short (${summary.length} chars, minimum ${this.thresholds.minimumSummaryLength})`);
        }

        // Check for clarity indicators (complete sentences, proper punctuation)
        const hasPunctuation = /[.!?]/.test(summary);
        if (!hasPunctuation) {
            errors.push('Summary lacks proper punctuation');
        }

        // Check for plain language (not just technical jargon)
        const wordCount = summary.split(/\s+/).length;
        if (wordCount < 10) {
            errors.push('Summary too brief to be meaningful');
        }

        // Check for explanatory content (should contain explanatory words)
        const explanatoryWords = ['this', 'that', 'which', 'contains', 'includes', 'provides', 'describes'];
        const hasExplanatoryContent = explanatoryWords.some(word =>
            summary.toLowerCase().includes(word)
        );

        return {
            isValid: errors.length === 0,
            errors,
            metrics: {
                length: summary.length,
                wordCount,
                hasPunctuation,
                hasExplanatoryContent
            }
        };
    }

    /**
     * Validate clause extraction with type classification and confidence scores
     * Requirements: 3.2
     */
    validateClauseExtraction(clauses) {
        const errors = [];

        // Check clauses array exists
        if (!Array.isArray(clauses)) {
            errors.push('Clauses is not an array');
            return { isValid: false, errors };
        }

        // Check minimum clause count
        if (clauses.length < this.thresholds.minimumClauseCount) {
            errors.push(`Insufficient clauses extracted (${clauses.length}, minimum ${this.thresholds.minimumClauseCount})`);
        }

        // Validate each clause
        const validClauseTypes = [
            'termination', 'payment', 'liability', 'confidentiality',
            'intellectual_property', 'warranty', 'indemnification',
            'dispute_resolution', 'governing_law', 'assignment', 'other'
        ];

        clauses.forEach((clause, index) => {
            // Check required fields
            if (!clause.type) {
                errors.push(`Clause ${index} missing type classification`);
            } else if (!validClauseTypes.includes(clause.type)) {
                errors.push(`Clause ${index} has invalid type: ${clause.type}`);
            }

            if (!clause.text || typeof clause.text !== 'string') {
                errors.push(`Clause ${index} missing or invalid text`);
            }

            // Check confidence score
            if (typeof clause.confidence !== 'number') {
                errors.push(`Clause ${index} missing confidence score`);
            } else if (clause.confidence < 0 || clause.confidence > 1) {
                errors.push(`Clause ${index} has invalid confidence score: ${clause.confidence}`);
            } else if (clause.confidence < this.thresholds.minimumClauseConfidence) {
                errors.push(`Clause ${index} has low confidence: ${clause.confidence}`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            metrics: {
                clauseCount: clauses.length,
                averageConfidence: clauses.length > 0
                    ? clauses.reduce((sum, c) => sum + (c.confidence || 0), 0) / clauses.length
                    : 0,
                typesFound: [...new Set(clauses.map(c => c.type).filter(Boolean))]
            }
        };
    }

    /**
     * Validate risk assessment with proper risk levels and explanations
     * Requirements: 3.3, 3.4
     */
    validateRiskAssessment(risks) {
        const errors = [];

        // Check risks array exists
        if (!Array.isArray(risks)) {
            errors.push('Risks is not an array');
            return { isValid: false, errors };
        }

        // Check minimum risk count
        if (risks.length < this.thresholds.minimumRiskCount) {
            errors.push(`Insufficient risks identified (${risks.length}, minimum ${this.thresholds.minimumRiskCount})`);
        }

        // Valid risk levels
        const validRiskLevels = ['Low', 'Medium', 'High', 'Critical'];

        risks.forEach((risk, index) => {
            // Check risk level
            if (!risk.level) {
                errors.push(`Risk ${index} missing level`);
            } else if (!validRiskLevels.includes(risk.level)) {
                errors.push(`Risk ${index} has invalid level: ${risk.level}`);
            }

            // Check description
            if (!risk.description || typeof risk.description !== 'string') {
                errors.push(`Risk ${index} missing or invalid description`);
            } else if (risk.description.length < 20) {
                errors.push(`Risk ${index} description too brief`);
            }

            // Check explanation (specific reasoning)
            if (!risk.explanation || typeof risk.explanation !== 'string') {
                errors.push(`Risk ${index} missing or invalid explanation`);
            } else if (risk.explanation.length < 30) {
                errors.push(`Risk ${index} explanation too brief`);
            }

            // Check that explanation provides specific reasoning
            const hasReasoningWords = ['because', 'due to', 'since', 'as', 'therefore', 'thus', 'may', 'could', 'might'];
            const hasReasoning = hasReasoningWords.some(word =>
                risk.explanation?.toLowerCase().includes(word)
            );
            if (!hasReasoning) {
                errors.push(`Risk ${index} explanation lacks specific reasoning`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            metrics: {
                riskCount: risks.length,
                riskLevels: risks.map(r => r.level).filter(Boolean),
                averageExplanationLength: risks.length > 0
                    ? risks.reduce((sum, r) => sum + (r.explanation?.length || 0), 0) / risks.length
                    : 0
            }
        };
    }

    /**
     * Validate recommendations are actionable and relevant
     * Requirements: 3.5
     */
    validateRecommendations(risks) {
        const errors = [];

        if (!Array.isArray(risks)) {
            errors.push('Risks array not provided for recommendation validation');
            return { isValid: false, errors };
        }

        risks.forEach((risk, index) => {
            // Check recommendation exists
            if (!risk.recommendation || typeof risk.recommendation !== 'string') {
                errors.push(`Risk ${index} missing or invalid recommendation`);
                return;
            }

            // Check recommendation is actionable (contains action verbs)
            const actionVerbs = [
                'review', 'consult', 'negotiate', 'clarify', 'modify',
                'add', 'remove', 'ensure', 'verify', 'consider',
                'seek', 'obtain', 'implement', 'establish', 'define'
            ];
            const isActionable = actionVerbs.some(verb =>
                risk.recommendation.toLowerCase().includes(verb)
            );
            if (!isActionable) {
                errors.push(`Risk ${index} recommendation lacks actionable guidance`);
            }

            // Check recommendation is relevant to the risk
            if (risk.recommendation.length < 20) {
                errors.push(`Risk ${index} recommendation too brief to be actionable`);
            }

            // Check recommendation provides mitigation strategy
            const mitigationWords = ['mitigate', 'reduce', 'minimize', 'address', 'resolve', 'prevent'];
            const hasMitigation = mitigationWords.some(word =>
                risk.recommendation.toLowerCase().includes(word)
            );
            // Note: Not all recommendations need explicit mitigation words, so this is informational
        });

        return {
            isValid: errors.length === 0,
            errors,
            metrics: {
                recommendationCount: risks.filter(r => r.recommendation).length,
                averageRecommendationLength: risks.length > 0
                    ? risks.reduce((sum, r) => sum + (r.recommendation?.length || 0), 0) / risks.length
                    : 0
            }
        };
    }

    /**
     * Validate metadata completeness
     */
    validateMetadata(metadata) {
        const errors = [];

        if (!metadata || typeof metadata !== 'object') {
            errors.push('Metadata is missing or not an object');
            return { isValid: false, errors };
        }

        // Check required metadata fields
        const requiredFields = ['processing_time', 'input_type', 'model_used'];
        requiredFields.forEach(field => {
            if (!(field in metadata)) {
                errors.push(`Metadata missing required field: ${field}`);
            }
        });

        // Validate processing_time
        if (typeof metadata.processing_time !== 'number' || metadata.processing_time < 0) {
            errors.push('Invalid processing_time in metadata');
        }

        // Validate input_type
        const validInputTypes = ['text', 'url', 'file', 'pdf', 'image', 'excel'];
        if (metadata.input_type && !validInputTypes.includes(metadata.input_type)) {
            errors.push(`Invalid input_type in metadata: ${metadata.input_type}`);
        }

        // Validate model_used
        if (metadata.model_used && typeof metadata.model_used !== 'string') {
            errors.push('Invalid model_used in metadata');
        }

        return {
            isValid: errors.length === 0,
            errors,
            metrics: {
                hasAllRequiredFields: requiredFields.every(field => field in metadata)
            }
        };
    }

    /**
     * Check consistency across different input types
     */
    validateConsistency(outputs) {
        const errors = [];

        if (!Array.isArray(outputs) || outputs.length < 2) {
            errors.push('Need at least 2 outputs to validate consistency');
            return { isValid: false, errors };
        }

        // Check all outputs have the same structure
        const firstOutput = outputs[0];
        const requiredKeys = ['summary', 'clauses', 'risks', 'metadata'];

        outputs.forEach((output, index) => {
            requiredKeys.forEach(key => {
                if (!(key in output)) {
                    errors.push(`Output ${index} missing required key: ${key}`);
                }
            });

            // Check type consistency
            if (typeof output.summary !== typeof firstOutput.summary) {
                errors.push(`Output ${index} has inconsistent summary type`);
            }
            if (Array.isArray(output.clauses) !== Array.isArray(firstOutput.clauses)) {
                errors.push(`Output ${index} has inconsistent clauses type`);
            }
            if (Array.isArray(output.risks) !== Array.isArray(firstOutput.risks)) {
                errors.push(`Output ${index} has inconsistent risks type`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            metrics: {
                outputCount: outputs.length,
                structureConsistent: errors.length === 0
            }
        };
    }

    /**
     * Collect all errors from validation results
     */
    _collectErrors(validations) {
        const allErrors = [];
        Object.entries(validations).forEach(([key, validation]) => {
            if (validation.errors && validation.errors.length > 0) {
                allErrors.push({
                    component: key,
                    errors: validation.errors
                });
            }
        });
        return allErrors;
    }
}

export default OutputValidator;
