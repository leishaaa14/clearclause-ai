/**
 * AWS Connectivity Validation Tests for ClearClause End-to-End Testing
 * 
 * This test suite validates that all required AWS services are accessible
 * and properly configured for the ClearClause AI system.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { AWS_CONFIG, TEST_CONFIG, SECURITY_CONFIG } from './config/test-config.js';
import { AWSServiceValidator, CredentialSecurityValidator } from './utils/aws-test-utilities.js';

/**
 * AWS Connectivity Validator Class
 * Tests all required AWS services for the ClearClause system
 */
class AWSConnectivityValidator {
    constructor(useRealServices = false) {
        this.useRealServices = useRealServices;
        this.serviceValidator = new AWSServiceValidator(useRealServices);
        this.securityValidator = new CredentialSecurityValidator();
        this.validationResults = [];
    }

    /**
     * Validate S3 bucket connectivity for impactxaws-docs bucket
     */
    async validateS3Connection(bucketName = AWS_CONFIG.s3Bucket) {
        try {
            const result = await this.serviceValidator.validateS3Access(bucketName);

            // Additional S3-specific validations
            if (result.status === 'accessible') {
                result.bucketName = bucketName;
                result.region = AWS_CONFIG.region;
                result.validationDetails = {
                    canAccess: true,
                    bucketExists: true,
                    hasPermissions: true
                };
            }

            this.validationResults.push(result);
            return result;
        } catch (error) {
            const errorResult = {
                service: 'S3',
                bucket: bucketName,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
            this.validationResults.push(errorResult);
            return errorResult;
        }
    }

    /**
     * Validate Textract Lambda connectivity for ClearClause_TextractOCR
     */
    async validateTextractLambda(lambdaName = AWS_CONFIG.textractLambda) {
        try {
            const result = await this.serviceValidator.validateLambdaAccess(lambdaName);

            if (result.status === 'accessible') {
                result.functionName = lambdaName;
                result.validationDetails = {
                    canInvoke: true,
                    functionExists: true,
                    hasPermissions: true,
                    purpose: 'Textract OCR processing'
                };
            }

            this.validationResults.push(result);
            return result;
        } catch (error) {
            const errorResult = {
                service: 'Lambda',
                function: lambdaName,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
            this.validationResults.push(errorResult);
            return errorResult;
        }
    }

    /**
     * Validate URL Fetcher Lambda connectivity for ClearClause_URLFetcher
     */
    async validateURLFetcherLambda(lambdaName = AWS_CONFIG.urlFetcherLambda) {
        try {
            const result = await this.serviceValidator.validateLambdaAccess(lambdaName);

            if (result.status === 'accessible') {
                result.functionName = lambdaName;
                result.validationDetails = {
                    canInvoke: true,
                    functionExists: true,
                    hasPermissions: true,
                    purpose: 'URL content fetching'
                };
            }

            this.validationResults.push(result);
            return result;
        } catch (error) {
            const errorResult = {
                service: 'Lambda',
                function: lambdaName,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
            this.validationResults.push(errorResult);
            return errorResult;
        }
    }

    /**
     * Validate Bedrock model availability for anthropic.claude-3-sonnet-20240229-v1:0
     */
    async validateBedrockModel(modelId = AWS_CONFIG.bedrockModel) {
        try {
            const result = await this.serviceValidator.validateBedrockAccess(modelId);

            if (result.status === 'accessible') {
                result.modelId = modelId;
                result.validationDetails = {
                    canInvoke: true,
                    modelAvailable: true,
                    hasPermissions: true,
                    modelType: 'anthropic.claude-3-sonnet'
                };
            }

            this.validationResults.push(result);
            return result;
        } catch (error) {
            const errorResult = {
                service: 'Bedrock',
                model: modelId,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
            this.validationResults.push(errorResult);
            return errorResult;
        }
    }

    /**
     * Validate credential security to ensure backend-only access
     */
    async validateCredentialSecurity() {
        try {
            // Check that credentials are available in backend context
            const credentialsAvailable = AWS_CONFIG.credentials &&
                AWS_CONFIG.credentials.accessKeyId &&
                AWS_CONFIG.credentials.secretAccessKey;

            // Scan for credential exposure in frontend directories
            const scanResult = await this.securityValidator.scanForCredentialExposure(
                SECURITY_CONFIG.scanDirectories
            );

            const result = {
                service: 'Security',
                status: credentialsAvailable && !scanResult.violationsFound ? 'secure' : 'violation',
                validationDetails: {
                    credentialsAvailable: credentialsAvailable,
                    frontendExposure: scanResult.violationsFound,
                    violations: scanResult.violations,
                    backendOnly: credentialsAvailable && !scanResult.violationsFound
                },
                timestamp: new Date().toISOString()
            };

            this.validationResults.push(result);
            return result;
        } catch (error) {
            const errorResult = {
                service: 'Security',
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
            this.validationResults.push(errorResult);
            return errorResult;
        }
    }

    /**
     * Run complete AWS connectivity validation
     */
    async validateAllServices() {
        const results = {
            s3: await this.validateS3Connection(),
            textractLambda: await this.validateTextractLambda(),
            urlFetcherLambda: await this.validateURLFetcherLambda(),
            bedrockModel: await this.validateBedrockModel(),
            credentialSecurity: await this.validateCredentialSecurity()
        };

        const summary = {
            totalServices: 5,
            successfulConnections: Object.values(results).filter(r =>
                r.status === 'accessible' || r.status === 'secure'
            ).length,
            failedConnections: Object.values(results).filter(r =>
                r.status === 'error' || r.status === 'violation'
            ).length,
            allServicesAccessible: Object.values(results).every(r =>
                r.status === 'accessible' || r.status === 'secure'
            ),
            results: results,
            timestamp: new Date().toISOString()
        };

        return summary;
    }

    /**
     * Get validation results summary
     */
    getValidationSummary() {
        return {
            total: this.validationResults.length,
            successful: this.validationResults.filter(r =>
                r.status === 'accessible' || r.status === 'secure'
            ).length,
            failed: this.validationResults.filter(r =>
                r.status === 'error' || r.status === 'violation'
            ).length,
            results: this.validationResults
        };
    }
}

describe('AWS Connectivity Validation System', () => {
    let connectivityValidator;

    beforeAll(async () => {
        // Use mock services for testing to avoid real AWS calls during unit tests
        connectivityValidator = new AWSConnectivityValidator(false);
    });

    afterAll(async () => {
        // Cleanup
        connectivityValidator = null;
    });

    describe('AWSConnectivityValidator Class', () => {
        it('should create validator instance with correct configuration', () => {
            expect(connectivityValidator).toBeDefined();
            expect(connectivityValidator.useRealServices).toBe(false);
            expect(connectivityValidator.serviceValidator).toBeDefined();
            expect(connectivityValidator.securityValidator).toBeDefined();
        });

        it('should validate S3 bucket connectivity', async () => {
            const result = await connectivityValidator.validateS3Connection();

            expect(result).toBeDefined();
            expect(result.service).toBe('S3');
            expect(result.bucket).toBe(AWS_CONFIG.s3Bucket);
            expect(result.status).toBe('accessible');
            expect(result.timestamp).toBeDefined();
            expect(result.validationDetails).toBeDefined();
            expect(result.validationDetails.canAccess).toBe(true);
        });

        it('should validate Textract Lambda connectivity', async () => {
            const result = await connectivityValidator.validateTextractLambda();

            expect(result).toBeDefined();
            expect(result.service).toBe('Lambda');
            expect(result.function).toBe(AWS_CONFIG.textractLambda);
            expect(result.status).toBe('accessible');
            expect(result.validationDetails.purpose).toBe('Textract OCR processing');
        });

        it('should validate URL Fetcher Lambda connectivity', async () => {
            const result = await connectivityValidator.validateURLFetcherLambda();

            expect(result).toBeDefined();
            expect(result.service).toBe('Lambda');
            expect(result.function).toBe(AWS_CONFIG.urlFetcherLambda);
            expect(result.status).toBe('accessible');
            expect(result.validationDetails.purpose).toBe('URL content fetching');
        });

        it('should validate Bedrock model availability', async () => {
            const result = await connectivityValidator.validateBedrockModel();

            expect(result).toBeDefined();
            expect(result.service).toBe('Bedrock');
            expect(result.model).toBe(AWS_CONFIG.bedrockModel);
            expect(result.status).toBe('accessible');
            expect(result.validationDetails.modelType).toBe('anthropic.claude-3-sonnet');
        });

        it('should validate credential security', async () => {
            const result = await connectivityValidator.validateCredentialSecurity();

            expect(result).toBeDefined();
            expect(result.service).toBe('Security');
            expect(result.validationDetails).toBeDefined();
            expect(result.validationDetails.credentialsAvailable).toBeDefined();
            expect(result.validationDetails.frontendExposure).toBeDefined();
        });

        it('should validate all services together', async () => {
            const summary = await connectivityValidator.validateAllServices();

            expect(summary).toBeDefined();
            expect(summary.totalServices).toBe(5);
            expect(summary.results).toBeDefined();
            expect(summary.results.s3).toBeDefined();
            expect(summary.results.textractLambda).toBeDefined();
            expect(summary.results.urlFetcherLambda).toBeDefined();
            expect(summary.results.bedrockModel).toBeDefined();
            expect(summary.results.credentialSecurity).toBeDefined();
        });

        it('should provide validation summary', () => {
            const summary = connectivityValidator.getValidationSummary();

            expect(summary).toBeDefined();
            expect(summary.total).toBeGreaterThan(0);
            expect(summary.successful).toBeDefined();
            expect(summary.failed).toBeDefined();
            expect(Array.isArray(summary.results)).toBe(true);
        });
    });
});

/**
 * Property-Based Test for AWS Services Connectivity Validation
 * **Feature: clearclause-e2e-testing, Property 1: AWS Services Connectivity Validation**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */
describe('Property-Based AWS Connectivity Tests', () => {
    it('should validate AWS configuration structure', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('s3Bucket', 'textractLambda', 'urlFetcherLambda', 'bedrockModel'),
                (configKey) => {
                    // Test that AWS configuration has all required properties
                    expect(AWS_CONFIG).toHaveProperty(configKey);
                    expect(typeof AWS_CONFIG[configKey]).toBe('string');
                    expect(AWS_CONFIG[configKey].length).toBeGreaterThan(0);

                    return true;
                }
            ),
            { numRuns: 10 }
        );
    });

    it('should validate service names match expected patterns', () => {
        fc.assert(
            fc.property(
                fc.record({
                    s3Bucket: fc.constant(AWS_CONFIG.s3Bucket),
                    textractLambda: fc.constant(AWS_CONFIG.textractLambda),
                    urlFetcherLambda: fc.constant(AWS_CONFIG.urlFetcherLambda),
                    bedrockModel: fc.constant(AWS_CONFIG.bedrockModel)
                }),
                (awsConfig) => {
                    // Validate service name patterns
                    expect(awsConfig.s3Bucket).toBe('impactxaws-docs');
                    expect(awsConfig.textractLambda).toBe('ClearClause_TextractOCR');
                    expect(awsConfig.urlFetcherLambda).toBe('ClearClause_URLFetcher');
                    expect(awsConfig.bedrockModel).toBe('anthropic.claude-3-sonnet-20240229-v1:0');

                    return true;
                }
            ),
            { numRuns: 10 }
        );
    });

    it('should validate credentials structure', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('accessKeyId', 'secretAccessKey'),
                (credentialKey) => {
                    // Test that credentials have required structure
                    expect(AWS_CONFIG.credentials).toBeDefined();
                    expect(AWS_CONFIG.credentials).toHaveProperty(credentialKey);
                    expect(typeof AWS_CONFIG.credentials[credentialKey]).toBe('string');
                    expect(AWS_CONFIG.credentials[credentialKey].length).toBeGreaterThan(0);

                    return true;
                }
            ),
            { numRuns: 10 }
        );
    });

    it('should validate validator instance creation', () => {
        fc.assert(
            fc.property(
                fc.boolean(),
                (useRealServices) => {
                    // Test that validator can be created with different configurations
                    const validator = new AWSConnectivityValidator(useRealServices);

                    expect(validator).toBeDefined();
                    expect(validator.useRealServices).toBe(useRealServices);
                    expect(validator.serviceValidator).toBeDefined();
                    expect(validator.securityValidator).toBeDefined();
                    expect(Array.isArray(validator.validationResults)).toBe(true);

                    return true;
                }
            ),
            { numRuns: 10 }
        );
    });
});

export { AWSConnectivityValidator };