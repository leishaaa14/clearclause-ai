/**
 * API Endpoint Unit Tests
 * 
 * Unit tests for API endpoint functionality covering file upload handling,
 * raw text processing, URL input handling, and response schema validation.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { APIResponseValidator } from './utils/APIResponseValidator.js';
import { TEST_CONFIG, AWS_CONFIG } from './config/test-config.js';

describe('API Endpoint Unit Tests', () => {
    let apiValidator;

    beforeEach(() => {
        apiValidator = new APIResponseValidator();
        // Reset any mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Cleanup after each test
        vi.restoreAllMocks();
    });

    describe('File Upload API Handling', () => {
        test('should handle PDF file upload requests', async () => {
            // Requirements 6.1: File upload request validation with proper AWS integration
            const filePayload = {
                type: 'file',
                content: {
                    name: 'contract.pdf',
                    size: 1024000,
                    type: 'application/pdf',
                    lastModified: new Date()
                }
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', filePayload);

            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);

            // Validate file-specific processing
            expect(responseBody.metadata.input_type).toBe('file');
            expect(responseBody.metadata.aws_services_used).toContain('s3');
            expect(responseBody.metadata.aws_services_used).toContain('textract');
            expect(responseBody.metadata.aws_services_used).toContain('bedrock');
        });

        test('should handle image file upload requests', async () => {
            const filePayload = {
                type: 'file',
                content: {
                    name: 'document.png',
                    size: 512000,
                    type: 'image/png',
                    lastModified: new Date()
                }
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', filePayload);

            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);

            expect(responseBody.metadata.input_type).toBe('file');
            expect(responseBody.summary).toContain('uploaded document');
        });

        test('should handle Excel file upload requests', async () => {
            const filePayload = {
                type: 'file',
                content: {
                    name: 'clauses.xlsx',
                    size: 256000,
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    lastModified: new Date()
                }
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', filePayload);

            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);

            expect(responseBody.metadata.input_type).toBe('file');
            expect(responseBody.clauses).toBeDefined();
            expect(Array.isArray(responseBody.clauses)).toBe(true);
        });

        test('should include proper processing time for file uploads', async () => {
            const filePayload = {
                type: 'file',
                content: {
                    name: 'large-contract.pdf',
                    size: 5000000, // 5MB file
                    type: 'application/pdf',
                    lastModified: new Date()
                }
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', filePayload);
            const responseBody = JSON.parse(response.body);

            // File processing should take longer due to S3 upload and Textract
            expect(responseBody.metadata.processing_time).toBeGreaterThan(2000);
        });
    });

    describe('Raw Text API Processing', () => {
        test('should process short legal text correctly', async () => {
            // Requirements 6.2: Raw text request processing validation
            const textPayload = {
                type: 'text',
                content: 'This agreement shall be governed by the laws of the State of California. Either party may terminate this agreement with 30 days written notice.'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', textPayload);

            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);

            expect(responseBody.metadata.input_type).toBe('text');
            expect(responseBody.metadata.aws_services_used).toContain('bedrock');
            expect(responseBody.metadata.aws_services_used).not.toContain('s3');
            expect(responseBody.metadata.aws_services_used).not.toContain('textract');
        });

        test('should process long legal text without truncation', async () => {
            const longText = 'This is a comprehensive legal agreement. '.repeat(100); // ~4000 characters
            const textPayload = {
                type: 'text',
                content: longText
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', textPayload);
            const responseBody = JSON.parse(response.body);

            expect(responseBody.summary).toBeDefined();
            expect(responseBody.clauses.length).toBeGreaterThan(0);
            expect(responseBody.risks.length).toBeGreaterThan(0);
        });

        test('should have faster processing time for raw text', async () => {
            const textPayload = {
                type: 'text',
                content: 'Simple contract terms and conditions for testing purposes.'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', textPayload);
            const responseBody = JSON.parse(response.body);

            // Raw text should process faster (no S3/Textract overhead)
            expect(responseBody.metadata.processing_time).toBeLessThan(2000);
        });

        test('should extract clauses from raw legal text', async () => {
            const legalText = `
                TERMINATION: Either party may terminate this agreement upon 30 days written notice.
                LIABILITY: The company's liability shall not exceed the total amount paid under this agreement.
                CONFIDENTIALITY: Both parties agree to maintain confidentiality of proprietary information.
            `;

            const textPayload = {
                type: 'text',
                content: legalText
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', textPayload);
            const responseBody = JSON.parse(response.body);

            expect(responseBody.clauses.length).toBeGreaterThan(0);

            // Check that clauses have valid structure and types
            responseBody.clauses.forEach(clause => {
                expect(clause).toHaveProperty('type');
                expect(clause).toHaveProperty('text');
                expect(clause).toHaveProperty('confidence');
                expect(clause).toHaveProperty('risk_level');

                // Validate clause type is one of the expected types
                const validTypes = ['termination', 'payment', 'liability', 'confidentiality', 'intellectual_property'];
                expect(validTypes).toContain(clause.type);
            });
        });
    });

    describe('URL Input API Handling', () => {
        test('should handle URL input requests', async () => {
            // Requirements 6.3: URL input request handling validation
            const urlPayload = {
                type: 'url',
                content: 'https://example.com/terms-of-service'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', urlPayload);

            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);

            expect(responseBody.metadata.input_type).toBe('url');
            expect(responseBody.metadata.aws_services_used).toContain('url_fetcher_lambda');
            expect(responseBody.metadata.aws_services_used).toContain('bedrock');
        });

        test('should handle privacy policy URLs', async () => {
            const urlPayload = {
                type: 'url',
                content: 'https://example.com/privacy-policy'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', urlPayload);
            const responseBody = JSON.parse(response.body);

            expect(responseBody.summary).toContain('web-based document');
            expect(responseBody.metadata.input_type).toBe('url');
        });

        test('should handle user agreement URLs', async () => {
            const urlPayload = {
                type: 'url',
                content: 'https://example.com/user-agreement'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', urlPayload);
            const responseBody = JSON.parse(response.body);

            expect(responseBody.clauses).toBeDefined();
            expect(responseBody.risks).toBeDefined();
            expect(responseBody.metadata.input_type).toBe('url');
        });

        test('should include URL fetching time in processing metrics', async () => {
            const urlPayload = {
                type: 'url',
                content: 'https://example.com/complex-terms'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', urlPayload);
            const responseBody = JSON.parse(response.body);

            // URL processing should include fetching overhead
            expect(responseBody.metadata.processing_time).toBeGreaterThan(1000);
        });
    });

    describe('API Response Schema Validation', () => {
        test('should validate complete response schema', async () => {
            // Requirements 6.4: API response schema validation
            const testPayload = {
                type: 'text',
                content: 'Test legal document content for schema validation.'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', testPayload);
            const schemaValidation = await apiValidator.validateResponseSchema(response);

            expect(schemaValidation.valid).toBe(true);
            expect(schemaValidation.errors).toHaveLength(0);
        });

        test('should validate summary field presence and type', async () => {
            const testPayload = {
                type: 'text',
                content: 'Legal content for summary validation.'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', testPayload);
            const responseBody = JSON.parse(response.body);

            expect(responseBody).toHaveProperty('summary');
            expect(typeof responseBody.summary).toBe('string');
            expect(responseBody.summary.length).toBeGreaterThan(0);
        });

        test('should validate clauses array structure', async () => {
            const testPayload = {
                type: 'text',
                content: 'Contract with various clauses for validation testing.'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', testPayload);
            const responseBody = JSON.parse(response.body);

            expect(responseBody).toHaveProperty('clauses');
            expect(Array.isArray(responseBody.clauses)).toBe(true);

            if (responseBody.clauses.length > 0) {
                const clause = responseBody.clauses[0];
                expect(clause).toHaveProperty('type');
                expect(clause).toHaveProperty('text');
                expect(clause).toHaveProperty('confidence');
                expect(clause).toHaveProperty('risk_level');

                expect(typeof clause.confidence).toBe('number');
                expect(clause.confidence).toBeGreaterThanOrEqual(0);
                expect(clause.confidence).toBeLessThanOrEqual(1);
                expect(['Low', 'Medium', 'High', 'Critical']).toContain(clause.risk_level);
            }
        });

        test('should validate risks array structure', async () => {
            const testPayload = {
                type: 'text',
                content: 'Agreement with potential risks for validation testing.'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', testPayload);
            const responseBody = JSON.parse(response.body);

            expect(responseBody).toHaveProperty('risks');
            expect(Array.isArray(responseBody.risks)).toBe(true);

            if (responseBody.risks.length > 0) {
                const risk = responseBody.risks[0];
                expect(risk).toHaveProperty('level');
                expect(risk).toHaveProperty('description');
                expect(risk).toHaveProperty('explanation');
                expect(risk).toHaveProperty('recommendation');

                expect(['Low', 'Medium', 'High', 'Critical']).toContain(risk.level);
                expect(typeof risk.description).toBe('string');
                expect(typeof risk.explanation).toBe('string');
                expect(typeof risk.recommendation).toBe('string');
            }
        });

        test('should validate metadata completeness', async () => {
            const testPayload = {
                type: 'file',
                content: {
                    name: 'test.pdf',
                    size: 100000,
                    type: 'application/pdf'
                }
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', testPayload);
            const responseBody = JSON.parse(response.body);

            const metadataValidation = await apiValidator.validateMetadataCompleteness(responseBody.metadata);

            expect(metadataValidation.complete).toBe(true);
            expect(metadataValidation.errors).toHaveLength(0);

            // Validate specific metadata fields
            expect(responseBody.metadata).toHaveProperty('processing_time');
            expect(responseBody.metadata).toHaveProperty('input_type');
            expect(responseBody.metadata).toHaveProperty('model_used');
            expect(responseBody.metadata).toHaveProperty('timestamp');

            expect(typeof responseBody.metadata.processing_time).toBe('number');
            expect(responseBody.metadata.processing_time).toBeGreaterThan(0);
            expect(['text', 'url', 'file']).toContain(responseBody.metadata.input_type);
            expect(responseBody.metadata.model_used).toBe(AWS_CONFIG.bedrockModel);
        });

        test('should handle malformed requests gracefully', async () => {
            const malformedPayload = {
                type: 'invalid_type',
                content: null
            };

            // The validator should handle this gracefully
            const response = await apiValidator.validateEndpointResponse('/api/process', malformedPayload);

            // Should still return a structured response
            expect(response).toHaveProperty('statusCode');
            expect(response).toHaveProperty('body');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle empty text input', async () => {
            const emptyTextPayload = {
                type: 'text',
                content: ''
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', emptyTextPayload);

            // Should handle gracefully
            expect(response.statusCode).toBe(200);
        });

        test('should handle very large file metadata', async () => {
            const largeFilePayload = {
                type: 'file',
                content: {
                    name: 'very-large-document.pdf',
                    size: 50000000, // 50MB
                    type: 'application/pdf'
                }
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', largeFilePayload);
            const responseBody = JSON.parse(response.body);

            // Should handle large files with appropriate processing time
            expect(responseBody.metadata.processing_time).toBeGreaterThan(5000);
        });

        test('should handle invalid URL formats', async () => {
            const invalidUrlPayload = {
                type: 'url',
                content: 'not-a-valid-url'
            };

            const response = await apiValidator.validateEndpointResponse('/api/process', invalidUrlPayload);

            // Should handle gracefully
            expect(response).toHaveProperty('statusCode');
        });
    });
});