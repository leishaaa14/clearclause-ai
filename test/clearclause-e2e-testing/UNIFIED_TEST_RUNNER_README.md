# ClearClause E2E Unified Test Runner

This document describes the unified test runner system that integrates all six testing phases into a comprehensive end-to-end testing framework for ClearClause AI.

## Overview

The unified test runner orchestrates the complete ClearClause testing pipeline with proper dependency management, progress reporting, result aggregation, and comprehensive cleanup. It validates the entire system from AWS connectivity through document processing to final output quality.

## Architecture

### Test Phases

The test runner executes six phases in dependency order:

1. **Infrastructure Setup & AWS Connectivity** - Validates AWS service access and test environment
2. **Dataset File Processing** - Tests file processing with representative dataset files  
3. **Raw Text Processing** - Validates raw text input processing and analysis
4. **URL Content Processing** - Tests URL fetching and content analysis pipeline
5. **API Endpoint Validation** - Validates API endpoints and response schemas
6. **Output Quality & Error Handling** - Tests output validation and error handling

### Key Components

- **UnifiedTestOrchestrator** - Main orchestration class that manages phase execution
- **ComprehensiveTestRunner** - Command-line interface with advanced options
- **MainTestIntegration** - Simple integration script for automated execution
- **Orchestrator Configuration** - Centralized configuration for phases and settings

## Usage

### Quick Start

```bash
# Run complete test suite with mocked AWS services
npm run test:e2e

# Run with real AWS services (requires credentials)
npm run test:e2e:real

# Run individual phases for debugging
npm run test:e2e:individual

# Run with comprehensive reporting
npm run test:e2e:comprehensive
```

### Command Line Options

```bash
# Basic execution
node test/clearclause-e2e-testing/run-all-tests.js

# With real AWS services
USE_REAL_AWS_SERVICES=true node test/clearclause-e2e-testing/run-all-tests.js

# Individual phase debugging
RUN_INDIVIDUAL_PHASES=true node test/clearclause-e2e-testing/run-all-tests.js

# Verbose output
VERBOSE=true node test/clearclause-e2e-testing/run-all-tests.js

# Custom output directory
TEST_OUTPUT_DIR=./custom-results node test/clearclause-e2e-testing/run-all-tests.js
```

### Advanced Usage

```bash
# Run specific phase only
node test/clearclause-e2e-testing/comprehensive-test-runner.js --phase infrastructure

# Export detailed report
node test/clearclause-e2e-testing/comprehensive-test-runner.js --output-file report.json

# Use real services with verbose logging
node test/clearclause-e2e-testing/comprehensive-test-runner.js --real-services --verbose

# Get help
node test/clearclause-e2e-testing/comprehensive-test-runner.js --help
```

## Configuration

### Environment Variables

- `USE_REAL_AWS_SERVICES` - Use real AWS services instead of mocks (default: false)
- `TEST_OUTPUT_DIR` - Directory for test reports (default: ./test-results)
- `VERBOSE` - Enable verbose logging (default: false)
- `RUN_INDIVIDUAL_PHASES` - Run phases individually for debugging (default: false)

### AWS Configuration

When using real AWS services, ensure these environment variables are set:

```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
```

### Test Configuration

Edit `test/clearclause-e2e-testing/config/orchestrator-config.js` to customize:

- Phase timeouts and retry settings
- AWS service endpoints and parameters
- Performance thresholds
- Reporting options
- Test data configuration

## Output and Reporting

### Report Types

The test runner generates three types of reports:

1. **Detailed JSON Report** - Complete test execution data with all metrics
2. **Summary JSON Report** - High-level results for quick analysis
3. **Readable Markdown Report** - Human-friendly report with formatted results

### Report Contents

- Overall execution success/failure status
- Individual phase results with timing
- Feature status (working/failed)
- Input type validation results
- Performance metrics and AWS usage
- Recommendations for improvements
- Error details and debugging information

### Sample Report Structure

```json
{
  "overallSuccess": true,
  "executionTime": 180000,
  "phasesExecuted": 6,
  "phasesSuccessful": 6,
  "phasesFailed": 0,
  "featureStatus": [
    {
      "featureName": "AWS Connectivity",
      "working": true,
      "statusMessage": "All services accessible"
    }
  ],
  "inputTypeResults": [
    {
      "inputType": "PDF",
      "success": true,
      "processingTime": 15000
    }
  ],
  "performanceMetrics": {
    "averageProcessingTime": 12000,
    "totalAWSCalls": 45,
    "totalFilesProcessed": 8
  },
  "recommendations": [
    "Consider optimizing PDF processing for better performance"
  ]
}
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: ClearClause E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run E2E tests (mocked)
        run: npm run test:e2e
      
      - name: Upload test reports
        uses: actions/upload-artifact@v3
        with:
          name: e2e-test-reports
          path: test-results/
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    
    stages {
        stage('E2E Tests') {
            steps {
                sh 'npm install'
                sh 'npm run test:e2e'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'test-results/**/*', fingerprint: true
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'test-results',
                        reportFiles: '*.html',
                        reportName: 'E2E Test Report'
                    ])
                }
            }
        }
    }
}
```

## Troubleshooting

### Common Issues

1. **AWS Credential Errors**
   - Ensure AWS credentials are properly configured
   - Check IAM permissions for required services
   - Verify region settings

2. **Timeout Errors**
   - Increase phase timeouts in orchestrator config
   - Check network connectivity to AWS services
   - Monitor system resources during execution

3. **File Processing Failures**
   - Verify dataset files exist in ./archive directory
   - Check file permissions and formats
   - Review Textract service limits

4. **Memory Issues**
   - Reduce concurrent test execution
   - Increase Node.js memory limit: `--max-old-space-size=4096`
   - Monitor memory usage during large file processing

### Debug Mode

Enable debug mode for detailed troubleshooting:

```bash
VERBOSE=true RUN_INDIVIDUAL_PHASES=true npm run test:e2e
```

This will:
- Run phases individually with detailed logging
- Show stack traces for errors
- Display progress information
- Include debug information in reports

### Log Analysis

Test execution logs include:
- Phase start/completion timestamps
- AWS service call details
- Processing time metrics
- Error messages and context
- Resource usage information

## Performance Optimization

### Recommendations

1. **Parallel Execution** - Enable parallel phase execution where dependencies allow
2. **Caching** - Cache AWS responses for repeated test runs
3. **File Selection** - Optimize dataset file selection for representative coverage
4. **Resource Management** - Monitor and optimize memory/CPU usage
5. **Network Optimization** - Use regional AWS endpoints for better performance

### Monitoring

The test runner provides built-in performance monitoring:
- Processing time per input type
- AWS service response times
- Memory usage tracking
- Concurrent request handling
- Resource cleanup verification

## Contributing

### Adding New Test Phases

1. Define phase in `orchestrator-config.js`
2. Implement phase method in `UnifiedTestOrchestrator`
3. Add phase-specific validation logic
4. Update documentation and examples

### Extending Reporting

1. Modify report generation in `TestExecutionReporter`
2. Add new report formats or metrics
3. Update export functionality
4. Test with various execution scenarios

### Improving Performance

1. Profile test execution with Node.js profiler
2. Identify bottlenecks in AWS service calls
3. Optimize file processing algorithms
4. Implement caching strategies

## Support

For issues or questions:
1. Check this documentation first
2. Review test execution logs
3. Enable debug mode for detailed information
4. Check AWS service status and limits
5. Verify environment configuration