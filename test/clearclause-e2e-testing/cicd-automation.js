#!/usr/bin/env node

/**
 * ClearClause End-to-End Testing CI/CD Automation Script
 * 
 * This script provides automated test execution, environment configuration,
 * scheduling, notification, and artifact management for continuous integration
 * and deployment pipelines.
 * 
 * Usage:
 *   node cicd-automation.js [options]
 * 
 * Options:
 *   --environment <env>     Target environment (ci, staging, production)
 *   --real-services         Use real AWS services instead of mocks
 *   --schedule <cron>       Schedule automated execution (cron format)
 *   --notify                Enable result notifications
 *   --retention <days>      Artifact retention period in days
 *   --export <path>         Export artifacts to specified path
 *   --cleanup               Run artifact cleanup only
 *   --help                  Show help information
 */

import { TestEnvironmentManager } from './utils/TestEnvironmentManager.js';
import fs from 'fs/promises';
import path from 'path';

class CICDAutomation {
    constructor() {
        this.integration = null;
        this.environmentManager = new TestEnvironmentManager();
        this.options = this.parseCommandLineArgs();
    }

    /**
     * Parse command line arguments
     */
    parseCommandLineArgs() {
        const args = process.argv.slice(2);
        const options = {
            environment: 'ci',
            useRealServices: false,
            schedule: null,
            notificationEnabled: false,
            artifactRetention: 30,
            exportPath: null,
            cleanupOnly: false,
            showHelp: false
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            switch (arg) {
                case '--environment':
                    options.environment = args[++i];
                    break;
                case '--real-services':
                    options.useRealServices = true;
                    break;
                case '--schedule':
                    options.schedule = args[++i];
                    break;
                case '--notify':
                    options.notificationEnabled = true;
                    break;
                case '--retention':
                    options.artifactRetention = parseInt(args[++i]);
                    break;
                case '--export':
                    options.exportPath = args[++i];
                    break;
                case '--cleanup':
                    options.cleanupOnly = true;
                    break;
                case '--help':
                    options.showHelp = true;
                    break;
                default:
                    console.warn(`⚠️  Unknown option: ${arg}`);
            }
        }

        return options;
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log(`
ClearClause End-to-End Testing CI/CD Automation

Usage: node cicd-automation.js [options]

Options:
  --environment <env>     Target environment (ci, staging, production) [default: ci]
  --real-services         Use real AWS services instead of mocks [default: false]
  --schedule <cron>       Schedule automated execution (cron format)
  --notify                Enable result notifications [default: false]
  --retention <days>      Artifact retention period in days [default: 30]
  --export <path>         Export artifacts to specified path
  --cleanup               Run artifact cleanup only
  --help                  Show this help information

Examples:
  # Run tests in CI environment with mocks
  node cicd-automation.js --environment ci

  # Run tests with real AWS services and notifications
  node cicd-automation.js --environment staging --real-services --notify

  # Schedule daily test execution at 2 AM
  node cicd-automation.js --schedule "0 2 * * *" --notify

  # Export artifacts and cleanup old ones
  node cicd-automation.js --export ./exports --cleanup --retention 7

  # Production test run with full configuration
  node cicd-automation.js --environment production --real-services --notify --retention 90

Environment Variables:
  CI_ENVIRONMENT          Override environment setting
  CI_USE_REAL_SERVICES    Use real services (true/false)
  CI_NOTIFICATION_ENABLED Enable notifications (true/false)
  CI_ARTIFACT_RETENTION   Artifact retention days
  CI_EXPORT_PATH          Default export path
        `);
    }

    /**
     * Apply environment variable overrides
     */
    applyEnvironmentOverrides() {
        if (process.env.CI_ENVIRONMENT) {
            this.options.environment = process.env.CI_ENVIRONMENT;
        }

        if (process.env.CI_USE_REAL_SERVICES === 'true') {
            this.options.useRealServices = true;
        }

        if (process.env.CI_NOTIFICATION_ENABLED === 'true') {
            this.options.notificationEnabled = true;
        }

        if (process.env.CI_ARTIFACT_RETENTION) {
            this.options.artifactRetention = parseInt(process.env.CI_ARTIFACT_RETENTION);
        }

        if (process.env.CI_EXPORT_PATH) {
            this.options.exportPath = process.env.CI_EXPORT_PATH;
        }
    }

    /**
     * Initialize CI/CD automation
     */
    async initialize() {
        console.log('🚀 Initializing ClearClause CI/CD Automation...');

        // Apply environment overrides
        this.applyEnvironmentOverrides();

        // Lazy load CICDIntegration to avoid vitest import issues
        const { CICDIntegration } = await import('./utils/CICDIntegration.js');

        // Create CI/CD integration instance
        this.integration = new CICDIntegration(this.options);

        // Initialize integration
        await this.integration.initialize();

        // Configure test environment
        await this.environmentManager.configureEnvironment(this.options.environment);

        console.log(`✅ CI/CD automation initialized for environment: ${this.options.environment}`);
        console.log(`📊 Configuration: ${JSON.stringify(this.options, null, 2)}`);
    }

    /**
     * Execute automated test suite
     */
    async executeTests() {
        console.log('🔄 Starting automated test execution...');

        try {
            const result = await this.integration.executeAutomatedTests();

            console.log(`✅ Test execution completed: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
            console.log(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);
            console.log(`📁 Artifacts: ${result.artifactPath}`);

            return result;

        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            throw error;
        }
    }

    /**
     * Schedule automated test execution
     */
    async scheduleExecution() {
        if (!this.options.schedule) {
            console.log('⏭️  No schedule specified, skipping scheduling');
            return;
        }

        console.log(`📅 Scheduling test execution: ${this.options.schedule}`);

        const scheduleConfig = await this.integration.scheduleExecution(this.options.schedule);

        console.log('✅ Test execution scheduled successfully');
        console.log(`📋 Schedule configuration saved`);

        return scheduleConfig;
    }

    /**
     * Export test artifacts
     */
    async exportArtifacts() {
        if (!this.options.exportPath) {
            console.log('⏭️  No export path specified, skipping export');
            return;
        }

        console.log(`📦 Exporting artifacts to: ${this.options.exportPath}`);

        const exportedPath = await this.integration.exportArtifacts(this.options.exportPath);

        console.log(`✅ Artifacts exported to: ${exportedPath}`);
        return exportedPath;
    }

    /**
     * Cleanup old artifacts
     */
    async cleanupArtifacts() {
        console.log('🗂️  Running artifact cleanup...');

        const result = await this.integration.manageArtifactRetention();

        console.log(`✅ Cleanup completed: ${result.deletedCount} old artifacts removed`);
        console.log(`📅 Retention period: ${result.retentionDays} days`);

        return result;
    }

    /**
     * Generate CI/CD status report
     */
    async generateStatusReport() {
        console.log('📊 Generating CI/CD status report...');

        const status = this.integration.getExecutionStatus();
        const environmentStatus = await this.environmentManager.getEnvironmentStatus();

        const report = {
            timestamp: new Date().toISOString(),
            execution: status,
            environment: environmentStatus,
            configuration: this.options,
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                memory: process.memoryUsage(),
                uptime: process.uptime()
            }
        };

        // Save status report
        const reportPath = path.join('test-artifacts', 'cicd-status-report.json');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log(`📋 Status report saved to: ${reportPath}`);
        return report;
    }

    /**
     * Run complete CI/CD workflow
     */
    async runWorkflow() {
        console.log('🔄 Starting complete CI/CD workflow...');

        const workflow = {
            startTime: Date.now(),
            steps: [],
            success: false,
            error: null
        };

        try {
            // Step 1: Initialize
            workflow.steps.push({ step: 'initialize', status: 'running', startTime: Date.now() });
            await this.initialize();
            workflow.steps[workflow.steps.length - 1].status = 'completed';
            workflow.steps[workflow.steps.length - 1].duration = Date.now() - workflow.steps[workflow.steps.length - 1].startTime;

            // Step 2: Execute tests (unless cleanup only)
            if (!this.options.cleanupOnly) {
                workflow.steps.push({ step: 'execute_tests', status: 'running', startTime: Date.now() });
                const testResult = await this.executeTests();
                workflow.steps[workflow.steps.length - 1].status = testResult.success ? 'completed' : 'failed';
                workflow.steps[workflow.steps.length - 1].duration = Date.now() - workflow.steps[workflow.steps.length - 1].startTime;
                workflow.steps[workflow.steps.length - 1].result = testResult;
            }

            // Step 3: Schedule execution (if specified)
            if (this.options.schedule) {
                workflow.steps.push({ step: 'schedule', status: 'running', startTime: Date.now() });
                await this.scheduleExecution();
                workflow.steps[workflow.steps.length - 1].status = 'completed';
                workflow.steps[workflow.steps.length - 1].duration = Date.now() - workflow.steps[workflow.steps.length - 1].startTime;
            }

            // Step 4: Export artifacts (if specified)
            if (this.options.exportPath) {
                workflow.steps.push({ step: 'export', status: 'running', startTime: Date.now() });
                await this.exportArtifacts();
                workflow.steps[workflow.steps.length - 1].status = 'completed';
                workflow.steps[workflow.steps.length - 1].duration = Date.now() - workflow.steps[workflow.steps.length - 1].startTime;
            }

            // Step 5: Cleanup artifacts
            workflow.steps.push({ step: 'cleanup', status: 'running', startTime: Date.now() });
            await this.cleanupArtifacts();
            workflow.steps[workflow.steps.length - 1].status = 'completed';
            workflow.steps[workflow.steps.length - 1].duration = Date.now() - workflow.steps[workflow.steps.length - 1].startTime;

            // Step 6: Generate status report
            workflow.steps.push({ step: 'status_report', status: 'running', startTime: Date.now() });
            await this.generateStatusReport();
            workflow.steps[workflow.steps.length - 1].status = 'completed';
            workflow.steps[workflow.steps.length - 1].duration = Date.now() - workflow.steps[workflow.steps.length - 1].startTime;

            workflow.success = true;
            workflow.duration = Date.now() - workflow.startTime;

            console.log('✅ CI/CD workflow completed successfully');
            console.log(`⏱️  Total duration: ${Math.round(workflow.duration / 1000)}s`);

        } catch (error) {
            workflow.error = {
                message: error.message,
                stack: error.stack
            };
            workflow.duration = Date.now() - workflow.startTime;

            console.error('❌ CI/CD workflow failed:', error.message);
            throw error;

        } finally {
            // Save workflow report
            const workflowPath = path.join('test-artifacts', 'cicd-workflow-report.json');
            await fs.mkdir(path.dirname(workflowPath), { recursive: true });
            await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2));
            console.log(`📋 Workflow report saved to: ${workflowPath}`);
        }

        return workflow;
    }

    /**
     * Main execution entry point
     */
    async run() {
        try {
            // Show help if requested
            if (this.options.showHelp) {
                this.showHelp();
                return;
            }

            console.log('🚀 ClearClause CI/CD Automation Starting...');
            console.log(`📅 ${new Date().toISOString()}`);

            // Run complete workflow
            const workflow = await this.runWorkflow();

            // Exit with appropriate code
            process.exit(workflow.success ? 0 : 1);

        } catch (error) {
            console.error('💥 Fatal error in CI/CD automation:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const automation = new CICDAutomation();
    automation.run();
}

export default CICDAutomation;