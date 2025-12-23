/**
 * Final Report Generator for ClearClause E2E Testing
 * Generates comprehensive reports with test results, metrics, and recommendations
 */

import fs from 'fs/promises';
import path from 'path';

export class FinalReportGenerator {
    constructor() {
        this.testResults = [];
        this.metrics = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            executionTime: 0,
            startTime: null,
            endTime: null
        };
        this.featureStatus = {};
        this.recommendations = [];
        this.errors = [];
    }

    /**
     * Initialize report generation
     */
    initialize() {
        this.metrics.startTime = new Date();
        console.log('📊 Final Report Generator initialized');
    }

    /**
     * Add test result to the report
     */
    addTestResult(testName, status, duration, error = null, metadata = {}) {
        const result = {
            testName,
            status,
            duration,
            error,
            metadata,
            timestamp: new Date()
        };

        this.testResults.push(result);
        this.metrics.totalTests++;

        if (status === 'passed') {
            this.metrics.passedTests++;
        } else {
            this.metrics.failedTests++;
            if (error) {
                this.errors.push({
                    testName,
                    error: error.message || error,
                    stack: error.stack || null
                });
            }
        }

        // Update feature status based on test name
        this.updateFeatureStatus(testName, status);
    }

    /**
     * Update feature status based on test results
     */
    updateFeatureStatus(testName, status) {
        let featureName = 'Unknown';

        // Map test names to features
        if (testName.includes('aws-connectivity') || testName.includes('AWS Connectivity')) {
            featureName = 'AWS Connectivity';
        } else if (testName.includes('dataset-file') || testName.includes('Dataset')) {
            featureName = 'Dataset File Processing';
        } else if (testName.includes('raw-text') || testName.includes('Raw Text')) {
            featureName = 'Raw Text Processing';
        } else if (testName.includes('url-content') || testName.includes('URL')) {
            featureName = 'URL Content Processing';
        } else if (testName.includes('api-endpoint') || testName.includes('API')) {
            featureName = 'API Endpoint Processing';
        } else if (testName.includes('output-quality') || testName.includes('Output')) {
            featureName = 'Output Quality Validation';
        } else if (testName.includes('security') || testName.includes('Security')) {
            featureName = 'Security and Credential Isolation';
        } else if (testName.includes('error-handling') || testName.includes('Error')) {
            featureName = 'Error Handling';
        } else if (testName.includes('logging') || testName.includes('Logging')) {
            featureName = 'AWS Service Logging';
        } else if (testName.includes('performance') || testName.includes('Performance')) {
            featureName = 'Performance Testing';
        }

        if (!this.featureStatus[featureName]) {
            this.featureStatus[featureName] = {
                featureName,
                status: true,
                tests: [],
                passedTests: 0,
                failedTests: 0
            };
        }

        this.featureStatus[featureName].tests.push({
            testName,
            status,
            timestamp: new Date()
        });

        if (status === 'passed') {
            this.featureStatus[featureName].passedTests++;
        } else {
            this.featureStatus[featureName].failedTests++;
            this.featureStatus[featureName].status = false;
        }
    }

    /**
     * Generate recommendations based on test results
     */
    generateRecommendations() {
        this.recommendations = [];

        // Analyze failed tests and generate recommendations
        const failedTests = this.testResults.filter(test => test.status === 'failed');

        if (failedTests.length > 0) {
            this.recommendations.push({
                category: 'Test Failures',
                priority: 'High',
                description: `${failedTests.length} tests failed. Review and fix failing tests to ensure system reliability.`,
                actionRequired: true
            });
        }

        // Check for timeout issues
        const timeoutTests = failedTests.filter(test =>
            test.error && test.error.includes && test.error.includes('timeout')
        );

        if (timeoutTests.length > 0) {
            this.recommendations.push({
                category: 'Performance',
                priority: 'Medium',
                description: `${timeoutTests.length} tests timed out. Consider increasing timeout values or optimizing test performance.`,
                actionRequired: true
            });
        }

        // Check for property-based test failures
        const pbtFailures = failedTests.filter(test =>
            test.testName.includes('Property') || test.testName.includes('property')
        );

        if (pbtFailures.length > 0) {
            this.recommendations.push({
                category: 'Property-Based Testing',
                priority: 'High',
                description: `${pbtFailures.length} property-based tests failed. Review test logic and implementation to ensure correctness.`,
                actionRequired: true
            });
        }

        // Check for AWS connectivity issues
        const awsFailures = failedTests.filter(test =>
            test.testName.includes('aws') || test.testName.includes('AWS')
        );

        if (awsFailures.length > 0) {
            this.recommendations.push({
                category: 'AWS Integration',
                priority: 'High',
                description: `${awsFailures.length} AWS-related tests failed. Verify AWS credentials and service availability.`,
                actionRequired: true
            });
        }

        // Performance recommendations
        const slowTests = this.testResults.filter(test => test.duration > 30000);
        if (slowTests.length > 0) {
            this.recommendations.push({
                category: 'Performance',
                priority: 'Medium',
                description: `${slowTests.length} tests took longer than 30 seconds. Consider optimizing test execution.`,
                actionRequired: false
            });
        }

        // Overall success rate recommendation
        const successRate = (this.metrics.passedTests / this.metrics.totalTests) * 100;
        if (successRate < 90) {
            this.recommendations.push({
                category: 'Overall Quality',
                priority: 'High',
                description: `Test success rate is ${successRate.toFixed(1)}%. Aim for >90% success rate for production readiness.`,
                actionRequired: true
            });
        }
    }

    /**
     * Finalize the report
     */
    finalize() {
        this.metrics.endTime = new Date();
        this.metrics.executionTime = this.metrics.endTime - this.metrics.startTime;
        this.generateRecommendations();

        console.log('📋 Final report generation completed');
    }

    /**
     * Generate comprehensive final report
     */
    generateFinalReport() {
        this.finalize();

        const report = {
            executionSummary: {
                testExecutionId: `clearclause-e2e-${Date.now()}`,
                startTime: this.metrics.startTime,
                endTime: this.metrics.endTime,
                totalDuration: this.metrics.executionTime,
                testPhases: Object.keys(this.featureStatus).length,
                overallSuccess: this.metrics.failedTests === 0
            },
            testMetrics: {
                totalTests: this.metrics.totalTests,
                passedTests: this.metrics.passedTests,
                failedTests: this.metrics.failedTests,
                successRate: ((this.metrics.passedTests / this.metrics.totalTests) * 100).toFixed(1)
            },
            featureStatus: Object.values(this.featureStatus),
            failedTests: this.errors,
            recommendations: this.recommendations,
            detailedResults: this.testResults,
            generatedAt: new Date(),
            version: '1.0.0'
        };

        return report;
    }

    /**
     * Export report to file
     */
    async exportReport(outputPath = 'test-reports') {
        const report = this.generateFinalReport();

        try {
            // Ensure output directory exists
            await fs.mkdir(outputPath, { recursive: true });

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `clearclause-e2e-final-report-${timestamp}.json`;
            const filepath = path.join(outputPath, filename);

            // Write report to file
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));

            // Also create a human-readable summary
            const summaryFilename = `clearclause-e2e-summary-${timestamp}.md`;
            const summaryPath = path.join(outputPath, summaryFilename);
            const summary = this.generateMarkdownSummary(report);
            await fs.writeFile(summaryPath, summary);

            console.log(`📄 Final report exported to: ${filepath}`);
            console.log(`📝 Summary report exported to: ${summaryPath}`);

            return {
                reportPath: filepath,
                summaryPath: summaryPath,
                report
            };
        } catch (error) {
            console.error('❌ Failed to export report:', error);
            throw error;
        }
    }

    /**
     * Generate markdown summary of the report
     */
    generateMarkdownSummary(report) {
        const { executionSummary, testMetrics, featureStatus, recommendations } = report;

        let summary = `# ClearClause E2E Testing Final Report\n\n`;
        summary += `**Generated:** ${report.generatedAt.toISOString()}\n`;
        summary += `**Execution ID:** ${executionSummary.testExecutionId}\n\n`;

        // Executive Summary
        summary += `## Executive Summary\n\n`;
        summary += `- **Overall Success:** ${executionSummary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}\n`;
        summary += `- **Total Tests:** ${testMetrics.totalTests}\n`;
        summary += `- **Success Rate:** ${testMetrics.successRate}%\n`;
        summary += `- **Execution Time:** ${Math.round(executionSummary.totalDuration / 1000)}s\n`;
        summary += `- **Test Phases:** ${executionSummary.testPhases}\n\n`;

        // Feature Status
        summary += `## Feature Status\n\n`;
        featureStatus.forEach(feature => {
            const status = feature.status ? '✅' : '❌';
            summary += `- **${feature.featureName}:** ${status} (${feature.passedTests}/${feature.passedTests + feature.failedTests} tests passed)\n`;
        });
        summary += `\n`;

        // Failed Tests
        if (report.failedTests.length > 0) {
            summary += `## Failed Tests (${report.failedTests.length})\n\n`;
            report.failedTests.forEach((failure, index) => {
                summary += `### ${index + 1}. ${failure.testName}\n`;
                summary += `**Error:** ${failure.error}\n\n`;
            });
        }

        // Recommendations
        if (recommendations.length > 0) {
            summary += `## Recommendations (${recommendations.length})\n\n`;
            recommendations.forEach((rec, index) => {
                const priority = rec.priority === 'High' ? '🔴' : rec.priority === 'Medium' ? '🟡' : '🟢';
                summary += `### ${index + 1}. ${rec.category} ${priority}\n`;
                summary += `${rec.description}\n`;
                summary += `**Action Required:** ${rec.actionRequired ? 'Yes' : 'No'}\n\n`;
            });
        }

        return summary;
    }

    /**
     * Print console summary
     */
    printSummary() {
        const report = this.generateFinalReport();

        console.log('\n' + '='.repeat(80));
        console.log('🎯 CLEARCLAUSE E2E TESTING FINAL REPORT');
        console.log('='.repeat(80));

        console.log(`\n📊 EXECUTION SUMMARY:`);
        console.log(`   Overall Success: ${report.executionSummary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   Total Tests: ${report.testMetrics.totalTests}`);
        console.log(`   Success Rate: ${report.testMetrics.successRate}%`);
        console.log(`   Execution Time: ${Math.round(report.executionSummary.totalDuration / 1000)}s`);

        console.log(`\n🔧 FEATURE STATUS:`);
        report.featureStatus.forEach(feature => {
            const status = feature.status ? '✅' : '❌';
            console.log(`   ${feature.featureName}: ${status} (${feature.passedTests}/${feature.passedTests + feature.failedTests})`);
        });

        if (report.failedTests.length > 0) {
            console.log(`\n❌ FAILED TESTS (${report.failedTests.length}):`);
            report.failedTests.slice(0, 5).forEach((failure, index) => {
                console.log(`   ${index + 1}. ${failure.testName}`);
                console.log(`      Error: ${failure.error.substring(0, 100)}...`);
            });
            if (report.failedTests.length > 5) {
                console.log(`   ... and ${report.failedTests.length - 5} more failures`);
            }
        }

        if (report.recommendations.length > 0) {
            console.log(`\n💡 TOP RECOMMENDATIONS (${report.recommendations.length}):`);
            report.recommendations.slice(0, 3).forEach((rec, index) => {
                const priority = rec.priority === 'High' ? '🔴' : rec.priority === 'Medium' ? '🟡' : '🟢';
                console.log(`   ${index + 1}. ${rec.category} ${priority}`);
                console.log(`      ${rec.description}`);
            });
        }

        console.log('\n' + '='.repeat(80));

        return report;
    }
}

// Export singleton instance
export const finalReportGenerator = new FinalReportGenerator();