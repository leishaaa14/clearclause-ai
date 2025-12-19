/**
 * ClearClause End-to-End Test Runner
 * 
 * Main test orchestrator that runs all six testing phases:
 * 1. Infrastructure Setup and AWS Connectivity Validation
 * 2. Dataset File Processing Validation
 * 3. Raw Text Processing Validation
 * 4. URL Content Processing Validation
 * 5. API Endpoint Validation
 * 6. Output Quality and Error Handling Validation
 * 
 * Implements test phase sequencing, dependency management, progress reporting,
 * result aggregation, and comprehensive cleanup.
 */

import { TestEnvironmentSetup } from './utils/aws-test-utilities.js';
import { TestExecutionReporter } from './utils/TestExecutionReporter.js';
import { AWSConnectivityValidator } from './utils/AWSConnectivityValidator.js';
import { DatasetFileProcessor } from './utils/DatasetFileProcessor.js';
import { InputTypeProcessor } from './utils/InputTypeProcessor.js';
import { APIResponseValidator } from './utils/APIResponseValidator.js';
import { OutputValidator } from './utils/OutputValidator.js';
import { TEST_CONFIG, AWS_CONFIG } from './config/test-config.js';

export class UnifiedTestOrchestrator {
    constructor(useRealServices = false) {
        this.useRealServices = useRealServices;
        this.testEnvironment = new TestEnvironmentSetup();
        this.reporter = new TestExecutionReporter();
        this.startTime = null;
        this.endTime = null;
        this.currentPhase = null;
        this.phaseResults = new Map();
        this.cleanup_handlers = [];

        // Test phase definitions with dependencies
        this.testPhases = [
            {
                id: 'infrastructure',
                name: 'Infrastructure Setup and AWS Connectivity Validation',
                dependencies: [],
                required: true,
                timeout: 60000 // 1 minute
            },
            {
                id: 'dataset-processing',
                name: 'Dataset File Processing Validation',
                dependencies: ['infrastructure'],
                required: true,
                timeout: 300000 // 5 minutes
            },
            {
                id: 'raw-text-processing',
                name: 'Raw Text Processing Validation',
                dependencies: ['infrastructure'],
                required: true,
                timeout: 120000 // 2 minutes
            },
            {
                id: 'url-processing',
                name: 'URL Content Processing Validation',
                dependencies: ['infrastructure'],
                required: true,
                timeout: 180000 // 3 minutes
            },
            {
                id: 'api-validation',
                name: 'API Endpoint Validation',
                dependencies: ['infrastructure', 'dataset-processing', 'raw-text-processing', 'url-processing'],
                required: true,
                timeout: 240000 // 4 minutes
            },
            {
                id: 'output-quality',
                name: 'Output Quality and Error Handling Validation',
                dependencies: ['api-validation'],
                required: true,
                timeout: 180000 // 3 minutes
            }
        ];
    }

    /**
     * Initialize the unified test orchestrator
     */
    async initialize() {
        console.log('🚀 Initializing ClearClause End-to-End Test Orchestrator...');
        this.startTime = new Date();

        try {
            // Initialize test environment
            await this.testEnvironment.initializeMockServices();

            // Initialize test execution reporter
            this.reporter.initialize();

            // Validate test environment
            const validation = await this.testEnvironment.validateTestEnvironment();

            if (!validation.allPassed) {
                throw new Error(`Test environment validation failed: ${validation.failedChecks.join(', ')}`);
            }

            console.log('✅ Test orchestrator initialized successfully');

            // Record initialization
            this.reporter.recordTestPhase('Initialization', 'completed', {
                duration: Date.now() - this.startTime.getTime(),
                testsRun: validation.checks.length,
                testsPassed: validation.checks.filter(c => c.passed).length,
                testsFailed: validation.checks.filter(c => !c.passed).length
            });

            return validation;

        } catch (error) {
            console.error('❌ Test orchestrator initialization failed:', error.message);
            this.reporter.recordTestPhase('Initialization', 'failed', {
                duration: Date.now() - this.startTime.getTime(),
                errorMessages: [error.message]
            });
            throw error;
        }
    }

    /**
     * Run all test phases in sequence with dependency management
     */
    async runAllPhases() {
        console.log('\n📋 Starting comprehensive end-to-end test execution...');
        console.log(`Total phases to execute: ${this.testPhases.length}`);

        const executionOrder = this.calculateExecutionOrder();
        console.log(`Execution order: ${executionOrder.map(p => p.name).join(' → ')}`);

        let overallSuccess = true;

        for (const phase of executionOrder) {
            try {
                console.log(`\n🔄 Starting Phase: ${phase.name}`);
                this.currentPhase = phase;

                // Check dependencies
                const dependenciesOk = this.checkPhaseDependencies(phase);
                if (!dependenciesOk) {
                    throw new Error(`Phase dependencies not satisfied: ${phase.dependencies.join(', ')}`);
                }

                // Record phase start
                this.reporter.recordTestPhase(phase.name, 'started');

                // Execute phase with timeout
                const phaseResult = await this.executePhaseWithTimeout(phase);

                // Record phase completion
                this.phaseResults.set(phase.id, phaseResult);
                this.reporter.recordTestPhase(phase.name, 'completed', {
                    duration: phaseResult.duration,
                    testsRun: phaseResult.testsRun || 0,
                    testsPassed: phaseResult.testsPassed || 0,
                    testsFailed: phaseResult.testsFailed || 0
                });

                console.log(`✅ Phase completed: ${phase.name} (${phaseResult.duration}ms)`);

            } catch (error) {
                console.error(`❌ Phase failed: ${phase.name} - ${error.message}`);

                const failedResult = {
                    success: false,
                    error: error.message,
                    duration: 0,
                    timestamp: new Date().toISOString()
                };

                this.phaseResults.set(phase.id, failedResult);
                this.reporter.recordTestPhase(phase.name, 'failed', {
                    errorMessages: [error.message]
                });

                overallSuccess = false;

                // Stop execution if required phase fails
                if (phase.required) {
                    console.error('💥 Required phase failed, stopping execution');
                    break;
                }
            }
        }

        this.endTime = new Date();
        const totalDuration = this.endTime - this.startTime;

        console.log(`\n📊 Test execution completed in ${Math.round(totalDuration / 1000)}s`);
        console.log(`Overall success: ${overallSuccess ? '✅ YES' : '❌ NO'}`);

        return {
            overallSuccess,
            totalDuration,
            phasesExecuted: this.phaseResults.size,
            phasesSuccessful: Array.from(this.phaseResults.values()).filter(r => r.success).length,
            phasesFailed: Array.from(this.phaseResults.values()).filter(r => !r.success).length
        };
    }

    /**
     * Execute a single test phase with timeout protection
     */
    async executePhaseWithTimeout(phase) {
        const startTime = Date.now();

        return new Promise(async (resolve, reject) => {
            // Set up timeout
            const timeoutId = setTimeout(() => {
                reject(new Error(`Phase timeout after ${phase.timeout}ms`));
            }, phase.timeout);

            try {
                let result;

                switch (phase.id) {
                    case 'infrastructure':
                        result = await this.runInfrastructurePhase();
                        break;
                    case 'dataset-processing':
                        result = await this.runDatasetProcessingPhase();
                        break;
                    case 'raw-text-processing':
                        result = await this.runRawTextProcessingPhase();
                        break;
                    case 'url-processing':
                        result = await this.runURLProcessingPhase();
                        break;
                    case 'api-validation':
                        result = await this.runAPIValidationPhase();
                        break;
                    case 'output-quality':
                        result = await this.runOutputQualityPhase();
                        break;
                    default:
                        throw new Error(`Unknown phase: ${phase.id}`);
                }

                clearTimeout(timeoutId);

                const duration = Date.now() - startTime;
                resolve({
                    ...result,
                    duration,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Phase 1: Infrastructure Setup and AWS Connectivity Validation
     */
    async runInfrastructurePhase() {
        console.log('🏗️  Running infrastructure setup and AWS connectivity validation...');

        const validator = new AWSConnectivityValidator(this.useRealServices);
        const results = await validator.validateAllServices();

        // Record feature status
        this.reporter.recordFeatureStatus(
            'AWS Connectivity',
            results.allServicesAccessible,
            `${results.successfulConnections}/${results.totalServices} services accessible`,
            Object.entries(results.results).map(([service, result]) => ({
                testName: `${service} connectivity`,
                passed: result.status === 'accessible' || result.status === 'secure'
            }))
        );

        return {
            success: results.allServicesAccessible,
            testsRun: results.totalServices,
            testsPassed: results.successfulConnections,
            testsFailed: results.failedConnections,
            details: results
        };
    }

    /**
     * Phase 2: Dataset File Processing Validation
     */
    async runDatasetProcessingPhase() {
        console.log('📁 Running dataset file processing validation...');

        const processor = new DatasetFileProcessor(this.useRealServices);

        // Select representative files from each type
        const fileTypes = ['pdf', 'txt', 'xlsx'];
        const allFiles = [];

        for (const fileType of fileTypes) {
            const files = await processor.selectRepresentativeFiles([fileType], 2);
            allFiles.push(...files);
        }

        // Process files through complete pipeline
        const results = await processor.processFiles(allFiles);

        // Record dataset processing results
        results.forEach(result => {
            this.reporter.recordDatasetProcessing(
                result.fileName || 'unknown',
                result.fileType || 'unknown',
                result.success,
                {
                    fileSize: result.fileSize,
                    extractedTextLength: result.extractedTextLength,
                    processingTime: result.processingTime,
                    errorMessage: result.error
                }
            );

            // Record sample output if successful
            if (result.success && result.analysis) {
                this.reporter.recordSampleOutput(
                    result.fileType || 'unknown',
                    result.analysis,
                    {
                        inputSource: result.fileName || 'dataset',
                        inputSize: result.fileSize,
                        processingTime: result.processingTime
                    }
                );
            }
        });

        const successfulResults = results.filter(r => r.success);

        // Record feature status
        this.reporter.recordFeatureStatus(
            'Dataset File Processing',
            successfulResults.length === results.length,
            `${successfulResults.length}/${results.length} files processed successfully`,
            results.map(r => ({
                testName: `Process ${r.fileName || 'file'}`,
                passed: r.success
            }))
        );

        return {
            success: successfulResults.length === results.length,
            testsRun: results.length,
            testsPassed: successfulResults.length,
            testsFailed: results.length - successfulResults.length,
            details: results
        };
    }

    /**
     * Phase 3: Raw Text Processing Validation
     */
    async runRawTextProcessingPhase() {
        console.log('📝 Running raw text processing validation...');

        const processor = new InputTypeProcessor(this.useRealServices);

        const testTexts = [
            'This agreement shall be governed by the laws of the state. Either party may terminate this agreement with 30 days notice.',
            'The contractor agrees to provide services as outlined in Schedule A. Payment terms are net 30 days. Confidential information shall not be disclosed to third parties without written consent.',
            'Short legal text for testing minimum processing requirements and clause detection accuracy.'
        ];

        const results = [];

        for (const text of testTexts) {
            try {
                const result = await processor.processRawText(text);
                results.push({
                    success: true,
                    textLength: text.length,
                    processingTime: result.processingTime || 0,
                    analysis: result.analysis
                });

                // Record sample output
                if (result.analysis) {
                    this.reporter.recordSampleOutput(
                        'RawText',
                        result.analysis,
                        {
                            inputSource: 'test-text',
                            inputSize: text.length,
                            processingTime: result.processingTime
                        }
                    );
                }

            } catch (error) {
                results.push({
                    success: false,
                    textLength: text.length,
                    error: error.message
                });
            }
        }

        // Record input type result
        const overallSuccess = results.every(r => r.success);
        this.reporter.recordInputTypeResult(
            'RawText',
            overallSuccess,
            overallSuccess ? null : 'Some raw text processing failed',
            {
                processingTime: results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / results.length,
                textLength: results.reduce((sum, r) => sum + r.textLength, 0) / results.length
            }
        );

        // Record feature status
        this.reporter.recordFeatureStatus(
            'Raw Text Processing',
            overallSuccess,
            `${results.filter(r => r.success).length}/${results.length} text samples processed successfully`,
            results.map((r, i) => ({
                testName: `Process text sample ${i + 1}`,
                passed: r.success
            }))
        );

        return {
            success: overallSuccess,
            testsRun: results.length,
            testsPassed: results.filter(r => r.success).length,
            testsFailed: results.filter(r => !r.success).length,
            details: results
        };
    }

    /**
     * Phase 4: URL Content Processing Validation
     */
    async runURLProcessingPhase() {
        console.log('🌐 Running URL content processing validation...');

        const processor = new InputTypeProcessor(this.useRealServices);

        // Use mock URLs for testing
        const testUrls = [
            'https://example.com/legal-document.html',
            'https://example.com/terms-of-service',
            'https://example.com/privacy-policy'
        ];

        const results = [];

        for (const url of testUrls) {
            try {
                const result = await processor.processURLContent(url);
                results.push({
                    success: true,
                    url: url,
                    processingTime: result.processingTime || 0,
                    analysis: result.analysis
                });

                // Record sample output
                if (result.analysis) {
                    this.reporter.recordSampleOutput(
                        'URL',
                        result.analysis,
                        {
                            inputSource: url,
                            inputSize: result.contentLength || 0,
                            processingTime: result.processingTime
                        }
                    );
                }

            } catch (error) {
                results.push({
                    success: false,
                    url: url,
                    error: error.message
                });
            }
        }

        // Record input type result
        const overallSuccess = results.every(r => r.success);
        this.reporter.recordInputTypeResult(
            'URL',
            overallSuccess,
            overallSuccess ? null : 'Some URL processing failed',
            {
                processingTime: results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / results.length
            }
        );

        // Record feature status
        this.reporter.recordFeatureStatus(
            'URL Content Processing',
            overallSuccess,
            `${results.filter(r => r.success).length}/${results.length} URLs processed successfully`,
            results.map((r, i) => ({
                testName: `Process URL ${i + 1}`,
                passed: r.success
            }))
        );

        return {
            success: overallSuccess,
            testsRun: results.length,
            testsPassed: results.filter(r => r.success).length,
            testsFailed: results.filter(r => !r.success).length,
            details: results
        };
    }

    /**
     * Phase 5: API Endpoint Validation
     */
    async runAPIValidationPhase() {
        console.log('🔌 Running API endpoint validation...');

        const validator = new APIResponseValidator(this.useRealServices);

        // Test different API request types
        const testRequests = [
            { type: 'file', content: 'mock-file-data', inputType: 'PDF' },
            { type: 'text', content: 'This is a test legal document for API validation.', inputType: 'RawText' },
            { type: 'url', content: 'https://example.com/legal-doc', inputType: 'URL' }
        ];

        const results = [];

        for (const request of testRequests) {
            try {
                const result = await validator.validateEndpointResponse('/api/process', request);
                results.push({
                    success: result.valid,
                    inputType: request.inputType,
                    processingTime: result.processingTime || 0,
                    responseValid: result.valid,
                    schemaValid: result.schemaValid
                });

            } catch (error) {
                results.push({
                    success: false,
                    inputType: request.inputType,
                    error: error.message
                });

                // Record failed input type
                this.reporter.recordInputTypeResult(
                    request.inputType,
                    false,
                    error.message
                );
            }
        }

        // Record feature status
        const overallSuccess = results.every(r => r.success);
        this.reporter.recordFeatureStatus(
            'API Endpoint Processing',
            overallSuccess,
            `${results.filter(r => r.success).length}/${results.length} API requests processed successfully`,
            results.map(r => ({
                testName: `API ${r.inputType} request`,
                passed: r.success
            }))
        );

        return {
            success: overallSuccess,
            testsRun: results.length,
            testsPassed: results.filter(r => r.success).length,
            testsFailed: results.filter(r => !r.success).length,
            details: results
        };
    }

    /**
     * Phase 6: Output Quality and Error Handling Validation
     */
    async runOutputQualityPhase() {
        console.log('🎯 Running output quality and error handling validation...');

        const validator = new OutputValidator();

        // Test output quality validation
        const mockAnalysisOutputs = [
            {
                summary: 'This is a comprehensive legal document analysis summary that meets minimum length requirements.',
                clauses: [
                    { type: 'termination', text: 'Either party may terminate...', confidence: 0.9 },
                    { type: 'payment', text: 'Payment terms are net 30...', confidence: 0.8 }
                ],
                risks: [
                    { level: 'Medium', description: 'Termination clause risk', explanation: 'Risk explanation', recommendation: 'Review termination terms' }
                ]
            }
        ];

        const results = [];

        for (const output of mockAnalysisOutputs) {
            try {
                const summaryValidation = await validator.validateSummaryQuality(output.summary);
                const clauseValidation = await validator.validateClauseExtraction(output.clauses);
                const riskValidation = await validator.validateRiskAssessment(output.risks);

                const allValid = summaryValidation.valid && clauseValidation.valid && riskValidation.valid;

                results.push({
                    success: allValid,
                    summaryValid: summaryValidation.valid,
                    clausesValid: clauseValidation.valid,
                    risksValid: riskValidation.valid
                });

            } catch (error) {
                results.push({
                    success: false,
                    error: error.message
                });
            }
        }

        // Test error handling
        try {
            // Simulate error conditions
            await validator.validateSummaryQuality(''); // Empty summary
            await validator.validateClauseExtraction([]); // No clauses
            await validator.validateRiskAssessment([]); // No risks

            results.push({
                success: true,
                errorHandlingValid: true
            });

        } catch (error) {
            results.push({
                success: false,
                errorHandlingValid: false,
                error: error.message
            });
        }

        // Record feature status
        const overallSuccess = results.every(r => r.success);
        this.reporter.recordFeatureStatus(
            'Output Quality Validation',
            overallSuccess,
            `${results.filter(r => r.success).length}/${results.length} quality validations passed`,
            results.map((r, i) => ({
                testName: `Quality validation ${i + 1}`,
                passed: r.success
            }))
        );

        this.reporter.recordFeatureStatus(
            'Error Handling',
            overallSuccess,
            'Error handling validation completed',
            [{
                testName: 'Error handling validation',
                passed: overallSuccess
            }]
        );

        return {
            success: overallSuccess,
            testsRun: results.length,
            testsPassed: results.filter(r => r.success).length,
            testsFailed: results.filter(r => !r.success).length,
            details: results
        };
    }

    /**
     * Calculate execution order based on dependencies
     */
    calculateExecutionOrder() {
        const ordered = [];
        const visited = new Set();
        const visiting = new Set();

        const visit = (phase) => {
            if (visiting.has(phase.id)) {
                throw new Error(`Circular dependency detected involving ${phase.id}`);
            }

            if (visited.has(phase.id)) {
                return;
            }

            visiting.add(phase.id);

            // Visit dependencies first
            for (const depId of phase.dependencies) {
                const depPhase = this.testPhases.find(p => p.id === depId);
                if (!depPhase) {
                    throw new Error(`Unknown dependency: ${depId}`);
                }
                visit(depPhase);
            }

            visiting.delete(phase.id);
            visited.add(phase.id);
            ordered.push(phase);
        };

        // Visit all phases
        for (const phase of this.testPhases) {
            visit(phase);
        }

        return ordered;
    }

    /**
     * Check if phase dependencies are satisfied
     */
    checkPhaseDependencies(phase) {
        for (const depId of phase.dependencies) {
            const depResult = this.phaseResults.get(depId);
            if (!depResult || !depResult.success) {
                return false;
            }
        }
        return true;
    }

    /**
     * Generate comprehensive final report
     */
    async generateFinalReport() {
        console.log('\n📋 Generating comprehensive test execution report...');

        const report = await this.reporter.generateFinalReport();

        // Add orchestrator-specific information
        report.orchestratorMetadata = {
            totalPhases: this.testPhases.length,
            phasesExecuted: this.phaseResults.size,
            phasesSuccessful: Array.from(this.phaseResults.values()).filter(r => r.success).length,
            phasesFailed: Array.from(this.phaseResults.values()).filter(r => !r.success).length,
            useRealServices: this.useRealServices,
            executionOrder: this.testPhases.map(p => p.name)
        };

        return report;
    }

    /**
     * Export report to file
     */
    async exportReport(report, filePath) {
        await this.reporter.exportReportToFile(report, filePath);
    }

    /**
     * Comprehensive cleanup of all resources
     */
    async cleanup() {
        console.log('\n🧹 Starting comprehensive cleanup...');

        try {
            // Run custom cleanup handlers
            for (const handler of this.cleanup_handlers) {
                try {
                    await handler();
                } catch (error) {
                    console.warn('Cleanup handler failed:', error.message);
                }
            }

            // Cleanup test environment
            if (this.testEnvironment) {
                await this.testEnvironment.cleanup();
            }

            // Clear reporter data
            if (this.reporter) {
                this.reporter.clear();
            }

            console.log('✅ Cleanup completed successfully');

        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
            throw error;
        }
    }

    /**
     * Add custom cleanup handler
     */
    addCleanupHandler(handler) {
        this.cleanup_handlers.push(handler);
    }

    /**
     * Get current execution progress
     */
    getProgress() {
        const totalPhases = this.testPhases.length;
        const completedPhases = this.phaseResults.size;
        const successfulPhases = Array.from(this.phaseResults.values()).filter(r => r.success).length;

        return {
            totalPhases,
            completedPhases,
            successfulPhases,
            failedPhases: completedPhases - successfulPhases,
            currentPhase: this.currentPhase ? this.currentPhase.name : null,
            progressPercentage: Math.round((completedPhases / totalPhases) * 100)
        };
    }
}

/**
 * Legacy E2ETestRunner for backward compatibility
 */
export class E2ETestRunner {
    constructor() {
        this.orchestrator = new UnifiedTestOrchestrator();
    }

    async initialize() {
        return await this.orchestrator.initialize();
    }

    async runInfrastructureTests() {
        return await this.orchestrator.runInfrastructurePhase();
    }

    async generateReport() {
        return await this.orchestrator.generateFinalReport();
    }

    async cleanup() {
        return await this.orchestrator.cleanup();
    }
}

export default UnifiedTestOrchestrator;