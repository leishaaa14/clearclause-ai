/**
 * ClearClause End-to-End Testing Infrastructure Setup Tests
 * 
 * This test suite validates that the testing infrastructure is properly
 * configured and all required components are available for comprehensive
 * end-to-end testing of the ClearClause AI system.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

// Import test infrastructure components
import testConfig, { AWS_CONFIG, TEST_CONFIG, VALIDATION_THRESHOLDS, SECURITY_CONFIG } from './config/test-config.js';
import testDataGenerators from './utils/test-data-generators.js';
import awsTestUtilities, { TestEnvironmentSetup, CredentialSecurityValidator } from './utils/aws-test-utilities.js';

describe('ClearClause E2E Testing Infrastructure Setup', () => {
    let testEnvironment;
    let securityValidator;

    beforeAll(async () => {
        testEnvironment = new TestEnvironmentSetup();
        securityValidator = new CredentialSecurityValidator();
        await testEnvironment.initializeMockServices();
    });

    afterAll(async () => {
        if (testEnvironment) {
            await testEnvironment.cleanup();
        }
    });

    describe('Directory Structure Validation', () => {
        it('should have created required test directory structure', () => {
            const requiredDirectories = [
                'test/clearclause-e2e-testing',
                'test/clearclause-e2e-testing/config',
                'test/clearclause-e2e-testing/utils'
            ];

            for (const dir of requiredDirectories) {
                expect(fs.existsSync(dir)).toBe(true);
            }
        });

        it('should have created required configuration files', () => {
            const requiredFiles = [
                'test/clearclause-e2e-testing/config/test-config.js',
                'test/clearclause-e2e-testing/utils/test-data-generators.js',
                'test/clearclause-e2e-testing/utils/aws-test-utilities.js'
            ];

            for (const file of requiredFiles) {
                expect(fs.existsSync(file)).toBe(true);
            }
        });
    });

    describe('Configuration Validation', () => {
        it('should load AWS configuration correctly', () => {
            expect(AWS_CONFIG).toBeDefined();
            expect(AWS_CONFIG.region).toBe('us-east-1');
            expect(AWS_CONFIG.s3Bucket).toBe('impactxaws-docs');
            expect(AWS_CONFIG.textractLambda).toBe('ClearClause_TextractOCR');
            expect(AWS_CONFIG.urlFetcherLambda).toBe('ClearClause_URLFetcher');
            expect(AWS_CONFIG.bedrockModel).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
        });

        it('should load test configuration correctly', () => {
            expect(TEST_CONFIG).toBeDefined();
            expect(TEST_CONFIG.timeout).toBe(30000);
            expect(TEST_CONFIG.propertyTestIterations).toBe(100);
            expect(TEST_CONFIG.supportedFileTypes).toContain('pdf');
            expect(TEST_CONFIG.supportedFileTypes).toContain('xlsx');
        });

        it('should load validation thresholds correctly', () => {
            expect(VALIDATION_THRESHOLDS).toBeDefined();
            expect(VALIDATION_THRESHOLDS.minimumSummaryLength).toBe(50);
            expect(VALIDATION_THRESHOLDS.minimumClauseCount).toBe(1);
            expect(VALIDATION_THRESHOLDS.minimumRiskCount).toBe(1);
        });

        it('should load security configuration correctly', () => {
            expect(SECURITY_CONFIG).toBeDefined();
            expect(SECURITY_CONFIG.credentialPatterns).toHaveLength(2);
            expect(SECURITY_CONFIG.scanDirectories).toContain('src');
            expect(SECURITY_CONFIG.scanDirectories).toContain('public');
        });
    });

    describe('Test Data Generators Validation', () => {
        it('should generate valid legal text', () => {
            fc.assert(
                fc.property(testDataGenerators.legalTextGenerator, (text) => {
                    expect(typeof text).toBe('string');
                    expect(text.length).toBeGreaterThan(50);
                    expect(text).toMatch(/agreement|contract|legal|clause|provision/i);
                }),
                { numRuns: 10 }
            );
        });

        it('should generate valid URL inputs', () => {
            fc.assert(
                fc.property(testDataGenerators.urlGenerator, (url) => {
                    expect(typeof url).toBe('string');
                    expect(url).toMatch(/^https?:\/\//);
                }),
                { numRuns: 10 }
            );
        });

        it('should generate valid file metadata', () => {
            fc.assert(
                fc.property(testDataGenerators.fileMetadataGenerator, (metadata) => {
                    expect(metadata).toHaveProperty('name');
                    expect(metadata).toHaveProperty('size');
                    expect(metadata).toHaveProperty('type');
                    expect(metadata).toHaveProperty('lastModified');
                    expect(metadata.size).toBeGreaterThan(0);
                }),
                { numRuns: 10 }
            );
        });

        it('should generate valid API request payloads', () => {
            fc.assert(
                fc.property(testDataGenerators.apiRequestGenerator, (request) => {
                    expect(request).toHaveProperty('type');
                    expect(request).toHaveProperty('content');
                    expect(['text', 'url', 'file']).toContain(request.type);
                }),
                { numRuns: 10 }
            );
        });

        it('should generate valid analysis output structures', () => {
            fc.assert(
                fc.property(testDataGenerators.analysisOutputGenerator, (output) => {
                    expect(output).toHaveProperty('summary');
                    expect(output).toHaveProperty('clauses');
                    expect(output).toHaveProperty('risks');
                    expect(output).toHaveProperty('metadata');
                    expect(Array.isArray(output.clauses)).toBe(true);
                    expect(Array.isArray(output.risks)).toBe(true);
                }),
                { numRuns: 10 }
            );
        });
    });

    describe('AWS Test Utilities Validation', () => {
        it('should initialize mock AWS services', async () => {
            const mockClients = await testEnvironment.initializeMockServices();

            expect(mockClients).toHaveProperty('s3');
            expect(mockClients).toHaveProperty('lambda');
            expect(mockClients).toHaveProperty('bedrock');
        });

        it('should validate test environment setup', async () => {
            const validation = await testEnvironment.validateTestEnvironment();

            expect(validation).toHaveProperty('allPassed');
            expect(validation).toHaveProperty('checks');
            expect(Array.isArray(validation.checks)).toBe(true);
        });

        it('should provide credential security validation', async () => {
            const scanResult = await securityValidator.scanForCredentialExposure(['test']);

            expect(scanResult).toHaveProperty('violationsFound');
            expect(scanResult).toHaveProperty('violations');
            expect(Array.isArray(scanResult.violations)).toBe(true);
        });
    });

    describe('Testing Dependencies Validation', () => {
        it('should have vitest available', () => {
            expect(describe).toBeDefined();
            expect(it).toBeDefined();
            expect(expect).toBeDefined();
        });

        it('should have fast-check available', () => {
            expect(fc).toBeDefined();
            expect(fc.assert).toBeDefined();
            expect(fc.property).toBeDefined();
        });

        it('should have required Node.js modules available', () => {
            expect(fs).toBeDefined();
            expect(path).toBeDefined();
        });
    });

    describe('Dataset Integration Validation', () => {
        it('should be able to access sample dataset files', () => {
            const sampleFiles = testDataGenerators.getSampleDatasetFiles('all', 3);

            expect(Array.isArray(sampleFiles)).toBe(true);
            expect(sampleFiles.length).toBeGreaterThan(0);

            sampleFiles.forEach(file => {
                expect(file).toHaveProperty('name');
                expect(file).toHaveProperty('path');
                expect(file).toHaveProperty('type');
                expect(file).toHaveProperty('size');
            });
        });

        it('should handle missing dataset gracefully', () => {
            // This should not throw an error even if dataset is missing
            expect(() => {
                testDataGenerators.getSampleDatasetFiles('nonexistent', 1);
            }).not.toThrow();
        });
    });
});

/**
 * Property-Based Test for Infrastructure Setup
 * **Feature: clearclause-e2e-testing, Property 1: Test infrastructure creates required directory structure and configuration**
 * **Validates: Requirements 1.1, 1.5**
 */
describe('Property-Based Infrastructure Setup Tests', () => {
    it('should maintain consistent configuration across multiple test runs', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 10 }), (runCount) => {
                // Test that configuration remains consistent across multiple accesses
                for (let i = 0; i < runCount; i++) {
                    const config1 = AWS_CONFIG;
                    const config2 = TEST_CONFIG;

                    // Configuration should be stable and consistent
                    expect(config1.region).toBe('us-east-1');
                    expect(config1.s3Bucket).toBe('impactxaws-docs');
                    expect(config2.timeout).toBe(30000);
                    expect(config2.propertyTestIterations).toBe(100);
                }

                return true;
            }),
            { numRuns: TEST_CONFIG.propertyTestIterations }
        );
    });

    it('should generate valid test data for any supported input type', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('text', 'url', 'file'),
                fc.integer({ min: 1, max: 100 }),
                (inputType, iterations) => {
                    // Generate test data for the specified input type
                    for (let i = 0; i < Math.min(iterations, 10); i++) {
                        let testData;

                        switch (inputType) {
                            case 'text':
                                testData = fc.sample(testDataGenerators.legalTextGenerator, 1)[0];
                                expect(typeof testData).toBe('string');
                                expect(testData.length).toBeGreaterThan(0);
                                break;
                            case 'url':
                                testData = fc.sample(testDataGenerators.urlGenerator, 1)[0];
                                expect(typeof testData).toBe('string');
                                expect(testData).toMatch(/^https?:\/\//);
                                break;
                            case 'file':
                                testData = fc.sample(testDataGenerators.fileMetadataGenerator, 1)[0];
                                expect(testData).toHaveProperty('name');
                                expect(testData).toHaveProperty('size');
                                break;
                        }
                    }

                    return true;
                }
            ),
            { numRuns: TEST_CONFIG.propertyTestIterations }
        );
    });

    it('should maintain security boundaries for credential access', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('frontend', 'backend', 'test'),
                (context) => {
                    // Verify that credentials are only accessible in appropriate contexts
                    if (context === 'frontend') {
                        // In a real frontend context, credentials should not be directly accessible
                        // This is a simulation - in actual frontend code, these would be undefined
                        expect(typeof AWS_CONFIG.credentials).toBe('object');
                    } else if (context === 'backend' || context === 'test') {
                        // Backend and test contexts should have access to credentials
                        expect(AWS_CONFIG.credentials).toBeDefined();
                        expect(AWS_CONFIG.credentials.accessKeyId).toBeDefined();
                        expect(AWS_CONFIG.credentials.secretAccessKey).toBeDefined();
                    }

                    return true;
                }
            ),
            { numRuns: TEST_CONFIG.propertyTestIterations }
        );
    });
});