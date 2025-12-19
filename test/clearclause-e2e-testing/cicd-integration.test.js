/**
 * CI/CD Integration Tests for ClearClause End-to-End Testing
 * 
 * Tests automated test execution, environment configuration,
 * result notification systems, and artifact management for
 * continuous integration and deployment pipelines.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { CICDIntegration } from './utils/CICDIntegration.js';
import { TEST_CONFIG } from './config/test-config.js';

describe('CI/CD Integration Tests', () => {
    let cicdIntegration;
    let testArtifactPath;

    beforeEach(async () => {
        // Create test instance with mock options
        cicdIntegration = new CICDIntegration({
            environment: 'test',
            useRealServices: false,
            reportFormat: 'json',
            notificationEnabled: true,
            artifactRetention: 7
        });

        testArtifactPath = cicdIntegration.artifactPath;

        // Mock console methods to reduce test noise
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(async () => {
        // Cleanup test artifacts
        try {
            await fs.rm(testArtifactPath, { recursive: true, force: true });
            await fs.rm('test-artifacts', { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }

        // Restore console methods
        vi.restoreAllMocks();
    });

    describe('Automated Test Execution', () => {
        it('should initialize CI/CD integration successfully', async () => {
            const result = await cicdIntegration.initialize();

            expect(result.success).toBe(true);
            expect(result.executionId).toBeDefined();
            expect(result.executionId).toMatch(/^e2e-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9]{6}$/);

            // Verify artifact directory was created
            const artifactExists = await fs.access(testArtifactPath).then(() => true).catch(() => false);
            expect(artifactExists).toBe(true);
        });

        it('should handle initialization failures gracefully', async () => {
            // Mock fs.mkdir to fail
            const originalMkdir = fs.mkdir;
            vi.spyOn(fs, 'mkdir').mockRejectedValueOnce(new Error('Permission denied'));

            await expect(cicdIntegration.initialize()).rejects.toThrow('Permission denied');

            // Restore original function
            fs.mkdir = originalMkdir;
        });

        it('should generate unique execution IDs', () => {
            const integration1 = new CICDIntegration();
            const integration2 = new CICDIntegration();

            expect(integration1.executionId).not.toBe(integration2.executionId);
            expect(integration1.executionId).toMatch(/^e2e-/);
            expect(integration2.executionId).toMatch(/^e2e-/);
        });

        it('should track execution status', async () => {
            await cicdIntegration.initialize();

            const status = cicdIntegration.getExecutionStatus();

            expect(status.executionId).toBeDefined();
            expect(status.environment).toBe('test');
            expect(status.artifactPath).toBe(testArtifactPath);
            expect(status.options).toEqual(expect.objectContaining({
                environment: 'test',
                useRealServices: false,
                reportFormat: 'json'
            }));
        });

        it('should record execution start', async () => {
            await cicdIntegration.initialize();

            const startRecord = await cicdIntegration.recordExecutionStart();

            expect(startRecord.executionId).toBe(cicdIntegration.executionId);
            expect(startRecord.startTime).toBeDefined();
            expect(startRecord.environment).toBe('test');
            expect(startRecord.options).toBeDefined();

            // Verify start record was saved
            const startPath = path.join(testArtifactPath, 'execution-start.json');
            const savedRecord = JSON.parse(await fs.readFile(startPath, 'utf8'));
            expect(savedRecord).toEqual(startRecord);
        });
    });

    describe('Environment Configuration', () => {
        it('should configure CI environment correctly', async () => {
            const ciIntegration = new CICDIntegration({ environment: 'ci' });
            await ciIntegration.initialize();

            await ciIntegration.configureEnvironment();

            expect(TEST_CONFIG.timeout).toBe(300000); // 5 minutes
            expect(TEST_CONFIG.retryAttempts).toBe(2);
            expect(TEST_CONFIG.parallelExecution).toBe(false);
            expect(TEST_CONFIG.verboseLogging).toBe(false);

            // Verify environment config was saved
            const configPath = path.join(ciIntegration.artifactPath, 'environment-config.json');
            const savedConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
            expect(savedConfig.environment).toBe('ci');
            expect(savedConfig.config.timeout).toBe(300000);

            // Cleanup
            await fs.rm(ciIntegration.artifactPath, { recursive: true, force: true });
        });

        it('should configure staging environment correctly', async () => {
            const stagingIntegration = new CICDIntegration({ environment: 'staging' });
            await stagingIntegration.initialize();

            await stagingIntegration.configureEnvironment();

            expect(TEST_CONFIG.timeout).toBe(600000); // 10 minutes
            expect(TEST_CONFIG.retryAttempts).toBe(3);
            expect(TEST_CONFIG.parallelExecution).toBe(true);
            expect(TEST_CONFIG.verboseLogging).toBe(true);

            // Cleanup
            await fs.rm(stagingIntegration.artifactPath, { recursive: true, force: true });
        });

        it('should configure production environment correctly', async () => {
            const prodIntegration = new CICDIntegration({ environment: 'production' });
            await prodIntegration.initialize();

            await prodIntegration.configureEnvironment();

            expect(TEST_CONFIG.timeout).toBe(900000); // 15 minutes
            expect(TEST_CONFIG.retryAttempts).toBe(1);
            expect(TEST_CONFIG.parallelExecution).toBe(false);
            expect(TEST_CONFIG.verboseLogging).toBe(false);

            // Cleanup
            await fs.rm(prodIntegration.artifactPath, { recursive: true, force: true });
        });

        it('should default to CI configuration for unknown environments', async () => {
            const unknownIntegration = new CICDIntegration({ environment: 'unknown' });
            await unknownIntegration.initialize();

            await unknownIntegration.configureEnvironment();

            expect(TEST_CONFIG.timeout).toBe(300000); // CI default
            expect(TEST_CONFIG.retryAttempts).toBe(2); // CI default

            // Cleanup
            await fs.rm(unknownIntegration.artifactPath, { recursive: true, force: true });
        });

        it('should save environment configuration to artifacts', async () => {
            await cicdIntegration.initialize();

            const configPath = await cicdIntegration.saveEnvironmentConfig({
                timeout: 300000,
                retryAttempts: 2
            });

            expect(configPath).toBe(path.join(testArtifactPath, 'environment-config.json'));

            const savedConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
            expect(savedConfig.environment).toBe('test');
            expect(savedConfig.config.timeout).toBe(300000);
            expect(savedConfig.timestamp).toBeDefined();
        });

        it('should schedule test execution', async () => {
            await cicdIntegration.initialize();

            const schedule = '0 2 * * *'; // Daily at 2 AM
            const scheduleConfig = await cicdIntegration.scheduleExecution(schedule);

            expect(scheduleConfig.schedule).toBe(schedule);
            expect(scheduleConfig.environment).toBe('test');
            expect(scheduleConfig.executionId).toBe(cicdIntegration.executionId);
            expect(scheduleConfig.createdAt).toBeDefined();

            // Verify schedule was saved
            const schedulePath = path.join(testArtifactPath, 'schedule-config.json');
            const savedSchedule = JSON.parse(await fs.readFile(schedulePath, 'utf8'));
            expect(savedSchedule).toEqual(scheduleConfig);
        });
    });

    describe('Result Notification Systems', () => {
        it('should send success notification', async () => {
            await cicdIntegration.initialize();

            const mockTestResults = {
                overallSuccess: true,
                phasesExecuted: 6,
                phasesSuccessful: 6,
                phasesFailed: 0,
                totalDuration: 120000
            };

            const mockReport = {
                featureStatuses: [
                    { feature: 'AWS Connectivity', working: true },
                    { feature: 'File Processing', working: true }
                ],
                inputTypeResults: [
                    { inputType: 'PDF', success: true },
                    { inputType: 'Raw Text', success: true }
                ]
            };

            const notification = await cicdIntegration.sendNotification(mockTestResults, mockReport);

            expect(notification.success).toBe(true);
            expect(notification.executionId).toBe(cicdIntegration.executionId);
            expect(notification.environment).toBe('test');
            expect(notification.summary.totalPhases).toBe(6);
            expect(notification.summary.successfulPhases).toBe(6);
            expect(notification.report.featuresWorking).toBe(2);
            expect(notification.report.inputTypesWorking).toBe(2);

            // Verify notification was saved
            const notificationPath = path.join(testArtifactPath, 'notification.json');
            const savedNotification = JSON.parse(await fs.readFile(notificationPath, 'utf8'));
            expect(savedNotification).toEqual(notification);
        });

        it('should send failure notification', async () => {
            await cicdIntegration.initialize();

            const mockError = new Error('Test execution failed');
            mockError.stack = 'Error: Test execution failed\n    at test.js:123:45';

            const failureNotification = await cicdIntegration.sendFailureNotification(mockError);

            expect(failureNotification.success).toBe(false);
            expect(failureNotification.executionId).toBe(cicdIntegration.executionId);
            expect(failureNotification.error.message).toBe('Test execution failed');
            expect(failureNotification.error.stack).toBeDefined();

            // Verify failure notification was saved
            const failurePath = path.join(testArtifactPath, 'failure-notification.json');
            const savedFailure = JSON.parse(await fs.readFile(failurePath, 'utf8'));
            expect(savedFailure).toEqual(failureNotification);
        });

        it('should handle notification with partial results', async () => {
            await cicdIntegration.initialize();

            const mockTestResults = {
                overallSuccess: false,
                phasesExecuted: 4,
                phasesSuccessful: 2,
                phasesFailed: 2,
                totalDuration: 90000
            };

            const mockReport = {
                featureStatuses: [
                    { feature: 'AWS Connectivity', working: true },
                    { feature: 'File Processing', working: false }
                ],
                inputTypeResults: [
                    { inputType: 'PDF', success: true },
                    { inputType: 'URL', success: false }
                ]
            };

            const notification = await cicdIntegration.sendNotification(mockTestResults, mockReport);

            expect(notification.success).toBe(false);
            expect(notification.summary.successfulPhases).toBe(2);
            expect(notification.summary.failedPhases).toBe(2);
            expect(notification.report.featuresWorking).toBe(1);
            expect(notification.report.featuresFailed).toBe(1);
        });

        it('should handle notification with missing report data', async () => {
            await cicdIntegration.initialize();

            const mockTestResults = {
                overallSuccess: true,
                phasesExecuted: 3,
                phasesSuccessful: 3,
                phasesFailed: 0,
                totalDuration: 60000
            };

            const mockReport = {}; // Empty report

            const notification = await cicdIntegration.sendNotification(mockTestResults, mockReport);

            expect(notification.success).toBe(true);
            expect(notification.report.featuresWorking).toBe(0);
            expect(notification.report.featuresFailed).toBe(0);
            expect(notification.report.inputTypesWorking).toBe(0);
            expect(notification.report.inputTypesFailed).toBe(0);
        });
    });

    describe('Artifact Management', () => {
        it('should save test artifacts successfully', async () => {
            await cicdIntegration.initialize();

            const mockReport = {
                executionSummary: { success: true },
                awsConnectivityResults: [],
                performanceMetrics: { avgProcessingTime: 5000 }
            };

            const mockTestResults = {
                overallSuccess: true,
                phasesExecuted: 6,
                totalDuration: 120000
            };

            const artifactPath = await cicdIntegration.saveTestArtifacts(mockReport, mockTestResults);

            expect(artifactPath).toBe(testArtifactPath);

            // Verify all artifact files were created
            const expectedFiles = [
                'test-artifacts.json',
                'detailed-report.json',
                'test-summary.json',
                'execution-metadata.json'
            ];

            for (const fileName of expectedFiles) {
                const filePath = path.join(testArtifactPath, fileName);
                const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
                expect(fileExists).toBe(true);
            }

            // Verify artifact content
            const artifactsPath = path.join(testArtifactPath, 'test-artifacts.json');
            const savedArtifacts = JSON.parse(await fs.readFile(artifactsPath, 'utf8'));
            expect(savedArtifacts.executionId).toBe(cicdIntegration.executionId);
            expect(savedArtifacts.testResults).toEqual(mockTestResults);
            expect(savedArtifacts.report).toEqual(mockReport);

            // Verify metadata content
            const metadataPath = path.join(testArtifactPath, 'execution-metadata.json');
            const savedMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            expect(savedMetadata.executionId).toBe(cicdIntegration.executionId);
            expect(savedMetadata.environment).toBe('test');
            expect(savedMetadata.nodeVersion).toBe(process.version);
            expect(savedMetadata.platform).toBe(process.platform);
        });

        it('should save error artifacts', async () => {
            await cicdIntegration.initialize();

            const mockError = new Error('Processing failed');
            mockError.stack = 'Error: Processing failed\n    at process.js:456:78';

            const errorPath = await cicdIntegration.saveErrorArtifacts(mockError);

            expect(errorPath).toBe(path.join(testArtifactPath, 'error-artifacts.json'));

            const savedError = JSON.parse(await fs.readFile(errorPath, 'utf8'));
            expect(savedError.executionId).toBe(cicdIntegration.executionId);
            expect(savedError.error.message).toBe('Processing failed');
            expect(savedError.error.stack).toBeDefined();
            expect(savedError.error.name).toBe('Error');
        });

        it('should export artifacts to external location', async () => {
            await cicdIntegration.initialize();

            // Create some test artifacts first
            const testFile = path.join(testArtifactPath, 'test-file.json');
            await fs.writeFile(testFile, JSON.stringify({ test: 'data' }));

            const exportPath = 'test-export';
            const targetPath = await cicdIntegration.exportArtifacts(exportPath);

            expect(targetPath).toBe(path.join(exportPath, `${cicdIntegration.executionId}-artifacts`));

            // Verify exported file exists
            const exportedFile = path.join(targetPath, 'test-file.json');
            const fileExists = await fs.access(exportedFile).then(() => true).catch(() => false);
            expect(fileExists).toBe(true);

            const exportedContent = JSON.parse(await fs.readFile(exportedFile, 'utf8'));
            expect(exportedContent).toEqual({ test: 'data' });

            // Cleanup export directory
            await fs.rm(exportPath, { recursive: true, force: true });
        });

        it('should handle export failures gracefully', async () => {
            await cicdIntegration.initialize();

            // Mock fs.mkdir to fail during export
            const originalMkdir = fs.mkdir;
            vi.spyOn(fs, 'mkdir').mockRejectedValueOnce(new Error('Export failed'));

            const exportPath = 'test-export';
            await expect(cicdIntegration.exportArtifacts(exportPath)).rejects.toThrow('Export failed');

            // Restore original function
            fs.mkdir = originalMkdir;
        });

        it('should manage artifact retention', async () => {
            // Create test artifacts directory structure
            const artifactsDir = 'test-artifacts';
            await fs.mkdir(artifactsDir, { recursive: true });

            // Create old and new artifact directories
            const oldDir = path.join(artifactsDir, 'old-execution');
            const newDir = path.join(artifactsDir, 'new-execution');

            await fs.mkdir(oldDir, { recursive: true });
            await fs.mkdir(newDir, { recursive: true });

            // Set old directory timestamp to be older than retention period
            const oldTime = new Date();
            oldTime.setDate(oldTime.getDate() - 10); // 10 days ago
            await fs.utimes(oldDir, oldTime, oldTime);

            // Create integration with short retention period
            const retentionIntegration = new CICDIntegration({ artifactRetention: 7 });

            const result = await retentionIntegration.manageArtifactRetention();

            expect(result.deletedCount).toBe(1);
            expect(result.retentionDays).toBe(7);

            // Verify old directory was deleted
            const oldExists = await fs.access(oldDir).then(() => true).catch(() => false);
            expect(oldExists).toBe(false);

            // Verify new directory still exists
            const newExists = await fs.access(newDir).then(() => true).catch(() => false);
            expect(newExists).toBe(true);

            // Cleanup
            await fs.rm(artifactsDir, { recursive: true, force: true });
        });

        it('should handle retention management failures', async () => {
            // Create integration pointing to non-existent directory
            const failureIntegration = new CICDIntegration({ artifactRetention: 7 });

            const result = await failureIntegration.manageArtifactRetention();

            expect(result.deletedCount).toBe(0);
            expect(result.error).toBeDefined();
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle complete CI/CD workflow', async () => {
            // Mock the orchestrator to avoid real test execution
            const mockOrchestrator = {
                initialize: vi.fn().mockResolvedValue(true),
                runAllPhases: vi.fn().mockResolvedValue({
                    overallSuccess: true,
                    phasesExecuted: 6,
                    phasesSuccessful: 6,
                    phasesFailed: 0,
                    totalDuration: 120000
                }),
                generateFinalReport: vi.fn().mockResolvedValue({
                    executionSummary: { success: true },
                    featureStatuses: [{ feature: 'Test', working: true }],
                    inputTypeResults: [{ inputType: 'PDF', success: true }]
                }),
                cleanup: vi.fn().mockResolvedValue(true),
                getProgress: vi.fn().mockReturnValue({ phase: 'complete', progress: 100 })
            };

            await cicdIntegration.initialize();

            // Replace the orchestrator after initialization
            const originalOrchestrator = cicdIntegration.orchestrator;
            cicdIntegration.orchestrator = mockOrchestrator;
            const result = await cicdIntegration.executeAutomatedTests();

            expect(result.success).toBe(true);
            expect(result.executionId).toBe(cicdIntegration.executionId);
            expect(result.duration).toBeGreaterThan(0);
            expect(result.testResults).toBeDefined();
            expect(result.report).toBeDefined();
            expect(result.artifactPath).toBe(testArtifactPath);

            // Verify orchestrator methods were called (except initialize which was called on the real orchestrator)
            expect(mockOrchestrator.runAllPhases).toHaveBeenCalled();
            expect(mockOrchestrator.generateFinalReport).toHaveBeenCalled();
            expect(mockOrchestrator.cleanup).toHaveBeenCalled();

            // Verify artifacts were saved
            const artifactsPath = path.join(testArtifactPath, 'test-artifacts.json');
            const artifactExists = await fs.access(artifactsPath).then(() => true).catch(() => false);
            expect(artifactExists).toBe(true);

            // Restore original orchestrator
            cicdIntegration.orchestrator = originalOrchestrator;
        });

        it('should handle test execution failures', async () => {
            const mockOrchestrator = {
                initialize: vi.fn().mockResolvedValue(true),
                runAllPhases: vi.fn().mockRejectedValue(new Error('Test execution failed')),
                cleanup: vi.fn().mockResolvedValue(true)
            };

            await cicdIntegration.initialize();
            cicdIntegration.orchestrator = mockOrchestrator;

            await expect(cicdIntegration.executeAutomatedTests()).rejects.toThrow('Test execution failed');

            // Verify cleanup was called even on failure
            expect(mockOrchestrator.cleanup).toHaveBeenCalled();

            // Verify error artifacts were saved
            const errorPath = path.join(testArtifactPath, 'error-artifacts.json');
            const errorExists = await fs.access(errorPath).then(() => true).catch(() => false);
            expect(errorExists).toBe(true);
        });

        it('should handle different environment configurations in workflow', async () => {
            const environments = ['ci', 'staging', 'production'];

            for (const env of environments) {
                const envIntegration = new CICDIntegration({ environment: env });
                await envIntegration.initialize();

                const status = envIntegration.getExecutionStatus();
                expect(status.environment).toBe(env);

                // Cleanup
                await fs.rm(envIntegration.artifactPath, { recursive: true, force: true });
            }
        });
    });
});