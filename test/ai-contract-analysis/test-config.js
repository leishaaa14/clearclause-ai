// Test Configuration for AI Contract Analysis
// Centralizes test settings, timeouts, and property-based testing parameters

import * as fc from 'fast-check';

/**
 * Global test configuration
 */
export const TestConfig = {
    // Property-based testing settings
    propertyTesting: {
        numRuns: 100, // Minimum 100 iterations as specified in design
        timeout: 30000, // 30 seconds per property test
        verbose: false,
        seed: undefined, // Use random seed unless specified
        path: [], // Path for shrinking
        endOnFailure: false,
        skipAllAfterTimeLimit: 60000, // Skip remaining tests after 1 minute
        interruptAfterTimeLimit: 120000, // Interrupt after 2 minutes
        markInterruptAsFailure: false
    },

    // Integration test settings
    integration: {
        timeout: 45000, // 45 seconds for integration tests
        concurrentLimit: 5, // Maximum concurrent operations
        retryAttempts: 2,
        cleanupTimeout: 5000
    },

    // Performance test settings
    performance: {
        timeout: 180000, // 3 minutes for performance tests
        warmupRuns: 2,
        measurementRuns: 5,
        memoryThreshold: 100, // MB
        processingTimeThreshold: 30000, // 30 seconds
        throughputThreshold: 0.1 // contracts per second
    },

    // Mock data settings
    mockData: {
        contractMinLength: 100,
        contractMaxLength: 10000,
        clauseMinLength: 20,
        clauseMaxLength: 500,
        riskMinLength: 50,
        riskMaxLength: 300
    },

    // Validation settings
    validation: {
        strictMode: true,
        validateSchema: true,
        validateRanges: true,
        validateReferences: true
    }
};

/**
 * Fast-check configuration for consistent property testing
 */
export const FastCheckConfig = {
    // Base configuration for all property tests
    base: {
        numRuns: TestConfig.propertyTesting.numRuns,
        timeout: TestConfig.propertyTesting.timeout,
        verbose: TestConfig.propertyTesting.verbose,
        seed: TestConfig.propertyTesting.seed,
        path: TestConfig.propertyTesting.path,
        endOnFailure: TestConfig.propertyTesting.endOnFailure,
        skipAllAfterTimeLimit: TestConfig.propertyTesting.skipAllAfterTimeLimit,
        interruptAfterTimeLimit: TestConfig.propertyTesting.interruptAfterTimeLimit,
        markInterruptAsFailure: TestConfig.propertyTesting.markInterruptAsFailure
    },

    // Configuration for quick tests (fewer runs)
    quick: {
        numRuns: 25,
        timeout: 10000,
        verbose: false
    },

    // Configuration for thorough tests (more runs)
    thorough: {
        numRuns: 500,
        timeout: 60000,
        verbose: true
    },

    // Configuration for stress tests
    stress: {
        numRuns: 1000,
        timeout: 120000,
        verbose: true,
        skipAllAfterTimeLimit: 300000 // 5 minutes
    }
};

/**
 * Test data size configurations
 */
export const TestDataSizes = {
    small: {
        contractLength: { min: 100, max: 500 },
        numClauses: { min: 1, max: 3 },
        numRisks: { min: 0, max: 2 },
        numRecommendations: { min: 0, max: 2 }
    },
    medium: {
        contractLength: { min: 500, max: 2000 },
        numClauses: { min: 3, max: 8 },
        numRisks: { min: 1, max: 5 },
        numRecommendations: { min: 1, max: 4 }
    },
    large: {
        contractLength: { min: 2000, max: 10000 },
        numClauses: { min: 8, max: 20 },
        numRisks: { min: 3, max: 15 },
        numRecommendations: { min: 2, max: 10 }
    },
    xlarge: {
        contractLength: { min: 10000, max: 50000 },
        numClauses: { min: 20, max: 100 },
        numRisks: { min: 10, max: 50 },
        numRecommendations: { min: 5, max: 25 }
    }
};

/**
 * Expected performance benchmarks
 */
export const PerformanceBenchmarks = {
    processing: {
        small: { maxTime: 5000, minThroughput: 1.0 }, // 5 seconds, 1 contract/sec
        medium: { maxTime: 15000, minThroughput: 0.5 }, // 15 seconds, 0.5 contracts/sec
        large: { maxTime: 30000, minThroughput: 0.2 }, // 30 seconds, 0.2 contracts/sec
        xlarge: { maxTime: 60000, minThroughput: 0.1 } // 60 seconds, 0.1 contracts/sec
    },
    memory: {
        maxIncrease: 100, // MB
        maxRetained: 20, // MB after cleanup
        leakThreshold: 5 // MB per operation
    },
    concurrency: {
        maxConcurrent: 10,
        timeoutMultiplier: 2.0, // Multiply base timeout for concurrent tests
        degradationThreshold: 0.5 // Acceptable performance degradation
    }
};

/**
 * Error simulation configurations
 */
export const ErrorSimulation = {
    networkErrors: [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNRESET'
    ],
    apiErrors: [
        { status: 429, message: 'Rate limit exceeded' },
        { status: 500, message: 'Internal server error' },
        { status: 503, message: 'Service unavailable' },
        { status: 401, message: 'Unauthorized' }
    ],
    modelErrors: [
        'Model not loaded',
        'Insufficient memory',
        'Invalid input format',
        'Context length exceeded'
    ],
    parsingErrors: [
        'Unsupported file format',
        'Corrupted file',
        'Empty document',
        'Encoding error'
    ]
};

/**
 * Validation schemas for test data
 */
export const ValidationSchemas = {
    contract: {
        required: ['text'],
        optional: ['metadata', 'type', 'filename'],
        textMinLength: 50,
        textMaxLength: 100000
    },

    analysisOutput: {
        required: ['summary', 'clauses', 'risks', 'recommendations', 'metadata'],
        summary: {
            required: ['title', 'documentType', 'totalClauses', 'riskScore', 'confidence'],
            ranges: {
                riskScore: { min: 0, max: 1 },
                confidence: { min: 0, max: 1 },
                totalClauses: { min: 0, max: 1000 }
            }
        },
        clause: {
            required: ['id', 'text', 'type', 'category', 'confidence'],
            ranges: {
                confidence: { min: 0, max: 1 }
            }
        },
        risk: {
            required: ['id', 'title', 'description', 'severity', 'category', 'confidence'],
            enums: {
                severity: ['Low', 'Medium', 'High', 'Critical']
            },
            ranges: {
                confidence: { min: 0, max: 1 }
            }
        },
        recommendation: {
            required: ['id', 'title', 'description', 'priority', 'category'],
            enums: {
                priority: ['Low', 'Medium', 'High']
            }
        }
    }
};

/**
 * Test environment detection and configuration
 */
export const TestEnvironment = {
    isCI: process.env.CI === 'true',
    isLocal: !process.env.CI,
    hasGPU: process.env.CUDA_VISIBLE_DEVICES !== undefined,
    nodeVersion: process.version,

    // Adjust test parameters based on environment
    getConfig() {
        if (this.isCI) {
            return {
                ...TestConfig,
                propertyTesting: {
                    ...TestConfig.propertyTesting,
                    numRuns: 50, // Fewer runs in CI
                    timeout: 20000 // Shorter timeout in CI
                },
                performance: {
                    ...TestConfig.performance,
                    timeout: 120000, // Shorter performance test timeout
                    measurementRuns: 3 // Fewer measurement runs
                }
            };
        }

        return TestConfig;
    }
};

/**
 * Utility functions for test configuration
 */
export class TestConfigUtils {
    /**
     * Get fast-check configuration for specific test type
     */
    static getFastCheckConfig(testType = 'base') {
        const config = FastCheckConfig[testType] || FastCheckConfig.base;

        // Adjust for CI environment
        if (TestEnvironment.isCI) {
            return {
                ...config,
                numRuns: Math.min(config.numRuns, 50),
                timeout: Math.min(config.timeout, 20000)
            };
        }

        return config;
    }

    /**
     * Get performance benchmark for specific size
     */
    static getPerformanceBenchmark(size = 'medium') {
        return PerformanceBenchmarks.processing[size] || PerformanceBenchmarks.processing.medium;
    }

    /**
     * Get test data size configuration
     */
    static getTestDataSize(size = 'medium') {
        return TestDataSizes[size] || TestDataSizes.medium;
    }

    /**
     * Create timeout for specific test type
     */
    static getTimeout(testType = 'unit') {
        const timeouts = {
            unit: 5000,
            integration: TestConfig.integration.timeout,
            performance: TestConfig.performance.timeout,
            property: TestConfig.propertyTesting.timeout,
            stress: 300000 // 5 minutes
        };

        let timeout = timeouts[testType] || timeouts.unit;

        // Increase timeout in CI
        if (TestEnvironment.isCI) {
            timeout *= 1.5;
        }

        return timeout;
    }

    /**
     * Validate test configuration
     */
    static validateConfig() {
        const errors = [];

        if (TestConfig.propertyTesting.numRuns < 1) {
            errors.push('Property testing numRuns must be at least 1');
        }

        if (TestConfig.propertyTesting.timeout < 1000) {
            errors.push('Property testing timeout must be at least 1000ms');
        }

        if (TestConfig.performance.processingTimeThreshold < 1000) {
            errors.push('Performance processing time threshold must be at least 1000ms');
        }

        if (errors.length > 0) {
            throw new Error(`Test configuration validation failed:\n${errors.join('\n')}`);
        }

        return true;
    }
}

// Validate configuration on import
TestConfigUtils.validateConfig();

export default TestConfig;