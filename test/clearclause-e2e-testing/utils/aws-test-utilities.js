/**
 * AWS Test Utilities for ClearClause End-to-End Testing
 * 
 * This module provides utilities for testing AWS service integrations,
 * including mock services, validation helpers, and test setup functions.
 */

import { AWS_CONFIG, TEST_CONFIG } from '../config/test-config.js';

/**
 * Mock AWS SDK clients for testing
 */
export class MockS3Client {
    constructor(config) {
        this.config = config;
        this.mockResponses = new Map();
    }

    setMockResponse(operation, response) {
        this.mockResponses.set(operation, response);
    }

    async send(command) {
        const operation = command.constructor.name;
        if (this.mockResponses.has(operation)) {
            return this.mockResponses.get(operation);
        }

        // Default mock responses
        switch (operation) {
            case 'PutObjectCommand':
                return {
                    ETag: '"mock-etag-12345"',
                    Location: `https://${AWS_CONFIG.s3Bucket}.s3.amazonaws.com/${command.input.Key}`,
                    Key: command.input.Key,
                    Bucket: command.input.Bucket
                };
            case 'HeadBucketCommand':
                return { $metadata: { httpStatusCode: 200 } };
            default:
                throw new Error(`Mock not implemented for ${operation}`);
        }
    }
}

export class MockLambdaClient {
    constructor(config) {
        this.config = config;
        this.mockResponses = new Map();
    }

    setMockResponse(functionName, response) {
        this.mockResponses.set(functionName, response);
    }

    async send(command) {
        const functionName = command.input.FunctionName;
        if (this.mockResponses.has(functionName)) {
            return this.mockResponses.get(functionName);
        }

        // Default mock responses
        return {
            StatusCode: 200,
            Payload: new TextEncoder().encode(JSON.stringify({
                statusCode: 200,
                body: JSON.stringify({ message: 'Mock Lambda response' })
            }))
        };
    }
}

export class MockBedrockClient {
    constructor(config) {
        this.config = config;
        this.mockResponses = new Map();
    }

    setMockResponse(modelId, response) {
        this.mockResponses.set(modelId, response);
    }

    async send(command) {
        const modelId = command.input.modelId;
        if (this.mockResponses.has(modelId)) {
            return this.mockResponses.get(modelId);
        }

        // Default mock response
        return {
            body: new TextEncoder().encode(JSON.stringify({
                content: [{
                    text: JSON.stringify({
                        summary: 'Mock analysis summary',
                        clauses: [{ type: 'mock', text: 'Mock clause', confidence: 0.9 }],
                        risks: [{ level: 'Low', description: 'Mock risk' }]
                    })
                }]
            })),
            contentType: 'application/json'
        };
    }
}

/**
 * AWS service validation utilities
 */
export class AWSServiceValidator {
    constructor(useRealServices = false) {
        this.useRealServices = useRealServices;
        this.validationResults = [];
    }

    async validateS3Access(bucketName = AWS_CONFIG.s3Bucket) {
        try {
            if (this.useRealServices) {
                const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
                const client = new S3Client({
                    region: AWS_CONFIG.region,
                    credentials: AWS_CONFIG.credentials
                });

                await client.send(new HeadBucketCommand({ Bucket: bucketName }));
            }

            const result = {
                service: 'S3',
                bucket: bucketName,
                status: 'accessible',
                timestamp: new Date().toISOString()
            };

            this.validationResults.push(result);
            return result;
        } catch (error) {
            const result = {
                service: 'S3',
                bucket: bucketName,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.validationResults.push(result);
            return result;
        }
    }

    async validateLambdaAccess(functionName) {
        try {
            if (this.useRealServices) {
                const { LambdaClient, GetFunctionCommand } = await import('@aws-sdk/client-lambda');
                const client = new LambdaClient({
                    region: AWS_CONFIG.region,
                    credentials: AWS_CONFIG.credentials
                });

                await client.send(new GetFunctionCommand({ FunctionName: functionName }));
            }

            const result = {
                service: 'Lambda',
                function: functionName,
                status: 'accessible',
                timestamp: new Date().toISOString()
            };

            this.validationResults.push(result);
            return result;
        } catch (error) {
            const result = {
                service: 'Lambda',
                function: functionName,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.validationResults.push(result);
            return result;
        }
    }

    async validateBedrockAccess(modelId = AWS_CONFIG.bedrockModel) {
        try {
            if (this.useRealServices) {
                const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
                const client = new BedrockRuntimeClient({
                    region: AWS_CONFIG.region,
                    credentials: AWS_CONFIG.credentials
                });

                // Test with minimal input
                const testInput = {
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 10,
                    messages: [{ role: "user", content: "test" }]
                };

                await client.send(new InvokeModelCommand({
                    modelId: modelId,
                    body: JSON.stringify(testInput)
                }));
            }

            const result = {
                service: 'Bedrock',
                model: modelId,
                status: 'accessible',
                timestamp: new Date().toISOString()
            };

            this.validationResults.push(result);
            return result;
        } catch (error) {
            const result = {
                service: 'Bedrock',
                model: modelId,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.validationResults.push(result);
            return result;
        }
    }

    getValidationSummary() {
        return {
            total: this.validationResults.length,
            successful: this.validationResults.filter(r => r.status === 'accessible').length,
            failed: this.validationResults.filter(r => r.status === 'error').length,
            results: this.validationResults
        };
    }
}

/**
 * Test environment setup utilities
 */
export class TestEnvironmentSetup {
    constructor() {
        this.setupComplete = false;
        this.mockClients = {};
    }

    async initializeMockServices() {
        this.mockClients.s3 = new MockS3Client(AWS_CONFIG);
        this.mockClients.lambda = new MockLambdaClient(AWS_CONFIG);
        this.mockClients.bedrock = new MockBedrockClient(AWS_CONFIG);

        this.setupComplete = true;
        return this.mockClients;
    }

    async validateTestEnvironment() {
        const checks = [];

        // Check required environment variables
        const requiredEnvVars = [
            'VITE_AWS_REGION',
            'VITE_S3_BUCKET',
            'VITE_TEXTRACT_LAMBDA',
            'VITE_URL_LAMBDA',
            'VITE_BEDROCK_MODEL'
        ];

        for (const envVar of requiredEnvVars) {
            checks.push({
                check: `Environment variable ${envVar}`,
                status: process.env[envVar] ? 'pass' : 'fail',
                value: process.env[envVar] ? 'present' : 'missing'
            });
        }

        // Check test configuration
        checks.push({
            check: 'Test configuration loaded',
            status: AWS_CONFIG && TEST_CONFIG ? 'pass' : 'fail',
            value: 'configuration objects available'
        });

        // Check mock services
        checks.push({
            check: 'Mock services initialized',
            status: this.setupComplete ? 'pass' : 'fail',
            value: this.setupComplete ? 'initialized' : 'not initialized'
        });

        return {
            allPassed: checks.every(check => check.status === 'pass'),
            checks: checks
        };
    }

    async cleanup() {
        // Clean up any test resources
        this.mockClients = {};
        this.setupComplete = false;
    }
}

/**
 * Credential security validation utilities
 */
export class CredentialSecurityValidator {
    constructor() {
        this.violations = [];
    }

    async scanForCredentialExposure(directories = ['src', 'public']) {
        const fs = await import('fs');
        const path = await import('path');

        for (const dir of directories) {
            if (fs.existsSync(dir)) {
                await this.scanDirectory(dir, fs, path);
            }
        }

        return {
            violationsFound: this.violations.length > 0,
            violations: this.violations
        };
    }

    async scanDirectory(dirPath, fs, path) {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                await this.scanDirectory(fullPath, fs, path);
            } else if (stat.isFile() && this.shouldScanFile(fullPath)) {
                await this.scanFile(fullPath, fs);
            }
        }
    }

    shouldScanFile(filePath) {
        const excludePatterns = ['.env', '.log', 'node_modules', '.git'];
        return !excludePatterns.some(pattern => filePath.includes(pattern));
    }

    async scanFile(filePath, fs) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');

            // Check for AWS credential patterns
            const credentialPatterns = [
                { pattern: /AKIA[0-9A-Z]{16}/g, type: 'AWS Access Key ID' },
                { pattern: /[A-Za-z0-9/+=]{40}/g, type: 'Potential AWS Secret Key' }
            ];

            for (const { pattern, type } of credentialPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                    this.violations.push({
                        file: filePath,
                        type: type,
                        matches: matches.length,
                        line: this.findLineNumber(content, matches[0])
                    });
                }
            }
        } catch (error) {
            // Skip files that can't be read
        }
    }

    findLineNumber(content, match) {
        const lines = content.substring(0, content.indexOf(match)).split('\n');
        return lines.length;
    }
}

export default {
    MockS3Client,
    MockLambdaClient,
    MockBedrockClient,
    AWSServiceValidator,
    TestEnvironmentSetup,
    CredentialSecurityValidator
};