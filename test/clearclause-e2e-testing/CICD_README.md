# ClearClause End-to-End Testing CI/CD Integration

This directory contains comprehensive CI/CD integration for automated testing of the ClearClause AI system using real AWS services across all supported input types.

## Overview

The CI/CD integration provides:

- **Automated Test Execution**: Complete end-to-end test suite automation
- **Environment Configuration**: Support for CI, staging, and production environments
- **Test Scheduling**: Automated test scheduling with cron expressions
- **Result Notifications**: Slack, email, and GitHub issue notifications
- **Artifact Management**: Comprehensive test artifact storage and cleanup
- **Containerized Testing**: Docker support for isolated test execution
- **GitHub Actions Integration**: Complete workflow automation

## Quick Start

### 1. Basic Setup

```bash
# Install dependencies
npm install

# Run CI environment tests (with mocks)
node test/clearclause-e2e-testing/cicd-automation.js --environment ci

# Run staging tests with real AWS services
node test/clearclause-e2e-testing/cicd-automation.js --environment staging --real-services --notify
```

### 2. Environment Setup

```bash
# Setup CI/CD environment (Linux/Mac)
./test/clearclause-e2e-testing/scripts/setup-cicd.sh --environment staging --real-services --notify

# Windows PowerShell equivalent
$env:CI_ENVIRONMENT="staging"
$env:CI_USE_REAL_SERVICES="true"
$env:CI_NOTIFICATION_ENABLED="true"
node test/clearclause-e2e-testing/cicd-automation.js --environment staging --real-services --notify
```

### 3. Docker Execution

```bash
# Build and run CI environment
docker-compose -f test/clearclause-e2e-testing/docker/docker-compose.cicd.yml up clearclause-ci

# Run staging environment with real services
docker-compose -f test/clearclause-e2e-testing/docker/docker-compose.cicd.yml up clearclause-staging
```

## Command Line Interface

### CI/CD Automation Script

```bash
node test/clearclause-e2e-testing/cicd-automation.js [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--environment <env>` | Target environment (ci, staging, production) | `ci` |
| `--real-services` | Use real AWS services instead of mocks | `false` |
| `--schedule <cron>` | Schedule automated execution (cron format) | - |
| `--notify` | Enable result notifications | `false` |
| `--retention <days>` | Artifact retention period in days | `30` |
| `--export <path>` | Export artifacts to specified path | - |
| `--cleanup` | Run artifact cleanup only | `false` |
| `--help` | Show help information | - |

#### Examples

```bash
# Basic CI testing
node test/clearclause-e2e-testing/cicd-automation.js --environment ci

# Staging with real services and notifications
node test/clearclause-e2e-testing/cicd-automation.js --environment staging --real-services --notify

# Schedule daily tests at 2 AM
node test/clearclause-e2e-testing/cicd-automation.js --schedule "0 2 * * *" --notify

# Production testing with extended retention
node test/clearclause-e2e-testing/cicd-automation.js --environment production --real-services --notify --retention 90

# Export artifacts and cleanup
node test/clearclause-e2e-testing/cicd-automation.js --export ./exports --cleanup --retention 7
```

## Environment Configuration

### Environment Types

#### CI Environment
- **Purpose**: Fast, lightweight testing for continuous integration
- **Services**: Mock AWS services
- **Timeout**: 5 minutes per phase
- **Retry Attempts**: 2
- **Parallel Execution**: Disabled
- **Resource Limits**: 512MB memory, 1 CPU core

#### Staging Environment
- **Purpose**: Full feature testing with real AWS services
- **Services**: Real AWS services
- **Timeout**: 10 minutes per phase
- **Retry Attempts**: 3
- **Parallel Execution**: Enabled
- **Resource Limits**: 1GB memory, 2 CPU cores

#### Production Environment
- **Purpose**: Production-like testing with strict validation
- **Services**: Real AWS services
- **Timeout**: 15 minutes per phase
- **Retry Attempts**: 1
- **Parallel Execution**: Disabled
- **Resource Limits**: 2GB memory, 4 CPU cores

### Environment Variables

#### Required for Real Services

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# AWS Service Configuration
VITE_S3_BUCKET=impactxaws-docs
VITE_TEXTRACT_LAMBDA=ClearClause_TextractOCR
VITE_URL_LAMBDA=ClearClause_URLFetcher
VITE_BEDROCK_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
```

#### CI/CD Configuration

```bash
# CI/CD Settings
CI_ENVIRONMENT=staging
CI_USE_REAL_SERVICES=true
CI_NOTIFICATION_ENABLED=true
CI_ARTIFACT_RETENTION=30

# Notification Settings (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## GitHub Actions Integration

The repository includes a complete GitHub Actions workflow at `.github/workflows/clearclause-e2e-testing.yml`.

### Workflow Features

- **Multi-environment support**: CI, staging, production
- **Scheduled execution**: Daily at 2 AM UTC
- **Manual triggers**: Workflow dispatch with parameters
- **Artifact management**: Automatic upload and retention
- **Notifications**: Slack integration and GitHub issues
- **Security**: Proper secret management

### Workflow Triggers

1. **Push to main/develop branches**
2. **Pull requests to main**
3. **Scheduled daily execution**
4. **Manual workflow dispatch**

### Required Secrets

Configure these secrets in your GitHub repository:

```
AWS_ACCESS_KEY_ID          # AWS access key
AWS_SECRET_ACCESS_KEY      # AWS secret key
AWS_REGION                 # AWS region (optional, defaults to us-east-1)
S3_BUCKET                  # S3 bucket name (optional)
TEXTRACT_LAMBDA           # Textract Lambda name (optional)
URL_LAMBDA                # URL Fetcher Lambda name (optional)
BEDROCK_MODEL             # Bedrock model ID (optional)
SLACK_WEBHOOK_URL         # Slack webhook for notifications (optional)
```

## Docker Integration

### Container Images

The CI/CD system includes Docker support for isolated testing:

- **Base Image**: `node:18-alpine`
- **Security**: Non-root user execution
- **Health Checks**: Container health monitoring
- **Resource Limits**: Configurable memory and CPU limits

### Docker Compose Services

| Service | Purpose | Resources |
|---------|---------|-----------|
| `clearclause-ci` | CI environment testing | 512MB, 1 CPU |
| `clearclause-staging` | Staging environment testing | 1GB, 2 CPUs |
| `clearclause-production` | Production environment testing | 2GB, 4 CPUs |
| `clearclause-scheduler` | Automated test scheduling | 256MB, 0.5 CPU |
| `clearclause-artifacts` | Artifact management | 256MB, 0.5 CPU |

### Docker Usage

```bash
# Build CI/CD container
docker build -f test/clearclause-e2e-testing/docker/Dockerfile.cicd -t clearclause-e2e .

# Run specific environment
docker-compose -f test/clearclause-e2e-testing/docker/docker-compose.cicd.yml up clearclause-staging

# Run with custom environment variables
docker run -e CI_ENVIRONMENT=production -e CI_USE_REAL_SERVICES=true clearclause-e2e

# Cleanup containers and volumes
docker-compose -f test/clearclause-e2e-testing/docker/docker-compose.cicd.yml down -v
```

## Test Execution Flow

### 1. Initialization Phase
- Environment configuration validation
- AWS service connectivity checks
- Test infrastructure setup
- Artifact directory creation

### 2. Test Execution Phase
- AWS connectivity validation
- Dataset file processing
- Raw text processing validation
- URL content processing
- API endpoint validation
- Error handling validation
- Security validation

### 3. Reporting Phase
- Test result aggregation
- Performance metrics collection
- Comprehensive report generation
- Artifact archival

### 4. Notification Phase
- Result notification dispatch
- Failure alert generation
- GitHub issue creation (for scheduled failures)

### 5. Cleanup Phase
- Artifact retention management
- Resource cleanup
- Export preparation

## Artifact Management

### Artifact Types

1. **Test Results**: JSON files with detailed test outcomes
2. **Performance Metrics**: Processing times and resource usage
3. **Error Logs**: Detailed error information and stack traces
4. **Configuration Files**: Environment and test configurations
5. **Sample Outputs**: Representative analysis results
6. **Workflow Reports**: Complete execution summaries

### Artifact Structure

```
test-artifacts/
├── e2e-{timestamp}-{id}/
│   ├── test-artifacts.json          # Main test results
│   ├── detailed-report.json         # Comprehensive report
│   ├── test-summary.json           # Execution summary
│   ├── execution-metadata.json     # Execution metadata
│   ├── environment-config.json     # Environment configuration
│   ├── notification.json           # Notification data
│   └── error-artifacts.json        # Error information (if any)
├── cicd-status-report.json         # CI/CD status
├── cicd-workflow-report.json       # Workflow execution
└── environment-config.json         # Current environment
```

### Retention Policies

- **CI Environment**: 7 days
- **Staging Environment**: 30 days
- **Production Environment**: 90 days
- **Workflow Archives**: 365 days

## Notification System

### Supported Channels

1. **Slack**: Webhook-based notifications with rich formatting
2. **GitHub Issues**: Automatic issue creation for scheduled failures
3. **Console Output**: Detailed console logging
4. **File-based**: JSON notification files for integration

### Notification Content

- **Execution Status**: Success/failure indication
- **Environment Information**: Target environment and configuration
- **Performance Metrics**: Execution duration and resource usage
- **Test Results**: Summary of passed/failed tests
- **Error Details**: Specific error information for failures
- **Artifact Links**: Direct links to test artifacts

### Slack Integration

Configure Slack notifications by setting the `SLACK_WEBHOOK_URL` environment variable:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
```

Notifications include:
- Color-coded status indicators
- Detailed test metrics
- Direct links to GitHub Actions runs
- Environment and configuration details

## Troubleshooting

### Common Issues

#### 1. AWS Credentials Not Found
```
Error: AWS credentials are required for real services mode
```
**Solution**: Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables.

#### 2. Node.js Version Too Old
```
Error: Node.js version 18 or higher is required
```
**Solution**: Upgrade to Node.js 18 or higher.

#### 3. Permission Denied
```
Error: EACCES: permission denied, mkdir 'test-artifacts'
```
**Solution**: Ensure write permissions for the project directory.

#### 4. Docker Build Fails
```
Error: Cannot connect to the Docker daemon
```
**Solution**: Ensure Docker is running and accessible.

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Enable debug logging
export DEBUG=clearclause:*
node test/clearclause-e2e-testing/cicd-automation.js --environment ci

# Enable verbose CI/CD logging
export CI_VERBOSE_LOGGING=true
node test/clearclause-e2e-testing/cicd-automation.js --environment staging --real-services
```

### Log Locations

- **Console Output**: Real-time execution logs
- **Artifact Files**: `test-artifacts/*/execution-metadata.json`
- **Error Files**: `test-artifacts/*/error-artifacts.json`
- **GitHub Actions**: Workflow run logs
- **Docker Logs**: `docker logs <container-name>`

## Performance Optimization

### Resource Management

1. **Memory Usage**: Monitor heap usage and configure appropriate limits
2. **CPU Utilization**: Use parallel execution in staging environment
3. **Network Optimization**: Implement connection pooling for AWS services
4. **Disk I/O**: Use SSD storage for artifact directories

### Execution Optimization

1. **Test Parallelization**: Enable parallel execution in appropriate environments
2. **Caching**: Cache AWS service responses where possible
3. **Batch Processing**: Process multiple files in batches
4. **Resource Cleanup**: Implement proper cleanup to prevent memory leaks

### Cost Optimization

1. **Mock Services**: Use mocks in CI environment to reduce AWS costs
2. **Scheduled Execution**: Run expensive tests during off-peak hours
3. **Artifact Retention**: Configure appropriate retention periods
4. **Resource Limits**: Set container resource limits to prevent overuse

## Security Considerations

### Credential Management

1. **Environment Variables**: Store credentials in environment variables, not code
2. **Secret Rotation**: Regularly rotate AWS access keys
3. **Least Privilege**: Use IAM roles with minimal required permissions
4. **Encryption**: Encrypt sensitive data in transit and at rest

### Container Security

1. **Non-root User**: Run containers with non-root user
2. **Image Scanning**: Regularly scan container images for vulnerabilities
3. **Network Isolation**: Use Docker networks for service isolation
4. **Resource Limits**: Set appropriate resource limits

### CI/CD Security

1. **Secret Management**: Use GitHub Secrets for sensitive data
2. **Branch Protection**: Protect main branches with required reviews
3. **Audit Logging**: Enable comprehensive audit logging
4. **Access Control**: Limit CI/CD access to authorized personnel

## Contributing

### Development Setup

1. **Clone Repository**: `git clone <repository-url>`
2. **Install Dependencies**: `npm install`
3. **Configure Environment**: Copy `.env.example` to `.env`
4. **Run Tests**: `npm test`

### Adding New Features

1. **Create Feature Branch**: `git checkout -b feature/new-feature`
2. **Implement Changes**: Add code and tests
3. **Update Documentation**: Update README and inline documentation
4. **Test Changes**: Run full test suite
5. **Submit Pull Request**: Create PR with detailed description

### Testing Guidelines

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete user workflows
4. **Performance Tests**: Validate performance requirements
5. **Security Tests**: Verify security controls

## Support

### Documentation

- **API Documentation**: Inline JSDoc comments
- **Architecture Documentation**: `docs/architecture.md`
- **Deployment Guide**: `docs/deployment.md`
- **Troubleshooting Guide**: This README

### Getting Help

1. **GitHub Issues**: Report bugs and request features
2. **Discussions**: Ask questions and share ideas
3. **Wiki**: Community-maintained documentation
4. **Slack Channel**: Real-time support and discussion

### Reporting Issues

When reporting issues, please include:

1. **Environment Information**: OS, Node.js version, Docker version
2. **Configuration**: Environment variables and settings
3. **Error Messages**: Complete error messages and stack traces
4. **Reproduction Steps**: Detailed steps to reproduce the issue
5. **Expected Behavior**: What you expected to happen
6. **Actual Behavior**: What actually happened

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Changelog

### Version 1.0.0
- Initial CI/CD integration implementation
- GitHub Actions workflow
- Docker containerization
- Multi-environment support
- Comprehensive notification system
- Artifact management and retention
- Security and performance optimizations