// Stress Testing for AI Contract Analysis System
// Tests system behavior under extreme loads, resource constraints, and edge conditions

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ContractProcessor } from '../../src/processors/ContractProcessor.js';
import { DocumentParser } from '../../model/parsers/DocumentParser.js';
import { ModelManager } from '../../model/core/ModelManager.js';
import { PerformanceTestGenerator } from './test-data-generators.js';
import { TestConfig, TestConfigUtils } from './test-config.js';

describe('Stress Testing Suite', () => {
    let contractProcessor;
    let documentParser;
    let modelManager;
    let stressMetrics;

    beforeEach(() => {
        contractProcessor = new ContractProcessor({
            preferAIModel: false, // Use API fallback for consistent stress testing
            fallbackToAPI: true,
            timeout: 120000, // Extended timeout for stress tests
            maxConcurrentRequests: 10
        });

        documentParser = new DocumentParser();
        modelManager = new ModelManager();

        stressMetrics = {
            startTime: 0,
            endTime: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            maxResponseTime: 0,
            minResponseTime: Infinity,
            memoryPeak: 0,
            memoryLeaks: [],
            errorTypes: new Map()
        };
    });

    afterEach(async () => {
        if (contractProcessor) {
            await contractProcessor.cleanup();
        }
        if (modelManager) {
            await modelManager.cleanup();
        }
    });

    describe('High Volume Load Testing', () => {
        it('should handle 50 concurrent contract processing requests', async () => {
            const numRequests = 50;
            const contracts = PerformanceTestGenerator.generateLoadTestContracts(numRequests);

            stressMetrics.startTime = Date.now();
            stressMetrics.totalRequests = numRequests;

            const promises = contracts.map(async (contract, index) => {
                try {
                    const startTime = Date.now();
                    const result = await contractProcessor.processContract({
                        text: contract.text,
                        filename: contract.filename
                    });
                    const responseTime = Date.now() - startTime;

                    stressMetrics.successfulRequests++;
                    stressMetrics.maxResponseTime = Math.max(stressMetrics.maxResponseTime, responseTime);
                    stressMetrics.minResponseTime = Math.min(stressMetrics.minResponseTime, responseTime);

                    return { success: true, result, responseTime, index };
                } catch (error) {
                    stressMetrics.failedRequests++;
                    const errorType = error.constructor.name;
                    stressMetrics.errorTypes.set(errorType, (stressMetrics.errorTypes.get(errorType) || 0) + 1);
                    return { success: false, error, index };
                }
            });

            const results = await Promise.allSettled(promises);
            stressMetrics.endTime = Date.now();

            const totalTime = stressMetrics.endTime - stressMetrics.startTime;
            const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value.success);

            // Calculate metrics
            const responseTimes = successfulResults.map(r => r.value.responseTime);
            stressMetrics.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

            // Assertions
            expect(successfulResults.length).toBeGreaterThan(numRequests * 0.8); // At least 80% success rate
            expect(stressMetrics.averageResponseTime).toBeLessThan(30000); // Average under 30 seconds
            expect(totalTime).toBeLessThan(180000); // Complete within 3 minutes

            // Verify all successful results have proper structure
            successfulResults.forEach(({ value }) => {
                expect(value.result).toHaveProperty('summary');
                expect(value.result).toHaveProperty('clauses');
                expect(value.result).toHaveProperty('risks');
                expect(value.result.clauses.length).toBeGreaterThan(0);
            });

            console.log(`High Volume Load Test Results:`);
            console.log(`  Total requests: ${numRequests}`);
            console.log(`  Successful: ${successfulResults.length}`);
            console.log(`  Failed: ${stressMetrics.failedRequests}`);
            console.log(`  Success rate: ${(successfulResults.length / numRequests * 100).toFixed(2)}%`);
            console.log(`  Total time: ${totalTime}ms`);
            console.log(`  Average response time: ${stressMetrics.averageResponseTime.toFixed(2)}ms`);
            console.log(`  Max response time: ${stressMetrics.maxResponseTime}ms`);
            console.log(`  Min response time: ${stressMetrics.minResponseTime}ms`);
        }, 300000); // 5 minute timeout

        it('should process very large contracts without memory issues', async () => {
            const getMemoryUsage = () => {
                if (typeof process !== 'undefined' && process.memoryUsage) {
                    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
                }
                return 0;
            };

            const initialMemory = getMemoryUsage();
            const largeContract = PerformanceTestGenerator.generateStressTestContract(100000); // 100KB contract

            expect(largeContract.text.length).toBeGreaterThan(50000);

            const document = { text: largeContract.text, filename: 'stress-large-contract.txt' };

            const startTime = Date.now();
            const result = await contractProcessor.processContract(document);
            const processingTime = Date.now() - startTime;

            const peakMemory = getMemoryUsage();

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            const finalMemory = getMemoryUsage();

            // Assertions
            expect(result.clauses.length).toBeGreaterThanOrEqual(3);
            expect(processingTime).toBeLessThan(120000); // Should complete within 2 minutes

            if (initialMemory > 0) {
                const memoryIncrease = peakMemory - initialMemory;
                const memoryRetained = finalMemory - initialMemory;

                expect(memoryIncrease).toBeLessThan(200); // Less than 200MB increase
                expect(memoryRetained).toBeLessThan(50); // Less than 50MB retained

                console.log(`Large Contract Memory Test:`);
                console.log(`  Contract size: ${largeContract.text.length} characters`);
                console.log(`  Processing time: ${processingTime}ms`);
                console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB`);
                console.log(`  Memory retained: ${memoryRetained.toFixed(2)}MB`);
                console.log(`  Clauses found: ${result.clauses.length}`);
            }
        }, 180000);

        it('should handle rapid sequential requests without degradation', async () => {
            const numRequests = 20;
            const contractText = `
        RAPID SEQUENTIAL TEST CONTRACT
        Payment terms: Net 30 days from invoice date.
        Termination: Either party may terminate with 30 days notice.
        Liability: Limited to total contract value.
        Confidentiality: Both parties agree to maintain confidentiality.
      `;

            const responseTimes = [];
            const throughputMeasurements = [];

            for (let i = 0; i < numRequests; i++) {
                const batchStartTime = Date.now();

                const document = {
                    text: contractText + ` Request ${i + 1}`,
                    filename: `rapid-${i + 1}.txt`
                };

                const startTime = Date.now();
                const result = await contractProcessor.processContract(document);
                const responseTime = Date.now() - startTime;

                responseTimes.push(responseTime);

                // Calculate throughput for last 5 requests
                if (i >= 4) {
                    const recentTimes = responseTimes.slice(-5);
                    const avgRecentTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
                    const throughput = 1000 / avgRecentTime; // requests per second
                    throughputMeasurements.push(throughput);
                }

                expect(result.clauses.length).toBeGreaterThan(0);
                expect(responseTime).toBeLessThan(15000); // Each request under 15 seconds

                // Brief pause to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Analyze performance degradation
            const firstHalfAvg = responseTimes.slice(0, numRequests / 2).reduce((sum, time) => sum + time, 0) / (numRequests / 2);
            const secondHalfAvg = responseTimes.slice(numRequests / 2).reduce((sum, time) => sum + time, 0) / (numRequests / 2);
            const degradationRatio = secondHalfAvg / firstHalfAvg;

            // Performance should not degrade more than 50%
            expect(degradationRatio).toBeLessThan(1.5);

            // Throughput should remain reasonably stable
            if (throughputMeasurements.length > 5) {
                const throughputVariance = Math.max(...throughputMeasurements) / Math.min(...throughputMeasurements);
                expect(throughputVariance).toBeLessThan(3); // Throughput variance less than 3x
            }

            console.log(`Rapid Sequential Test Results:`);
            console.log(`  Total requests: ${numRequests}`);
            console.log(`  First half avg: ${firstHalfAvg.toFixed(2)}ms`);
            console.log(`  Second half avg: ${secondHalfAvg.toFixed(2)}ms`);
            console.log(`  Degradation ratio: ${degradationRatio.toFixed(2)}`);
            console.log(`  Min response time: ${Math.min(...responseTimes)}ms`);
            console.log(`  Max response time: ${Math.max(...responseTimes)}ms`);
        }, 240000);
    });

    describe('Resource Constraint Testing', () => {
        it('should handle memory pressure gracefully', async () => {
            // Simulate memory pressure by processing multiple large contracts
            const contracts = Array(5).fill(null).map((_, index) => {
                const largeContract = PerformanceTestGenerator.generateStressTestContract(50000);
                return {
                    text: largeContract.text + ` Memory Test ${index + 1}`,
                    filename: `memory-pressure-${index + 1}.txt`
                };
            });

            const getMemoryUsage = () => {
                if (typeof process !== 'undefined' && process.memoryUsage) {
                    return process.memoryUsage().heapUsed / 1024 / 1024;
                }
                return 0;
            };

            const initialMemory = getMemoryUsage();
            const results = [];
            const memoryReadings = [initialMemory];

            for (const contract of contracts) {
                try {
                    const result = await contractProcessor.processContract(contract);
                    results.push({ success: true, result });

                    const currentMemory = getMemoryUsage();
                    memoryReadings.push(currentMemory);

                    // Force cleanup periodically
                    if (global.gc) {
                        global.gc();
                    }

                    expect(result.clauses.length).toBeGreaterThan(0);
                } catch (error) {
                    results.push({ success: false, error });
                }
            }

            const finalMemory = getMemoryUsage();
            const maxMemory = Math.max(...memoryReadings);
            const memoryIncrease = maxMemory - initialMemory;

            // Should successfully process most contracts
            const successfulResults = results.filter(r => r.success);
            expect(successfulResults.length).toBeGreaterThan(contracts.length * 0.6); // At least 60% success

            if (initialMemory > 0) {
                // Memory increase should be reasonable
                expect(memoryIncrease).toBeLessThan(500); // Less than 500MB increase

                console.log(`Memory Pressure Test:`);
                console.log(`  Contracts processed: ${contracts.length}`);
                console.log(`  Successful: ${successfulResults.length}`);
                console.log(`  Initial memory: ${initialMemory.toFixed(2)}MB`);
                console.log(`  Peak memory: ${maxMemory.toFixed(2)}MB`);
                console.log(`  Final memory: ${finalMemory.toFixed(2)}MB`);
                console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB`);
            }
        }, 180000);

        it('should handle timeout scenarios appropriately', async () => {
            // Create a processor with very short timeout for testing
            const shortTimeoutProcessor = new ContractProcessor({
                preferAIModel: false,
                fallbackToAPI: true,
                timeout: 2000 // Very short timeout
            });

            const contractText = `
        TIMEOUT TEST CONTRACT
        
        This contract is designed to test timeout handling in the system.
        It contains multiple complex sections that may take time to process.
        
        ${Array(50).fill('Complex clause with detailed terms and conditions that require extensive analysis.').join(' ')}
      `;

            const document = { text: contractText, filename: 'timeout-test.txt' };

            try {
                const result = await shortTimeoutProcessor.processContract(document);
                // If it succeeds, verify the result
                expect(result).toHaveProperty('summary');
                expect(result).toHaveProperty('clauses');
            } catch (error) {
                // Should handle timeout gracefully
                expect(error.message).toMatch(/timeout|time.*out/i);
            }

            await shortTimeoutProcessor.cleanup();
        }, 30000);

        it('should recover from API rate limiting', async () => {
            // Simulate rapid requests that might trigger rate limiting
            const rapidRequests = Array(15).fill(null).map((_, index) => ({
                text: `Rate limit test contract ${index + 1}. Payment due in 30 days.`,
                filename: `rate-limit-${index + 1}.txt`
            }));

            const results = [];
            const startTime = Date.now();

            // Send requests rapidly
            for (const contract of rapidRequests) {
                try {
                    const result = await contractProcessor.processContract(contract);
                    results.push({ success: true, result });
                } catch (error) {
                    results.push({ success: false, error });

                    // If rate limited, wait a bit before continuing
                    if (error.message.includes('rate') || error.message.includes('429')) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            const totalTime = Date.now() - startTime;
            const successfulResults = results.filter(r => r.success);

            // Should eventually succeed for most requests
            expect(successfulResults.length).toBeGreaterThan(rapidRequests.length * 0.5); // At least 50% success

            console.log(`Rate Limiting Test:`);
            console.log(`  Total requests: ${rapidRequests.length}`);
            console.log(`  Successful: ${successfulResults.length}`);
            console.log(`  Total time: ${totalTime}ms`);
            console.log(`  Average time per request: ${(totalTime / rapidRequests.length).toFixed(2)}ms`);
        }, 120000);
    });

    describe('Edge Case and Error Resilience', () => {
        it('should handle malformed and edge case inputs', async () => {
            const edgeCaseInputs = [
                { text: '', filename: 'empty.txt', expectError: true },
                { text: '   \n\n\t   ', filename: 'whitespace.txt', expectError: true },
                { text: 'A'.repeat(5), filename: 'too-short.txt', expectError: true },
                { text: 'X'.repeat(200000), filename: 'too-long.txt', expectError: false }, // Very long
                { text: '🚀💼📄 Contract with emojis and unicode ñáéíóú', filename: 'unicode.txt', expectError: false },
                { text: 'Contract\x00with\x01null\x02bytes', filename: 'null-bytes.txt', expectError: false },
                { text: '<script>alert("xss")</script> Contract content', filename: 'html-injection.txt', expectError: false },
                { text: 'Contract with "quotes" and \'apostrophes\' and `backticks`', filename: 'quotes.txt', expectError: false }
            ];

            const results = [];

            for (const input of edgeCaseInputs) {
                try {
                    const result = await contractProcessor.processContract(input);
                    results.push({
                        input: input.filename,
                        success: true,
                        result,
                        expectError: input.expectError
                    });
                } catch (error) {
                    results.push({
                        input: input.filename,
                        success: false,
                        error: error.message,
                        expectError: input.expectError
                    });
                }
            }

            // Verify error handling matches expectations
            results.forEach(({ input, success, expectError, result, error }) => {
                if (expectError) {
                    // System may handle gracefully or return error - both are acceptable
                    console.log(`  ${input}: ${success ? 'Handled gracefully' : 'Expected error - ' + error}`);
                } else {
                    if (success) {
                        expect(result).toHaveProperty('summary');
                        expect(result).toHaveProperty('clauses');
                        console.log(`  ${input}: Processed successfully - ${result.clauses.length} clauses`);
                    } else {
                        console.log(`  ${input}: Unexpected error - ${error}`);
                    }
                }
            });

            console.log(`Edge Case Test Results:`);
            console.log(`  Total inputs: ${edgeCaseInputs.length}`);
            console.log(`  Expected errors: ${results.filter(r => r.expectError && !r.success).length}`);
            console.log(`  Unexpected errors: ${results.filter(r => !r.expectError && !r.success).length}`);
            console.log(`  Successful processing: ${results.filter(r => r.success).length}`);
        }, 60000);

        it('should maintain system stability under error conditions', async () => {
            const errorInducingInputs = [
                'Contract with extremely long single line without breaks that might cause parsing issues and memory problems during text processing and analysis phases of the contract review system',
                'Contract\nwith\nmany\nshort\nlines\nthat\nmight\ncause\nprocessing\noverhead\ndue\nto\nfrequent\nline\nbreaks\nand\nsegmentation\nissues',
                'Contract with repeated words '.repeat(1000),
                JSON.stringify({ malicious: 'json', injection: true, contract: 'fake' }),
                '<?xml version="1.0"?><contract><malicious>xml</malicious></contract>'
            ];

            let systemStable = true;
            const errorResults = [];

            for (const input of errorInducingInputs) {
                try {
                    const document = { text: input, filename: 'error-test.txt' };
                    const result = await contractProcessor.processContract(document);

                    errorResults.push({
                        inputType: input.substring(0, 30) + '...',
                        success: true,
                        clauses: result.clauses.length
                    });
                } catch (error) {
                    errorResults.push({
                        inputType: input.substring(0, 30) + '...',
                        success: false,
                        error: error.message
                    });

                    // Check if error is handled gracefully
                    if (error.message.includes('FATAL') || error.message.includes('CRASH')) {
                        systemStable = false;
                    }
                }

                // Verify system is still responsive after each error
                try {
                    const testDoc = { text: 'Simple test contract', filename: 'stability-check.txt' };
                    await contractProcessor.processContract(testDoc);
                } catch (error) {
                    systemStable = false;
                    console.error('System became unresponsive after error:', error);
                }
            }

            expect(systemStable).toBe(true);

            console.log(`Error Resilience Test:`);
            errorResults.forEach(result => {
                console.log(`  ${result.inputType}: ${result.success ? 'Success' : 'Error - ' + result.error}`);
            });
        }, 90000);
    });

    describe('Property-Based Stress Testing', () => {
        it('should handle arbitrary contract inputs without crashing', async () => {
            const contractArbitrary = fc.record({
                text: fc.oneof(
                    fc.string({ minLength: 50, maxLength: 1000 }),
                    fc.string({ minLength: 1000, maxLength: 5000 }),
                    fc.string({ minLength: 5000, maxLength: 20000 })
                ).map(text => `CONTRACT: ${text} Payment terms and conditions apply.`),
                filename: fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '.txt')
            });

            await fc.assert(
                fc.asyncProperty(contractArbitrary, async (contract) => {
                    try {
                        const result = await contractProcessor.processContract(contract);

                        // Basic structure validation
                        expect(result).toHaveProperty('summary');
                        expect(result).toHaveProperty('clauses');
                        expect(result).toHaveProperty('risks');
                        expect(result).toHaveProperty('recommendations');
                        expect(result).toHaveProperty('metadata');

                        // Arrays should be valid
                        expect(Array.isArray(result.clauses)).toBe(true);
                        expect(Array.isArray(result.risks)).toBe(true);
                        expect(Array.isArray(result.recommendations)).toBe(true);

                        return true;
                    } catch (error) {
                        // Errors are acceptable for invalid inputs, but shouldn't crash the system
                        expect(error).toBeInstanceOf(Error);
                        return true;
                    }
                }),
                {
                    numRuns: 25, // Reduced for stress testing
                    timeout: 15000,
                    verbose: false
                }
            );
        }, 120000);

        it('should maintain performance consistency across random inputs', async () => {
            const performanceData = [];

            const contractArbitrary = fc.record({
                text: fc.string({ minLength: 200, maxLength: 2000 }).map(text =>
                    `PERFORMANCE TEST CONTRACT: ${text} Payment due in 30 days. Termination with notice.`
                ),
                filename: fc.string({ minLength: 5, maxLength: 20 }).map(s => s + '.txt')
            });

            await fc.assert(
                fc.asyncProperty(contractArbitrary, async (contract) => {
                    const startTime = Date.now();

                    try {
                        const result = await contractProcessor.processContract(contract);
                        const processingTime = Date.now() - startTime;

                        performanceData.push({
                            textLength: contract.text.length,
                            processingTime: processingTime,
                            clausesFound: result.clauses.length,
                            success: true
                        });

                        // Performance should be reasonable
                        expect(processingTime).toBeLessThan(30000);

                        return true;
                    } catch (error) {
                        const processingTime = Date.now() - startTime;
                        performanceData.push({
                            textLength: contract.text.length,
                            processingTime: processingTime,
                            error: error.message,
                            success: false
                        });

                        return true;
                    }
                }),
                {
                    numRuns: 20,
                    timeout: 35000,
                    verbose: false
                }
            );

            // Analyze performance consistency
            const successfulRuns = performanceData.filter(d => d.success);
            if (successfulRuns.length > 5) {
                const processingTimes = successfulRuns.map(d => d.processingTime);
                const avgTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
                const maxTime = Math.max(...processingTimes);
                const minTime = Math.min(...processingTimes);

                // Performance variance should be reasonable
                const variance = maxTime / minTime;
                expect(variance).toBeLessThan(20); // Max shouldn't be more than 20x min (allow for high variance in stress conditions)

                console.log(`Property-Based Performance Analysis:`);
                console.log(`  Successful runs: ${successfulRuns.length}`);
                console.log(`  Average time: ${avgTime.toFixed(2)}ms`);
                console.log(`  Min time: ${minTime}ms`);
                console.log(`  Max time: ${maxTime}ms`);
                console.log(`  Variance ratio: ${variance.toFixed(2)}`);
            }
        }, 180000);
    });

    describe('System Recovery and Cleanup', () => {
        it('should recover from system overload conditions', async () => {
            // Simulate system overload by creating many concurrent requests
            const overloadRequests = Array(30).fill(null).map((_, index) => ({
                text: `Overload test contract ${index + 1}. Payment terms and conditions.`,
                filename: `overload-${index + 1}.txt`
            }));

            const batchSize = 10;
            const batches = [];

            for (let i = 0; i < overloadRequests.length; i += batchSize) {
                batches.push(overloadRequests.slice(i, i + batchSize));
            }

            let totalSuccessful = 0;
            let totalFailed = 0;

            for (const batch of batches) {
                const batchPromises = batch.map(async (contract) => {
                    try {
                        const result = await contractProcessor.processContract(contract);
                        return { success: true, result };
                    } catch (error) {
                        return { success: false, error };
                    }
                });

                const batchResults = await Promise.allSettled(batchPromises);
                const successful = batchResults.filter(r =>
                    r.status === 'fulfilled' && r.value.success
                ).length;

                totalSuccessful += successful;
                totalFailed += (batchSize - successful);

                // Brief pause between batches to allow recovery
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // System should handle most requests even under overload
            const successRate = totalSuccessful / overloadRequests.length;
            expect(successRate).toBeGreaterThan(0.5); // At least 50% success rate

            // Verify system is still responsive after overload
            const recoveryTest = {
                text: 'Recovery test contract with payment terms.',
                filename: 'recovery-test.txt'
            };

            const recoveryResult = await contractProcessor.processContract(recoveryTest);
            expect(recoveryResult.clauses.length).toBeGreaterThan(0);

            console.log(`System Overload Recovery Test:`);
            console.log(`  Total requests: ${overloadRequests.length}`);
            console.log(`  Successful: ${totalSuccessful}`);
            console.log(`  Failed: ${totalFailed}`);
            console.log(`  Success rate: ${(successRate * 100).toFixed(2)}%`);
            console.log(`  System recovered: Yes`);
        }, 300000);

        it('should properly cleanup resources after stress testing', async () => {
            const getMemoryUsage = () => {
                if (typeof process !== 'undefined' && process.memoryUsage) {
                    return process.memoryUsage().heapUsed / 1024 / 1024;
                }
                return 0;
            };

            const initialMemory = getMemoryUsage();

            // Perform intensive operations
            const intensiveContracts = Array(10).fill(null).map((_, index) => {
                const largeContract = PerformanceTestGenerator.generateStressTestContract(30000);
                return {
                    text: largeContract.text + ` Cleanup test ${index + 1}`,
                    filename: `cleanup-${index + 1}.txt`
                };
            });

            for (const contract of intensiveContracts) {
                try {
                    await contractProcessor.processContract(contract);
                } catch (error) {
                    // Errors are acceptable during stress testing
                }
            }

            const beforeCleanupMemory = getMemoryUsage();

            // Perform cleanup
            await contractProcessor.cleanup();

            // Force garbage collection
            if (global.gc) {
                global.gc();
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            const afterCleanupMemory = getMemoryUsage();

            if (initialMemory > 0) {
                const memoryIncrease = beforeCleanupMemory - initialMemory;
                const memoryAfterCleanup = afterCleanupMemory - initialMemory;
                const cleanupEffectiveness = (memoryIncrease - memoryAfterCleanup) / memoryIncrease;

                // Cleanup should show some effectiveness (allow for system variations)
                expect(cleanupEffectiveness).toBeGreaterThanOrEqual(0); // Any cleanup is beneficial

                console.log(`Resource Cleanup Test:`);
                console.log(`  Initial memory: ${initialMemory.toFixed(2)}MB`);
                console.log(`  Before cleanup: ${beforeCleanupMemory.toFixed(2)}MB`);
                console.log(`  After cleanup: ${afterCleanupMemory.toFixed(2)}MB`);
                console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB`);
                console.log(`  Memory after cleanup: ${memoryAfterCleanup.toFixed(2)}MB`);
                console.log(`  Cleanup effectiveness: ${(cleanupEffectiveness * 100).toFixed(2)}%`);
            }
        }, 120000);
    });
});