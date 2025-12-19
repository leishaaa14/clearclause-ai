/**
 * ClearClause End-to-End Testing: AWS Service Logging Unit Tests
 * 
 * Unit tests for AWS service logging components including service call logging,
 * Textract metrics, Bedrock metrics, and performance logging.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AWSServiceLogger } from './utils/AWSServiceLogger.js';

describe('AWS Service Logging Unit Tests', () => {
    let logger;
    let consoleSpy;

    beforeEach(() => {
        logger = new AWSServiceLogger();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    describe('AWS Service Call Logging', () => {
        test('should log AWS service call with all required metadata', () => {
            // Requirement 8.1: Log AWS service calls with timestamps and response codes
            const service = 'S3';
            const operation = 'putObject';
            const metadata = {
                responseCode: 200,
                duration: 1500,
                requestId: 'req-123-456',
                success: true
            };

            logger.logServiceCall(service, operation, metadata);

            expect(logger.serviceCalls).toHaveLength(1);

            const loggedCall = logger.serviceCalls[0];
            expect(loggedCall.service).toBe(service);
            expect(loggedCall.operation).toBe(operation);
            expect(loggedCall.responseCode).toBe(metadata.responseCode);
            expect(loggedCall.duration).toBe(metadata.duration);
            expect(loggedCall.requestId).toBe(metadata.requestId);
            expect(loggedCall.success).toBe(metadata.success);
            expect(loggedCall.timestamp).toBeDefined();
            expect(new Date(loggedCall.timestamp)).toBeInstanceOf(Date);
            expect(loggedCall.errorMessage).toBeNull();
        });

        test('should log failed AWS service call with error message', () => {
            const service = 'Textract';
            const operation = 'analyzeDocument';
            const metadata = {
                responseCode: 500,
                duration: 2000,
                success: false,
                errorMessage: 'Internal server error'
            };

            logger.logServiceCall(service, operation, metadata);

            const loggedCall = logger.serviceCalls[0];
            expect(loggedCall.success).toBe(false);
            expect(loggedCall.errorMessage).toBe(metadata.errorMessage);
            expect(loggedCall.responseCode).toBe(500);
        });

        test('should handle minimal metadata gracefully', () => {
            logger.logServiceCall('Lambda', 'invoke');

            const loggedCall = logger.serviceCalls[0];
            expect(loggedCall.service).toBe('Lambda');
            expect(loggedCall.operation).toBe('invoke');
            expect(loggedCall.responseCode).toBeNull();
            expect(loggedCall.duration).toBeNull();
            expect(loggedCall.success).toBe(true); // Default to true
            expect(loggedCall.timestamp).toBeDefined();
        });

        test('should log console output for service calls', () => {
            logger.logServiceCall('Bedrock', 'invokeModel', {
                duration: 3000,
                success: true
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[AWS-Bedrock] invokeModel - SUCCESS (3000ms)')
            );
        });

        test('should log console error for failed service calls', () => {
            const errorSpy = vi.spyOn(console, 'error');

            logger.logServiceCall('S3', 'getObject', {
                success: false,
                errorMessage: 'Access denied'
            });

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[AWS-S3] Error: Access denied')
            );
        });
    });

    describe('Textract Metrics Logging', () => {
        test('should log Textract metrics with all required fields', () => {
            // Requirement 8.2: Record Textract output size and processing duration
            const textractMetrics = {
                outputSize: 524288,
                processingDuration: 15000,
                confidence: 0.95,
                pageCount: 5,
                blockCount: 150,
                extractedTextLength: 2500
            };

            logger.logTextractMetrics(textractMetrics);

            expect(logger.processingMetrics).toHaveLength(1);

            const loggedMetrics = logger.processingMetrics[0];
            expect(loggedMetrics.service).toBe('Textract');
            expect(loggedMetrics.outputSize).toBe(textractMetrics.outputSize);
            expect(loggedMetrics.processingDuration).toBe(textractMetrics.processingDuration);
            expect(loggedMetrics.confidence).toBe(textractMetrics.confidence);
            expect(loggedMetrics.pageCount).toBe(textractMetrics.pageCount);
            expect(loggedMetrics.blockCount).toBe(textractMetrics.blockCount);
            expect(loggedMetrics.extractedTextLength).toBe(textractMetrics.extractedTextLength);
            expect(loggedMetrics.timestamp).toBeDefined();
        });

        test('should handle missing Textract metrics with defaults', () => {
            logger.logTextractMetrics({});

            const loggedMetrics = logger.processingMetrics[0];
            expect(loggedMetrics.outputSize).toBe(0);
            expect(loggedMetrics.processingDuration).toBe(0);
            expect(loggedMetrics.confidence).toBe(0);
            expect(loggedMetrics.pageCount).toBe(0);
            expect(loggedMetrics.blockCount).toBe(0);
            expect(loggedMetrics.extractedTextLength).toBe(0);
        });

        test('should log Textract console output with formatted metrics', () => {
            logger.logTextractMetrics({
                pageCount: 3,
                extractedTextLength: 1500,
                confidence: 0.87
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Textract] Processed 3 pages, extracted 1500 characters (confidence: 87.0%)')
            );
        });
    });

    describe('Bedrock Metrics Logging', () => {
        test('should log Bedrock metrics with token usage and inference time', () => {
            // Requirement 8.3: Track Bedrock token usage and inference time
            const bedrockMetrics = {
                inputTokens: 1200,
                outputTokens: 800,
                inferenceTime: 4500,
                modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
                requestSize: 15000,
                responseSize: 8000
            };

            logger.logBedrockMetrics(bedrockMetrics);

            expect(logger.processingMetrics).toHaveLength(1);

            const loggedMetrics = logger.processingMetrics[0];
            expect(loggedMetrics.service).toBe('Bedrock');
            expect(loggedMetrics.tokenUsage.inputTokens).toBe(bedrockMetrics.inputTokens);
            expect(loggedMetrics.tokenUsage.outputTokens).toBe(bedrockMetrics.outputTokens);
            expect(loggedMetrics.tokenUsage.totalTokens).toBe(2000);
            expect(loggedMetrics.inferenceTime).toBe(bedrockMetrics.inferenceTime);
            expect(loggedMetrics.modelId).toBe(bedrockMetrics.modelId);
            expect(loggedMetrics.requestSize).toBe(bedrockMetrics.requestSize);
            expect(loggedMetrics.responseSize).toBe(bedrockMetrics.responseSize);
            expect(loggedMetrics.timestamp).toBeDefined();
        });

        test('should handle missing Bedrock metrics with defaults', () => {
            logger.logBedrockMetrics({});

            const loggedMetrics = logger.processingMetrics[0];
            expect(loggedMetrics.tokenUsage.inputTokens).toBe(0);
            expect(loggedMetrics.tokenUsage.outputTokens).toBe(0);
            expect(loggedMetrics.tokenUsage.totalTokens).toBe(0);
            expect(loggedMetrics.inferenceTime).toBe(0);
            expect(loggedMetrics.modelId).toBe('unknown');
            expect(loggedMetrics.requestSize).toBe(0);
            expect(loggedMetrics.responseSize).toBe(0);
        });

        test('should log Bedrock console output with formatted metrics', () => {
            logger.logBedrockMetrics({
                inputTokens: 500,
                outputTokens: 300,
                inferenceTime: 2500,
                modelId: 'anthropic.claude-3-haiku-20240307-v1:0'
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Bedrock] Model: anthropic.claude-3-haiku-20240307-v1:0, Tokens: 800 (500→300), Inference: 2500ms')
            );
        });
    });

    describe('Processing Time Logging', () => {
        test('should log processing metrics per input type', () => {
            // Requirement 8.4: Measure processing time per input type
            const inputType = 'PDF';
            const processingTime = 25000;
            const additionalMetrics = {
                fileSize: 2048000,
                textLength: 5000,
                awsServiceCalls: 3,
                totalAwsTime: 15000,
                analysisTime: 8000
            };

            logger.logProcessingMetrics(inputType, processingTime, additionalMetrics);

            expect(logger.processingMetrics).toHaveLength(1);

            const loggedMetrics = logger.processingMetrics[0];
            expect(loggedMetrics.inputType).toBe(inputType);
            expect(loggedMetrics.processingTime).toBe(processingTime);
            expect(loggedMetrics.fileSize).toBe(additionalMetrics.fileSize);
            expect(loggedMetrics.textLength).toBe(additionalMetrics.textLength);
            expect(loggedMetrics.awsServiceCalls).toBe(additionalMetrics.awsServiceCalls);
            expect(loggedMetrics.totalAwsTime).toBe(additionalMetrics.totalAwsTime);
            expect(loggedMetrics.analysisTime).toBe(additionalMetrics.analysisTime);
            expect(loggedMetrics.timestamp).toBeDefined();
        });

        test('should handle minimal processing metrics', () => {
            logger.logProcessingMetrics('RawText', 5000);

            const loggedMetrics = logger.processingMetrics[0];
            expect(loggedMetrics.inputType).toBe('RawText');
            expect(loggedMetrics.processingTime).toBe(5000);
            expect(loggedMetrics.fileSize).toBeNull();
            expect(loggedMetrics.textLength).toBeNull();
            expect(loggedMetrics.awsServiceCalls).toBe(0);
        });

        test('should log processing console output with timing breakdown', () => {
            logger.logProcessingMetrics('Excel', 18000, {
                totalAwsTime: 12000,
                analysisTime: 5000
            });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Performance] Excel: 18000ms total (AWS: 12000ms, Analysis: 5000ms)')
            );
        });
    });

    describe('Resource Usage Logging', () => {
        test('should log resource usage for AWS services', () => {
            const service = 'Lambda';
            const usage = {
                memoryUsage: 256,
                cpuUsage: 45.5,
                networkIO: 1024000,
                storageIO: 512000,
                estimatedCost: 0.0025
            };

            logger.logResourceUsage(service, usage);

            expect(logger.resourceUsage).toHaveLength(1);

            const loggedUsage = logger.resourceUsage[0];
            expect(loggedUsage.service).toBe(service);
            expect(loggedUsage.memoryUsage).toBe(usage.memoryUsage);
            expect(loggedUsage.cpuUsage).toBe(usage.cpuUsage);
            expect(loggedUsage.networkIO).toBe(usage.networkIO);
            expect(loggedUsage.storageIO).toBe(usage.storageIO);
            expect(loggedUsage.cost).toBe(usage.estimatedCost);
            expect(loggedUsage.timestamp).toBeDefined();
        });
    });

    describe('Test Result Recording', () => {
        test('should record passed test results', () => {
            logger.recordTestResult('AWS Connectivity Test', true);

            expect(logger.testResults.passed).toBe(1);
            expect(logger.testResults.failed).toBe(0);
            expect(logger.testResults.errors).toHaveLength(0);
        });

        test('should record failed test results with error message', () => {
            const testName = 'File Processing Test';
            const errorMessage = 'Textract service unavailable';

            logger.recordTestResult(testName, false, errorMessage);

            expect(logger.testResults.passed).toBe(0);
            expect(logger.testResults.failed).toBe(1);
            expect(logger.testResults.errors).toHaveLength(1);

            const error = logger.testResults.errors[0];
            expect(error.testName).toBe(testName);
            expect(error.errorMessage).toBe(errorMessage);
            expect(error.timestamp).toBeDefined();
        });

        test('should accumulate multiple test results', () => {
            logger.recordTestResult('Test 1', true);
            logger.recordTestResult('Test 2', false, 'Error 1');
            logger.recordTestResult('Test 3', true);
            logger.recordTestResult('Test 4', false, 'Error 2');

            expect(logger.testResults.passed).toBe(2);
            expect(logger.testResults.failed).toBe(2);
            expect(logger.testResults.errors).toHaveLength(2);
        });
    });

    describe('Service Call Statistics', () => {
        test('should calculate accurate service call statistics', () => {
            // Add multiple service calls
            logger.logServiceCall('S3', 'putObject', { duration: 1000, success: true });
            logger.logServiceCall('S3', 'getObject', { duration: 500, success: true });
            logger.logServiceCall('S3', 'deleteObject', { duration: 300, success: false });
            logger.logServiceCall('Textract', 'analyzeDocument', { duration: 15000, success: true });

            const stats = logger.getServiceCallStats();

            // Verify S3 statistics
            expect(stats.S3.totalCalls).toBe(3);
            expect(stats.S3.successfulCalls).toBe(2);
            expect(stats.S3.failedCalls).toBe(1);
            expect(stats.S3.totalDuration).toBe(1800);
            expect(stats.S3.averageDuration).toBe(600);
            expect(stats.S3.successRate).toBeCloseTo(66.67, 2);

            // Verify Textract statistics
            expect(stats.Textract.totalCalls).toBe(1);
            expect(stats.Textract.successfulCalls).toBe(1);
            expect(stats.Textract.failedCalls).toBe(0);
            expect(stats.Textract.totalDuration).toBe(15000);
            expect(stats.Textract.averageDuration).toBe(15000);
            expect(stats.Textract.successRate).toBe(100);
        });
    });

    describe('Processing Metrics by Type', () => {
        test('should aggregate processing metrics by input type', () => {
            logger.logProcessingMetrics('PDF', 10000);
            logger.logProcessingMetrics('PDF', 15000);
            logger.logProcessingMetrics('Image', 8000);
            logger.logProcessingMetrics('PDF', 12000);

            const metricsByType = logger.getProcessingMetricsByType();

            // Verify PDF metrics
            expect(metricsByType.PDF.count).toBe(3);
            expect(metricsByType.PDF.totalTime).toBe(37000);
            expect(metricsByType.PDF.averageTime).toBeCloseTo(12333.33, 2);
            expect(metricsByType.PDF.minTime).toBe(10000);
            expect(metricsByType.PDF.maxTime).toBe(15000);

            // Verify Image metrics
            expect(metricsByType.Image.count).toBe(1);
            expect(metricsByType.Image.totalTime).toBe(8000);
            expect(metricsByType.Image.averageTime).toBe(8000);
            expect(metricsByType.Image.minTime).toBe(8000);
            expect(metricsByType.Image.maxTime).toBe(8000);
        });
    });

    describe('Logger Utility Functions', () => {
        test('should clear all logged data', () => {
            logger.logServiceCall('S3', 'putObject');
            logger.logTextractMetrics({ outputSize: 1000 });
            logger.recordTestResult('Test', true);

            logger.clear();

            expect(logger.serviceCalls).toHaveLength(0);
            expect(logger.processingMetrics).toHaveLength(0);
            expect(logger.resourceUsage).toHaveLength(0);
            expect(logger.testResults.passed).toBe(0);
            expect(logger.testResults.failed).toBe(0);
            expect(logger.testResults.errors).toHaveLength(0);
        });

        test('should export data to JSON format', () => {
            logger.logServiceCall('S3', 'putObject', { success: true });
            logger.recordTestResult('Test', true);

            const jsonData = logger.exportToJSON();
            const parsedData = JSON.parse(jsonData);

            expect(parsedData.serviceCalls).toHaveLength(1);
            expect(parsedData.testResults.passed).toBe(1);
            expect(parsedData.testStartTime).toBeDefined();
        });
    });
});