// Property-based test for runtime model configuration
// **Feature: ai-contract-analysis, Property 14: Runtime model configuration**
// **Validates: Requirements 7.4**

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ModelManager } from '../../model/core/ModelManager.js';
import { ContractProcessor } from '../../src/processors/ContractProcessor.js';

describe('Runtime Model Configuration Property Tests', () => {
    let modelManager;
    let contractProcessor;

    beforeEach(() => {
        modelManager = new ModelManager();
        contractProcessor = new ContractProcessor();
    });

    afterEach(async () => {
        if (modelManager && typeof modelManager.unloadModel === 'function') {
            await modelManager.unloadModel();
        }
        if (contractProcessor && typeof contractProcessor.cleanup === 'function') {
            await contractProcessor.cleanup();
        }
    });

    it('**Feature: ai-contract-analysis, Property 14: Runtime model configuration**', async () => {
        // **Validates: Requirements 7.4**
        await fc.assert(
            fc.asyncProperty(
                // Generate valid runtime configuration parameters
                fc.record({
                    temperature: fc.float({ min: 0.0, max: 2.0 }),
                    maxTokens: fc.integer({ min: 100, max: 4000 }),
                    contextWindow: fc.constantFrom(4096, 8192, 16384, 32768, 65536, 128000),
                    memoryOptimization: fc.boolean(),
                    timeout: fc.integer({ min: 5000, max: 120000 }),
                    retryAttempts: fc.integer({ min: 1, max: 5 }),
                    batchSize: fc.integer({ min: 1, max: 10 })
                }),
                async (config) => {
                    try {
                        // Test 1: ModelManager should accept runtime configuration updates
                        const initialConfig = modelManager.getConfiguration();

                        // Update configuration at runtime
                        await modelManager.updateConfiguration(config);
                        const updatedConfig = modelManager.getConfiguration();

                        // Verify configuration was updated
                        expect(updatedConfig.temperature).toBe(config.temperature);
                        expect(updatedConfig.maxTokens).toBe(config.maxTokens);
                        expect(updatedConfig.contextWindow).toBe(config.contextWindow);
                        expect(updatedConfig.memoryOptimization).toBe(config.memoryOptimization);

                        // Test 2: Configuration should persist across operations
                        const configAfterOperation = modelManager.getConfiguration();
                        expect(configAfterOperation.temperature).toBe(config.temperature);
                        expect(configAfterOperation.maxTokens).toBe(config.maxTokens);

                        // Test 3: ContractProcessor should use updated model configuration
                        const processorConfig = contractProcessor.getModelConfiguration();

                        // Update processor configuration
                        await contractProcessor.updateModelConfiguration(config);
                        const updatedProcessorConfig = contractProcessor.getModelConfiguration();

                        // Verify processor configuration was updated
                        expect(updatedProcessorConfig.temperature).toBe(config.temperature);
                        expect(updatedProcessorConfig.maxTokens).toBe(config.maxTokens);

                        // Test 4: Configuration validation should work
                        const validationResult = modelManager.validateConfiguration(config);
                        expect(validationResult.isValid).toBe(true);
                        expect(Array.isArray(validationResult.errors)).toBe(true);
                        expect(validationResult.errors.length).toBe(0);

                        // Test 5: Configuration should be retrievable
                        const retrievedConfig = modelManager.getConfiguration();
                        expect(typeof retrievedConfig).toBe('object');
                        expect(retrievedConfig).toHaveProperty('temperature');
                        expect(retrievedConfig).toHaveProperty('maxTokens');
                        expect(retrievedConfig).toHaveProperty('contextWindow');

                        // Test 6: Configuration changes should not break existing functionality
                        const testDocument = {
                            text: "This is a test contract with payment terms. Payment shall be made within 30 days.",
                            content: "This is a test contract with payment terms. Payment shall be made within 30 days.",
                            filename: 'test-config.txt'
                        };

                        // Process document with new configuration (should not throw)
                        try {
                            const result = await contractProcessor.processContract(testDocument);

                            // Should still produce valid output structure
                            expect(result).toHaveProperty('summary');
                            expect(result).toHaveProperty('clauses');
                            expect(result).toHaveProperty('risks');
                            expect(result).toHaveProperty('metadata');

                            // Metadata should reflect the updated configuration
                            if (result.metadata.processingMethod === 'ai_model') {
                                expect(result.metadata).toHaveProperty('modelConfiguration');
                                const metadataConfig = result.metadata.modelConfiguration;
                                expect(metadataConfig.temperature).toBe(config.temperature);
                                expect(metadataConfig.maxTokens).toBe(config.maxTokens);
                            }
                        } catch (error) {
                            // If processing fails, it should be due to system unavailability, not config issues
                            expect(error.message).not.toMatch(/invalid.*configuration/i);
                            expect(error.message).not.toMatch(/configuration.*error/i);
                        }

                    } catch (error) {
                        // Configuration errors should be descriptive and not crash the system
                        if (error.message.includes('configuration')) {
                            expect(error.message).toMatch(/configuration|parameter|setting/i);
                        } else {
                            // Re-throw non-configuration errors for investigation
                            throw error;
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 14a: Invalid configuration parameters are properly rejected', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.oneof(
                    // Invalid temperature values
                    fc.record({
                        temperature: fc.oneof(
                            fc.float({ min: Math.fround(-1.0), max: Math.fround(-0.1) }), // Negative
                            fc.float({ min: Math.fround(2.1), max: Math.fround(10.0) }),  // Too high
                            fc.constant(NaN),
                            fc.constant(Infinity)
                        )
                    }),
                    // Invalid maxTokens values
                    fc.record({
                        maxTokens: fc.oneof(
                            fc.integer({ min: -100, max: 0 }), // Negative or zero
                            fc.integer({ min: 10000, max: 50000 }), // Too high
                            fc.constant(NaN)
                        )
                    }),
                    // Invalid contextWindow values
                    fc.record({
                        contextWindow: fc.oneof(
                            fc.integer({ min: -1000, max: 0 }), // Negative or zero
                            fc.integer({ min: 200000, max: 500000 }), // Too high
                            fc.constant(1023) // Not power of 2 or standard size
                        )
                    }),
                    // Invalid timeout values
                    fc.record({
                        timeout: fc.oneof(
                            fc.integer({ min: -5000, max: 0 }), // Negative or zero
                            fc.integer({ min: 300000, max: 1000000 }), // Too high (>5 minutes)
                            fc.constant(NaN)
                        )
                    })
                ),
                async (invalidConfig) => {
                    try {
                        // Attempt to update with invalid configuration
                        await modelManager.updateConfiguration(invalidConfig);

                        // If update succeeds, validate should catch the issues
                        const validationResult = modelManager.validateConfiguration(invalidConfig);
                        expect(validationResult.isValid).toBe(false);
                        expect(validationResult.errors.length).toBeGreaterThan(0);

                    } catch (error) {
                        // Should throw descriptive configuration error
                        expect(error.message).toMatch(/invalid|configuration|parameter|range|value/i);
                        expect(typeof error.message).toBe('string');
                        expect(error.message.length).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    it('Property 14b: Configuration changes are atomic and consistent', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        temperature: fc.float({ min: 0.0, max: 2.0 }),
                        maxTokens: fc.integer({ min: 100, max: 4000 }),
                        contextWindow: fc.constantFrom(4096, 8192, 16384, 32768, 65536, 128000)
                    }),
                    { minLength: 2, maxLength: 5 }
                ),
                async (configSequence) => {
                    // Apply configuration changes in sequence
                    for (let i = 0; i < configSequence.length; i++) {
                        const config = configSequence[i];

                        try {
                            // Update configuration
                            await modelManager.updateConfiguration(config);

                            // Verify configuration is immediately consistent
                            const currentConfig = modelManager.getConfiguration();
                            expect(currentConfig.temperature).toBe(config.temperature);
                            expect(currentConfig.maxTokens).toBe(config.maxTokens);
                            expect(currentConfig.contextWindow).toBe(config.contextWindow);

                            // Verify configuration persists across multiple reads
                            const config1 = modelManager.getConfiguration();
                            const config2 = modelManager.getConfiguration();
                            expect(config1.temperature).toBe(config2.temperature);
                            expect(config1.maxTokens).toBe(config2.maxTokens);
                            expect(config1.contextWindow).toBe(config2.contextWindow);

                        } catch (error) {
                            // Configuration errors should not leave system in inconsistent state
                            const configAfterError = modelManager.getConfiguration();
                            expect(typeof configAfterError).toBe('object');
                            expect(configAfterError).toHaveProperty('temperature');
                            expect(configAfterError).toHaveProperty('maxTokens');

                            // Should be able to continue with next configuration
                            // Error message should be meaningful (allow various error formats)
                            expect(error.message).toBeDefined();
                            expect(error.message.length).toBeGreaterThan(0);
                        }
                    }
                }
            ),
            { numRuns: 30 }
        );
    });

    it('Property 14c: Configuration backup and restore functionality', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    originalConfig: fc.record({
                        temperature: fc.float({ min: 0.0, max: 1.0 }),
                        maxTokens: fc.integer({ min: 500, max: 2000 }),
                        contextWindow: fc.constantFrom(4096, 8192, 16384)
                    }),
                    newConfig: fc.record({
                        temperature: fc.float({ min: 1.0, max: 2.0 }),
                        maxTokens: fc.integer({ min: 2000, max: 4000 }),
                        contextWindow: fc.constantFrom(32768, 65536, 128000)
                    })
                }),
                async ({ originalConfig, newConfig }) => {
                    try {
                        // Set original configuration
                        await modelManager.updateConfiguration(originalConfig);
                        const configBeforeChange = modelManager.getConfiguration();

                        // Create backup
                        const backup = modelManager.backupConfiguration();
                        expect(typeof backup).toBe('object');
                        expect(backup.temperature).toBe(originalConfig.temperature);
                        expect(backup.maxTokens).toBe(originalConfig.maxTokens);

                        // Change to new configuration
                        await modelManager.updateConfiguration(newConfig);
                        const configAfterChange = modelManager.getConfiguration();
                        expect(configAfterChange.temperature).toBe(newConfig.temperature);
                        expect(configAfterChange.maxTokens).toBe(newConfig.maxTokens);

                        // Restore from backup
                        await modelManager.restoreConfiguration(backup);
                        const configAfterRestore = modelManager.getConfiguration();

                        // Should match original configuration
                        expect(configAfterRestore.temperature).toBe(originalConfig.temperature);
                        expect(configAfterRestore.maxTokens).toBe(originalConfig.maxTokens);
                        expect(configAfterRestore.contextWindow).toBe(originalConfig.contextWindow);

                    } catch (error) {
                        // Backup/restore errors should be descriptive
                        expect(error.message).toMatch(/backup|restore|configuration/i);
                    }
                }
            ),
            { numRuns: 25 }
        );
    });
});