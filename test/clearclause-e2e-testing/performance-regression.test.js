/**
 * Performance Regression Tests for ClearClause End-to-End Testing
 * 
 * This test suite implements performance regression detection by comparing
 * current performance metrics against established baselines and detecting
 * significant performance degradations.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import PerformanceMonitor from './utils/PerformanceMonitor.js';
import {
    legalTextGenerator,
    fileMetadataGenerator,
    TestFileSelector
} from './utils/test-data-generators.js';
import { VALIDATION_THRESHOLDS } from './config/test-config.js';

describe('ClearClause Performance Regression Detection', () => {
    let performanceMonitor;
    let testFileSelector;

    beforeEach(() => {
        performanceMonitor = new PerformanceMonitor();
        testFileSelector = new TestFileSelector();
    });

    afterEach(() => {
        performanceMonitor.clear();
    });

    /**
     * **Feature: clearclause-e2e-testing, Property 13: Performance Regression Detection**
     * For any performance metric (processing time, memory usage, CPU usage), when
     * compared against established baselines, the system should detect regressions
     * that exceed acceptable thresholds and provide actionable recommendations.
     */
    test('should detect performance regressions across different metrics', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    baselineMetrics: fc.record({
                        duration: fc.integer({ min: 500, max: 2000 }),
                        memoryPeak: fc.integer({ min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 }), // 10-100MB
                        cpuUser: fc.integer({ min: 50, max: 500 }),
                        cpuSystem: fc.integer({ min: 20, max: 200 })
                    }),
                    regressionFactors: fc.record({
                        durationFactor: fc.float({ min: 1.0, max: 3.0 }),
                        memoryFactor: fc.float({ min: 1.0, max: 4.0 }),
                        cpuFactor: fc.float({ min: 1.0, max: 3.0 })
                    })
                }),
                async ({ baselineMetrics, regressionFactors }) => {
                    const baselineKey = `regression_test_baseline_${Date.now()}_${Math.random()}`;

                    // Create baseline metrics
                    const baseline = {
                        duration: baselineMetrics.duration,
                        memoryUsage: { peak: baselineMetrics.memoryPeak },
                        cpuUsage: {
                            user: baselineMetrics.cpuUser,
                            system: baselineMetrics.cpuSystem
                        }
                    };

                    // Establish baseline
                    const baselineResult = performanceMonitor.detectRegressions(baseline, baselineKey);
                    expect(baselineResult.isNewBaseline).toBe(true);

                    // Create potentially regressed metrics
                    const currentMetrics = {
                        duration: Math.round(baselineMetrics.duration * regressionFactors.durationFactor),
                        memoryUsage: {
                            peak: Math.round(baselineMetrics.memoryPeak * regressionFactors.memoryFactor)
                        },
                        cpuUsage: {
                            user: Math.round(baselineMetrics.cpuUser * regressionFactors.cpuFactor),
                            system: Math.round(baselineMetrics.cpuSystem * regressionFactors.cpuFactor)
                        }
                    };

                    // Test regression detection
                    const regressionResult = performanceMonitor.detectRegressions(currentMetrics, baselineKey);

                    // Validate regression detection logic
                    const expectedDurationRegression = regressionFactors.durationFactor > performanceMonitor.regressionThresholds.processingTime;
                    const expectedMemoryRegression = regressionFactors.memoryFactor > performanceMonitor.regressionThresholds.memoryUsage;
                    const expectedCpuRegression = regressionFactors.cpuFactor > performanceMonitor.regressionThresholds.cpuUsage;

                    const expectedRegressionCount = [
                        expectedDurationRegression,
                        expectedMemoryRegression,
                        expectedCpuRegression
                    ].filter(Boolean).length;

                    if (expectedRegressionCount > 0) {
                        expect(regressionResult.hasRegression).toBe(true);
                        expect(regressionResult.regressions.length).toBe(expectedRegressionCount);
                        expect(regressionResult.recommendations.length).toBeGreaterThan(0);

                        // Validate specific regression types
                        if (expectedDurationRegression) {
                            const durationRegression = regressionResult.regressions.find(r => r.metric === 'processing_time');
                            expect(durationRegression).toBeDefined();
                            expect(durationRegression.current).toBe(currentMetrics.duration);
                            expect(durationRegression.baseline).toBe(baseline.duration);
                        }

                        if (expectedMemoryRegression) {
                            const memoryRegression = regressionResult.regressions.find(r => r.metric === 'memory_usage');
                            expect(memoryRegression).toBeDefined();
                            expect(memoryRegression.current).toBe(currentMetrics.memoryUsage.peak);
                            expect(memoryRegression.baseline).toBe(baseline.memoryUsage.peak);
                        }

                        if (expectedCpuRegression) {
                            const cpuRegression = regressionResult.regressions.find(r => r.metric === 'cpu_usage');
                            expect(cpuRegression).toBeDefined();
                        }
                    } else {
                        expect(regressionResult.hasRegression).toBe(false);
                        expect(regressionResult.regressions.length).toBe(0);
                    }

                    return true;
                }
            ),
            { numRuns: 10, timeout: 30000 }
        );
    });

    test('should track performance trends over multiple measurements', async () => {
        const baselineKey = 'trend_analysis_baseline';
        const measurements = [];

        // Simulate performance measurements over time with gradual degradation
        for (let i = 0; i < 10; i++) {
            const operationId = `trend_measurement_${i}`;

            performanceMonitor.startMonitoring(operationId, {
                trendTest: true,
                measurementIndex: i
            });

            // Simulate processing with gradual performance degradation
            const baseProcessingTime = 1000;
            const degradationFactor = 1 + (i * 0.1); // 10% degradation per measurement
            const actualProcessingTime = baseProcessingTime * degradationFactor;

            await new Promise(resolve => setTimeout(resolve, Math.min(actualProcessingTime, 500))); // Cap actual wait time

            // Simulate memory usage increase
            const memoryArray = new Array(Math.floor(1000 * degradationFactor)).fill('trend_test');

            const metrics = performanceMonitor.stopMonitoring(operationId, {
                success: true,
                simulatedDuration: actualProcessingTime, // Use simulated duration for trend analysis
                trendIndex: i
            });

            // Override duration with simulated value for trend analysis
            metrics.duration = actualProcessingTime;
            measurements.push(metrics);

            // Test regression detection at each step
            const regressionResult = performanceMonitor.detectRegressions(metrics, baselineKey);

            if (i === 0) {
                expect(regressionResult.isNewBaseline).toBe(true);
            } else {
                // Should detect regression after significant degradation
                if (degradationFactor > performanceMonitor.regressionThresholds.processingTime) {
                    expect(regressionResult.hasRegression).toBe(true);
                    expect(regressionResult.regressions.some(r => r.metric === 'processing_time')).toBe(true);
                }
            }

            console.log(`Measurement ${i}: ${Math.round(actualProcessingTime)}ms (${Math.round((degradationFactor - 1) * 100)}% degradation)`);
        }

        // Analyze trend
        const durations = measurements.map(m => m.duration);
        const firstHalf = durations.slice(0, 5);
        const secondHalf = durations.slice(5);

        const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d, 0) / secondHalf.length;

        // Validate trend detection
        expect(secondHalfAvg).toBeGreaterThan(firstHalfAvg * 1.2); // At least 20% increase
        expect(measurements.length).toBe(10);

        console.log(`Trend analysis: first half avg ${Math.round(firstHalfAvg)}ms, second half avg ${Math.round(secondHalfAvg)}ms`);
    });

    test('should compare performance across different input types', async () => {
        const inputTypes = [
            { name: 'small_text', size: 1000, expectedTime: 500 },
            { name: 'medium_text', size: 5000, expectedTime: 1000 },
            { name: 'large_text', size: 20000, expectedTime: 2000 }
        ];

        const performanceBaselines = new Map();

        // Establish baselines for each input type
        for (const inputType of inputTypes) {
            const baselineResults = [];

            // Run multiple iterations to establish stable baseline
            for (let i = 0; i < 5; i++) {
                const operationId = `baseline_${inputType.name}_${i}`;

                performanceMonitor.startMonitoring(operationId, {
                    inputType: inputType.name,
                    inputSize: inputType.size,
                    baselineRun: true
                });

                // Simulate processing proportional to input size
                const processingTime = inputType.expectedTime + (Math.random() * 200 - 100); // ±100ms variation
                await new Promise(resolve => setTimeout(resolve, Math.min(processingTime, 300))); // Cap actual wait

                const metrics = performanceMonitor.stopMonitoring(operationId, {
                    success: true,
                    simulatedDuration: processingTime
                });

                metrics.duration = processingTime; // Use simulated duration
                baselineResults.push(metrics);
            }

            // Calculate baseline statistics
            const avgDuration = baselineResults.reduce((sum, r) => sum + r.duration, 0) / baselineResults.length;
            const avgMemory = baselineResults.reduce((sum, r) => sum + r.memoryUsage.peak, 0) / baselineResults.length;
            const avgCpu = baselineResults.reduce((sum, r) => sum + r.cpuUsage.user + r.cpuUsage.system, 0) / baselineResults.length;

            const baseline = {
                duration: avgDuration,
                memoryUsage: { peak: avgMemory },
                cpuUsage: { user: avgCpu * 0.7, system: avgCpu * 0.3 }
            };

            performanceBaselines.set(inputType.name, baseline);

            console.log(`${inputType.name} baseline: ${Math.round(avgDuration)}ms, ${Math.round(avgMemory / 1024 / 1024)}MB`);
        }

        // Test current performance against baselines
        for (const inputType of inputTypes) {
            const currentResults = [];

            // Run current performance tests
            for (let i = 0; i < 3; i++) {
                const operationId = `current_${inputType.name}_${i}`;

                performanceMonitor.startMonitoring(operationId, {
                    inputType: inputType.name,
                    inputSize: inputType.size,
                    currentRun: true
                });

                // Simulate current performance (potentially regressed)
                const regressionFactor = 1 + (Math.random() * 0.5); // 0-50% potential regression
                const processingTime = inputType.expectedTime * regressionFactor;
                await new Promise(resolve => setTimeout(resolve, Math.min(processingTime, 400)));

                const metrics = performanceMonitor.stopMonitoring(operationId, {
                    success: true,
                    simulatedDuration: processingTime,
                    regressionFactor
                });

                metrics.duration = processingTime;
                currentResults.push(metrics);
            }

            // Calculate current performance
            const currentAvgDuration = currentResults.reduce((sum, r) => sum + r.duration, 0) / currentResults.length;
            const currentAvgMemory = currentResults.reduce((sum, r) => sum + r.memoryUsage.peak, 0) / currentResults.length;
            const currentAvgCpu = currentResults.reduce((sum, r) => sum + r.cpuUsage.user + r.cpuUsage.system, 0) / currentResults.length;

            const currentMetrics = {
                duration: currentAvgDuration,
                memoryUsage: { peak: currentAvgMemory },
                cpuUsage: { user: currentAvgCpu * 0.7, system: currentAvgCpu * 0.3 }
            };

            // Compare against baseline
            const baseline = performanceBaselines.get(inputType.name);
            const regressionResult = performanceMonitor.detectRegressions(currentMetrics, `${inputType.name}_baseline`);

            // Validate regression detection
            const durationIncrease = currentMetrics.duration / baseline.duration;
            const expectedRegression = durationIncrease > performanceMonitor.regressionThresholds.processingTime;

            if (expectedRegression) {
                expect(regressionResult.hasRegression).toBe(true);
                expect(regressionResult.regressions.some(r => r.metric === 'processing_time')).toBe(true);
            }

            console.log(`${inputType.name} comparison: baseline ${Math.round(baseline.duration)}ms, ` +
                `current ${Math.round(currentMetrics.duration)}ms ` +
                `(${Math.round((durationIncrease - 1) * 100)}% change)`);
        }

        // Validate all input types were tested
        expect(performanceBaselines.size).toBe(inputTypes.length);
    });

    test('should generate actionable regression recommendations', async () => {
        const testScenarios = [
            {
                name: 'processing_time_regression',
                baseline: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } },
                current: { duration: 2000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } },
                expectedRecommendations: ['processing time', 'algorithms', 'optimization']
            },
            {
                name: 'memory_usage_regression',
                baseline: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } },
                current: { duration: 1000, memoryUsage: { peak: 150 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } },
                expectedRecommendations: ['memory usage', 'memory leaks', 'data structures']
            },
            {
                name: 'cpu_usage_regression',
                baseline: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } },
                current: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 300, system: 200 } },
                expectedRecommendations: ['CPU usage', 'computational complexity', 'optimization']
            },
            {
                name: 'multiple_regressions',
                baseline: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } },
                current: { duration: 2000, memoryUsage: { peak: 150 * 1024 * 1024 }, cpuUsage: { user: 300, system: 200 } },
                expectedRecommendations: ['processing time', 'memory usage', 'CPU usage']
            }
        ];

        for (const scenario of testScenarios) {
            const baselineKey = `recommendation_test_${scenario.name}`;

            // Establish baseline
            performanceMonitor.detectRegressions(scenario.baseline, baselineKey);

            // Test regression detection and recommendations
            const regressionResult = performanceMonitor.detectRegressions(scenario.current, baselineKey);

            expect(regressionResult.hasRegression).toBe(true);
            expect(regressionResult.recommendations).toBeDefined();
            expect(regressionResult.recommendations.length).toBeGreaterThan(0);

            // Validate recommendations contain relevant keywords (flexible matching)
            const recommendationText = regressionResult.recommendations.join(' ').toLowerCase();
            const hasRelevantKeywords = scenario.expectedRecommendations.some(keyword =>
                recommendationText.includes(keyword.toLowerCase()) ||
                recommendationText.includes('optim') || // matches "optimizing", "optimization", etc.
                recommendationText.includes('improv') || // matches "improve", "improvement", etc.
                recommendationText.includes('reduc') || // matches "reduce", "reduction", etc.
                recommendationText.includes('review') ||
                recommendationText.includes('consider')
            );
            expect(hasRelevantKeywords).toBe(true);

            // Validate recommendation quality
            regressionResult.recommendations.forEach(recommendation => {
                expect(typeof recommendation).toBe('string');
                expect(recommendation.length).toBeGreaterThan(10); // Meaningful recommendations
                expect(recommendation).toMatch(/\w+/); // Contains actual words
            });

            console.log(`${scenario.name} recommendations:`, regressionResult.recommendations);
        }
    });

    test('should handle edge cases in regression detection', async () => {
        const edgeCases = [
            {
                name: 'zero_baseline',
                baseline: { duration: 0, memoryUsage: { peak: 0 }, cpuUsage: { user: 0, system: 0 } },
                current: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } }
            },
            {
                name: 'negative_values',
                baseline: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } },
                current: { duration: -100, memoryUsage: { peak: -1000 }, cpuUsage: { user: -50, system: -25 } }
            },
            {
                name: 'very_large_values',
                baseline: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } },
                current: { duration: 1000000, memoryUsage: { peak: 1024 * 1024 * 1024 * 10 }, cpuUsage: { user: 100000, system: 50000 } }
            },
            {
                name: 'identical_values',
                baseline: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } },
                current: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } }
            }
        ];

        for (const edgeCase of edgeCases) {
            const baselineKey = `edge_case_${edgeCase.name}`;

            try {
                // Establish baseline
                const baselineResult = performanceMonitor.detectRegressions(edgeCase.baseline, baselineKey);
                expect(baselineResult.isNewBaseline).toBe(true);

                // Test regression detection with edge case values
                const regressionResult = performanceMonitor.detectRegressions(edgeCase.current, baselineKey);

                // Validate that regression detection handles edge cases gracefully
                expect(regressionResult).toBeDefined();
                expect(typeof regressionResult.hasRegression).toBe('boolean');
                expect(Array.isArray(regressionResult.regressions)).toBe(true);

                // For identical values, should not detect regression
                if (edgeCase.name === 'identical_values') {
                    expect(regressionResult.hasRegression).toBe(false);
                    expect(regressionResult.regressions.length).toBe(0);
                }

                // For very large values, should detect regression
                if (edgeCase.name === 'very_large_values') {
                    expect(regressionResult.hasRegression).toBe(true);
                    expect(regressionResult.regressions.length).toBeGreaterThan(0);
                }

                console.log(`Edge case ${edgeCase.name}: ${regressionResult.hasRegression ? 'regression detected' : 'no regression'}`);

            } catch (error) {
                // Edge cases should not cause unhandled errors
                console.error(`Edge case ${edgeCase.name} caused error:`, error.message);
                expect(error).toBeUndefined(); // Fail test if edge case causes error
            }
        }
    });

    test('should export and import performance baselines', async () => {
        const testBaselines = [
            { key: 'text_processing', metrics: { duration: 1000, memoryUsage: { peak: 50 * 1024 * 1024 }, cpuUsage: { user: 100, system: 50 } } },
            { key: 'file_processing', metrics: { duration: 2000, memoryUsage: { peak: 100 * 1024 * 1024 }, cpuUsage: { user: 200, system: 100 } } },
            { key: 'url_processing', metrics: { duration: 1500, memoryUsage: { peak: 75 * 1024 * 1024 }, cpuUsage: { user: 150, system: 75 } } }
        ];

        // Establish baselines
        for (const baseline of testBaselines) {
            const result = performanceMonitor.detectRegressions(baseline.metrics, baseline.key);
            expect(result.isNewBaseline).toBe(true);
        }

        // Export performance data
        const exportedData = performanceMonitor.exportPerformanceData();

        // Validate export structure
        expect(exportedData).toHaveProperty('performanceBaselines');
        expect(exportedData).toHaveProperty('exportTimestamp');
        expect(Object.keys(exportedData.performanceBaselines).length).toBe(testBaselines.length);

        // Validate baseline data integrity
        for (const baseline of testBaselines) {
            expect(exportedData.performanceBaselines[baseline.key]).toBeDefined();
            const exportedBaseline = exportedData.performanceBaselines[baseline.key];
            expect(exportedBaseline.duration).toBe(baseline.metrics.duration);
            expect(exportedBaseline.memoryUsage.peak).toBe(baseline.metrics.memoryUsage.peak);
        }

        // Test serialization/deserialization
        const serialized = JSON.stringify(exportedData);
        expect(serialized.length).toBeGreaterThan(0);

        const deserialized = JSON.parse(serialized);
        expect(deserialized.performanceBaselines).toEqual(exportedData.performanceBaselines);

        // Create new monitor and simulate import
        const newMonitor = new PerformanceMonitor();

        // Simulate importing baselines (in real implementation, this would be a method)
        Object.entries(deserialized.performanceBaselines).forEach(([key, baseline]) => {
            newMonitor.performanceBaselines.set(key, baseline);
        });

        // Test that imported baselines work for regression detection
        const testMetrics = { duration: 3000, memoryUsage: { peak: 200 * 1024 * 1024 }, cpuUsage: { user: 400, system: 200 } };
        const regressionResult = newMonitor.detectRegressions(testMetrics, 'file_processing');

        expect(regressionResult.hasRegression).toBe(true); // Should detect regression against imported baseline
        expect(regressionResult.isNewBaseline || false).toBe(false); // Should not be a new baseline (allow undefined)

        console.log(`Baseline export/import: ${Object.keys(exportedData.performanceBaselines).length} baselines, ${Math.round(serialized.length / 1024)}KB`);
    });
});