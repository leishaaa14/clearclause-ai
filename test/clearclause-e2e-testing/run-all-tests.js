#!/usr/bin/env node

/**
 * ClearClause E2E Test Suite - Main Integration Script
 * 
 * Simple entry point for running the complete ClearClause end-to-end testing suite.
 * This script provides a unified interface for test execution with proper orchestration,
 * dependency management, and comprehensive reporting.
 * 
 * Features:
 * - Runs all six testing phases in proper dependency order
 * - Provides real-time progress monitoring
 * - Generates comprehensive test reports
 * - Handles cleanup and resource management
 * - Supports both mock and real AWS service testing
 */

import { UnifiedTestOrchestrator } from './test-runner.js';
import { ComprehensiveTestRunner } from './comprehensive-test-runner.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Main test execution orchestrator
 */
class MainTestIntegration {
    constructor() {
        this.useRealServices = process.env.USE_REAL_AWS_SERVICES === 'true';
        this.outputDir = process.env.TEST_OUTPUT_DIR || './test-results';
        this.verbose = process.env.VERBOSE === 'true';

        console.log('🚀 ClearClause E2E Test Suite Integration');
        console.log('=========================================');
        console.log(`Real AWS Services: ${this.useRealServices ? 'ENABLED' : 'DISABLED'}`);
        console.log(`Output Directory: ${this.outputDir}`);
        console.log(`Verbose Mode: ${this.verbose ? 'ENABLED' : 'DISABLED'}`);
        console.log('');
    }

    /**
     * Execute the complete test suite with all phases
     */
    async executeCompleteTestSuite() {
        const startTime = new Date();
        let orchestrator = null;

        try {
            console.log('🔧 Initializing unified test orchestrator...');
            orchestrator = new UnifiedTestOrchestrator(this.useRealServices);

            // Initialize test environment
            await orchestrator.initialize();
            console.log('✅ Test orchestrator initialized successfully\n');

            // Start progress monitoring for long-running tests
            const progressInterval = this.startProgressMonitoring(orchestrator);

            // Execute all test phases
            console.log('🎯 Starting comprehensive test execution...');
            const executionResult = await orchestrator.runAllPhases();

            // Stop progress monitoring
            clearInterval(progressInterval);

            // Generate final comprehensive report
            console.log('\n📊 Generating comprehensive test report...');
            const finalReport = await orchestrator.generateFinalReport();

            // Add integration metadata
            const endTime = new Date();
            finalReport.integrationMetadata = {
                executionStartTime: startTime.toISOString(),
                executionEndTime: endTime.toISOString(),
                totalExecutionTime: endTime - startTime,
                useRealServices: this.useRealServices,
                testSuiteVersion: '1.0.0',
                nodeVersion: process.version,
                platform: process.platform
            };

            // Export reports
            await this.exportReports(finalReport, executionResult);

            // Display final summary
            this.displayFinalSummary(executionResult, finalReport, endTime - startTime);

            // Cleanup resources
            await orchestrator.cleanup();

            return {
                success: executionResult.overallSuccess,
                report: finalReport,
                executionResult
            };

        } catch (error) {
            console.error('\n💥 Test suite execution failed:');
            console.error(`Error: ${error.message}`);

            if (this.verbose && error.stack) {
                console.error('\nStack trace:');
                console.error(error.stack);
            }

            // Attempt cleanup on failure
            if (orchestrator) {
                try {
                    await orchestrator.cleanup();
                } catch (cleanupError) {
                    console.error('Additional cleanup error:', cleanupError.message);
                }
            }

            throw error;
        }
    }

    /**
     * Execute individual test phases for debugging
     */
    async executeIndividualPhases() {
        console.log('🔍 Running individual test phases for detailed analysis...');

        const orchestrator = new UnifiedTestOrchestrator(this.useRealServices);
        await orchestrator.initialize();

        const phases = [
            { name: 'Infrastructure & AWS Connectivity', method: 'runInfrastructurePhase' },
            { name: 'Dataset File Processing', method: 'runDatasetProcessingPhase' },
            { name: 'Raw Text Processing', method: 'runRawTextProcessingPhase' },
            { name: 'URL Content Processing', method: 'runURLProcessingPhase' },
            { name: 'API Endpoint Validation', method: 'runAPIValidationPhase' },
            { name: 'Output Quality & Error Handling', method: 'runOutputQualityPhase' }
        ];

        const results = [];

        for (const phase of phases) {
            try {
                console.log(`\n🔄 Executing: ${phase.name}`);
                const startTime = Date.now();

                const result = await orchestrator[phase.method]();
                const duration = Date.now() - startTime;

                results.push({
                    phaseName: phase.name,
                    success: result.success,
                    duration,
                    details: result
                });

                const status = result.success ? '✅ PASSED' : '❌ FAILED';
                console.log(`${status} ${phase.name} (${Math.round(duration / 1000)}s)`);

            } catch (error) {
                console.error(`❌ FAILED ${phase.name}: ${error.message}`);
                results.push({
                    phaseName: phase.name,
                    success: false,
                    error: error.message,
                    duration: 0
                });
            }
        }

        await orchestrator.cleanup();
        return results;
    }

    /**
     * Start progress monitoring for long-running tests
     */
    startProgressMonitoring(orchestrator) {
        return setInterval(() => {
            const progress = orchestrator.getProgress();

            if (progress.currentPhase) {
                const progressBar = this.createProgressBar(progress.progressPercentage);
                console.log(`🔄 ${progressBar} ${progress.progressPercentage}% - ${progress.currentPhase}`);
            }
        }, 15000); // Update every 15 seconds
    }

    /**
     * Create a simple progress bar
     */
    createProgressBar(percentage) {
        const width = 20;
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
    }

    /**
     * Export comprehensive reports
     */
    async exportReports(finalReport, executionResult) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            // Export detailed JSON report
            const detailedReportPath = join(this.outputDir, `clearclause-e2e-detailed-${timestamp}.json`);
            writeFileSync(detailedReportPath, JSON.stringify(finalReport, null, 2));
            console.log(`📄 Detailed report exported: ${detailedReportPath}`);

            // Export summary report
            const summaryReport = this.createSummaryReport(finalReport, executionResult);
            const summaryReportPath = join(this.outputDir, `clearclause-e2e-summary-${timestamp}.json`);
            writeFileSync(summaryReportPath, JSON.stringify(summaryReport, null, 2));
            console.log(`📄 Summary report exported: ${summaryReportPath}`);

            // Export human-readable report
            const readableReport = this.createReadableReport(finalReport, executionResult);
            const readableReportPath = join(this.outputDir, `clearclause-e2e-report-${timestamp}.md`);
            writeFileSync(readableReportPath, readableReport);
            console.log(`📄 Readable report exported: ${readableReportPath}`);

        } catch (error) {
            console.error('Failed to export reports:', error.message);
        }
    }

    /**
     * Create summary report for quick analysis
     */
    createSummaryReport(finalReport, executionResult) {
        return {
            overallSuccess: executionResult.overallSuccess,
            executionTime: finalReport.integrationMetadata?.totalExecutionTime || 0,
            phasesExecuted: executionResult.phasesExecuted,
            phasesSuccessful: executionResult.phasesSuccessful,
            phasesFailed: executionResult.phasesFailed,
            featuresWorking: finalReport.featureStatus?.filter(f => f.working).length || 0,
            featuresFailed: finalReport.featureStatus?.filter(f => !f.working).length || 0,
            inputTypesWorking: finalReport.inputTypeResults?.filter(r => r.success).length || 0,
            inputTypesFailed: finalReport.inputTypeResults?.filter(r => !r.success).length || 0,
            totalRecommendations: finalReport.recommendations?.length || 0,
            useRealServices: finalReport.integrationMetadata?.useRealServices || false
        };
    }

    /**
     * Create human-readable markdown report
     */
    createReadableReport(finalReport, executionResult) {
        const timestamp = new Date().toISOString();

        return `# ClearClause End-to-End Test Report

**Generated:** ${timestamp}
**Overall Success:** ${executionResult.overallSuccess ? '✅ PASSED' : '❌ FAILED'}
**Execution Time:** ${Math.round((finalReport.integrationMetadata?.totalExecutionTime || 0) / 1000)}s
**Real AWS Services:** ${finalReport.integrationMetadata?.useRealServices ? 'Yes' : 'No'}

## Phase Results

| Phase | Status | Tests Run | Passed | Failed |
|-------|--------|-----------|--------|--------|
${this.generatePhaseTable(executionResult)}

## Feature Status

${finalReport.featureStatus?.map(f =>
            `- ${f.working ? '✅' : '❌'} **${f.featureName}**: ${f.statusMessage}`
        ).join('\n') || 'No feature status available'}

## Input Type Results

${finalReport.inputTypeResults?.map(r =>
            `- ${r.success ? '✅' : '❌'} **${r.inputType}**: ${r.success ? 'Working' : r.errorMessage}`
        ).join('\n') || 'No input type results available'}

## Recommendations

${finalReport.recommendations?.map((rec, i) =>
            `${i + 1}. ${rec}`
        ).join('\n') || 'No recommendations'}

## Performance Metrics

- **Average Processing Time:** ${finalReport.performanceMetrics?.averageProcessingTime || 'N/A'}ms
- **Total AWS Calls:** ${finalReport.performanceMetrics?.totalAWSCalls || 'N/A'}
- **Files Processed:** ${finalReport.performanceMetrics?.totalFilesProcessed || 'N/A'}

---
*Report generated by ClearClause E2E Test Suite v1.0.0*
`;
    }

    /**
     * Generate phase results table for markdown report
     */
    generatePhaseTable(executionResult) {
        // This would need to be populated from actual phase results
        // For now, return a placeholder
        return `| All Phases | ${executionResult.overallSuccess ? 'PASSED' : 'FAILED'} | ${executionResult.phasesExecuted} | ${executionResult.phasesSuccessful} | ${executionResult.phasesFailed} |`;
    }

    /**
     * Display final execution summary
     */
    displayFinalSummary(executionResult, finalReport, totalDuration) {
        console.log('\n🏁 FINAL EXECUTION SUMMARY');
        console.log('==========================');

        const durationMinutes = Math.round(totalDuration / 60000);
        const durationSeconds = Math.round((totalDuration % 60000) / 1000);

        console.log(`⏱️  Total Duration: ${durationMinutes}m ${durationSeconds}s`);
        console.log(`🎯 Overall Success: ${executionResult.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`📊 Phases: ${executionResult.phasesSuccessful}/${executionResult.phasesExecuted} successful`);

        if (finalReport.featureStatus && Array.isArray(finalReport.featureStatus)) {
            const workingFeatures = finalReport.featureStatus.filter(f => f.working).length;
            const totalFeatures = finalReport.featureStatus.length;
            console.log(`🔧 Features: ${workingFeatures}/${totalFeatures} working`);
        }

        if (finalReport.inputTypeResults && Array.isArray(finalReport.inputTypeResults)) {
            const workingInputs = finalReport.inputTypeResults.filter(r => r.success).length;
            const totalInputs = finalReport.inputTypeResults.length;
            console.log(`📝 Input Types: ${workingInputs}/${totalInputs} working`);
        }

        if (finalReport.recommendations && finalReport.recommendations.length > 0) {
            console.log(`💡 Recommendations: ${finalReport.recommendations.length} items`);
        }

        console.log('');
    }
}

/**
 * Main execution function
 */
async function main() {
    const integration = new MainTestIntegration();

    try {
        // Check if running individual phases for debugging
        const runIndividual = process.env.RUN_INDIVIDUAL_PHASES === 'true';

        if (runIndividual) {
            console.log('🔍 Running individual phases for debugging...');
            const results = await integration.executeIndividualPhases();

            console.log('\n📋 Individual Phase Results:');
            results.forEach(result => {
                const status = result.success ? '✅' : '❌';
                console.log(`${status} ${result.phaseName} (${Math.round(result.duration / 1000)}s)`);
            });

            const allPassed = results.every(r => r.success);
            process.exit(allPassed ? 0 : 1);

        } else {
            // Run complete test suite
            const result = await integration.executeCompleteTestSuite();
            process.exit(result.success ? 0 : 1);
        }

    } catch (error) {
        console.error('\n💥 Test integration failed:', error.message);
        process.exit(1);
    }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received interrupt signal, shutting down...');
    process.exit(130);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received termination signal, shutting down...');
    process.exit(143);
});

// Run if called directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
    main().catch(error => {
        console.error('💥 Unhandled error in main:', error);
        process.exit(1);
    });
}

export { MainTestIntegration };