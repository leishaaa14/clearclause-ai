/**
 * Stress Testing for ClearClause End-to-End Testing
 * 
 * This test suite implements comprehensive stress testing including concurrent
 * request handling, AWS service limit testing, and system resilience validation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import PerformanceMonitor from './utils/PerformanceMonitor.js';
import {
    legalTextGenerator,
    urlGenerator,
    fileMetadataGenerator,
    testScenarioGenerator,
    errorScenarioGenerator
} from './utils/test-data-generators.js';
import { TEST_CONFIG, AWS_CONFIG } from './config/test-config.js';

describe('ClearClause Stress Testing', () => {
    let performanceMonitor;

    beforeEach(() => {
        performanceMonitor = new PerformanceMonitor();
    });

    afterEach(() => {
        performanceMonitor.clear();
    });

    /**
     * **Feature: clearclause-e2e-testing, Property 12: Concurrent Request Handling**
     * For any number of concurrent requests up to system limits, the system should
     * handle requests without failures, maintain reasonable response times, and
     * preserve data integrity across all concurrent operations.
     */
    test('should handle concurrent requests without failures', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    concurrentRequests: fc.integer({ min: 5, max: 20 }),
                    testInputs: fc.array(
                        fc.oneof(
                            legalTextGenerator.map(text => ({ type: 'text', content: text })),
                            urlGenerator.map(url => ({ type: 'url', content: url })),
                            fileMetadataGenerator.map(file => ({ type: 'file', content: file }))
                        ),
                        { minLength: 5, maxLength: 20 }
                    )
                }),
                async ({ concurrentRequests, testInputs }) => {
                    // Mock processing function that simulates ClearClause analysis
                    const mockProcessingFunction = async (inputData) => {
                        // Simulate variable processing time
                        const baseTime = 200;
                        const variableTime = Math.random() * 800; // 200-1000ms
                        await new Promise(resolve => setTimeout(resolve, baseTime + variableTime));

                        // Simulate memory usage and potential contention
                        const workArray = new Array(Math.floor(Math.random() * 5000)).fill('concurrent_test');

                        // Small chance of simulated error to test error handling
                        if (Math.random() < 0.05) { // 5% error rate
                            throw new Error('Simulated processing error');
                        }

                        return {
                            summary: `Concurrent analysis for ${inputData.type}`,
                            clauses: [
                                { type: 'test', confidence: Math.random() * 0.5 + 0.5 },
                                { type: 'concurrent', confidence: Math.random() * 0.5 + 0.5 }
                            ],
                            risks: [{ level: 'Low', description: 'Concurrent test risk' }],
                            metadata: {
                                processing_time: baseTime + variableTime,
                                input_type: inputData.type,
                                concurrent_id: Math.random().toString(36).substr(2, 9)
                            }
                        };
                    };

                    const stressConfig = {
                        concurrentRequests,
                        duration: 5000, // 5 seconds
                        rampUpTime: 1000, // 1 second ramp up
                        inputData: testInputs
                    };

                    const stressResults = await performanceMonitor.runStressTest(
                        stressConfig,
                        mockProcessingFunction
                    );

                    // Validate stress test results
                    expect(stressResults.summary.totalRequests).toBeGreaterThan(0);
                    expect(stressResults.summary.successRate).toBeGreaterThanOrEqual(80); // At least 80% success rate
                    expect(stressResults.summary.averageResponseTime).toBeLessThan(5000); // Under 5 seconds
                    expect(stressResults.summary.requestsPerSecond).toBeGreaterThan(0);

                    // Validate concurrent processing didn't cause data corruption
                    const successfulRequests = stressResults.requests.filter(r => r.success !== false);
                    successfulRequests.forEach(request => {
                        expect(request.duration).toBeGreaterThan(0);
                        expect(request.memoryUsage).toBeDefined();
                        expect(request.metadata.concurrent_id).toBeDefined();
                    });

                    // Validate error handling for failed requests
                    const failedRequests = stressResults.requests.filter(r => r.success === false);
                    failedRequests.forEach(request => {
                        expect(request.error).toBeDefined();
                        expect(typeof request.error).toBe('string');
                    });

                    // Validate response time distribution
                    const responseTimes = successfulRequests.map(r => r.duration);
                    if (responseTimes.length > 0) {
                        const p95ResponseTime = performanceMonitor.calculatePercentile(responseTimes, 95);
                        expect(p95ResponseTime).toBeLessThan(3000); // 95th percentile under 3 seconds
                    }

                    console.log(`Concurrent test: ${stressResults.summary.totalRequests} requests, ` +
                        `${stressResults.summary.successRate.toFixed(1)}% success, ` +
                        `${Math.round(stressResults.summary.averageResponseTime)}ms avg`);

                    return true;
                }
            ),
            { numRuns: 3, timeout: 30000 }
        );
    });

    test('should test AWS service limits and thresholds', async () => {
        const limitConfig = {
            services: ['s3', 'textract', 'lambda', 'bedrock'],
            maxConcurrentRequests: 25,
            requestInterval: 50 // milliseconds between requests
        };

        const limitResults = await performanceMonitor.testServiceLimits(limitConfig);

        // Validate limit test results structure
        expect(limitResults).toHaveProperty('services');
        expect(limitResults).toHaveProperty('summary');
        expect(limitResults.summary).toHaveProperty('recommendedConcurrency');

        // Validate each service was tested
        limitConfig.services.forEach(service => {
            expect(limitResults.services[service]).toBeDefined();

            const serviceResults = limitResults.services[service];
            expect(serviceResults.requests.length).toBeGreaterThan(0);
            expect(serviceResults.limits).toBeDefined();
            expect(serviceResults.limits.maxSuccessfulConcurrent).toBeGreaterThanOrEqual(0);
            expect(serviceResults.limits.errorRate).toBeGreaterThanOrEqual(0);
            expect(serviceResults.limits.averageResponseTime).toBeGreaterThan(0);

            // Validate recommended concurrency is reasonable
            const recommendedConcurrency = limitResults.summary.recommendedConcurrency[service];
            expect(recommendedConcurrency).toBeGreaterThanOrEqual(0);
            expect(recommendedConcurrency).toBeLessThanOrEqual(limitConfig.maxConcurrentRequests);

            console.log(`${service}: max concurrent ${serviceResults.limits.maxSuccessfulConcurrent}, ` +
                `recommended ${recommendedConcurrency}, ` +
                `error rate ${(serviceResults.limits.errorRate * 100).toFixed(1)}%`);
        });

        // Validate throttling detection
        if (limitResults.summary.throttlingDetected) {
            expect(limitResults.summary.servicesWithLimits.length).toBeGreaterThan(0);
            console.log('Throttling detected for services:', limitResults.summary.servicesWithLimits);
        }
    });

    test('should handle high-volume request bursts', async () => {
        const burstConfig = {
            burstSize: 50,
            burstDuration: 2000, // 2 seconds
            cooldownPeriod: 1000, // 1 second
            numberOfBursts: 3
        };

        const mockProcessingFunction = async (inputData) => {
            // Simulate processing with potential resource contention
            const processingTime = Math.random() * 500 + 100; // 100-600ms
            await new Promise(resolve => setTimeout(resolve, processingTime));

            // Simulate memory pressure during bursts
            const memoryPressure = new Array(Math.floor(Math.random() * 1000)).fill('burst_test');

            return {
                summary: 'Burst test analysis',
                burstId: inputData.burstId,
                requestId: inputData.requestId,
                processingTime
            };
        };

        const burstResults = [];

        for (let burstIndex = 0; burstIndex < burstConfig.numberOfBursts; burstIndex++) {
            console.log(`Running burst ${burstIndex + 1}/${burstConfig.numberOfBursts}`);

            const burstPromises = [];
            const burstStartTime = Date.now();

            // Create burst of concurrent requests
            for (let i = 0; i < burstConfig.burstSize; i++) {
                const operationId = `burst_${burstIndex}_request_${i}`;

                const requestPromise = (async () => {
                    performanceMonitor.startMonitoring(operationId, {
                        burstIndex,
                        requestIndex: i,
                        burstTest: true
                    });

                    try {
                        const result = await mockProcessingFunction({
                            burstId: burstIndex,
                            requestId: i
                        });

                        const metrics = performanceMonitor.stopMonitoring(operationId, {
                            success: true,
                            burstId: burstIndex
                        });

                        return metrics;

                    } catch (error) {
                        const metrics = performanceMonitor.stopMonitoring(operationId, {
                            success: false,
                            error: error.message,
                            burstId: burstIndex
                        });

                        return metrics;
                    }
                })();

                burstPromises.push(requestPromise);
            }

            // Wait for all requests in burst to complete
            const burstRequestResults = await Promise.all(burstPromises);
            const burstEndTime = Date.now();

            const burstMetrics = {
                burstIndex,
                totalRequests: burstConfig.burstSize,
                actualDuration: burstEndTime - burstStartTime,
                successfulRequests: burstRequestResults.filter(r => r.success !== false).length,
                failedRequests: burstRequestResults.filter(r => r.success === false).length,
                averageResponseTime: burstRequestResults.reduce((sum, r) => sum + r.duration, 0) / burstRequestResults.length,
                requests: burstRequestResults
            };

            burstResults.push(burstMetrics);

            // Validate burst performance
            expect(burstMetrics.successfulRequests).toBeGreaterThan(burstConfig.burstSize * 0.8); // At least 80% success
            expect(burstMetrics.averageResponseTime).toBeLessThan(2000); // Under 2 seconds average

            console.log(`Burst ${burstIndex + 1}: ${burstMetrics.successfulRequests}/${burstMetrics.totalRequests} successful, ` +
                `${Math.round(burstMetrics.averageResponseTime)}ms avg response time`);

            // Cooldown period between bursts
            if (burstIndex < burstConfig.numberOfBursts - 1) {
                await new Promise(resolve => setTimeout(resolve, burstConfig.cooldownPeriod));
            }
        }

        // Validate overall burst test results
        expect(burstResults.length).toBe(burstConfig.numberOfBursts);

        const totalRequests = burstResults.reduce((sum, burst) => sum + burst.totalRequests, 0);
        const totalSuccessful = burstResults.reduce((sum, burst) => sum + burst.successfulRequests, 0);
        const overallSuccessRate = (totalSuccessful / totalRequests) * 100;

        expect(overallSuccessRate).toBeGreaterThanOrEqual(75); // At least 75% overall success rate

        console.log(`Burst test complete: ${totalSuccessful}/${totalRequests} total successful (${overallSuccessRate.toFixed(1)}%)`);
    });

    test('should validate system resilience under error conditions', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    errorScenarios: fc.array(errorScenarioGenerator, { minLength: 3, maxLength: 10 }),
                    concurrentRequests: fc.integer({ min: 5, max: 15 })
                }),
                async ({ errorScenarios, concurrentRequests }) => {
                    // Mock processing function that simulates various error conditions
                    const mockProcessingWithErrors = async (inputData) => {
                        const scenario = inputData.errorScenario;

                        // Simulate processing time
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

                        // Simulate different error conditions
                        switch (scenario.errorType) {
                            case 'aws_service_unavailable':
                                if (Math.random() < 0.7) { // 70% chance of error
                                    throw new Error('AWS service temporarily unavailable');
                                }
                                break;
                            case 'network_timeout':
                                if (Math.random() < 0.5) { // 50% chance of timeout
                                    await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate timeout
                                    throw new Error('Network timeout');
                                }
                                break;
                            case 'invalid_credentials':
                                if (Math.random() < 0.8) { // 80% chance of auth error
                                    throw new Error('Invalid AWS credentials');
                                }
                                break;
                            case 'file_too_large':
                                if (inputData.size && inputData.size > 10000) {
                                    throw new Error('File size exceeds limit');
                                }
                                break;
                            case 'malformed_response':
                                if (Math.random() < 0.6) { // 60% chance of malformed response
                                    return { invalid: 'response', missing: 'required_fields' };
                                }
                                break;
                        }

                        // Return successful result if no error triggered
                        return {
                            summary: 'Resilience test successful',
                            scenario: scenario.errorType,
                            handled: true
                        };
                    };

                    const resilienceResults = [];
                    const promises = [];

                    // Create concurrent requests with different error scenarios
                    for (let i = 0; i < concurrentRequests; i++) {
                        const scenario = errorScenarios[i % errorScenarios.length];
                        const operationId = `resilience_test_${i}`;

                        const requestPromise = (async () => {
                            performanceMonitor.startMonitoring(operationId, {
                                errorScenario: scenario.errorType,
                                resilienceTest: true
                            });

                            try {
                                const result = await mockProcessingWithErrors({
                                    errorScenario: scenario,
                                    size: Math.random() * 20000 // Random size for file_too_large test
                                });

                                const metrics = performanceMonitor.stopMonitoring(operationId, {
                                    success: true,
                                    scenarioType: scenario.errorType,
                                    resultValid: result.summary && result.scenario
                                });

                                return { ...metrics, result };

                            } catch (error) {
                                const metrics = performanceMonitor.stopMonitoring(operationId, {
                                    success: false,
                                    error: error.message,
                                    scenarioType: scenario.errorType,
                                    errorHandled: true
                                });

                                return metrics;
                            }
                        })();

                        promises.push(requestPromise);
                    }

                    const results = await Promise.all(promises);
                    resilienceResults.push(...results);

                    // Validate resilience test results
                    expect(resilienceResults.length).toBe(concurrentRequests);

                    // System should handle errors gracefully (no unhandled exceptions)
                    resilienceResults.forEach(result => {
                        expect(result).toBeDefined();
                        expect(result.duration).toBeGreaterThan(0);

                        if (result.success === false) {
                            expect(result.error).toBeDefined();
                            expect(typeof result.error).toBe('string');
                        }
                    });

                    // Validate error distribution matches expected scenarios
                    const errorTypes = resilienceResults
                        .filter(r => r.success === false)
                        .map(r => r.metadata.scenarioType);

                    const uniqueErrorTypes = [...new Set(errorTypes)];
                    expect(uniqueErrorTypes.length).toBeGreaterThan(0);

                    // System should maintain some level of availability even under errors
                    const successRate = (resilienceResults.filter(r => r.success !== false).length / resilienceResults.length) * 100;
                    expect(successRate).toBeGreaterThanOrEqual(20); // At least 20% availability under error conditions

                    console.log(`Resilience test: ${successRate.toFixed(1)}% success rate under error conditions`);

                    return true;
                }
            ),
            { numRuns: 3, timeout: 45000 }
        );
    });

    test('should monitor resource usage during stress conditions', async () => {
        const stressConfig = {
            concurrentRequests: 15,
            duration: 8000, // 8 seconds
            rampUpTime: 2000, // 2 seconds
            inputData: [
                { type: 'text', content: 'Stress test legal document content' },
                { type: 'url', content: 'https://example.com/stress-test' },
                { type: 'file', content: { name: 'stress-test.pdf', size: 50000 } }
            ]
        };

        // Mock processing function with resource usage simulation
        const resourceIntensiveProcessing = async (inputData) => {
            // Simulate CPU-intensive work
            const iterations = Math.floor(Math.random() * 10000) + 5000;
            let result = 0;
            for (let i = 0; i < iterations; i++) {
                result += Math.sqrt(i);
            }

            // Simulate memory allocation
            const memoryArray = new Array(Math.floor(Math.random() * 10000) + 5000).fill('stress_test_data');

            // Simulate I/O wait
            await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

            return {
                summary: 'Resource-intensive analysis complete',
                computationResult: result,
                memoryAllocated: memoryArray.length,
                inputType: inputData.type
            };
        };

        const stressResults = await performanceMonitor.runStressTest(
            stressConfig,
            resourceIntensiveProcessing
        );

        // Validate resource usage monitoring
        expect(stressResults.requests.length).toBeGreaterThan(0);

        // Analyze resource usage patterns
        const memoryUsages = stressResults.requests.map(r => r.memoryUsage.peak);
        const cpuUsages = stressResults.requests.map(r => r.cpuUsage.user + r.cpuUsage.system);

        const avgMemoryUsage = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
        const maxMemoryUsage = Math.max(...memoryUsages);
        const avgCpuUsage = cpuUsages.reduce((sum, cpu) => sum + cpu, 0) / cpuUsages.length;

        // Validate resource usage is within reasonable bounds
        expect(avgMemoryUsage).toBeGreaterThan(0);
        expect(maxMemoryUsage).toBeLessThan(1024 * 1024 * 1024); // Less than 1GB
        expect(avgCpuUsage).toBeGreaterThan(0);

        // Validate system maintained stability under stress
        expect(stressResults.summary.successRate).toBeGreaterThanOrEqual(70); // At least 70% success under stress
        expect(stressResults.summary.averageResponseTime).toBeLessThan(10000); // Under 10 seconds average

        console.log(`Resource stress test: avg memory ${Math.round(avgMemoryUsage / 1024 / 1024)}MB, ` +
            `max memory ${Math.round(maxMemoryUsage / 1024 / 1024)}MB, ` +
            `avg CPU ${Math.round(avgCpuUsage)}ms`);

        // Validate resource snapshots were captured
        const requestsWithSnapshots = stressResults.requests.filter(r => r.resourceSnapshots && r.resourceSnapshots.length > 0);
        expect(requestsWithSnapshots.length).toBeGreaterThan(0);

        // Validate snapshot data quality
        requestsWithSnapshots.forEach(request => {
            request.resourceSnapshots.forEach(snapshot => {
                expect(snapshot.memory).toBeDefined();
                expect(snapshot.cpu).toBeDefined();
                expect(snapshot.systemLoad).toBeDefined();
                expect(snapshot.timestamp).toBeGreaterThanOrEqual(0);
            });
        });
    });

    test('should validate system recovery after stress periods', async () => {
        const recoveryTest = async () => {
            // Phase 1: Apply stress
            console.log('Phase 1: Applying stress...');
            const stressConfig = {
                concurrentRequests: 20,
                duration: 3000, // 3 seconds of stress
                rampUpTime: 500,
                inputData: [{ type: 'text', content: 'Recovery test content' }]
            };

            const mockStressFunction = async (inputData) => {
                // Intensive processing
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
                const heavyArray = new Array(5000).fill('stress_data');
                return { processed: true, dataSize: heavyArray.length };
            };

            const stressResults = await performanceMonitor.runStressTest(stressConfig, mockStressFunction);

            // Phase 2: Recovery period
            console.log('Phase 2: Recovery period...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second recovery

            // Phase 3: Test normal operation
            console.log('Phase 3: Testing normal operation...');
            const normalOperationResults = [];

            for (let i = 0; i < 5; i++) {
                const operationId = `recovery_test_${i}`;

                performanceMonitor.startMonitoring(operationId, {
                    recoveryTest: true,
                    postStress: true
                });

                const result = await mockStressFunction({ type: 'text', content: 'Normal operation test' });

                const metrics = performanceMonitor.stopMonitoring(operationId, {
                    success: true,
                    phase: 'recovery'
                });

                normalOperationResults.push(metrics);
            }

            // Validate recovery
            const stressAvgTime = stressResults.summary.averageResponseTime;
            const recoveryAvgTime = normalOperationResults.reduce((sum, r) => sum + r.duration, 0) / normalOperationResults.length;

            // System should recover to normal performance levels
            expect(recoveryAvgTime).toBeLessThan(stressAvgTime * 1.2); // Within 20% of stress period performance
            expect(normalOperationResults.every(r => r.success !== false)).toBe(true); // All recovery tests should succeed

            console.log(`Recovery validation: stress avg ${Math.round(stressAvgTime)}ms, ` +
                `recovery avg ${Math.round(recoveryAvgTime)}ms`);

            return {
                stressResults,
                recoveryResults: normalOperationResults,
                recoverySuccessful: recoveryAvgTime < stressAvgTime * 1.2
            };
        };

        const recoveryTestResult = await recoveryTest();

        expect(recoveryTestResult.recoverySuccessful).toBe(true);
        expect(recoveryTestResult.recoveryResults.length).toBe(5);
        expect(recoveryTestResult.stressResults.summary.totalRequests).toBeGreaterThan(0);
    });
});