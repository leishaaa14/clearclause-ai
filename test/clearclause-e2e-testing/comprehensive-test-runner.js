#!/usr/bin/env node

/**
 * ClearClause End-to-End Comprehensive Test Runner
 * 
 * Main entry point for executing the complete ClearClause E2E testing suite.
 * This script orchestrates all six testing phases with proper dependency management,
 * progress reporting, result aggregation, and comprehensive cleanup.
 * 
 * Usage:
 *   node comprehensive-test-runner.js [--real-services] [--output-file report.json]
 * 
 * Options:
 *   --real-services    Use real AWS services instead of mocks (requires credentials)
 *   --output-file      Specify output file for the final report
 *   --verbose          Enable verbose logging
 *   --phase            Run specific phase only (infrastructure, dataset-processing, etc.)
 */

import { UnifiedTestOrchestrator } from './test-runner.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ComprehensiveTestRunner {
    constructor(options = {}) {
        this.options = {
            useRealServices: false,
            outputFile: null,
            verbose: false,
            specificPhase: null,
            ...options
        };

        this.orchestrator = new UnifiedTestOrchestrator(this.options.useRealServices);
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Main execution method
     */
    async run() {
        this.startTime = new Date();

        try {
            console.log('🚀 ClearClause End-to-End Testing Suite');
            console.log('=====================================');
            console.log(`Start time: ${this.startTime.toISOString()}`);
            console.log(`Using real AWS services: ${this.options.useRealServices ? 'YES' : 'NO'}`);
            console.log(`Verbose logging: ${this.options.verbose ? 'YES' : 'NO'}`);

            if (this.options.specificPhase) {
                console.log(`Running specific phase: ${this.options.specificPhase}`);
            }

            console.log('');

            // Initialize the test orchestrator
            console.log('🔧 Initializing test environment...');
            await this.orchestrator.initialize();

            let executionResult;

            if (this.options.specificPhase) {
                // Run specific phase only
                executionResult = await this.runSpecificPhase(this.options.specificPhase);
            } else {
                // Run all phases
                executionResult = await this.orchestrator.runAllPhases();
            }

            // Generate comprehensive report
            console.log('\n📊 Generating final report...');
            const report = await this.orchestrator.generateFinalReport();

            // Add execution metadata
            this.endTime = new Date();
            report.executionMetadata = {
                startTime: this.startTime.toISOString(),
                endTime: this.endTime.toISOString(),
                totalDuration: this.endTime - this.startTime,
                useRealServices: this.options.useRealServices,
                specificPhase: this.options.specificPhase,
                commandLineOptions: this.options
            };

            // Export report if requested
            if (this.options.outputFile) {
                await this.exportReport(report, this.options.outputFile);
                console.log(`📄 Report exported to: ${this.options.outputFile}`);
            }

            // Display summary
            this.displayExecutionSummary(executionResult, report);

            // Cleanup
            await this.orchestrator.cleanup();

            // Exit with appropriate code
            const exitCode = executionResult.overallSuccess ? 0 : 1;
            console.log(`\n🏁 Test execution completed with exit code: ${exitCode}`);

            return {
                success: executionResult.overallSuccess,
                report,
                exitCode
            };

        } catch (error) {
            console.error('\n💥 Fatal error during test execution:');
            console.error(error.message);

            if (this.options.verbose) {
                console.error('\nStack trace:');
                console.error(error.stack);
            }

            // Attempt cleanup even on failure
            try {
                await this.orchestrator.cleanup();
            } catch (cleanupError) {
                console.error('Additional error during cleanup:', cleanupError.message);
            }

            return {
                success: false,
                error: error.message,
                exitCode: 1
            };
        }
    }

    /**
     * Run a specific test phase
     */
    async runSpecificPhase(phaseName) {
        console.log(`🎯 Running specific phase: ${phaseName}`);

        const phaseMap = {
            'infrastructure': () => this.orchestrator.runInfrastructurePhase(),
            'dataset-processing': () => this.orchestrator.runDatasetProcessingPhase(),
            'raw-text-processing': () => this.orchestrator.runRawTextProcessingPhase(),
            'url-processing': () => this.orchestrator.runURLProcessingPhase(),
            'api-validation': () => this.orchestrator.runAPIValidationPhase(),
            'output-quality': () => this.orchestrator.runOutputQualityPhase()
        };

        const phaseRunner = phaseMap[phaseName];
        if (!phaseRunner) {
            throw new Error(`Unknown phase: ${phaseName}. Available phases: ${Object.keys(phaseMap).join(', ')}`);
        }

        const result = await phaseRunner();

        return {
            overallSuccess: result.success,
            totalDuration: result.duration || 0,
            phasesExecuted: 1,
            phasesSuccessful: result.success ? 1 : 0,
            phasesFailed: result.success ? 0 : 1,
            specificPhase: phaseName,
            phaseResult: result
        };
    }

    /**
     * Export report to file
     */
    async exportReport(report, filePath) {
        try {
            const reportJson = JSON.stringify(report, null, 2);
            writeFileSync(filePath, reportJson, 'utf8');
        } catch (error) {
            console.error(`Failed to export report to ${filePath}:`, error.message);
            throw error;
        }
    }

    /**
     * Display execution summary
     */
    displayExecutionSummary(executionResult, report) {
        console.log('\n📋 EXECUTION SUMMARY');
        console.log('===================');

        const duration = this.endTime - this.startTime;
        const durationSeconds = Math.round(duration / 1000);
        const durationMinutes = Math.round(duration / 60000);

        console.log(`⏱️  Total Duration: ${durationMinutes}m ${durationSeconds % 60}s`);
        console.log(`🎯 Overall Success: ${executionResult.overallSuccess ? '✅ YES' : '❌ NO'}`);

        if (!this.options.specificPhase) {
            console.log(`📊 Phases Executed: ${executionResult.phasesExecuted}`);
            console.log(`✅ Phases Successful: ${executionResult.phasesSuccessful}`);
            console.log(`❌ Phases Failed: ${executionResult.phasesFailed}`);
        }

        // Display feature status summary
        if (report.featureStatus && report.featureStatus.length > 0) {
            console.log('\n🔍 FEATURE STATUS');
            console.log('================');

            report.featureStatus.forEach(feature => {
                const status = feature.working ? '✅' : '❌';
                console.log(`${status} ${feature.featureName}: ${feature.statusMessage}`);
            });
        }

        // Display failed input types
        if (report.inputTypeResults && report.inputTypeResults.some(r => !r.success)) {
            console.log('\n⚠️  FAILED INPUT TYPES');
            console.log('=====================');

            report.inputTypeResults
                .filter(r => !r.success)
                .forEach(result => {
                    console.log(`❌ ${result.inputType}: ${result.errorMessage}`);
                });
        }

        // Display performance metrics
        if (report.performanceMetrics) {
            console.log('\n⚡ PERFORMANCE METRICS');
            console.log('=====================');

            const metrics = report.performanceMetrics;
            if (metrics.averageProcessingTime) {
                console.log(`📈 Average Processing Time: ${Math.round(metrics.averageProcessingTime)}ms`);
            }
            if (metrics.totalAWSCalls) {
                console.log(`☁️  Total AWS Calls: ${metrics.totalAWSCalls}`);
            }
            if (metrics.totalFilesProcessed) {
                console.log(`📁 Files Processed: ${metrics.totalFilesProcessed}`);
            }
        }

        // Display recommendations
        if (report.recommendations && report.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS');
            console.log('==================');

            report.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        }

        console.log('');
    }

    /**
     * Monitor execution progress (for long-running tests)
     */
    startProgressMonitoring() {
        const interval = setInterval(() => {
            const progress = this.orchestrator.getProgress();

            if (progress.currentPhase) {
                console.log(`🔄 Progress: ${progress.progressPercentage}% - ${progress.currentPhase}`);
            }

            if (progress.completedPhases === progress.totalPhases) {
                clearInterval(interval);
            }
        }, 30000); // Update every 30 seconds

        return interval;
    }
}

/**
 * Parse command line arguments
 */
function parseArguments() {
    const args = process.argv.slice(2);
    const options = {
        useRealServices: false,
        outputFile: null,
        verbose: false,
        specificPhase: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--real-services':
                options.useRealServices = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--output-file':
                if (i + 1 < args.length) {
                    options.outputFile = args[++i];
                } else {
                    throw new Error('--output-file requires a filename');
                }
                break;
            case '--phase':
                if (i + 1 < args.length) {
                    options.specificPhase = args[++i];
                } else {
                    throw new Error('--phase requires a phase name');
                }
                break;
            case '--help':
                displayHelp();
                process.exit(0);
                break;
            default:
                if (arg.startsWith('--')) {
                    throw new Error(`Unknown option: ${arg}`);
                }
        }
    }

    return options;
}

/**
 * Display help information
 */
function displayHelp() {
    console.log(`
ClearClause End-to-End Comprehensive Test Runner

Usage: node comprehensive-test-runner.js [options]

Options:
  --real-services     Use real AWS services instead of mocks (requires credentials)
  --output-file FILE  Export final report to specified file
  --verbose          Enable verbose logging and error details
  --phase PHASE      Run specific phase only
  --help             Display this help message

Available Phases:
  infrastructure      AWS connectivity and infrastructure validation
  dataset-processing  Dataset file processing validation
  raw-text-processing Raw text input processing validation
  url-processing      URL content processing validation
  api-validation      API endpoint validation
  output-quality      Output quality and error handling validation

Examples:
  node comprehensive-test-runner.js
  node comprehensive-test-runner.js --real-services --output-file report.json
  node comprehensive-test-runner.js --phase infrastructure --verbose
`);
}

/**
 * Main execution when run as script
 */
async function main() {
    try {
        const options = parseArguments();
        const runner = new ComprehensiveTestRunner(options);

        // Set up process handlers
        process.on('SIGINT', async () => {
            console.log('\n🛑 Received interrupt signal, cleaning up...');
            await runner.orchestrator.cleanup();
            process.exit(130);
        });

        process.on('SIGTERM', async () => {
            console.log('\n🛑 Received termination signal, cleaning up...');
            await runner.orchestrator.cleanup();
            process.exit(143);
        });

        // Run the test suite
        const result = await runner.run();
        process.exit(result.exitCode);

    } catch (error) {
        console.error('💥 Failed to start test runner:', error.message);
        process.exit(1);
    }
}

// Export for programmatic use
export { ComprehensiveTestRunner };

// Run as script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('💥 Unhandled error:', error);
        process.exit(1);
    });
}