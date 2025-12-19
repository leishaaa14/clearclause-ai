/**
 * AWS Connectivity Validator Utility
 * 
 * Validates connectivity to all required AWS services for ClearClause E2E testing.
 * This utility is extracted from the test file to avoid vitest import conflicts
 * when used in the unified test orchestrator.
 */

import { AWSServiceValidator, CredentialSecurityValidator } from './aws-test-utilities.js';
import { AWS_CONFIG, SECURITY_CONFIG } from '../config/test-config.js';

export class AWSConnectivityValidator {
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

    /**
     * Clear validation results
     */
    clearResults() {
        this.validationResults = [];
    }

    /**
     * Get detailed validation report
     */
    getDetailedReport() {
        return {
            summary: this.getValidationSummary(),
            serviceDetails: this.validationResults,
            configuration: {
                useRealServices: this.useRealServices,
                awsConfig: {
                    s3Bucket: AWS_CONFIG.s3Bucket,
                    textractLambda: AWS_CONFIG.textractLambda,
                    urlFetcherLambda: AWS_CONFIG.urlFetcherLambda,
                    bedrockModel: AWS_CONFIG.bedrockModel,
                    region: AWS_CONFIG.region
                }
            },
            timestamp: new Date().toISOString()
        };
    }
}

export default AWSConnectivityValidator;