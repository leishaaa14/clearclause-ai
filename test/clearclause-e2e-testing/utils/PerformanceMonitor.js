/**
 * Performance Monitor for ClearClause End-to-End Testing
 * 
 * Provides comprehensive performance monitoring, benchmarking, and stress testing
 * capabilities for the ClearClause AI system across different input types.
 */

import { performance } from 'perf_hooks';
import os from 'os';

export class PerformanceMonitor {
    constructor() {
        this.benchmarks = new Map();
        this.stressTestResults = [];
        this.resourceUsageHistory = [];
        this.performanceBaselines = new Map();
        this.regressionThresholds = {
            processingTime: 1.5, // 50% increase threshold
            memoryUsage: 2.0,    // 100% increase threshold
            cpuUsage: 1.8        // 80% increase threshold
        };
    }

    /**
     * Start performance monitoring for a specific operation
     * @param {string} operationId - Unique identifier for the operation
     * @param {Object} metadata - Additional metadata about the operation
     */
    startMonitoring(operationId, metadata = {}) {
        const startTime = performance.now();
        const startMemory = process.memoryUsage();
        const startCpuUsage = process.cpuUsage();

        this.benchmarks.set(operationId, {
            startTime,
            startMemory,
            startCpuUsage,
            metadata,
            resourceSnapshots: []
        });

        // Take initial resource snapshot
        this.takeResourceSnapshot(operationId);
    }

    /**
     * Stop performance monitoring and calculate metrics
     * @param {string} operationId - Operation identifier
     * @param {Object} additionalMetrics - Additional metrics to include
     * @returns {Object} Performance metrics
     */
    stopMonitoring(operationId, additionalMetrics = {}) {
        const benchmark = this.benchmarks.get(operationId);
        if (!benchmark) {
            throw new Error(`No benchmark found for operation: ${operationId}`);
        }

        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        const endCpuUsage = process.cpuUsage(benchmark.startCpuUsage);

        const metrics = {
            operationId,
            duration: endTime - benchmark.startTime,
            memoryUsage: {
                peak: Math.max(endMemory.heapUsed, benchmark.startMemory.heapUsed),
                delta: endMemory.heapUsed - benchmark.startMemory.heapUsed,
                heapUsed: endMemory.heapUsed,
                heapTotal: endMemory.heapTotal,
                external: endMemory.external,
                rss: endMemory.rss
            },
            cpuUsage: {
                user: endCpuUsage.user / 1000, // Convert to milliseconds
                system: endCpuUsage.system / 1000
            },
            resourceSnapshots: benchmark.resourceSnapshots,
            metadata: benchmark.metadata,
            timestamp: new Date().toISOString(),
            ...additionalMetrics
        };

        // Store in resource usage history
        this.resourceUsageHistory.push(metrics);

        // Clean up benchmark
        this.benchmarks.delete(operationId);

        return metrics;
    }

    /**
     * Take a resource usage snapshot during monitoring
     * @param {string} operationId - Operation identifier
     */
    takeResourceSnapshot(operationId) {
        const benchmark = this.benchmarks.get(operationId);
        if (!benchmark) return;

        const snapshot = {
            timestamp: performance.now() - benchmark.startTime,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(benchmark.startCpuUsage),
            systemLoad: os.loadavg(),
            freeMemory: os.freemem(),
            totalMemory: os.totalmem()
        };

        benchmark.resourceSnapshots.push(snapshot);
    }

    /**
     * Run performance benchmark for different input types
     * @param {Array} inputTypes - Array of input type configurations
     * @param {Function} processingFunction - Function to benchmark
     * @returns {Promise<Object>} Benchmark results
     */
    async runBenchmark(inputTypes, processingFunction) {
        const benchmarkResults = {
            startTime: new Date().toISOString(),
            inputTypes: {},
            summary: {
                totalTests: 0,
                averageProcessingTime: 0,
                fastestInputType: null,
                slowestInputType: null,
                memoryEfficient: null,
                memoryIntensive: null
            }
        };

        for (const inputType of inputTypes) {
            console.log(`Running benchmark for input type: ${inputType.name}`);

            const typeResults = {
                name: inputType.name,
                iterations: inputType.iterations || 5,
                results: [],
                statistics: {}
            };

            // Run multiple iterations for statistical significance
            for (let i = 0; i < typeResults.iterations; i++) {
                const operationId = `benchmark_${inputType.name}_${i}`;

                try {
                    this.startMonitoring(operationId, {
                        inputType: inputType.name,
                        iteration: i,
                        benchmarkRun: true
                    });

                    // Take snapshots during processing
                    const snapshotInterval = setInterval(() => {
                        this.takeResourceSnapshot(operationId);
                    }, 100); // Every 100ms

                    const result = await processingFunction(inputType.testData);

                    clearInterval(snapshotInterval);

                    const metrics = this.stopMonitoring(operationId, {
                        success: true,
                        resultSize: JSON.stringify(result).length
                    });

                    typeResults.results.push(metrics);
                    benchmarkResults.summary.totalTests++;

                } catch (error) {
                    console.error(`Benchmark failed for ${inputType.name} iteration ${i}:`, error.message);

                    const metrics = this.stopMonitoring(operationId, {
                        success: false,
                        error: error.message
                    });

                    typeResults.results.push(metrics);
                }

                // Brief pause between iterations
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Calculate statistics for this input type
            typeResults.statistics = this.calculateStatistics(typeResults.results);
            benchmarkResults.inputTypes[inputType.name] = typeResults;
        }

        // Calculate overall summary
        benchmarkResults.summary = this.calculateBenchmarkSummary(benchmarkResults.inputTypes);
        benchmarkResults.endTime = new Date().toISOString();

        return benchmarkResults;
    }

    /**
     * Run concurrent stress test
     * @param {Object} stressConfig - Stress test configuration
     * @param {Function} processingFunction - Function to stress test
     * @returns {Promise<Object>} Stress test results
     */
    async runStressTest(stressConfig, processingFunction) {
        const {
            concurrentRequests = 10,
            duration = 30000, // 30 seconds
            rampUpTime = 5000, // 5 seconds
            inputData = []
        } = stressConfig;

        console.log(`Starting stress test: ${concurrentRequests} concurrent requests for ${duration}ms`);

        const stressResults = {
            config: stressConfig,
            startTime: new Date().toISOString(),
            requests: [],
            summary: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                minResponseTime: Infinity,
                maxResponseTime: 0,
                requestsPerSecond: 0,
                errors: []
            }
        };

        const startTime = Date.now();
        const endTime = startTime + duration;
        let requestId = 0;
        const requestsLock = new Set(); // Track active operations to prevent race conditions

        // Function to create a single request
        const createRequest = async () => {
            const currentRequestId = requestId++;
            const operationId = `stress_${currentRequestId}`;
            const testData = inputData[currentRequestId % inputData.length] || inputData[0];

            // Prevent race conditions by tracking active operations
            if (requestsLock.has(operationId)) {
                return;
            }
            requestsLock.add(operationId);

            try {
                this.startMonitoring(operationId, {
                    stressTest: true,
                    requestId: currentRequestId,
                    concurrentRequests
                });

                const result = await processingFunction(testData);

                // Check if monitoring is still active before stopping
                if (this.benchmarks.has(operationId)) {
                    const metrics = this.stopMonitoring(operationId, {
                        success: true,
                        requestId: currentRequestId
                    });

                    stressResults.requests.push(metrics);
                    stressResults.summary.successfulRequests++;
                }

            } catch (error) {
                // Check if monitoring is still active before stopping
                if (this.benchmarks.has(operationId)) {
                    const metrics = this.stopMonitoring(operationId, {
                        success: false,
                        error: error.message,
                        requestId: currentRequestId
                    });

                    stressResults.requests.push(metrics);
                    stressResults.summary.failedRequests++;
                    stressResults.summary.errors.push({
                        requestId: currentRequestId,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            } finally {
                requestsLock.delete(operationId);
                stressResults.summary.totalRequests++;
            }
        };

        // Ramp up concurrent requests gradually
        const rampUpInterval = rampUpTime / concurrentRequests;
        const activeRequests = new Set();

        for (let i = 0; i < concurrentRequests; i++) {
            setTimeout(() => {
                const runContinuousRequests = async () => {
                    while (Date.now() < endTime) {
                        try {
                            const requestPromise = createRequest();
                            activeRequests.add(requestPromise);

                            requestPromise.finally(() => {
                                activeRequests.delete(requestPromise);
                            });

                            await requestPromise;

                            // Small delay between requests from same worker
                            await new Promise(resolve => setTimeout(resolve, 50));
                        } catch (error) {
                            // Silently handle errors to prevent unhandled rejections
                            console.error('Stress test worker error:', error.message);
                        }
                    }
                };

                runContinuousRequests().catch(error => {
                    console.error('Stress test worker error:', error.message);
                });
            }, i * rampUpInterval);
        }

        // Wait for test duration plus some buffer for cleanup
        await new Promise(resolve => setTimeout(resolve, duration + 2000));

        // Wait for any remaining requests to complete
        await Promise.allSettled(Array.from(activeRequests));

        // Calculate final statistics
        stressResults.summary = this.calculateStressTestSummary(stressResults.requests, duration);
        stressResults.endTime = new Date().toISOString();

        this.stressTestResults.push(stressResults);

        return stressResults;
    }

    /**
     * Test AWS service limits and thresholds
     * @param {Object} limitConfig - Service limit configuration
     * @returns {Promise<Object>} Limit test results
     */
    async testServiceLimits(limitConfig) {
        const {
            services = ['s3', 'textract', 'lambda', 'bedrock'],
            maxConcurrentRequests = 50,
            requestInterval = 100 // milliseconds
        } = limitConfig;

        const limitResults = {
            startTime: new Date().toISOString(),
            services: {},
            summary: {
                servicesWithLimits: [],
                recommendedConcurrency: {},
                throttlingDetected: false
            }
        };

        for (const service of services) {
            console.log(`Testing limits for ${service} service`);

            const serviceResults = {
                service,
                requests: [],
                limits: {
                    maxSuccessfulConcurrent: 0,
                    throttlingThreshold: null,
                    averageResponseTime: 0,
                    errorRate: 0
                }
            };

            // Gradually increase concurrent requests until we hit limits
            for (let concurrency = 1; concurrency <= maxConcurrentRequests; concurrency += 5) {
                const batchResults = await this.testServiceConcurrency(service, concurrency, requestInterval);
                serviceResults.requests.push(...batchResults.requests);

                // Check if we're hitting limits (high error rate or throttling)
                const errorRate = batchResults.requests.filter(r => !r.success).length / batchResults.requests.length;
                const avgResponseTime = batchResults.requests.reduce((sum, r) => sum + r.duration, 0) / batchResults.requests.length;

                if (errorRate > 0.1 || avgResponseTime > 10000) { // 10% error rate or 10s response time
                    serviceResults.limits.throttlingThreshold = concurrency;
                    limitResults.summary.throttlingDetected = true;
                    break;
                } else {
                    serviceResults.limits.maxSuccessfulConcurrent = concurrency;
                }

                // Brief pause between concurrency levels
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            serviceResults.limits.averageResponseTime = serviceResults.requests.reduce((sum, r) => sum + r.duration, 0) / serviceResults.requests.length;
            serviceResults.limits.errorRate = serviceResults.requests.filter(r => !r.success).length / serviceResults.requests.length;

            limitResults.services[service] = serviceResults;
            limitResults.summary.recommendedConcurrency[service] = Math.floor(serviceResults.limits.maxSuccessfulConcurrent * 0.8);
        }

        limitResults.endTime = new Date().toISOString();
        return limitResults;
    }

    /**
     * Test service concurrency for a specific level
     * @param {string} service - Service name
     * @param {number} concurrency - Concurrent request count
     * @param {number} interval - Interval between requests
     * @returns {Promise<Object>} Concurrency test results
     */
    async testServiceConcurrency(service, concurrency, interval) {
        const requests = [];
        const promises = [];

        for (let i = 0; i < concurrency; i++) {
            const promise = new Promise(async (resolve) => {
                const operationId = `limit_test_${service}_${concurrency}_${i}`;

                try {
                    this.startMonitoring(operationId, {
                        service,
                        concurrency,
                        limitTest: true
                    });

                    // Simulate service call (replace with actual service calls in real implementation)
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

                    // Check if monitoring is still active before stopping
                    if (this.benchmarks.has(operationId)) {
                        const metrics = this.stopMonitoring(operationId, {
                            success: true,
                            service
                        });

                        requests.push(metrics);
                        resolve(metrics);
                    } else {
                        resolve({ success: false, error: 'Monitoring not found', service });
                    }

                } catch (error) {
                    // Check if monitoring is still active before stopping
                    if (this.benchmarks.has(operationId)) {
                        const metrics = this.stopMonitoring(operationId, {
                            success: false,
                            error: error.message,
                            service
                        });

                        requests.push(metrics);
                        resolve(metrics);
                    } else {
                        requests.push({ success: false, error: error.message, service });
                        resolve({ success: false, error: error.message, service });
                    }
                }
            });

            promises.push(promise);

            // Stagger request starts
            if (i < concurrency - 1) {
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }

        await Promise.all(promises);

        return { requests };
    }

    /**
     * Detect performance regressions by comparing with baselines
     * @param {Object} currentMetrics - Current performance metrics
     * @param {string} baselineKey - Key for baseline comparison
     * @returns {Object} Regression analysis results
     */
    detectRegressions(currentMetrics, baselineKey) {
        const baseline = this.performanceBaselines.get(baselineKey);
        if (!baseline) {
            // Store as new baseline
            this.performanceBaselines.set(baselineKey, currentMetrics);
            return {
                hasRegression: false,
                isNewBaseline: true,
                message: 'Baseline established for future comparisons'
            };
        }

        const regressions = [];

        // Check processing time regression
        if (currentMetrics.duration > baseline.duration * this.regressionThresholds.processingTime) {
            regressions.push({
                metric: 'processing_time',
                current: currentMetrics.duration,
                baseline: baseline.duration,
                increase: ((currentMetrics.duration / baseline.duration - 1) * 100).toFixed(1) + '%'
            });
        }

        // Check memory usage regression
        if (currentMetrics.memoryUsage.peak > baseline.memoryUsage.peak * this.regressionThresholds.memoryUsage) {
            regressions.push({
                metric: 'memory_usage',
                current: currentMetrics.memoryUsage.peak,
                baseline: baseline.memoryUsage.peak,
                increase: ((currentMetrics.memoryUsage.peak / baseline.memoryUsage.peak - 1) * 100).toFixed(1) + '%'
            });
        }

        // Check CPU usage regression
        const currentCpuTotal = currentMetrics.cpuUsage.user + currentMetrics.cpuUsage.system;
        const baselineCpuTotal = baseline.cpuUsage.user + baseline.cpuUsage.system;

        if (currentCpuTotal > baselineCpuTotal * this.regressionThresholds.cpuUsage) {
            regressions.push({
                metric: 'cpu_usage',
                current: currentCpuTotal,
                baseline: baselineCpuTotal,
                increase: ((currentCpuTotal / baselineCpuTotal - 1) * 100).toFixed(1) + '%'
            });
        }

        return {
            hasRegression: regressions.length > 0,
            regressions,
            recommendations: this.generateRegressionRecommendations(regressions)
        };
    }

    /**
     * Calculate statistics for benchmark results
     * @param {Array} results - Array of performance metrics
     * @returns {Object} Statistical summary
     */
    calculateStatistics(results) {
        if (results.length === 0) return {};

        const durations = results.map(r => r.duration);
        const memoryUsages = results.map(r => r.memoryUsage.peak);
        const successfulResults = results.filter(r => r.success !== false);

        return {
            count: results.length,
            successRate: (successfulResults.length / results.length) * 100,
            duration: {
                min: Math.min(...durations),
                max: Math.max(...durations),
                average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
                median: this.calculateMedian(durations),
                p95: this.calculatePercentile(durations, 95),
                p99: this.calculatePercentile(durations, 99)
            },
            memory: {
                min: Math.min(...memoryUsages),
                max: Math.max(...memoryUsages),
                average: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length
            }
        };
    }

    /**
     * Calculate benchmark summary across all input types
     * @param {Object} inputTypes - Benchmark results by input type
     * @returns {Object} Overall summary
     */
    calculateBenchmarkSummary(inputTypes) {
        const summary = {
            totalTests: 0,
            averageProcessingTime: 0,
            fastestInputType: null,
            slowestInputType: null,
            memoryEfficient: null,
            memoryIntensive: null
        };

        let totalDuration = 0;
        let fastestTime = Infinity;
        let slowestTime = 0;
        let lowestMemory = Infinity;
        let highestMemory = 0;

        Object.entries(inputTypes).forEach(([typeName, typeData]) => {
            const stats = typeData.statistics;
            if (!stats.duration) return;

            summary.totalTests += stats.count;
            totalDuration += stats.duration.average * stats.count;

            if (stats.duration.average < fastestTime) {
                fastestTime = stats.duration.average;
                summary.fastestInputType = typeName;
            }

            if (stats.duration.average > slowestTime) {
                slowestTime = stats.duration.average;
                summary.slowestInputType = typeName;
            }

            if (stats.memory.average < lowestMemory) {
                lowestMemory = stats.memory.average;
                summary.memoryEfficient = typeName;
            }

            if (stats.memory.average > highestMemory) {
                highestMemory = stats.memory.average;
                summary.memoryIntensive = typeName;
            }
        });

        summary.averageProcessingTime = summary.totalTests > 0 ? totalDuration / summary.totalTests : 0;

        return summary;
    }

    /**
     * Calculate stress test summary
     * @param {Array} requests - Array of request results
     * @param {number} duration - Test duration in milliseconds
     * @returns {Object} Stress test summary
     */
    calculateStressTestSummary(requests, duration) {
        const successfulRequests = requests.filter(r => r.success !== false);
        const failedRequests = requests.filter(r => r.success === false);
        const durations = successfulRequests.map(r => r.duration);

        return {
            totalRequests: requests.length,
            successfulRequests: successfulRequests.length,
            failedRequests: failedRequests.length,
            successRate: (successfulRequests.length / requests.length) * 100,
            averageResponseTime: durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
            minResponseTime: durations.length > 0 ? Math.min(...durations) : 0,
            maxResponseTime: durations.length > 0 ? Math.max(...durations) : 0,
            requestsPerSecond: (requests.length / duration) * 1000,
            p95ResponseTime: durations.length > 0 ? this.calculatePercentile(durations, 95) : 0,
            errors: failedRequests.map(r => ({ error: r.error, timestamp: r.timestamp }))
        };
    }

    /**
     * Generate recommendations based on regression analysis
     * @param {Array} regressions - Array of detected regressions
     * @returns {Array} Array of recommendation strings
     */
    generateRegressionRecommendations(regressions) {
        const recommendations = [];

        regressions.forEach(regression => {
            switch (regression.metric) {
                case 'processing_time':
                    recommendations.push(
                        `Processing time increased by ${regression.increase}. ` +
                        'Consider optimizing algorithms or reviewing recent code changes.'
                    );
                    break;
                case 'memory_usage':
                    recommendations.push(
                        `Memory usage increased by ${regression.increase}. ` +
                        'Check for memory leaks or inefficient data structures.'
                    );
                    break;
                case 'cpu_usage':
                    recommendations.push(
                        `CPU usage increased by ${regression.increase}. ` +
                        'Review computational complexity and consider optimization.'
                    );
                    break;
            }
        });

        return recommendations;
    }

    /**
     * Utility methods for statistical calculations
     */
    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    calculatePercentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * Export performance data for analysis
     * @returns {Object} Complete performance data
     */
    exportPerformanceData() {
        return {
            resourceUsageHistory: this.resourceUsageHistory,
            stressTestResults: this.stressTestResults,
            performanceBaselines: Object.fromEntries(this.performanceBaselines),
            exportTimestamp: new Date().toISOString()
        };
    }

    /**
     * Clear all performance data
     */
    clear() {
        this.benchmarks.clear();
        this.stressTestResults = [];
        this.resourceUsageHistory = [];
    }
}

export default PerformanceMonitor;