/**
 * API Integration Validation Tests
 * 
 * Integration tests that validate the complete API endpoint validation system
 * working together with all components and input types.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { APIResponseValidator } from './utils/APIResponseValidator.js';
import { TEST_CONFIG, AWS_CONFIG } from './config/test-config.js';

describe('API Integration Validation', () => {
    let apiValidator;

    beforeAll(async () => {
        apiValidator = new APIResponseValidator();
    });

    afterAll(async () => {
        // Cleanup resources
    });

    test('should validate complete API workflow for all input types', async () => {
        const testCases = [
            {
                name: 'File Upload Integration',
                payload: {
                    type: 'file',
                    content: {
                        name: 'integration-test.pdf',
                        size: 1024000,
                        type: 'application/pdf',
                        lastModified: new Date()
                    }
                },
                expectedServices: ['s3', 'textract', 'bedrock']
            },
            {
                name: 'Raw Text Integration',
                payload: {
                    type: 'text',
                    content: 'This integration test validates the complete API workflow for raw text processing with legal clauses and risk analysis.'
                },
                expectedServices: ['bedrock']
            },
            {
                name: 'URL Integration',
                payload: {
                    type: 'url',
                    content: 'https://example.com/terms-integration-test'
                },
                expectedServices: ['url_fetcher_lambda', 'bedrock']
            }
        ];

        for (const testCase of testCases) {
            console.log(`Testing ${testCase.name}...`);

            const response = await apiValidator.validateEndpointResponse('/api/process', testCase.payload);

            // Validate response structure
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);

            // Validate all required fields are present
            expect(responseBody).toHaveProperty('summary');
            expect(responseBody).toHaveProperty('clauses');
            expect(responseBody).toHaveProperty('risks');
            expect(responseBody).toHaveProperty('metadata');

            // Validate metadata completeness
            expect(responseBody.metadata.input_type).toBe(testCase.payload.type);
            expect(responseBody.metadata.processing_time).toBeGreaterThan(0);
            expect(responseBody.metadata.model_used).toBe(AWS_CONFIG.bedrockModel);

            // Validate AWS services usage
            for (const service of testCase.expectedServices) {
                expect(responseBody.metadata.aws_services_used).toContain(service);
            }

            // Validate schema compliance
            const schemaValidation = await apiValidator.validateResponseSchema(response);
            expect(schemaValidation.valid).toBe(true);

            // Validate metadata completeness
            const metadataValidation = await apiValidator.validateMetadataCompleteness(responseBody.metadata);
            expect(metadataValidation.complete).toBe(true);
        }
    });

    test('should maintain consistent response structure across input types', async () => {
        const responses = [];

        // Collect responses from different input types
        const inputTypes = [
            { type: 'text', content: 'Legal text for consistency testing.' },
            { type: 'url', content: 'https://example.com/consistency-test' },
            { type: 'file', content: { name: 'consistency.pdf', size: 100000, type: 'application/pdf' } }
        ];

        for (const input of inputTypes) {
            const response = await apiValidator.validateEndpointResponse('/api/process', input);
            responses.push(JSON.parse(response.body));
        }

        // Validate consistent structure across all responses
        for (const response of responses) {
            expect(response).toHaveProperty('summary');
            expect(response).toHaveProperty('clauses');
            expect(response).toHaveProperty('risks');
            expect(response).toHaveProperty('metadata');

            expect(Array.isArray(response.clauses)).toBe(true);
            expect(Array.isArray(response.risks)).toBe(true);
            expect(typeof response.metadata).toBe('object');
        }

        // Validate that all responses have the same top-level structure
        const firstResponseKeys = Object.keys(responses[0]).sort();
        for (let i = 1; i < responses.length; i++) {
            const currentResponseKeys = Object.keys(responses[i]).sort();
            expect(currentResponseKeys).toEqual(firstResponseKeys);
        }
    });

    test('should validate processing time thresholds for different input types', async () => {
        const testCases = [
            {
                type: 'text',
                content: 'Short text for processing time validation.',
                maxTime: 2000 // Text should be fastest
            },
            {
                type: 'url',
                content: 'https://example.com/processing-time-test',
                maxTime: 5000 // URL includes fetching overhead
            },
            {
                type: 'file',
                content: { name: 'processing-test.pdf', size: 2000000, type: 'application/pdf' },
                maxTime: 10000 // File includes S3 upload and Textract
            }
        ];

        for (const testCase of testCases) {
            const response = await apiValidator.validateEndpointResponse('/api/process', testCase);
            const responseBody = JSON.parse(response.body);

            expect(responseBody.metadata.processing_time).toBeLessThan(testCase.maxTime);
            expect(responseBody.metadata.input_type).toBe(testCase.type);
        }
    });

    test('should validate error handling and fallback mechanisms', async () => {
        // Test with edge case inputs that might trigger fallbacks
        const edgeCases = [
            {
                type: 'text',
                content: '' // Empty text
            },
            {
                type: 'file',
                content: {
                    name: 'huge-file.pdf',
                    size: 100000000, // Very large file
                    type: 'application/pdf'
                }
            },
            {
                type: 'url',
                content: 'invalid-url-format'
            }
        ];

        for (const edgeCase of edgeCases) {
            const response = await apiValidator.validateEndpointResponse('/api/process', edgeCase);

            // Should handle gracefully without throwing errors
            expect(response).toHaveProperty('statusCode');
            expect(response).toHaveProperty('body');

            // Should maintain response structure even for edge cases
            if (response.statusCode === 200) {
                const responseBody = JSON.parse(response.body);
                expect(responseBody).toHaveProperty('metadata');
            }
        }
    });

    test('should validate security and credential isolation', async () => {
        const testPayload = {
            type: 'text',
            content: 'Security validation test content.'
        };

        const response = await apiValidator.validateEndpointResponse('/api/process', testPayload);
        const responseBody = JSON.parse(response.body);

        // Ensure no AWS credentials are exposed in response
        const responseString = JSON.stringify(responseBody);

        // Check for common AWS credential patterns
        expect(responseString).not.toMatch(/AKIA[0-9A-Z]{16}/); // AWS Access Key ID
        expect(responseString).not.toMatch(/[A-Za-z0-9/+=]{40}/); // AWS Secret Access Key

        // Ensure model information is present but not sensitive details
        expect(responseBody.metadata.model_used).toBeTruthy();
        expect(responseBody.metadata.model_used).not.toContain('secret');
        expect(responseBody.metadata.model_used).not.toContain('key');
    });
});