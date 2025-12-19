/**
 * ClearClause End-to-End Testing Configuration
 * 
 * This configuration file defines AWS service endpoints, credentials,
 * and testing parameters for comprehensive end-to-end testing.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const AWS_CONFIG = {
    // AWS Service Configuration
    region: process.env.VITE_AWS_REGION || 'us-east-1',
    s3Bucket: process.env.VITE_S3_BUCKET || 'impactxaws-docs',
    textractLambda: process.env.VITE_TEXTRACT_LAMBDA || 'ClearClause_TextractOCR',
    urlFetcherLambda: process.env.VITE_URL_LAMBDA || 'ClearClause_URLFetcher',
    bedrockModel: process.env.VITE_BEDROCK_MODEL || 'anthropic.claude-3-sonnet-20240229-v1:0',

    // Credentials (backend-only access)
    credentials: {
        accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY
    }
};

export const TEST_CONFIG = {
    // Test execution parameters
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second

    // Property-based testing configuration
    propertyTestIterations: 100,

    // File processing limits
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedFileTypes: ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'xls'],

    // Dataset configuration
    datasetPath: './archive/CUAD_v1',
    sampleFileCount: 5, // Number of files to test per type

    // API endpoint configuration
    apiEndpoint: '/api/process',
    baseUrl: 'http://localhost:3000'
};

export const VALIDATION_THRESHOLDS = {
    // Output quality thresholds
    minimumSummaryLength: 50,
    minimumClauseCount: 1,
    minimumRiskCount: 1,

    // Processing time thresholds (milliseconds)
    maxProcessingTime: {
        rawText: 10000,    // 10 seconds
        smallFile: 30000,  // 30 seconds
        largeFile: 60000   // 60 seconds
    },

    // Confidence score thresholds
    minimumTextractConfidence: 0.7,
    minimumClauseConfidence: 0.5
};

export const SECURITY_CONFIG = {
    // Security validation parameters
    credentialPatterns: [
        /AKIA[0-9A-Z]{16}/g,  // AWS Access Key ID pattern
        /[A-Za-z0-9/+=]{40}/g  // AWS Secret Access Key pattern
    ],

    // Directories to scan for credential exposure
    scanDirectories: ['src', 'public', 'dist'],

    // Files to exclude from credential scanning
    excludeFiles: ['.env', 'test-config.js', '*.log']
};

export default {
    AWS_CONFIG,
    TEST_CONFIG,
    VALIDATION_THRESHOLDS,
    SECURITY_CONFIG
};