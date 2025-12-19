# ClearClause End-to-End Testing Infrastructure

This directory contains the comprehensive end-to-end testing infrastructure for the ClearClause AI system. The testing framework validates all aspects of the system including AWS connectivity, document processing, output quality, and security compliance.

## Directory Structure

```
test/clearclause-e2e-testing/
├── config/
│   └── test-config.js          # AWS and testing configuration
├── utils/
│   ├── test-data-generators.js # Test data generation utilities
│   └── aws-test-utilities.js   # AWS service testing utilities
├── infrastructure-setup.test.js # Infrastructure validation tests
├── test-runner.js              # Test execution orchestrator
└── README.md                   # This file
```

## Configuration

### AWS Services Configuration
The testing framework is configured to work with the following AWS services:
- **S3 Bucket**: `impactxaws-docs`
- **Textract Lambda**: `ClearClause_TextractOCR`
- **URL Fetcher Lambda**: `ClearClause_URLFetcher`
- **Bedrock Model**: `anthropic.claude-3-sonnet-20240229-v1:0`

### Test Configuration
- **Property Test Iterations**: 100 runs per property
- **Test Timeout**: 30 seconds
- **Supported File Types**: PDF, PNG, JPG, JPEG, XLSX, XLS
- **Dataset Path**: `./archive/CUAD_v1`

## Test Data Generators

The framework includes generators for:
- **Legal Text**: Realistic legal document content
- **URL Inputs**: Various URL formats for testing
- **File Metadata**: File upload simulation data
- **API Requests**: Complete request payloads
- **Analysis Outputs**: Expected response structures
- **AWS Responses**: Mock AWS service responses

## AWS Test Utilities

### Mock Services
- **MockS3Client**: Simulates S3 operations
- **MockLambdaClient**: Simulates Lambda invocations
- **MockBedrockClient**: Simulates Bedrock model calls

### Validation Utilities
- **AWSServiceValidator**: Tests real AWS service connectivity
- **TestEnvironmentSetup**: Manages test environment initialization
- **CredentialSecurityValidator**: Scans for credential exposure

## Running Tests

### Infrastructure Tests
```bash
npm test -- test/clearclause-e2e-testing/infrastructure-setup.test.js
```

### All E2E Tests (when implemented)
```bash
npm test -- test/clearclause-e2e-testing/
```

### Property-Based Tests Only
```bash
npm test -- test/clearclause-e2e-testing/ --reporter=verbose
```

## Security Considerations

### Credential Management
- AWS credentials are configured for backend-only access
- Frontend code is scanned for credential exposure
- Test environment validates credential isolation

### Data Privacy
- Test data uses synthetic legal content when possible
- Real dataset files are processed securely
- No sensitive information is logged or exposed

## Test Phases

The complete testing framework will include six phases:

1. **AWS Connectivity Validation** - Verify all AWS services are accessible
2. **Dataset File Processing** - Test document processing pipeline
3. **Input Type Validation** - Validate all supported input types
4. **API Integration Testing** - Test the complete API interface
5. **Output Quality Validation** - Verify analysis result quality
6. **Security and Compliance** - Ensure security boundaries

## Property-Based Testing

The framework uses fast-check for property-based testing with the following properties:

1. **Test Infrastructure Setup** - Validates consistent configuration
2. **AWS Services Connectivity** - Tests service availability
3. **Dataset File Processing** - Validates processing pipeline
4. **Output Quality Consistency** - Ensures consistent analysis quality
5. **Security Boundary Enforcement** - Validates credential isolation

## Troubleshooting

### Common Issues

1. **AWS Credentials Not Found**
   - Ensure `.env` file contains valid AWS credentials
   - Check that credentials have necessary permissions

2. **Dataset Files Missing**
   - The framework gracefully handles missing dataset files
   - Mock data is used when real dataset is unavailable

3. **Test Timeouts**
   - Increase timeout in `test-config.js` if needed
   - Check AWS service response times

### Debug Mode
Set `DEBUG=true` in environment to enable verbose logging:
```bash
DEBUG=true npm test
```

## Contributing

When adding new tests:
1. Follow the existing directory structure
2. Use the provided test data generators
3. Include both unit and property-based tests
4. Update this README with new test descriptions
5. Ensure security validation for any AWS interactions

## Dependencies

- **vitest**: Test framework
- **fast-check**: Property-based testing
- **@aws-sdk/**: AWS service clients
- **dotenv**: Environment configuration
- **fs/path**: File system operations