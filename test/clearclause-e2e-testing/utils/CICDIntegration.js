/**
 * CI/CD Integration Utilities for ClearClause End-to-End Testing
 * 
 * Provides automated test execution, environment configuration management,
 * test scheduling, result notification, and artifact management for
 * continuous integration and deployment pipelines.
 */

import fs from 'fs/promises';
import path from 'path';
import { UnifiedTestOrchestrator } from '../test-runner.js';
import { TestExecutionReporter } from './TestExecutionReporter.js';
import { TEST_CONFIG } from '../config/test-config.js';

export class CICDIntegration {
    constructor(options = {}) {
        this.options = {
            environment: options.environment || 'ci',
            useRealServices: options.useRealServices || false,
            reportFormat: options.reportFormat || 'json',
            notificationEnabled: options.notificationEnabled || false,
            artifactRetention: options.artifactRetention || 30, // days
            ...options
        };

        this.orchestrator = null;
        this.reporter = new TestExecutionReporter();
        this.executionId = this.generateExecutionId();
        this.artifactPath = path.join('test-artifacts', this.executionId);
    }

    /**
     * Initialize CI/CD test execution environment
     */
    async initialize() {
        console.log(`🚀 Initializing CI/CD test execution (ID: ${this.executionId})`);

        try {
            // Create artifact directory
            await fs.mkdir(this.artifactPath, { recursive: true });

            // Initialize test orchestrator
            this.orchestrator = new UnifiedTestOrchestrator(this.options.useRealServices);
            await this.orchestrator.initialize();

            // Configure environment-specific settings
            await this.configureEnvironment();

            console.log('✅ CI/CD integration initialized successfully');
            return { success: true, executionId: this.executionId };

        } catch (error) {
            console.error('❌ CI/CD initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute automated test suite
     */
    async executeAutomatedTests() {
        console.log('🔄 Starting automated test execution...');

        const startTime = Date.now();
        let testResults = null;

        try {
            // Record execution start
            await this.recordExecutionStart();

            // Run all test phases
            testResults = await this.orchestrator.runAllPhases();

            // Generate comprehensive report
            const report = await this.orchestrator.generateFinalReport();

            // Save test artifacts
            await this.saveTestArtifacts(report, testResults);

            // Send notifications if enabled
            if (this.options.notificationEnabled) {
                await this.sendNotification(testResults, report);
            }

            const duration = Date.now() - startTime;
            console.log(`✅ Automated test execution completed in ${Math.round(duration / 1000)}s`);

            return {
                success: testResults.overallSuccess,
                executionId: this.executionId,
                duration,
                testResults,
                report,
                artifactPath: this.artifactPath
            };

        } catch (error) {
            console.error('❌ Automated test execution failed:', error.message);

            // Save error artifacts
            await this.saveErrorArtifacts(error);

            // Send failure notification
            if (this.options.notificationEnabled) {
                await this.sendFailureNotification(error);
            }

            throw error;

        } finally {
            // Always cleanup
            if (this.orchestrator) {
                await this.orchestrator.cleanup();
            }
        }
    }

    /**
     * Configure environment-specific test settings
     */
    async configureEnvironment() {
        console.log(`🔧 Configuring environment: ${this.options.environment}`);

        const envConfig = {
            ci: {
                timeout: 300000, // 5 minutes per phase
                retryAttempts: 2,
                parallelExecution: false,
                verboseLogging: false
            },
            staging: {
                timeout: 600000, // 10 minutes per phase
                retryAttempts: 3,
                parallelExecution: true,
                verboseLogging: true
            },
            production: {
                timeout: 900000, // 15 minutes per phase
                retryAttempts: 1,
                parallelExecution: false,
                verboseLogging: false
            }
        };

        const config = envConfig[this.options.environment] || envConfig.ci;

        // Apply configuration
        Object.assign(TEST_CONFIG, config);

        // Save environment configuration
        await this.saveEnvironmentConfig(config);

        console.log(`✅ Environment configured: ${JSON.stringify(config, null, 2)}`);
    }

    /**
     * Schedule automated test execution
     */
    async scheduleExecution(schedule) {
        console.log(`📅 Scheduling test execution: ${schedule}`);

        const scheduleConfig = {
            schedule,
            environment: this.options.environment,
            useRealServices: this.options.useRealServices,
            notificationEnabled: this.options.notificationEnabled,
            createdAt: new Date().toISOString(),
            executionId: this.executionId
        };

        // Save schedule configuration
        const schedulePath = path.join(this.artifactPath, 'schedule-config.json');
        await fs.writeFile(schedulePath, JSON.stringify(scheduleConfig, null, 2));

        console.log(`✅ Test execution scheduled and saved to ${schedulePath}`);
        return scheduleConfig;
    }

    /**
     * Send test result notifications
     */
    async sendNotification(testResults, report) {
        console.log('📧 Sending test result notification...');

        const notification = {
            executionId: this.executionId,
            timestamp: new Date().toISOString(),
            environment: this.options.environment,
            success: testResults.overallSuccess,
            summary: {
                totalPhases: testResults.phasesExecuted,
                successfulPhases: testResults.phasesSuccessful,
                failedPhases: testResults.phasesFailed,
                duration: testResults.totalDuration
            },
            report: {
                featuresWorking: Array.isArray(report.featureStatuses) ? report.featureStatuses.filter(f => f.working).length : 0,
                featuresFailed: Array.isArray(report.featureStatuses) ? report.featureStatuses.filter(f => !f.working).length : 0,
                inputTypesWorking: Array.isArray(report.inputTypeResults) ? report.inputTypeResults.filter(r => r.success).length : 0,
                inputTypesFailed: Array.isArray(report.inputTypeResults) ? report.inputTypeResults.filter(r => !r.success).length : 0
            },
            artifactPath: this.artifactPath
        };

        // Save notification data
        const notificationPath = path.join(this.artifactPath, 'notification.json');
        await fs.writeFile(notificationPath, JSON.stringify(notification, null, 2));

        // In a real implementation, this would send to Slack, email, etc.
        console.log(`📧 Notification prepared and saved to ${notificationPath}`);
        console.log(`Status: ${notification.success ? '✅ SUCCESS' : '❌ FAILURE'}`);
        console.log(`Summary: ${notification.summary.successfulPhases}/${notification.summary.totalPhases} phases passed`);

        return notification;
    }

    /**
     * Send failure notification
     */
    async sendFailureNotification(error) {
        console.log('🚨 Sending failure notification...');

        const failureNotification = {
            executionId: this.executionId,
            timestamp: new Date().toISOString(),
            environment: this.options.environment,
            success: false,
            error: {
                message: error.message,
                stack: error.stack
            },
            artifactPath: this.artifactPath
        };

        // Save failure notification
        const failurePath = path.join(this.artifactPath, 'failure-notification.json');
        await fs.writeFile(failurePath, JSON.stringify(failureNotification, null, 2));

        console.log(`🚨 Failure notification saved to ${failurePath}`);
        return failureNotification;
    }

    /**
     * Save test artifacts
     */
    async saveTestArtifacts(report, testResults) {
        console.log('💾 Saving test artifacts...');

        const artifacts = {
            executionId: this.executionId,
            timestamp: new Date().toISOString(),
            environment: this.options.environment,
            testResults,
            report
        };

        // Save main artifacts
        const artifactsPath = path.join(this.artifactPath, 'test-artifacts.json');
        await fs.writeFile(artifactsPath, JSON.stringify(artifacts, null, 2));

        // Save detailed report
        const reportPath = path.join(this.artifactPath, 'detailed-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        // Save test results summary
        const summaryPath = path.join(this.artifactPath, 'test-summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(testResults, null, 2));

        // Save execution metadata
        const metadataPath = path.join(this.artifactPath, 'execution-metadata.json');
        const metadata = {
            executionId: this.executionId,
            environment: this.options.environment,
            useRealServices: this.options.useRealServices,
            startTime: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform,
            options: this.options
        };
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        console.log(`💾 Test artifacts saved to ${this.artifactPath}`);
        return this.artifactPath;
    }

    /**
     * Save error artifacts
     */
    async saveErrorArtifacts(error) {
        console.log('💾 Saving error artifacts...');

        const errorArtifacts = {
            executionId: this.executionId,
            timestamp: new Date().toISOString(),
            environment: this.options.environment,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        };

        const errorPath = path.join(this.artifactPath, 'error-artifacts.json');
        await fs.writeFile(errorPath, JSON.stringify(errorArtifacts, null, 2));

        console.log(`💾 Error artifacts saved to ${errorPath}`);
        return errorPath;
    }

    /**
     * Save environment configuration
     */
    async saveEnvironmentConfig(config) {
        const configPath = path.join(this.artifactPath, 'environment-config.json');
        const envConfig = {
            environment: this.options.environment,
            config,
            timestamp: new Date().toISOString()
        };

        await fs.writeFile(configPath, JSON.stringify(envConfig, null, 2));
        return configPath;
    }

    /**
     * Record execution start
     */
    async recordExecutionStart() {
        const startRecord = {
            executionId: this.executionId,
            startTime: new Date().toISOString(),
            environment: this.options.environment,
            options: this.options
        };

        const startPath = path.join(this.artifactPath, 'execution-start.json');
        await fs.writeFile(startPath, JSON.stringify(startRecord, null, 2));

        return startRecord;
    }

    /**
     * Manage artifact retention
     */
    async manageArtifactRetention() {
        console.log('🗂️  Managing artifact retention...');

        const artifactsDir = 'test-artifacts';
        const retentionDays = this.options.artifactRetention;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        try {
            const entries = await fs.readdir(artifactsDir, { withFileTypes: true });
            let deletedCount = 0;

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dirPath = path.join(artifactsDir, entry.name);
                    const stats = await fs.stat(dirPath);

                    if (stats.mtime < cutoffDate) {
                        await fs.rm(dirPath, { recursive: true, force: true });
                        deletedCount++;
                        console.log(`🗑️  Deleted old artifacts: ${entry.name}`);
                    }
                }
            }

            console.log(`🗂️  Artifact retention completed: ${deletedCount} old directories removed`);
            return { deletedCount, retentionDays };

        } catch (error) {
            console.warn('⚠️  Artifact retention failed:', error.message);
            return { deletedCount: 0, error: error.message };
        }
    }

    /**
     * Generate execution ID
     */
    generateExecutionId() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = Math.random().toString(36).substring(2, 8);
        return `e2e-${timestamp}-${random}`;
    }

    /**
     * Get execution status
     */
    getExecutionStatus() {
        return {
            executionId: this.executionId,
            environment: this.options.environment,
            artifactPath: this.artifactPath,
            options: this.options,
            progress: this.orchestrator ? this.orchestrator.getProgress() : null
        };
    }

    /**
     * Export artifacts for external systems
     */
    async exportArtifacts(exportPath, format = 'zip') {
        console.log(`📦 Exporting artifacts to ${exportPath} (format: ${format})`);

        // In a real implementation, this would create zip/tar archives
        // For now, we'll copy the artifacts directory
        const targetPath = path.join(exportPath, `${this.executionId}-artifacts`);

        try {
            await fs.mkdir(targetPath, { recursive: true });

            // Copy all artifacts
            const entries = await fs.readdir(this.artifactPath);
            for (const entry of entries) {
                const sourcePath = path.join(this.artifactPath, entry);
                const targetFilePath = path.join(targetPath, entry);
                await fs.copyFile(sourcePath, targetFilePath);
            }

            console.log(`📦 Artifacts exported to ${targetPath}`);
            return targetPath;

        } catch (error) {
            console.error('❌ Artifact export failed:', error.message);
            throw error;
        }
    }
}

export default CICDIntegration;