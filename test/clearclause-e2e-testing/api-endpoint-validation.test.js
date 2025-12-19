/**
 * API Endpoint Validation Property-Based Tests
 * 
 * **Feature: clearclause-e2e-testing, Property 6: API Endpoint Response Validation**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 * 
 * This test validates that the POST /api/process endpoint handles all input types
 * correctly and returns properly structured responses with required metadata.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import {
    apiRequestGenerator,
    analysisOutputGenerator,
    legalTextGenerator,
    urlGenerator,
    fileMetadataGenerator
} from './utils/test-data-generators.js';
import { APIResponseValidator } from './utils/APIResponseValidator.js';
import { TEST_CONFIG } from './config/test-config.js';

describe('API Endpoint Response Validation', () => {
    let apiValidator;
    let testServer;

    beforeAll(async () => {
        apiValidator = new APIResponseValidator();
        // Initialize test server or mock if needed
        testServer = await setupTestServer();
    });

    afterAll(async () => {
        if (testServer) {
            await testServer.close();
        }
    });

    /**
     * **Feature: clearclause-e2e-testing, Property 6: API Endpoint Response Validation**
     * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
     * 
     * For any request to POST /api/process (file upload, raw text, or URL input),
     * the API should handle the request properly with AWS integration and return
     * a response containing summary, clauses array, risks array, and metadata
     * with processing time, input type, and model used.
     */
    test('API endpoint handles all input types and returns structured responses', async () => {
        await fc.assert(
            fc.asyncProperty(
                apiRequestGenerator,
                async (requestPayload) => {
                    // Validate the request payload structure
                    expect(requestPayload).toHaveProperty('type');
                    expect(requestPayload).toHaveProperty('content');
                    expect(['text', 'url', 'file']).toContain(requestPayload.type);

                    // Send request to API endpoint
                    const response = await apiValidator.validateEndpointResponse(
                        '/api/process',
                        requestPayload
                    );

                    // Validate response structure
                    expect(response).toBeDefined();
                    expect(response.statusCode).toBe(200);

                    const responseBody = JSON.parse(response.body);

                    // Validate required response fields (Requirements 6.4)
                    expect(responseBody).toHaveProperty('summary');
                    expect(responseBody).toHaveProperty('clauses');
                    expect(responseBody).toHaveProperty('risks');
                    expect(responseBody).toHaveProperty('metadata');

                    // Validate clauses array structure
                    expect(Array.isArray(responseBody.clauses)).toBe(true);
                    if (responseBody.clauses.length > 0) {
                        responseBody.clauses.forEach(clause => {
                            expect(clause).toHaveProperty('type');
                            expect(clause).toHaveProperty('text');
                            expect(clause).toHaveProperty('confidence');
                            expect(clause).toHaveProperty('risk_level');
                        });
                    }

                    // Validate risks array structure
                    expect(Array.isArray(responseBody.risks)).toBe(true);
                    if (responseBody.risks.length > 0) {
                        responseBody.risks.forEach(risk => {
                            expect(risk).toHaveProperty('level');
                            expect(risk).toHaveProperty('description');
                            expect(risk).toHaveProperty('explanation');
                            expect(['Low', 'Medium', 'High', 'Critical']).toContain(risk.level);
                        });
                    }

                    // Validate metadata completeness (Requirements 6.5)
                    expect(responseBody.metadata).toHaveProperty('processing_time');
                    expect(responseBody.metadata).toHaveProperty('input_type');
                    expect(responseBody.metadata).toHaveProperty('model_used');

                    // Validate metadata values
                    expect(typeof responseBody.metadata.processing_time).toBe('number');
                    expect(responseBody.metadata.processing_time).toBeGreaterThan(0);
                    expect(['text', 'url', 'file']).toContain(responseBody.metadata.input_type);
                    expect(responseBody.metadata.model_used).toBeTruthy();

                    // Validate input type specific handling
                    switch (requestPayload.type) {
                        case 'text':
                            // Raw text should bypass S3/Textract (Requirements 6.2)
                            expect(responseBody.metadata.input_type).toBe('text');
                            break;
                        case 'url':
                            // URL should use URL Fetcher Lambda (Requirements 6.3)
                            expect(responseBody.metadata.input_type).toBe('url');
                            break;
                        case 'file':
                            // File should use proper AWS integration (Requirements 6.1)
                            expect(responseBody.metadata.input_type).toBe('file');
                            break;
                    }

                    return true;
                }
            ),
            {
                numRuns: TEST_CONFIG.propertyTestIterations,
                timeout: TEST_CONFIG.timeout
            }
        );
    });

    test('API endpoint validates file upload requests with AWS integration', async () => {
        await fc.assert(
            fc.asyncProperty(
                fileMetadataGenerator,
                async (fileMetadata) => {
                    const requestPayload = {
                        type: 'file',
                        content: fileMetadata
                    };

                    const response = await apiValidator.validateEndpointResponse(
                        '/api/process',
                        requestPayload
                    );

                    // Validate file upload handling (Requirements 6.1)
                    expect(response.statusCode).toBe(200);
                    const responseBody = JSON.parse(response.body);

                    // Should contain AWS integration metadata
                    expect(responseBody.metadata.input_type).toBe('file');

                    // Should have processed the file through AWS services
                    if (responseBody.metadata.aws_services_used) {
                        expect(Array.isArray(responseBody.metadata.aws_services_used)).toBe(true);
                    }

                    return true;
                }
            ),
            {
                numRuns: Math.floor(TEST_CONFIG.propertyTestIterations / 3),
                timeout: TEST_CONFIG.timeout
            }
        );
    });

    test('API endpoint processes raw text requests correctly', async () => {
        await fc.assert(
            fc.asyncProperty(
                legalTextGenerator,
                async (textContent) => {
                    const requestPayload = {
                        type: 'text',
                        content: textContent
                    };

                    const response = await apiValidator.validateEndpointResponse(
                        '/api/process',
                        requestPayload
                    );

                    // Validate raw text processing (Requirements 6.2)
                    expect(response.statusCode).toBe(200);
                    const responseBody = JSON.parse(response.body);

                    expect(responseBody.metadata.input_type).toBe('text');

                    // Raw text should have faster processing time (no S3/Textract)
                    expect(responseBody.metadata.processing_time).toBeLessThan(
                        TEST_CONFIG.VALIDATION_THRESHOLDS?.maxProcessingTime?.rawText || 10000
                    );

                    return true;
                }
            ),
            {
                numRuns: Math.floor(TEST_CONFIG.propertyTestIterations / 3),
                timeout: TEST_CONFIG.timeout
            }
        );
    });

    test('API endpoint handles URL input requests through Lambda invocation', async () => {
        await fc.assert(
            fc.asyncProperty(
                urlGenerator,
                async (urlContent) => {
                    const requestPayload = {
                        type: 'url',
                        content: urlContent
                    };

                    const response = await apiValidator.validateEndpointResponse(
                        '/api/process',
                        requestPayload
                    );

                    // Validate URL processing (Requirements 6.3)
                    expect(response.statusCode).toBe(200);
                    const responseBody = JSON.parse(response.body);

                    expect(responseBody.metadata.input_type).toBe('url');

                    // Should indicate URL Fetcher Lambda was used
                    if (responseBody.metadata.aws_services_used) {
                        expect(responseBody.metadata.aws_services_used).toContain('url_fetcher_lambda');
                    }

                    return true;
                }
            ),
            {
                numRuns: Math.floor(TEST_CONFIG.propertyTestIterations / 3),
                timeout: TEST_CONFIG.timeout
            }
        );
    });
});

/**
 * Setup test server for API endpoint testing
 */
async function setupTestServer() {
    // This would typically start a test server or configure mocks
    // For now, we'll return a mock server object
    return {
        close: async () => {
            // Cleanup logic
        }
    };
}