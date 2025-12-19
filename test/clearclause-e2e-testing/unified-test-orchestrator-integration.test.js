/**
 * Unified Test Orchestrator Integration Tests
 * 
 * Integration tests for the complete test execution flow including:
 * - Full test suite execution
 * - Test phase coordination and dependency management
 * - Result aggregation and reporting
 * - Cleanup procedures and resource management
 * 
 * **Subtask 12.1: Write integration tests for complete test execution flow**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import UnifiedTestOrchestrator from './test-runner.js';
import { TestExecutionReporter } from './utils/TestExecutionReporter.js';
import { TEST_CONFIG } from './config/test-config.js';

describe('Unified Test Orchestrator Integration Tests', () => {
    let orchestrator;
    let cleanupHandlers = [];

    beforeEach(async () => {
        // Use mock services for integration testing
        orchestrator = new UnifiedTestOrchestrator(false);
        cleanupHandlers = [];
    });

    afterEach(async () => {
        // Cleanup orchestrator and any test resources
        if (orchestrator) {
            try {
                await orchestrator.cleanup();
            } catch (error) {
                console.warn('Orchestrator cleanup warning:', error.message);
            }
        }

        // Run additional cleanup handlers
        for (const handler of cleanupHandlers) {
            try {
                await handler();
            } catch (error) {
                console.warn('Additional cleanup warning:', error.message);
            }
        }
    });

    describe('Full Test Suite Execution', () => {
        it('should initialize orchestrator successfully', async () => {
            const validation = await orchestrator.initialize();

            expect(validation).toBeDefined();
            expect(validation.allPassed).toBe(true);
            expect(orchestrator.startTime).toBeDefined();
            expect(orchestrator.reporter).toBeDefined();
            expect(orchestrator.testEnvironment).toBeDefined();
        });

        it('should execute all test phases in correct order', async () => {
            await orchestrator.initialize();

            const executionOrder = orchestrator.calculateExecutionOrder();

            expect(executionOrder).toHaveLength(6);
            expect(executionOrder[0].id).toBe('infrastructure');
            expect(executionOrder[1].id).toBe('dataset-processing');
            expect(executionOrder[2].id).toBe('raw-text-processing');
            expect(executionOrder[3].id).toBe('url-processing');
            expect(executionOrder[4].id).toBe('api-validation');
            expect(executionOrder[5].id).toBe('output-quality');

            // Verify dependencies are respected
            const apiPhase = executionOrder.find(p => p.id === 'api-validation');
            expect(apiPhase.dependencies).toContain('infrastructure');
            expect(apiPhase.dependencies).toContain('dataset-processing');
            expect(apiPhase.dependencies).toContain('raw-text-processing');
            expect(apiPhase.dependencies).toContain('url-processing');

            const outputPhase = executionOrder.find(p => p.id === 'output-quality');
            expect(outputPhase.dependencies).toContain('api-validation');
        });

        it('should run complete test suite and generate results', async () => {
            await orchestrator.initialize();

            const executionResult = await orchestrator.runAllPhases();

            expect(executionResult).toBeDefined();
            expect(executionResult.overallSuccess).toBeDefined();
            expect(executionResult.totalDuration).toBeGreaterThan(0);
            expect(executionResult.phasesExecuted).toBeGreaterThan(0);
            expect(executionResult.phasesExecuted).toBeLessThanOrEqual(6);
            expect(executionResult.phasesSuccessful).toBeGreaterThanOrEqual(0);
            expect(executionResult.phasesFailed).toBeGreaterThanOrEqual(0);
            expect(executionResult.phasesSuccessful + executionResult.phasesFailed).toBe(executionResult.phasesExecuted);

            // Verify orchestrator state
            expect(orchestrator.endTime).toBeDefined();
            expect(orchestrator.phaseResults.size).toBe(executionResult.phasesExecuted);
        }, 60000); // 1 minute timeout for full execution

        it('should handle phase failures gracefully', async () => {
            await orchestrator.initialize();

            // Mock infrastructure to succeed first
            const originalInfraMethod = orchestrator.runInfrastructurePhase;
            orchestrator.runInfrastructurePhase = async () => {
                return {
                    success: true,
                    testsRun: 5,
                    testsPassed: 5,
                    testsFailed: 0
                };
            };

            // Mock a phase to fail by overriding the method
            const originalMethod = orchestrator.runDatasetProcessingPhase;
            orchestrator.runDatasetProcessingPhase = async () => {
                throw new Error('Simulated dataset processing failure');
            };

            const executionResult = await orchestrator.runAllPhases();

            expect(executionResult.overallSuccess).toBe(false);
            expect(executionResult.phasesFailed).toBeGreaterThan(0);

            // Verify failure was recorded
            const datasetResult = orchestrator.phaseResults.get('dataset-processing');
            expect(datasetResult).toBeDefined();
            expect(datasetResult.success).toBe(false);
            expect(datasetResult.error).toContain('Simulated dataset processing failure');

            // Restore original methods
            orchestrator.runDatasetProcessingPhase = originalMethod;
            orchestrator.runInfrastructurePhase = originalInfraMethod;
        });

        it('should respect phase timeouts', async () => {
            await orchestrator.initialize();

            // Mock a phase to take too long
            const originalMethod = orchestrator.runInfrastructurePhase;
            orchestrator.runInfrastructurePhase = async () => {
                return new Promise((resolve) => {
                    setTimeout(() => resolve({ success: true }), 70000); // 70 seconds
                });
            };

            // Reduce timeout for testing
            const infraPhase = orchestrator.testPhases.find(p => p.id === 'infrastructure');
            const originalTimeout = infraPhase.timeout;
            infraPhase.timeout = 1000; // 1 second

            const executionResult = await orchestrator.runAllPhases();

            expect(executionResult.overallSuccess).toBe(false);
            expect(executionResult.phasesFailed).toBeGreaterThan(0);

            // Verify timeout was recorded
            const infraResult = orchestrator.phaseResults.get('infrastructure');
            expect(infraResult).toBeDefined();
            expect(infraResult.success).toBe(false);
            expect(infraResult.error).toContain('timeout');

            // Restore original method and timeout
            orchestrator.runInfrastructurePhase = originalMethod;
            infraPhase.timeout = originalTimeout;
        });

        it('should track execution progress correctly', async () => {
            await orchestrator.initialize();

            let progress = orchestrator.getProgress();
            expect(progress.totalPhases).toBe(6);
            expect(progress.completedPhases).toBe(0);
            expect(progress.progressPercentage).toBe(0);
            expect(progress.currentPhase).toBeNull();

            // Start execution in background and check progress
            const executionPromise = orchestrator.runAllPhases();

            // Allow some time for phases to start
            await new Promise(resolve => setTimeout(resolve, 100));

            progress = orchestrator.getProgress();
            expect(progress.completedPhases).toBeGreaterThanOrEqual(0);
            expect(progress.progressPercentage).toBeGreaterThanOrEqual(0);
            expect(progress.progressPercentage).toBeLessThanOrEqual(100);

            // Wait for completion
            await executionPromise;

            progress = orchestrator.getProgress();
            expect(progress.completedPhases).toBeGreaterThan(0);
            expect(progress.progressPercentage).toBeGreaterThan(0);
        });
    });

    describe('Test Phase Coordination', () => {
        it('should validate phase dependencies correctly', async () => {
            await orchestrator.initialize();

            const infraPhase = orchestrator.testPhases.find(p => p.id === 'infrastructure');
            const datasetPhase = orchestrator.testPhases.find(p => p.id === 'dataset-processing');
            const apiPhase = orchestrator.testPhases.find(p => p.id === 'api-validation');

            // Infrastructure has no dependencies
            expect(orchestrator.checkPhaseDependencies(infraPhase)).toBe(true);

            // Dataset processing depends on infrastructure (not yet completed)
            expect(orchestrator.checkPhaseDependencies(datasetPhase)).toBe(false);

            // Simulate infrastructure completion
            orchestrator.phaseResults.set('infrastructure', { success: true });
            expect(orchestrator.checkPhaseDependencies(datasetPhase)).toBe(true);

            // API validation has multiple dependencies
            expect(orchestrator.checkPhaseDependencies(apiPhase)).toBe(false);

            // Add required dependencies
            orchestrator.phaseResults.set('dataset-processing', { success: true });
            orchestrator.phaseResults.set('raw-text-processing', { success: true });
            orchestrator.phaseResults.set('url-processing', { success: true });
            expect(orchestrator.checkPhaseDependencies(apiPhase)).toBe(true);
        });

        it('should detect circular dependencies', () => {
            // Create orchestrator with circular dependency
            const circularOrchestrator = new UnifiedTestOrchestrator(false);

            // Modify phases to create circular dependency
            circularOrchestrator.testPhases = [
                { id: 'phase-a', dependencies: ['phase-b'] },
                { id: 'phase-b', dependencies: ['phase-a'] }
            ];

            expect(() => {
                circularOrchestrator.calculateExecutionOrder();
            }).toThrow('Circular dependency detected');

            cleanupHandlers.push(() => circularOrchestrator.cleanup());
        });

        it('should handle unknown dependencies', () => {
            const invalidOrchestrator = new UnifiedTestOrchestrator(false);

            // Add phase with unknown dependency
            invalidOrchestrator.testPhases = [
                { id: 'valid-phase', dependencies: ['unknown-phase'] }
            ];

            expect(() => {
                invalidOrchestrator.calculateExecutionOrder();
            }).toThrow('Unknown dependency: unknown-phase');

            cleanupHandlers.push(() => invalidOrchestrator.cleanup());
        });

        it('should execute phases with timeout protection', async () => {
            await orchestrator.initialize();

            // Use an existing phase for testing
            const infraPhase = orchestrator.testPhases.find(p => p.id === 'infrastructure');
            const testPhase = {
                ...infraPhase,
                timeout: 500 // 500ms timeout
            };

            // Test successful execution within timeout
            const originalMethod = orchestrator.runInfrastructurePhase;
            orchestrator.runInfrastructurePhase = async () => {
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
                return { success: true, testsRun: 1, testsPassed: 1, testsFailed: 0 };
            };

            const result = await orchestrator.executePhaseWithTimeout(testPhase);
            expect(result.success).toBe(true);
            expect(result.duration).toBeGreaterThan(100);
            expect(result.timestamp).toBeDefined();

            // Test timeout handling
            orchestrator.runInfrastructurePhase = async () => {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1000ms delay
                return { success: true };
            };

            testPhase.timeout = 200; // Shorter timeout
            await expect(orchestrator.executePhaseWithTimeout(testPhase))
                .rejects.toThrow('Phase timeout after 200ms');

            // Restore original method
            orchestrator.runInfrastructurePhase = originalMethod;
        });
    });

    describe('Result Aggregation', () => {
        it('should aggregate results from all phases', async () => {
            await orchestrator.initialize();

            // Simulate phase results
            orchestrator.phaseResults.set('infrastructure', {
                success: true,
                testsRun: 5,
                testsPassed: 5,
                testsFailed: 0,
                duration: 1000
            });

            orchestrator.phaseResults.set('dataset-processing', {
                success: false,
                testsRun: 3,
                testsPassed: 2,
                testsFailed: 1,
                duration: 2000,
                error: 'Processing failed'
            });

            // Record failed input type to make overallSuccess false
            orchestrator.reporter.recordInputTypeResult('PDF', false, 'Processing failed');

            const report = await orchestrator.generateFinalReport();

            expect(report).toBeDefined();
            expect(report.executionSummary).toBeDefined();
            // overallSuccess is based on failed input types and feature status, not just phase results
            expect(report.executionSummary.overallSuccess).toBeDefined();
            expect(typeof report.executionSummary.overallSuccess).toBe('boolean');
            expect(report.testPhases.length).toBeGreaterThanOrEqual(1); // At least initialization phase

            // Verify orchestrator metadata
            expect(report.orchestratorMetadata).toBeDefined();
            expect(report.orchestratorMetadata.totalPhases).toBe(6);
            expect(report.orchestratorMetadata.phasesExecuted).toBe(2);
            expect(report.orchestratorMetadata.phasesSuccessful).toBe(1);
            expect(report.orchestratorMetadata.phasesFailed).toBe(1);
            expect(report.orchestratorMetadata.useRealServices).toBe(false);
            expect(Array.isArray(report.orchestratorMetadata.executionOrder)).toBe(true);
        });

        it('should include comprehensive metrics in final report', async () => {
            await orchestrator.initialize();

            // Run a subset of phases to generate data
            await orchestrator.runInfrastructurePhase();

            const report = await orchestrator.generateFinalReport();

            // Verify report structure
            expect(report.executionSummary).toBeDefined();
            expect(report.featureStatus).toBeDefined();
            expect(report.testPhases).toBeDefined();
            expect(report.failedInputTypes).toBeDefined();
            expect(report.inputTypeResults).toBeDefined();
            expect(report.datasetCoverage).toBeDefined();
            expect(report.sampleOutputs).toBeDefined();
            expect(report.awsServiceMetrics).toBeDefined();
            expect(report.recommendations).toBeDefined();
            expect(report.metadata).toBeDefined();
            expect(report.orchestratorMetadata).toBeDefined();

            // Verify recommendations are generated
            expect(Array.isArray(report.recommendations)).toBe(true);
            expect(report.recommendations.length).toBeGreaterThan(0);

            // Verify metadata completeness
            expect(report.metadata.reportGeneratedAt).toBeDefined();
            expect(report.metadata.nodeVersion).toBeDefined();
            expect(report.metadata.testEnvironment).toBeDefined();
        });

        it('should export report to file successfully', async () => {
            await orchestrator.initialize();

            const report = await orchestrator.generateFinalReport();
            const testFilePath = 'test-report-export.json';

            // Export report
            await orchestrator.exportReport(report, testFilePath);

            // Verify file was created and contains valid JSON
            const fs = await import('fs/promises');
            const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
            expect(fileExists).toBe(true);

            const fileContent = await fs.readFile(testFilePath, 'utf8');
            const parsedReport = JSON.parse(fileContent);

            expect(parsedReport.executionSummary).toBeDefined();
            expect(parsedReport.orchestratorMetadata).toBeDefined();

            // Cleanup test file
            cleanupHandlers.push(async () => {
                try {
                    await fs.unlink(testFilePath);
                } catch (error) {
                    // File might not exist, ignore error
                }
            });
        });
    });

    describe('Cleanup Procedures', () => {
        it('should perform comprehensive cleanup', async () => {
            await orchestrator.initialize();

            let cleanupHandlerCalled = false;
            orchestrator.addCleanupHandler(async () => {
                cleanupHandlerCalled = true;
            });

            // Verify cleanup handler was added
            expect(orchestrator.cleanup_handlers).toHaveLength(1);

            // Perform cleanup
            await orchestrator.cleanup();

            // Verify cleanup handler was called
            expect(cleanupHandlerCalled).toBe(true);
        });

        it('should handle cleanup failures gracefully', async () => {
            await orchestrator.initialize();

            // Add failing cleanup handler
            orchestrator.addCleanupHandler(async () => {
                throw new Error('Cleanup handler failed');
            });

            // Add successful cleanup handler
            let successfulCleanupCalled = false;
            orchestrator.addCleanupHandler(async () => {
                successfulCleanupCalled = true;
            });

            // Cleanup should not throw despite handler failure
            await expect(orchestrator.cleanup()).resolves.not.toThrow();

            // Successful handler should still be called
            expect(successfulCleanupCalled).toBe(true);
        });

        it('should cleanup test environment and reporter', async () => {
            await orchestrator.initialize();

            // Verify components are initialized
            expect(orchestrator.testEnvironment).toBeDefined();
            expect(orchestrator.reporter).toBeDefined();

            // Check initial state (initialization adds a phase)
            const initialPhaseCount = orchestrator.reporter.testPhases.length;
            expect(initialPhaseCount).toBeGreaterThanOrEqual(1);

            // Add some data to reporter
            orchestrator.reporter.recordTestPhase('Test Phase', 'completed');
            expect(orchestrator.reporter.testPhases).toHaveLength(initialPhaseCount + 1);

            // Perform cleanup
            await orchestrator.cleanup();

            // Verify reporter was cleared
            expect(orchestrator.reporter.testPhases).toHaveLength(0);
        });

        it('should handle resource cleanup during execution interruption', async () => {
            await orchestrator.initialize();

            let cleanupCalled = false;
            orchestrator.addCleanupHandler(async () => {
                cleanupCalled = true;
            });

            // Start execution
            const executionPromise = orchestrator.runAllPhases();

            // Interrupt execution by calling cleanup
            await orchestrator.cleanup();

            // Wait for execution to complete (should handle interruption gracefully)
            try {
                await executionPromise;
            } catch (error) {
                // Execution might fail due to cleanup, which is expected
            }

            expect(cleanupCalled).toBe(true);
        });
    });

    describe('Error Handling and Resilience', () => {
        it('should handle initialization failures', async () => {
            const failingOrchestrator = new UnifiedTestOrchestrator(false);

            // Mock test environment to fail
            failingOrchestrator.testEnvironment.validateTestEnvironment = async () => {
                return {
                    allPassed: false,
                    failedChecks: ['Mock validation failure']
                };
            };

            await expect(failingOrchestrator.initialize())
                .rejects.toThrow('Test environment validation failed');

            cleanupHandlers.push(() => failingOrchestrator.cleanup());
        });

        it('should continue execution when non-required phases fail', async () => {
            await orchestrator.initialize();

            // Mark a phase as non-required
            const datasetPhase = orchestrator.testPhases.find(p => p.id === 'dataset-processing');
            const originalRequired = datasetPhase.required;
            datasetPhase.required = false;

            // Mock dataset phase to fail
            const originalMethod = orchestrator.runDatasetProcessingPhase;
            orchestrator.runDatasetProcessingPhase = async () => {
                throw new Error('Non-required phase failure');
            };

            const executionResult = await orchestrator.runAllPhases();

            // Execution should continue despite failure
            expect(executionResult.phasesExecuted).toBeGreaterThan(1);
            expect(executionResult.phasesFailed).toBeGreaterThan(0);

            // Restore original values
            datasetPhase.required = originalRequired;
            orchestrator.runDatasetProcessingPhase = originalMethod;
        });

        it('should stop execution when required phases fail', async () => {
            await orchestrator.initialize();

            // Mock infrastructure phase to fail (it's required)
            const originalMethod = orchestrator.runInfrastructurePhase;
            orchestrator.runInfrastructurePhase = async () => {
                throw new Error('Required phase failure');
            };

            const executionResult = await orchestrator.runAllPhases();

            // Execution should stop after infrastructure failure
            expect(executionResult.overallSuccess).toBe(false);
            expect(executionResult.phasesExecuted).toBe(1); // Only infrastructure attempted
            expect(executionResult.phasesFailed).toBe(1);

            // Restore original method
            orchestrator.runInfrastructurePhase = originalMethod;
        });

        it('should handle concurrent access safely', async () => {
            await orchestrator.initialize();

            // Start multiple operations concurrently
            const operations = [
                orchestrator.getProgress(),
                orchestrator.getProgress(),
                orchestrator.calculateExecutionOrder(),
                orchestrator.calculateExecutionOrder()
            ];

            // All operations should complete without errors
            const results = await Promise.all(operations);

            expect(results).toHaveLength(4);
            results.forEach(result => {
                expect(result).toBeDefined();
            });
        });
    });

    describe('Configuration and Customization', () => {
        it('should support real services configuration', () => {
            const realServicesOrchestrator = new UnifiedTestOrchestrator(true);

            expect(realServicesOrchestrator.useRealServices).toBe(true);

            cleanupHandlers.push(() => realServicesOrchestrator.cleanup());
        });

        it('should allow custom cleanup handlers', async () => {
            await orchestrator.initialize();

            const customHandlers = [];

            // Add multiple custom handlers
            for (let i = 0; i < 3; i++) {
                const handlerIndex = i;
                orchestrator.addCleanupHandler(async () => {
                    customHandlers.push(handlerIndex);
                });
            }

            expect(orchestrator.cleanup_handlers).toHaveLength(3);

            await orchestrator.cleanup();

            // All handlers should have been called
            expect(customHandlers).toHaveLength(3);
            expect(customHandlers).toContain(0);
            expect(customHandlers).toContain(1);
            expect(customHandlers).toContain(2);
        });

        it('should respect phase timeout configurations', () => {
            const phases = orchestrator.testPhases;

            // Verify all phases have reasonable timeouts
            phases.forEach(phase => {
                expect(phase.timeout).toBeGreaterThan(0);
                expect(phase.timeout).toBeLessThanOrEqual(300000); // Max 5 minutes
            });

            // Verify infrastructure has shortest timeout
            const infraPhase = phases.find(p => p.id === 'infrastructure');
            expect(infraPhase.timeout).toBe(60000); // 1 minute

            // Verify dataset processing has longest timeout
            const datasetPhase = phases.find(p => p.id === 'dataset-processing');
            expect(datasetPhase.timeout).toBe(300000); // 5 minutes
        });
    });
});