#!/bin/bash

# ClearClause End-to-End Testing CI/CD Setup Script
# 
# This script sets up the CI/CD environment for automated testing,
# including environment configuration, dependency installation,
# and service validation.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEST_DIR="$PROJECT_ROOT/test/clearclause-e2e-testing"

# Default values
ENVIRONMENT="ci"
USE_REAL_SERVICES="false"
ENABLE_NOTIFICATIONS="false"
ARTIFACT_RETENTION="30"
SKIP_DEPENDENCIES="false"
VALIDATE_ONLY="false"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show help
show_help() {
    cat << EOF
ClearClause End-to-End Testing CI/CD Setup

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV       Target environment (ci, staging, production) [default: ci]
    -r, --real-services         Use real AWS services instead of mocks
    -n, --notify                Enable result notifications
    -t, --retention DAYS        Artifact retention period in days [default: 30]
    -s, --skip-deps             Skip dependency installation
    -v, --validate-only         Only validate environment, don't setup
    -h, --help                  Show this help message

Examples:
    # Basic CI setup
    $0 --environment ci

    # Staging setup with real services
    $0 --environment staging --real-services --notify

    # Production setup with extended retention
    $0 --environment production --real-services --notify --retention 90

    # Validate environment only
    $0 --validate-only

Environment Variables:
    CI_ENVIRONMENT              Override environment setting
    CI_USE_REAL_SERVICES        Use real services (true/false)
    CI_NOTIFICATION_ENABLED     Enable notifications (true/false)
    CI_ARTIFACT_RETENTION       Artifact retention days
    AWS_ACCESS_KEY_ID           AWS access key (for real services)
    AWS_SECRET_ACCESS_KEY       AWS secret key (for real services)
    AWS_REGION                  AWS region [default: us-east-1]

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--real-services)
            USE_REAL_SERVICES="true"
            shift
            ;;
        -n|--notify)
            ENABLE_NOTIFICATIONS="true"
            shift
            ;;
        -t|--retention)
            ARTIFACT_RETENTION="$2"
            shift 2
            ;;
        -s|--skip-deps)
            SKIP_DEPENDENCIES="true"
            shift
            ;;
        -v|--validate-only)
            VALIDATE_ONLY="true"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Apply environment variable overrides
if [[ -n "$CI_ENVIRONMENT" ]]; then
    ENVIRONMENT="$CI_ENVIRONMENT"
fi

if [[ "$CI_USE_REAL_SERVICES" == "true" ]]; then
    USE_REAL_SERVICES="true"
fi

if [[ "$CI_NOTIFICATION_ENABLED" == "true" ]]; then
    ENABLE_NOTIFICATIONS="true"
fi

if [[ -n "$CI_ARTIFACT_RETENTION" ]]; then
    ARTIFACT_RETENTION="$CI_ARTIFACT_RETENTION"
fi

# Validate environment parameter
if [[ ! "$ENVIRONMENT" =~ ^(ci|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be ci, staging, or production."
    exit 1
fi

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        return 1
    fi

    local node_version=$(node --version | sed 's/v//')
    local major_version=$(echo $node_version | cut -d. -f1)
    if [[ $major_version -lt 18 ]]; then
        print_error "Node.js version 18 or higher is required (found: $node_version)"
        return 1
    fi
    print_success "Node.js version: $node_version"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        return 1
    fi
    print_success "npm version: $(npm --version)"

    # Check Git
    if ! command -v git &> /dev/null; then
        print_warning "Git is not installed (optional for CI/CD)"
    else
        print_success "Git version: $(git --version | cut -d' ' -f3)"
    fi

    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        print_success "Docker version: $(docker --version | cut -d' ' -f3 | sed 's/,//')"
    else
        print_warning "Docker is not installed (optional for containerized testing)"
    fi

    return 0
}

# Function to validate AWS credentials
validate_aws_credentials() {
    if [[ "$USE_REAL_SERVICES" == "true" ]]; then
        print_status "Validating AWS credentials..."

        if [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" ]]; then
            print_error "AWS credentials are required for real services mode"
            print_error "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables"
            return 1
        fi

        # Set default region if not specified
        if [[ -z "$AWS_REGION" ]]; then
            export AWS_REGION="us-east-1"
            print_warning "AWS_REGION not set, using default: us-east-1"
        fi

        print_success "AWS credentials configured for region: $AWS_REGION"
    else
        print_status "Using mock AWS services (real services disabled)"
    fi

    return 0
}

# Function to install dependencies
install_dependencies() {
    if [[ "$SKIP_DEPENDENCIES" == "true" ]]; then
        print_status "Skipping dependency installation"
        return 0
    fi

    print_status "Installing dependencies..."

    cd "$PROJECT_ROOT"

    # Check if package-lock.json exists
    if [[ -f "package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi

    print_success "Dependencies installed successfully"
    return 0
}

# Function to create directories
create_directories() {
    print_status "Creating required directories..."

    local dirs=(
        "$PROJECT_ROOT/test-artifacts"
        "$PROJECT_ROOT/test-exports"
        "$PROJECT_ROOT/.github/workflows"
    )

    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            print_success "Created directory: $dir"
        fi
    done

    return 0
}

# Function to configure environment
configure_environment() {
    print_status "Configuring environment: $ENVIRONMENT"

    cd "$PROJECT_ROOT"

    # Create environment configuration
    cat > .env.cicd << EOF
# ClearClause CI/CD Environment Configuration
# Generated on: $(date)

CI_ENVIRONMENT=$ENVIRONMENT
CI_USE_REAL_SERVICES=$USE_REAL_SERVICES
CI_NOTIFICATION_ENABLED=$ENABLE_NOTIFICATIONS
CI_ARTIFACT_RETENTION=$ARTIFACT_RETENTION

# AWS Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
VITE_AWS_REGION=${AWS_REGION:-us-east-1}
VITE_S3_BUCKET=${S3_BUCKET:-impactxaws-docs}
VITE_TEXTRACT_LAMBDA=${TEXTRACT_LAMBDA:-ClearClause_TextractOCR}
VITE_URL_LAMBDA=${URL_LAMBDA:-ClearClause_URLFetcher}
VITE_BEDROCK_MODEL=${BEDROCK_MODEL:-anthropic.claude-3-sonnet-20240229-v1:0}

EOF

    # Add AWS credentials if using real services
    if [[ "$USE_REAL_SERVICES" == "true" ]]; then
        cat >> .env.cicd << EOF
# AWS Credentials (for real services)
VITE_AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
VITE_AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY

EOF
    fi

    print_success "Environment configuration saved to .env.cicd"
    return 0
}

# Function to validate test environment
validate_test_environment() {
    print_status "Validating test environment..."

    cd "$PROJECT_ROOT"

    # Test the CI/CD automation script
    if ! node test/clearclause-e2e-testing/cicd-automation.js --help > /dev/null 2>&1; then
        print_error "CI/CD automation script validation failed"
        return 1
    fi

    # Test environment manager
    if ! node -e "
        import('./test/clearclause-e2e-testing/utils/TestEnvironmentManager.js')
            .then(({ TestEnvironmentManager }) => {
                const manager = new TestEnvironmentManager();
                return manager.configureEnvironment('$ENVIRONMENT');
            })
            .then(() => console.log('Environment validation passed'))
            .catch(err => { console.error('Environment validation failed:', err.message); process.exit(1); });
    " 2>/dev/null; then
        print_error "Test environment validation failed"
        return 1
    fi

    print_success "Test environment validation passed"
    return 0
}

# Function to generate CI/CD scripts
generate_scripts() {
    print_status "Generating CI/CD helper scripts..."

    # Create run script
    cat > "$PROJECT_ROOT/run-e2e-tests.sh" << 'EOF'
#!/bin/bash
# ClearClause End-to-End Test Runner
# Generated by setup-cicd.sh

set -e

# Load CI/CD environment
if [[ -f ".env.cicd" ]]; then
    source .env.cicd
fi

# Run tests
node test/clearclause-e2e-testing/cicd-automation.js "$@"
EOF

    chmod +x "$PROJECT_ROOT/run-e2e-tests.sh"

    # Create Docker run script
    cat > "$PROJECT_ROOT/run-e2e-docker.sh" << 'EOF'
#!/bin/bash
# ClearClause End-to-End Docker Test Runner
# Generated by setup-cicd.sh

set -e

ENVIRONMENT=${1:-ci}

# Load environment variables
if [[ -f ".env.cicd" ]]; then
    export $(grep -v '^#' .env.cicd | xargs)
fi

# Run with Docker Compose
docker-compose -f test/clearclause-e2e-testing/docker/docker-compose.cicd.yml up clearclause-$ENVIRONMENT
EOF

    chmod +x "$PROJECT_ROOT/run-e2e-docker.sh"

    print_success "Generated helper scripts: run-e2e-tests.sh, run-e2e-docker.sh"
    return 0
}

# Function to show setup summary
show_summary() {
    print_success "CI/CD setup completed successfully!"
    echo
    echo "Configuration Summary:"
    echo "  Environment: $ENVIRONMENT"
    echo "  Real Services: $USE_REAL_SERVICES"
    echo "  Notifications: $ENABLE_NOTIFICATIONS"
    echo "  Artifact Retention: $ARTIFACT_RETENTION days"
    echo
    echo "Next Steps:"
    echo "  1. Run tests: ./run-e2e-tests.sh --environment $ENVIRONMENT"
    echo "  2. Run with Docker: ./run-e2e-docker.sh $ENVIRONMENT"
    echo "  3. Schedule tests: node test/clearclause-e2e-testing/cicd-automation.js --schedule '0 2 * * *'"
    echo "  4. View GitHub Actions: .github/workflows/clearclause-e2e-testing.yml"
    echo
    echo "Configuration file: .env.cicd"
    echo "Artifacts directory: test-artifacts/"
    echo "Exports directory: test-exports/"
}

# Main execution
main() {
    print_status "Starting ClearClause CI/CD setup..."
    print_status "Environment: $ENVIRONMENT"
    print_status "Real Services: $USE_REAL_SERVICES"
    print_status "Notifications: $ENABLE_NOTIFICATIONS"
    print_status "Artifact Retention: $ARTIFACT_RETENTION days"
    echo

    # Check prerequisites
    if ! check_prerequisites; then
        print_error "Prerequisites check failed"
        exit 1
    fi

    # Validate AWS credentials
    if ! validate_aws_credentials; then
        print_error "AWS credentials validation failed"
        exit 1
    fi

    # If validate-only mode, stop here
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        print_success "Validation completed successfully"
        exit 0
    fi

    # Install dependencies
    if ! install_dependencies; then
        print_error "Dependency installation failed"
        exit 1
    fi

    # Create directories
    if ! create_directories; then
        print_error "Directory creation failed"
        exit 1
    fi

    # Configure environment
    if ! configure_environment; then
        print_error "Environment configuration failed"
        exit 1
    fi

    # Validate test environment
    if ! validate_test_environment; then
        print_error "Test environment validation failed"
        exit 1
    fi

    # Generate scripts
    if ! generate_scripts; then
        print_error "Script generation failed"
        exit 1
    fi

    # Show summary
    show_summary
}

# Execute main function
main "$@"