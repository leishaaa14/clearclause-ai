/**
 * Performance Benchmarks Test for ClearClause End-to-End Testing
 * 
 * This test suite implements comprehensive performance benchmarking for different
 * input types, validating processing speed, resource usage, and system scalability.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import PerformanceMonitor from './utils/PerformanceMonitor.js';
import {
    legalTextGenerator,
    urlGenerator,
    fileMetadataGenerator,
    TestFileSelector
} from './utils/test-data-generators.js';
import { TEST_CONFIG, VALIDATION_THRESHOLDS } from './config/test-config.js';

describe('ClearClause Performance Benchmarks', () => {
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
     * **Feature: clearclause-e2e-testing, Property 11: Performance Benchmarking Consistency**
     * For any input type (PDF, Image, Excel, Raw Text, URL), the system should complete
     * processing within acceptable time thresholds and maintain consistent performance
     * characteristics across multiple runs.
     */
    test('should maintain consistent performance across different input types', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    textInput: legalTextGenerator,
                    urlInput: urlGenerator,
                    fileInput: fileMetadataGenerator
                }),
                async (testInputs) => {
                    const inputTypes = [
                        {
                            name: 'raw_text',
                            testData: { type: 'text', content: testInputs.textInput },
                            iterations: 3
                        },
                        {
                            name: 'url_content',
                            testData: { type: 'url', content: testInputs.urlInput },
                            iterations: 3
                        },
                        {
                            name: 'file_upload',
                            testData: { type: 'file', content: testInputs.fileInput },
                            iterations: 3
                        }
                    ];

                    // Mock processing function that simulates ClearClause analysis
                    const mockProcessingFunction = async (inputData) => {
                        const processingTime = Math.random() * 2000 + 500; // 500-2500ms
                        await new Promise(resolve => setTimeout(resolve, processingTime));

                        // Simulate memory usage
                        const largeArray = new Array(Math.floor(Math.random() * 10000)).fill('test');

                        return {
                            summary: `Analysis complete for ${inputData.type} input`,
                            clauses: [{ type: 'test', confidence: 0.9 }],
                            risks: [{ level: 'Low', description: 'Test risk' }],
                            metadata: {
                                processing_time: processingTime,
                                input_type: inputData.type,
                                model_used: 'test-model'
                            }
                        };
                    };

                    const benchmarkResults = await performanceMonitor.runBenchmark(
                        inputTypes,
                        mockProcessingFunction
                    );

                    // Validate benchmark results structure
                    expect(benchmarkResults).toHaveProperty('inputTypes');
                    expect(benchmarkResults).toHaveProperty('summary');
                    expect(benchmarkResults.summary.totalTests).toBeGreaterThan(0);

                    // Validate each input type has consistent performance
                    Object.entries(benchmarkResults.inputTypes).forEach(([typeName, typeData]) => {
                        expect(typeData.statistics).toBeDefined();
                        expect(typeData.statistics.successRate).toBeGreaterThanOrEqual(80); // At least 80% success rate

                        // Performance should be within reasonable bounds
                        expect(typeData.statistics.duration.average).toBeLessThan(VALIDATION_THRESHOLDS.maxProcessingTime.largeFile);
                        expect(typeData.statistics.duration.p95).toBeLessThan(VALIDATION_THRESHOLDS.maxProcessingTime.largeFile * 1.5);

                        // Memory usage should be reasonable
                        expect(typeData.statistics.memory.average).toBeGreaterThan(0);
                        expect(typeData.statistics.memory.max).toBeLessThan(500 * 1024 * 1024); // 500MB limit
                    });

                    // Validate performance consistency (coefficient of variation < 50%)
                    Object.values(benchmarkResults.inputTypes).forEach(typeData => {
                        const durations = typeData.results.map(r => r.duration);
                        const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
                        const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
                        const stdDev = Math.sqrt(variance);
                        const coefficientOfVariation = stdDev / mean;

                        expect(coefficientOfVariation).toBeLessThan(0.5); // Less than 50% variation
                    });

                    return true;
                }
            ),
            { numRuns: 5, timeout: 60000 }
        );
    });

    test('should benchmark processing speed for different input sizes', async () => {
        const inputSizes = [
            { name: 'small', size: 1000, expectedTime: VALIDATION_THRESHOLDS.maxProcessingTime.rawText },
            { name: 'medium', size: 10000, expectedTime: VALIDATION_THRESHOLDS.maxProcessingTime.smallFile },
            { name: 'large', size: 100000, expectedTime: VALIDATION_THRESHOLDS.maxProcessingTime.largeFile }
        ];

        const processingFunction = async (inputData) => {
            // Simulate processing time proportional to input size
            const baseTime = 100;
            const sizeMultiplier = inputData.size / 1000;
            const processingTime = baseTime + (sizeMultiplier * 50) + (Math.random() * 200);

            await new Promise(resolve => setTimeout(resolve, processingTime));

            return {
                summary: `Processed ${inputData.size} characters`,
                processingTime
            };
        };

        for (const sizeConfig of inputSizes) {
            const operationId = `size_benchmark_${sizeConfig.name}`;

            performanceMonitor.startMonitoring(operationId, {
                inputSize: sizeConfig.size,
                expectedTime: sizeConfig.expectedTime
            });

            const result = await processingFunction({ size: sizeConfig.size });

            const metrics = performanceMonitor.stopMonitoring(operationId, {
                resultSize: JSON.stringify(result).length
            });

            // Validate processing time is within expected bounds
            expect(metrics.duration).toBeLessThan(sizeConfig.expectedTime);

            // Validate memory usage scales reasonably with input size
            expect(metrics.memoryUsage.delta).toBeGreaterThanOrEqual(0);

            console.log(`${sizeConfig.name} input (${sizeConfig.size} chars): ${Math.round(metrics.duration)}ms`);
        }
    });

    test('should monitor resource usage during processing', async () => {
        const operationId = 'resource_monitoring_test';

        performanceMonitor.startMonitoring(operationId, {
            testType: 'resource_monitoring'
        });

        // Simulate processing with varying resource usage
        const iterations = 10;
        for (let i = 0; i < iterations; i++) {
            // Take resource snapshots during processing
            performanceMonitor.takeResourceSnapshot(operationId);

            // Simulate work with memory allocation
            const tempArray = new Array(1000 * (i + 1)).fill(`data_${i}`);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Clean up to simulate garbage collection
            tempArray.length = 0;
        }

        const metrics = performanceMonitor.stopMonitoring(operationId);

        // Validate resource snapshots were taken
        expect(metrics.resourceSnapshots).toBeDefined();
        expect(metrics.resourceSnapshots.length).toBeGreaterThan(0);

        // Validate resource usage tracking
        expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
        expect(metrics.cpuUsage.user).toBeGreaterThanOrEqual(0);
        expect(metrics.cpuUsage.system).toBeGreaterThanOrEqual(0);

        // Validate resource snapshots contain expected data
        metrics.resourceSnapshots.forEach(snapshot => {
            expect(snapshot).toHaveProperty('timestamp');
            expect(snapshot).toHaveProperty('memory');
            expect(snapshot).toHaveProperty('cpu');
            expect(snapshot).toHaveProperty('systemLoad');
            expect(snapshot.timestamp).toBeGreaterThanOrEqual(0);
        });

        console.log(`Resource monitoring: ${metrics.resourceSnapshots.length} snapshots, peak memory: ${Math.round(metrics.memoryUsage.peak / 1024 / 1024)}MB`);
    });

    test('should detect performance regressions', async () => {
        const baselineKey = 'regression_test_baseline';

        // Create baseline performance
        const createBaselineMetrics = () => ({
            duration: 1000,
            memoryUsage: { peak: 50 * 1024 * 1024 }, // 50MB
            cpuUsage: { user: 100, system: 50 }
        });

        const baselineMetrics = createBaselineMetrics();

        // Test no regression (similar performance)
        const similarMetrics = {
            duration: 1100, // 10% increase (within threshold)
            memoryUsage: { peak: 55 * 1024 * 1024 }, // 10% increase
            cpuUsage: { user: 110, system: 55 }
        };

        let regressionResult = performanceMonitor.detectRegressions(baselineMetrics, baselineKey);
        expect(regressionResult.isNewBaseline).toBe(true);

        regressionResult = performanceMonitor.detectRegressions(similarMetrics, baselineKey);
        expect(regressionResult.hasRegression).toBe(false);

        // Test performance regression (significant increase)
        const regressedMetrics = {
            duration: 2000, // 100% increase (exceeds threshold)
            memoryUsage: { peak: 120 * 1024 * 1024 }, // 140% increase
            cpuUsage: { user: 250, system: 150 }
        };

        regressionResult = performanceMonitor.detectRegressions(regressedMetrics, baselineKey);
        expect(regressionResult.hasRegression).toBe(true);
        expect(regressionResult.regressions).toBeDefined();
        expect(regressionResult.regressions.length).toBeGreaterThan(0);
        expect(regressionResult.recommendations).toBeDefined();
        expect(regressionResult.recommendations.length).toBeGreaterThan(0);

        // Validate regression details
        const processingTimeRegression = regressionResult.regressions.find(r => r.metric === 'processing_time');
        expect(processingTimeRegression).toBeDefined();
        expect(processingTimeRegression.current).toBe(2000);
        expect(processingTimeRegression.baseline).toBe(1000);

        console.log(`Regression detected: ${regressionResult.regressions.length} metrics regressed`);
    });

    test('should benchmark dataset file processing', async () => {
        const representativeFiles = testFileSelector.selectRepresentativeFiles();

        // Mock file processing function
        const processFile = async (fileInfo) => {
            // Simulate processing time based on file size
            const processingTime = Math.min(fileInfo.size / 1000, 5000) + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, processingTime));

            return {
                summary: `Processed file: ${fileInfo.name}`,
                clauses: Array(Math.floor(Math.random() * 10) + 1).fill().map((_, i) => ({
                    type: 'test_clause',
                    confidence: Math.random() * 0.5 + 0.5
                })),
                processingTime
            };
        };

        const benchmarkResults = {};

        // Benchmark each file category
        for (const [category, files] of Object.entries(representativeFiles)) {
            if (files.length === 0) continue;

            console.log(`Benchmarking ${category} files (${files.length} files)`);

            const categoryResults = [];

            for (const file of files) {
                const operationId = `file_benchmark_${category}_${file.name}`;

                performanceMonitor.startMonitoring(operationId, {
                    category,
                    fileName: file.name,
                    fileSize: file.size
                });

                try {
                    const result = await processFile(file);

                    const metrics = performanceMonitor.stopMonitoring(operationId, {
                        success: true,
                        clausesExtracted: result.clauses.length
                    });

                    categoryResults.push(metrics);

                    // Validate processing completed within reasonable time
                    expect(metrics.duration).toBeLessThan(VALIDATION_THRESHOLDS.maxProcessingTime.largeFile);

                } catch (error) {
                    const metrics = performanceMonitor.stopMonitoring(operationId, {
                        success: false,
                        error: error.message
                    });

                    categoryResults.push(metrics);
                }
            }

            // Calculate category statistics
            const statistics = performanceMonitor.calculateStatistics(categoryResults);
            benchmarkResults[category] = {
                files: files.length,
                statistics,
                results: categoryResults
            };

            // Validate category performance
            expect(statistics.successRate).toBeGreaterThanOrEqual(80);
            expect(statistics.duration.average).toBeLessThan(VALIDATION_THRESHOLDS.maxProcessingTime.largeFile);

            console.log(`${category}: ${Math.round(statistics.duration.average)}ms avg, ${statistics.successRate.toFixed(1)}% success`);
        }

        // Validate overall benchmark results
        expect(Object.keys(benchmarkResults).length).toBeGreaterThan(0);
    });

    test('should export performance data for analysis', async () => {
        // Generate some performance data
        const operationId = 'export_test';

        performanceMonitor.startMonitoring(operationId, { testType: 'export' });
        await new Promise(resolve => setTimeout(resolve, 100));
        performanceMonitor.stopMonitoring(operationId);

        // Add a stress test result
        performanceMonitor.stressTestResults.push({
            config: { concurrentRequests: 5, duration: 1000 },
            summary: { totalRequests: 10, successfulRequests: 9 }
        });

        const exportedData = performanceMonitor.exportPerformanceData();

        // Validate exported data structure
        expect(exportedData).toHaveProperty('resourceUsageHistory');
        expect(exportedData).toHaveProperty('stressTestResults');
        expect(exportedData).toHaveProperty('performanceBaselines');
        expect(exportedData).toHaveProperty('exportTimestamp');

        expect(exportedData.resourceUsageHistory.length).toBeGreaterThan(0);
        expect(exportedData.stressTestResults.length).toBeGreaterThan(0);
        expect(exportedData.exportTimestamp).toBeDefined();

        // Validate data can be serialized
        const serialized = JSON.stringify(exportedData);
        expect(serialized.length).toBeGreaterThan(0);

        const parsed = JSON.parse(serialized);
        expect(parsed.exportTimestamp).toBe(exportedData.exportTimestamp);

        console.log(`Exported performance data: ${Math.round(serialized.length / 1024)}KB`);
    });
});