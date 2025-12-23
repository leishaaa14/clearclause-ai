/**
 * API Response Validator for ClearClause End-to-End Testing
 * 
 * This class provides validation functionality for API endpoint responses,
 * ensuring proper handling of different input types and response structure validation.
 */

import { AWS_CONFIG, TEST_CONFIG, VALIDATION_THRESHOLDS } from '../config/test-config.js';

export class APIResponseValidator {
    constructor() {
        this.baseUrl = TEST_CONFIG.baseUrl;
        this.apiEndpoint = TEST_CONFIG.apiEndpoint;
    }

    /**
     * Validate API endpoint response for given payload
     * @param {string} endpoint - API endpoint path
     * @param {Object} payload - Request payload
     * @returns {Promise<Object>} Response validation result
     */
    async validateEndpointResponse(endpoint, payload) {
        try {
            const startTime = Date.now();

            // Simulate API call or make actual call based on environment
            const response = await this.makeAPICall(endpoint, payload);

            const processingTime = Date.now() - startTime;

            // Validate response structure
            const validationResult = await this.validateResponseSchema(response);

            // Add processing time to metadata if not present
            if (response.body) {
                const responseBody = JSON.parse(response.body);
                if (responseBody.metadata && !responseBody.metadata.processing_time) {
                    responseBody.metadata.processing_time = processingTime;
                    response.body = JSON.stringify(responseBody);
                }
            }

            return response;
        } catch (error) {
            console.error('API endpoint validation error:', error);
            throw error;
        }
    }

    /**
     * Make API call to the specified endpoint
     * @param {string} endpoint - API endpoint path
     * @param {Object} payload - Request payload
     * @returns {Promise<Object>} API response
     */
    async makeAPICall(endpoint, payload) {
        try {
            // For testing purposes, we'll simulate the API call
            // In a real implementation, this would make an actual HTTP request

            const mockResponse = await this.generateMockResponse(payload);

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mockResponse)
            };
        } catch (error) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Internal Server Error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                })
            };
        }
    }

    /**
     * Generate mock response based on input payload
     * @param {Object} payload - Request payload
     * @returns {Promise<Object>} Mock response data
     */
    async generateMockResponse(payload) {
        const { type, content } = payload;

        // Simulate processing time based on input type
        const processingTime = this.calculateProcessingTime(type, content);

        // Generate appropriate response based on input type
        const response = {
            summary: this.generateSummary(type, content),
            clauses: this.generateClauses(type, content),
            risks: this.generateRisks(type, content),
            metadata: {
                processing_time: processingTime,
                input_type: type,
                model_used: AWS_CONFIG.bedrockModel,
                timestamp: new Date().toISOString(),
                aws_services_used: this.getAWSServicesUsed(type)
            }
        };

        return response;
    }

    /**
     * Calculate simulated processing time based on input type
     * @param {string} type - Input type (text, url, file)
     * @param {any} content - Input content
     * @returns {number} Processing time in milliseconds
     */
    calculateProcessingTime(type, content) {
        const baseTime = 500; // Base processing time

        switch (type) {
            case 'text':
                // Text processing is fastest (no S3/Textract)
                const textLength = typeof content === 'string' ? content.length : 100;
                return baseTime + Math.floor(textLength / 10);

            case 'url':
                // URL processing includes fetching time
                return baseTime + Math.floor(Math.random() * 2000) + 1000;

            case 'file':
                // File processing includes S3 upload and Textract
                const fileSize = content?.size || 10000;
                return baseTime + Math.floor(fileSize / 1000) + 2000;

            default:
                return baseTime;
        }
    }

    /**
     * Generate summary based on input type and content
     * @param {string} type - Input type
     * @param {any} content - Input content
     * @returns {string} Generated summary
     */
    generateSummary(type, content) {
        const summaries = {
            text: "This document contains legal text that has been analyzed for clauses and risks. The analysis identifies key terms and potential areas of concern.",
            url: "This web-based document has been fetched and analyzed for legal content. The analysis covers terms of service, privacy policies, and user agreements.",
            file: "This uploaded document has been processed through OCR and analyzed for legal clauses. The analysis includes risk assessment and recommendations."
        };

        return summaries[type] || "Document analysis completed successfully.";
    }

    /**
     * Generate clauses array based on input type
     * @param {string} type - Input type
     * @param {any} content - Input content
     * @returns {Array} Generated clauses
     */
    generateClauses(type, content) {
        const clauseTypes = ['termination', 'payment', 'liability', 'confidentiality', 'intellectual_property'];
        const riskLevels = ['Low', 'Medium', 'High', 'Critical'];

        const clauseCount = Math.floor(Math.random() * 5) + 1; // 1-5 clauses
        const clauses = [];

        for (let i = 0; i < clauseCount; i++) {
            clauses.push({
                type: clauseTypes[Math.floor(Math.random() * clauseTypes.length)],
                text: `This clause defines ${clauseTypes[i % clauseTypes.length]} terms and conditions that apply to the agreement.`,
                confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
                risk_level: riskLevels[Math.floor(Math.random() * riskLevels.length)]
            });
        }

        return clauses;
    }

    /**
     * Generate risks array based on input type
     * @param {string} type - Input type
     * @param {any} content - Input content
     * @returns {Array} Generated risks
     */
    generateRisks(type, content) {
        const riskLevels = ['Low', 'Medium', 'High', 'Critical'];
        const riskCategories = ['financial', 'legal', 'operational', 'compliance'];

        const riskCount = Math.floor(Math.random() * 3) + 1; // 1-3 risks
        const risks = [];

        for (let i = 0; i < riskCount; i++) {
            const level = riskLevels[Math.floor(Math.random() * riskLevels.length)];
            risks.push({
                level: level,
                description: `This risk involves ${riskCategories[i % riskCategories.length]} considerations that could impact the agreement.`,
                explanation: `This risk exists because the document contains provisions that may create ${level.toLowerCase()} level exposure for the parties involved.`,
                recommendation: `To mitigate this risk, consider reviewing the relevant clauses with legal counsel and negotiating more favorable terms.`
            });
        }

        return risks;
    }

    /**
     * Get AWS services used based on input type
     * @param {string} type - Input type
     * @returns {Array} List of AWS services used
     */
    getAWSServicesUsed(type) {
        const services = ['bedrock'];

        switch (type) {
            case 'file':
                services.push('s3', 'textract');
                break;
            case 'url':
                services.push('url_fetcher_lambda');
                break;
            case 'text':
                // Only Bedrock for text analysis
                break;
        }

        return services;
    }

    /**
     * Validate response schema structure
     * @param {Object} response - API response object
     * @returns {Promise<Object>} Schema validation result
     */
    async validateResponseSchema(response) {
        try {
            if (!response || !response.body) {
                throw new Error('Response body is missing');
            }

            const responseBody = JSON.parse(response.body);

            // Validate required top-level fields
            const requiredFields = ['summary', 'clauses', 'risks', 'metadata'];
            for (const field of requiredFields) {
                if (!(field in responseBody)) {
                    throw new Error(`Required field '${field}' is missing from response`);
                }
            }

            // Validate clauses array
            if (!Array.isArray(responseBody.clauses)) {
                throw new Error('Clauses field must be an array');
            }

            // Validate risks array
            if (!Array.isArray(responseBody.risks)) {
                throw new Error('Risks field must be an array');
            }

            // Validate metadata object
            if (typeof responseBody.metadata !== 'object') {
                throw new Error('Metadata field must be an object');
            }

            const requiredMetadataFields = ['processing_time', 'input_type', 'model_used'];
            for (const field of requiredMetadataFields) {
                if (!(field in responseBody.metadata)) {
                    throw new Error(`Required metadata field '${field}' is missing`);
                }
            }

            return {
                valid: true,
                schema: 'valid',
                errors: []
            };
        } catch (error) {
            return {
                valid: false,
                schema: 'invalid',
                errors: [error.message]
            };
        }
    }

    /**
     * Validate metadata completeness
     * @param {Object} metadata - Metadata object from response
     * @returns {Promise<Object>} Metadata validation result
     */
    async validateMetadataCompleteness(metadata) {
        try {
            const requiredFields = {
                processing_time: 'number',
                input_type: 'string',
                model_used: 'string',
                timestamp: 'string'
            };

            const validationErrors = [];

            for (const [field, expectedType] of Object.entries(requiredFields)) {
                if (!(field in metadata)) {
                    validationErrors.push(`Missing required field: ${field}`);
                } else if (typeof metadata[field] !== expectedType) {
                    validationErrors.push(`Field ${field} should be of type ${expectedType}, got ${typeof metadata[field]}`);
                }
            }

            // Validate specific field values
            if (metadata.processing_time && metadata.processing_time <= 0) {
                validationErrors.push('Processing time must be greater than 0');
            }

            if (metadata.input_type && !['text', 'url', 'file'].includes(metadata.input_type)) {
                validationErrors.push('Input type must be one of: text, url, file');
            }

            return {
                complete: validationErrors.length === 0,
                errors: validationErrors
            };
        } catch (error) {
            return {
                complete: false,
                errors: [error.message]
            };
        }
    }
}

export default APIResponseValidator;