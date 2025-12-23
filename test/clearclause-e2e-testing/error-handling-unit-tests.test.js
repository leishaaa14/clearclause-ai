/**
 * Error Handling Unit Tests for ClearClause End-to-End Testing
 * 
 * This test suite provides unit tests for specific error handling scenarios,
 * AWS service failure conditions, fallback mechanism triggers, and error message security.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AWS_CONFIG, TEST_CONFIG } from './config/test-config.js';
import {
    AWSServiceValidator,
    MockS3Client,
    MockLambdaClient,
    MockBedrockClient,
    TestEnvironmentSetup
} from './utils/aws-test-utilities.js';
import { ErrorHandlingValidator } from './error-handling-fallback-validation.test.js';

describe('Error Handling Unit Tests', () => {
    let errorValidator;
    let mockClients;

    beforeAll(async () => {
        errorValidator = new ErrorHandlingValidator();
        await errorValidator.initializeErrorSimulation();
        mockClients = errorValidator.mockClients;
    });

    afterAll(async () => {
        if (errorValidator) {
            await errorValidator.cleanup();
        }
    });

    beforeEach(() => {
        // Reset error logs and state for each test
        errorValidator.errorLogs = [];
        errorValidator.fallbackTriggers = [];
        errorValidator.processingResults = [];

        // Reset mock client errors
        if (mockClients.s3) mockClients.s3._simulatedError = null;
        if (mockClients.lambda) mockClients.lambda._simulatedError = null;
        if (mockClients.bedrock) mockClients.bedrock._simulatedError = null;
    });

    describe('Exception Handling Unit Tests', () => {
        it('should handle text processing exceptions gracefully', async () => {
            // Simulate Bedrock error
            mockClients.bedrock.simulateError('model_unavailable');

            const testInput = { type: 'text', content: 'Test legal document content' };
            const result = await errorValidator.validateExceptionHandling(testInput);

            expect(result.input).toEqual(testInput);
            expect(result.processingComplete).toBe(false);
            expect(result.handledErrors).toHaveLength(1);
            expect(result.unhandledExceptions).toHaveLength(0);
            expect(result.handledErrors[0].message).toContain('Service Unavailable');
        });

        it('should handle URL processing exceptions gracefully', async () => {
            // Simulate Lambda error for URL fetcher
            mockClients.lambda.simulateError('function_not_found');

            const testInput = { type: 'url', content: 'https://example.com/terms' };
            const result = await errorValidator.validateExceptionHandling(testInput);

            expect(result.input).toEqual(testInput);
            expect(result.processingComplete).toBe(false);
            expect(result.handledErrors).toHaveLength(1);
            expect(result.unhandledExceptions).toHaveLength(0);
            expect(result.handledErrors[0].message).toContain('Service Unavailable');
        });

        it('should handle file processing exceptions gracefully', async () => {
            // Simulate S3 error
            mockClients.s3.simulateError('service_unavailable');

            const testInput = {
                type: 'file',
                content: { name: 'test.pdf', size: 1024, type: 'application/pdf' }
            };
            const result = await errorValidator.validateExceptionHandling(testInput);

            expect(result.input).toEqual(testInput);
            expect(result.processingComplete).toBe(false);
            expect(result.handledErrors).toHaveLength(1);
            expect(result.unhandledExceptions).toHaveLength(0);
            expect(result.handledErrors[0].message).toContain('Service Unavailable');
        });

        it('should categorize errors correctly as handled vs unhandled', async () => {
            // Test with a handled error pattern
            const handledError = new Error('Service Unavailable: Temporary outage');
            expect(errorValidator.isHandledError(handledError)).toBe(true);

            // Test with an unhandled error pattern
            const unhandledError = new Error('Unexpected system failure');
            expect(errorValidator.isHandledError(unhandledError)).toBe(false);

            // Test with access denied error
            const accessError = new Error('Access Denied: Invalid permissions');
            expect(errorValidator.isHandledError(accessError)).toBe(true);

            // Test with function not found error
            const functionError = new Error('Function not found: Lambda does not exist');
            expect(errorValidator.isHandledError(functionError)).toBe(true);
        });

        it('should track processing time for all operations', async () => {
            const testInput = { type: 'text', content: 'Test content' };
            const result = await errorValidator.validateExceptionHandling(testInput);

            expect(result.startTime).toBeDefined();
            expect(result.endTime).toBeDefined();
            expect(result.processingTime).toBeGreaterThan(0);
            expect(result.endTime).toBeGreaterThanOrEqual(result.startTime);
        });
    });

    describe('AWS Service Failure Unit Tests', () => {
        it('should handle S3 service unavailable error', async () => {
            mockClients.s3.simulateError('service_unavailable');

            try {
                await mockClients.s3.send({
                    constructor: { name: 'PutObjectCommand' },
                    input: { Key: 'test.pdf', Bucket: AWS_CONFIG.s3Bucket }
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Service Unavailable');
                expect(error.message).toContain('S3 is temporarily unavailable');
            }
        });

        it('should handle S3 access denied error', async () => {
            mockClients.s3.simulateError('access_denied');

            try {
                await mockClients.s3.send({
                    constructor: { name: 'PutObjectCommand' },
                    input: { Key: 'test.pdf', Bucket: AWS_CONFIG.s3Bucket }
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Access Denied');
                expect(error.message).toContain('Invalid credentials');
            }
        });

        it('should handle Lambda function not found error', async () => {
            mockClients.lambda.simulateError('function_not_found');

            try {
                await mockClients.lambda.send({
                    input: { FunctionName: AWS_CONFIG.textractLambda }
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('ResourceNotFoundException');
                expect(error.message).toContain('Function not found');
            }
        });

        it('should handle Lambda invocation timeout error', async () => {
            mockClients.lambda.simulateError('timeout');

            try {
                await mockClients.lambda.send({
                    input: { FunctionName: AWS_CONFIG.urlFetcherLambda }
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('TimeoutException');
                expect(error.message).toContain('timed out');
            }
        });

        it('should handle Bedrock model unavailable error', async () => {
            mockClients.bedrock.simulateError('model_unavailable');

            try {
                await mockClients.bedrock.send({
                    input: { modelId: AWS_CONFIG.bedrockModel }
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('ModelNotReadyException');
                expect(error.message).toContain('Model is not ready');
            }
        });

        it('should handle Bedrock quota exceeded error', async () => {
            mockClients.bedrock.simulateError('quota_exceeded');

            try {
                await mockClients.bedrock.send({
                    input: { modelId: AWS_CONFIG.bedrockModel }
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('ThrottlingException');
                expect(error.message).toContain('quota exceeded');
            }
        });
    });

    describe('Fallback Mechanism Unit Tests', () => {
        it('should trigger S3 fallback when S3 service fails', async () => {
            const result = await errorValidator.validateFallbackMechanisms('s3');

            expect(result.serviceFailureType).toBe('s3');
            expect(result.primaryServiceFailed).toBe(true);
            expect(result.fallbackTriggered).toBe(true);
            expect(result.fallbackSuccessful).toBe(true);
            expect(result.outputMaintained).toBe(true);
        });

        it('should trigger Lambda fallback when Lambda service fails', async () => {
            const result = await errorValidator.validateFallbackMechanisms('lambda');

            expect(result.serviceFailureType).toBe('lambda');
            expect(result.primaryServiceFailed).toBe(true);
            expect(result.fallbackTriggered).toBe(true);
            expect(result.fallbackSuccessful).toBe(true);
            expect(result.outputMaintained).toBe(true);
        });

        it('should trigger Bedrock fallback when Bedrock service fails', async () => {
            const result = await errorValidator.validateFallbackMechanisms('bedrock');

            expect(result.serviceFailureType).toBe('bedrock');
            expect(result.primaryServiceFailed).toBe(true);
            expect(result.fallbackTriggered).toBe(true);
            expect(result.fallbackSuccessful).toBe(true);
            expect(result.outputMaintained).toBe(true);
        });

        it('should log fallback triggers with proper context', async () => {
            await errorValidator.validateFallbackMechanisms('s3');
            await errorValidator.validateFallbackMechanisms('lambda');

            expect(errorValidator.fallbackTriggers).toHaveLength(2);

            const s3Trigger = errorValidator.fallbackTriggers.find(t => t.serviceType === 's3');
            expect(s3Trigger).toBeDefined();
            expect(s3Trigger.context).toContain('Primary s3 service failed');
            expect(s3Trigger.context).toContain('fallback activated');
            expect(s3Trigger.timestamp).toBeDefined();

            const lambdaTrigger = errorValidator.fallbackTriggers.find(t => t.serviceType === 'lambda');
            expect(lambdaTrigger).toBeDefined();
            expect(lambdaTrigger.context).toContain('Primary lambda service failed');
            expect(lambdaTrigger.context).toContain('fallback activated');
            expect(lambdaTrigger.timestamp).toBeDefined();
        });

        it('should maintain output structure in fallback scenarios', async () => {
            const result = await errorValidator.validateFallbackMechanisms('bedrock');

            expect(result.fallbackTriggered).toBe(true);
            expect(result.outputMaintained).toBe(true);

            // Verify the fallback output structure
            // The fallback result is stored in the fallbackTriggers array
            expect(errorValidator.fallbackTriggers).toHaveLength(1);
            const fallbackTrigger = errorValidator.fallbackTriggers[0];
            const fallbackOutput = fallbackTrigger.fallbackResult?.output;
            expect(fallbackOutput).toBeDefined();
            expect(fallbackOutput.summary).toBeDefined();
            expect(Array.isArray(fallbackOutput.clauses)).toBe(true);
            expect(Array.isArray(fallbackOutput.risks)).toBe(true);
            expect(fallbackOutput.metadata).toBeDefined();
        });

        it('should not trigger fallback when services are working', async () => {
            // Don't simulate any service failures
            const testInput = { type: 'text', content: 'Test content' };
            const result = await errorValidator.validateExceptionHandling(testInput);

            expect(result.processingComplete).toBe(true);
            expect(result.handledErrors).toHaveLength(0);
            expect(result.unhandledExceptions).toHaveLength(0);
        });
    });

    describe('Error Message Security Unit Tests', () => {
        it('should detect AWS Access Key ID exposure', () => {
            const unsecureMessage = 'Authentication failed for key AKIAIOSFODNN7EXAMPLE';
            const result = errorValidator.validateErrorMessageSecurity(unsecureMessage);

            expect(result.secure).toBe(false);
            expect(result.violations.length).toBeGreaterThan(0);
            expect(result.message).toBe(unsecureMessage);
        });

        it('should detect AWS Secret Access Key exposure', () => {
            const unsecureMessage = 'Invalid secret key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
            const result = errorValidator.validateErrorMessageSecurity(unsecureMessage);

            expect(result.secure).toBe(false);
            expect(result.violations.length).toBeGreaterThan(0);
        });

        it('should detect credential parameter exposure', () => {
            const unsecureMessage = 'Request failed with aws_access_key_id=AKIATEST123 and aws_secret_access_key=secret123';
            const result = errorValidator.validateErrorMessageSecurity(unsecureMessage);

            expect(result.secure).toBe(false);
            expect(result.violations.length).toBeGreaterThan(0);
        });

        it('should allow secure error messages', () => {
            const secureMessages = [
                'Service temporarily unavailable. Please try again later.',
                'Invalid request format. Check your input parameters.',
                'Authentication failed. Please verify your credentials.',
                'Resource not found. The requested item does not exist.',
                'Rate limit exceeded. Please wait before making another request.'
            ];

            secureMessages.forEach(message => {
                const result = errorValidator.validateErrorMessageSecurity(message);
                expect(result.secure).toBe(true);
                expect(result.meaningful).toBe(true);
                expect(result.violations).toHaveLength(0);
            });
        });

        it('should identify non-meaningful error messages', () => {
            const nonMeaningfulMessages = [
                '',
                'undefined',
                '[object Object]',
                'Error',
                'null'
            ];

            nonMeaningfulMessages.forEach(message => {
                const result = errorValidator.validateErrorMessageSecurity(message);
                expect(result.meaningful).toBeFalsy(); // Use toBeFalsy() to handle empty string and false
            });
        });

        it('should sanitize error messages properly', () => {
            const unsecureMessage = 'Failed with key AKIAIOSFODNN7EXAMPLE and secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
            const sanitized = errorValidator.sanitizeErrorMessage(unsecureMessage);

            expect(sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE');
            expect(sanitized).not.toContain('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
            expect(sanitized).toContain('[REDACTED_ACCESS_KEY]');
            expect(sanitized).toContain('[REDACTED_SECRET_KEY]');
        });

        it('should sanitize credential parameters in error messages', () => {
            const unsecureMessage = 'Request failed: aws_access_key_id=AKIATEST123&aws_secret_access_key=secretkey456';
            const sanitized = errorValidator.sanitizeErrorMessage(unsecureMessage);

            expect(sanitized).toContain('aws_access_key_id=[REDACTED]');
            expect(sanitized).toContain('aws_secret_access_key=[REDACTED]');
            expect(sanitized).not.toContain('AKIATEST123');
            expect(sanitized).not.toContain('secretkey456');
        });
    });

    describe('Output Structure Validation Unit Tests', () => {
        it('should validate complete output structure', () => {
            const validOutput = {
                summary: 'This is a valid summary of the legal document analysis.',
                clauses: [
                    { type: 'termination', text: 'Termination clause text', confidence: 0.95 },
                    { type: 'payment', text: 'Payment terms clause', confidence: 0.88 }
                ],
                risks: [
                    { level: 'High', description: 'High risk identified in contract' },
                    { level: 'Medium', description: 'Medium risk requires attention' }
                ],
                metadata: {
                    processing_time: 2500,
                    input_type: 'file',
                    model_used: 'anthropic.claude-3-sonnet-20240229-v1:0'
                }
            };

            const isValid = errorValidator.validateOutputStructure(validOutput);
            expect(isValid).toBe(true);
        });

        it('should reject output missing required fields', () => {
            const invalidOutputs = [
                { summary: 'Only summary' },
                { clauses: [], risks: [] },
                { summary: 'Test', clauses: [], metadata: {} },
                { summary: 'Test', risks: [], metadata: {} }
            ];

            invalidOutputs.forEach(output => {
                const isValid = errorValidator.validateOutputStructure(output);
                expect(isValid).toBe(false);
            });
        });

        it('should reject output with invalid clause structure', () => {
            const invalidOutput = {
                summary: 'Valid summary',
                clauses: [
                    { type: 'termination' }, // Missing text and confidence
                    { text: 'Some text' }, // Missing type and confidence
                ],
                risks: [{ level: 'Low', description: 'Test risk' }],
                metadata: { processing_time: 1000, input_type: 'text', model_used: 'test' }
            };

            const isValid = errorValidator.validateOutputStructure(invalidOutput);
            expect(isValid).toBe(false);
        });

        it('should reject output with invalid risk levels', () => {
            const invalidOutput = {
                summary: 'Valid summary',
                clauses: [{ type: 'test', text: 'test', confidence: 0.9 }],
                risks: [
                    { level: 'Invalid', description: 'Invalid risk level' },
                    { level: 'VeryHigh', description: 'Non-standard risk level' }
                ],
                metadata: { processing_time: 1000, input_type: 'text', model_used: 'test' }
            };

            const isValid = errorValidator.validateOutputStructure(invalidOutput);
            expect(isValid).toBe(false);
        });

        it('should validate risk levels correctly', () => {
            const validRiskLevels = ['Low', 'Medium', 'High', 'Critical'];

            validRiskLevels.forEach(level => {
                const output = {
                    summary: 'Valid summary',
                    clauses: [{ type: 'test', text: 'test', confidence: 0.9 }],
                    risks: [{ level: level, description: 'Test risk' }],
                    metadata: { processing_time: 1000, input_type: 'text', model_used: 'test' }
                };

                const isValid = errorValidator.validateOutputStructure(output);
                expect(isValid).toBe(true);
            });
        });

        it('should reject non-object or null outputs', () => {
            const invalidOutputs = [null, undefined, 'string', 123, [], true];

            invalidOutputs.forEach(output => {
                const isValid = errorValidator.validateOutputStructure(output);
                expect(isValid).toBe(false);
            });
        });
    });

    describe('Error Handling Summary Unit Tests', () => {
        it('should provide accurate processing statistics', async () => {
            // Process multiple inputs with different outcomes
            await errorValidator.validateExceptionHandling({ type: 'text', content: 'test1' });

            mockClients.bedrock.simulateError('model_unavailable');
            await errorValidator.validateExceptionHandling({ type: 'text', content: 'test2' });

            await errorValidator.validateFallbackMechanisms('s3');

            const summary = errorValidator.getErrorHandlingSummary();

            expect(summary.totalProcessingAttempts).toBe(2);
            expect(summary.successfulProcessing).toBe(1);
            expect(summary.handledErrors).toBe(1);
            expect(summary.unhandledExceptions).toBe(0);
            expect(summary.fallbackTriggers).toBe(1);
            expect(Array.isArray(summary.processingResults)).toBe(true);
            expect(Array.isArray(summary.errorLogs)).toBe(true);
        });

        it('should track different error types separately', async () => {
            // Simulate different types of errors
            mockClients.s3.simulateError('access_denied');
            await errorValidator.validateExceptionHandling({
                type: 'file',
                content: { name: 'test.pdf', size: 1024 }
            });

            mockClients.lambda.simulateError('timeout');
            await errorValidator.validateExceptionHandling({
                type: 'url',
                content: 'https://example.com/test'
            });

            const summary = errorValidator.getErrorHandlingSummary();

            expect(summary.totalProcessingAttempts).toBe(2);
            expect(summary.handledErrors).toBe(2);
            expect(summary.unhandledExceptions).toBe(0);

            // Check that different error types were recorded
            const results = summary.processingResults;
            expect(results[0].handledErrors[0].message).toContain('Service Unavailable');
            expect(results[1].handledErrors[0].message).toContain('Service Unavailable');
        });
    });
});