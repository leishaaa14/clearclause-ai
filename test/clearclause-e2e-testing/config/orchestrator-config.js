/**
 * Unified Test Orchestrator Configuration
 * 
 * Central configuration for the ClearClause E2E test orchestrator,
 * including phase definitions, timeouts, dependencies, and execution settings.
 */

export const ORCHESTRATOR_CONFIG = {
    // Test execution settings
    execution: {
        defaultTimeout: 300000, // 5 minutes default timeout
        progressUpdateInterval: 15000, // 15 seconds
        maxRetries: 2,
        parallelExecution: false, // Sequential execution for dependency management
        failFast: true, // Stop on first required phase failure
        cleanupOnFailure: true
    },

    // Test phase definitions with dependencies and configuration
    phases: [
        {
            id: 'infrastructure',
            name: 'Infrastructure Setup and AWS Connectivity Validation',
            description: 'Validates AWS service connectivity and test environment setup',
            dependencies: [],
            required: true,
            timeout: 60000, // 1 minute
            retries: 3,
            category: 'setup'
        },
        {
            id: 'dataset-processing',
            name: 'Dataset File Processing Validation',
            description: 'Tests file processing pipeline with representative dataset files',
            dependencies: ['infrastructure'],
            required: true,
            timeout: 300000, // 5 minutes
            retries: 2,
            category: 'processing'
        },
        {
            id: 'raw-text-processing',
            name: 'Raw Text Processing Validation',
            description: 'Validates raw text input processing and analysis',
            dependencies: ['infrastructure'],
            required: true,
            timeout: 120000, // 2 minutes
            retries: 2,
            category: 'processing'
        },
        {
            id: 'url-processing',
            name: 'URL Content Processing Validation',
            description: 'Tests URL fetching and content analysis pipeline',
            dependencies: ['infrastructure'],
            required: true,
            timeout: 180000, // 3 minutes
            retries: 2,
            category: 'processing'
        },
        {
            id: 'api-validation',
            name: 'API Endpoint Validation',
            description: 'Validates API endpoints and response schemas',
            dependencies: ['infrastructure', 'dataset-processing', 'raw-text-processing', 'url-processing'],
            required: true,
            timeout: 240000, // 4 minutes
            retries: 2,
            category: 'integration'
        },
        {
            id: 'output-quality',
            name: 'Output Quality and Error Handling Validation',
            description: 'Tests output quality validation and error handling mechanisms',
            dependencies: ['api-validation'],
            required: true,
            timeout: 180000, // 3 minutes
            retries: 2,
            category: 'validation'
        }
    ],

    // Resource management settings
    resources: {
        maxConcurrentTests: 5,
        memoryLimitMB: 1024,
        tempFileCleanup: true,
        logRetentionDays: 7
    },

    // Reporting configuration
    reporting: {
        generateDetailedReport: true,
        generateSummaryReport: true,
        generateReadableReport: true,
        includePerformanceMetrics: true,
        includeDebugInfo: false, // Set to true for debugging
        exportFormats: ['json', 'markdown'],
        timestampFormat: 'ISO'
    },

    // AWS service configuration for testing
    awsServices: {
        s3: {
            bucketName: 'impactxaws-docs',
            testPrefix: 'e2e-test/',
            cleanupAfterTest: true
        },
        textract: {
            lambdaName: 'ClearClause_TextractOCR',
            maxDocumentSize: 10485760, // 10MB
            supportedFormats: ['pdf', 'png', 'jpg', 'jpeg']
        },
        urlFetcher: {
            lambdaName: 'ClearClause_URLFetcher',
            timeout: 30000,
            maxContentSize: 5242880 // 5MB
        },
        bedrock: {
            modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
            maxTokens: 4096,
            temperature: 0.1
        }
    },

    // Test data configuration
    testData: {
        datasetPath: './archive',
        sampleSize: {
            pdf: 2,
            image: 2,
            excel: 2,
            text: 3,
            url: 3
        },
        mockData: {
            generateSynthetic: true,
            useRealFiles: true,
            maxFileSize: 5242880 // 5MB
        }
    },

    // Performance thresholds
    performance: {
        maxProcessingTime: {
            pdf: 30000, // 30 seconds
            image: 20000, // 20 seconds
            excel: 15000, // 15 seconds
            text: 5000, // 5 seconds
            url: 25000 // 25 seconds
        },
        maxMemoryUsage: 512, // MB
        maxConcurrentRequests: 10
    },

    // Error handling configuration
    errorHandling: {
        logErrors: true,
        includeStackTrace: false, // Set to true for debugging
        retryOnTransientErrors: true,
        transientErrorCodes: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
        maxErrorsBeforeAbort: 5
    },

    // Security settings
    security: {
        validateCredentials: true,
        scanForCredentialExposure: true,
        enforceBackendOnly: true,
        logSecurityEvents: true
    }
};

/**
 * Get phase configuration by ID
 */
export function getPhaseConfig(phaseId) {
    return ORCHESTRATOR_CONFIG.phases.find(phase => phase.id === phaseId);
}

/**
 * Get phases by category
 */
export function getPhasesByCategory(category) {
    return ORCHESTRATOR_CONFIG.phases.filter(phase => phase.category === category);
}

/**
 * Get execution order based on dependencies
 */
export function calculateExecutionOrder() {
    const phases = [...ORCHESTRATOR_CONFIG.phases];
    const ordered = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(phase) {
        if (visiting.has(phase.id)) {
            throw new Error(`Circular dependency detected involving ${phase.id}`);
        }

        if (visited.has(phase.id)) {
            return;
        }

        visiting.add(phase.id);

        // Visit dependencies first
        for (const depId of phase.dependencies) {
            const depPhase = phases.find(p => p.id === depId);
            if (!depPhase) {
                throw new Error(`Unknown dependency: ${depId} for phase ${phase.id}`);
            }
            visit(depPhase);
        }

        visiting.delete(phase.id);
        visited.add(phase.id);
        ordered.push(phase);
    }

    // Visit all phases
    for (const phase of phases) {
        visit(phase);
    }

    return ordered;
}

/**
 * Validate orchestrator configuration
 */
export function validateConfig() {
    const errors = [];

    // Validate phases
    for (const phase of ORCHESTRATOR_CONFIG.phases) {
        if (!phase.id || !phase.name) {
            errors.push(`Phase missing required fields: ${JSON.stringify(phase)}`);
        }

        if (phase.timeout && phase.timeout < 1000) {
            errors.push(`Phase ${phase.id} timeout too low: ${phase.timeout}ms`);
        }

        // Validate dependencies exist
        for (const depId of phase.dependencies || []) {
            const depExists = ORCHESTRATOR_CONFIG.phases.some(p => p.id === depId);
            if (!depExists) {
                errors.push(`Phase ${phase.id} has unknown dependency: ${depId}`);
            }
        }
    }

    // Validate execution order (check for circular dependencies)
    try {
        calculateExecutionOrder();
    } catch (error) {
        errors.push(`Execution order validation failed: ${error.message}`);
    }

    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return true;
}

// Validate configuration on import
validateConfig();

export default ORCHESTRATOR_CONFIG;