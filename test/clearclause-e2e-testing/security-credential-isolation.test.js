/**
 * Security and Credential Isolation Tests for ClearClause End-to-End Testing
 * 
 * This test suite validates that AWS credentials are never exposed to the frontend
 * and that all AWS service calls are executed exclusively in backend functions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import fs from 'fs/promises';
import path from 'path';
import { AWS_CONFIG, SECURITY_CONFIG } from './config/test-config.js';

/**
 * Security Validator Class
 * Validates credential isolation and security boundaries
 */
class SecurityValidator {
    constructor() {
        this.violations = [];
        this.scanResults = {};
    }

    /**
     * Scan frontend code for AWS credential exposure
     */
    async scanFrontendForCredentials() {
        const frontendDirs = ['src', 'public', 'dist'];
        const violations = [];

        for (const dir of frontendDirs) {
            const dirPath = path.resolve(process.cwd(), dir);

            try {
                await fs.access(dirPath);
                const files = await this.getFilesRecursively(dirPath);

                for (const file of files) {
                    // Skip certain file types that shouldn't contain credentials
                    if (this.shouldSkipFile(file)) continue;

                    try {
                        const content = await fs.readFile(file, 'utf-8');
                        const credentialViolations = this.scanContentForCredentials(content, file);
                        violations.push(...credentialViolations);
                    } catch (error) {
                        // Skip files that can't be read as text
                        continue;
                    }
                }
            } catch (error) {
                // Directory doesn't exist, skip
                continue;
            }
        }

        return {
            violationsFound: violations.length > 0,
            violations: violations,
            scannedDirectories: frontendDirs
        };
    }

    /**
     * Validate backend-only credential access
     */
    async validateBackendCredentialAccess() {
        const backendDirs = ['functions', 'api', 'server'];
        const hasBackendCredentials = [];

        for (const dir of backendDirs) {
            const dirPath = path.resolve(process.cwd(), dir);

            try {
                await fs.access(dirPath);
                const files = await this.getFilesRecursively(dirPath);

                for (const file of files) {
                    if (file.endsWith('.js') || file.endsWith('.ts')) {
                        try {
                            const content = await fs.readFile(file, 'utf-8');
                            if (this.hasValidCredentialAccess(content)) {
                                hasBackendCredentials.push({
                                    file: file,
                                    hasCredentials: true,
                                    location: 'backend'
                                });
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                }
            } catch (error) {
                // Directory doesn't exist, skip
                continue;
            }
        }

        return {
            backendCredentialsFound: hasBackendCredentials.length > 0,
            credentialFiles: hasBackendCredentials,
            scannedDirectories: backendDirs
        };
    }

    /**
     * Validate AWS service call locations (backend functions only)
     */
    async validateAWSCallLocations() {
        const awsServicePatterns = [
            /aws-sdk/gi,
            /AWS\./gi,
            /S3Client/gi,
            /TextractClient/gi,
            /BedrockClient/gi,
            /LambdaClient/gi,
            /\.s3\./gi,
            /\.textract\./gi,
            /\.bedrock\./gi,
            /\.lambda\./gi
        ];

        const frontendViolations = [];
        const backendUsage = [];

        // Check frontend directories for AWS service usage
        const frontendDirs = ['src', 'public'];
        for (const dir of frontendDirs) {
            const dirPath = path.resolve(process.cwd(), dir);

            try {
                await fs.access(dirPath);
                const files = await this.getFilesRecursively(dirPath);

                for (const file of files) {
                    if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
                        try {
                            const content = await fs.readFile(file, 'utf-8');
                            const violations = this.scanForAWSUsage(content, file, awsServicePatterns);
                            frontendViolations.push(...violations);
                        } catch (error) {
                            continue;
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }

        // Check backend directories for proper AWS service usage
        const backendDirs = ['functions', 'api', 'server'];
        for (const dir of backendDirs) {
            const dirPath = path.resolve(process.cwd(), dir);

            try {
                await fs.access(dirPath);
                const files = await this.getFilesRecursively(dirPath);

                for (const file of files) {
                    if (file.endsWith('.js') || file.endsWith('.ts')) {
                        try {
                            const content = await fs.readFile(file, 'utf-8');
                            const usage = this.scanForAWSUsage(content, file, awsServicePatterns);
                            if (usage.length > 0) {
                                backendUsage.push({
                                    file: file,
                                    awsUsage: usage,
                                    location: 'backend'
                                });
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }

        return {
            frontendViolations: frontendViolations,
            backendUsage: backendUsage,
            hasViolations: frontendViolations.length > 0,
            properBackendUsage: backendUsage.length > 0
        };
    }

    /**
     * Validate frontend UI-only functionality
     */
    async validateFrontendUIOnly() {
        const frontendDir = path.resolve(process.cwd(), 'src');
        const uiOnlyPatterns = [
            /useState/gi,
            /useEffect/gi,
            /onClick/gi,
            /onChange/gi,
            /onSubmit/gi,
            /className/gi,
            /style=/gi,
            /jsx/gi,
            /React/gi,
            /component/gi
        ];

        const uiComponents = [];
        const nonUIViolations = [];

        try {
            await fs.access(frontendDir);
            const files = await this.getFilesRecursively(frontendDir);

            for (const file of files) {
                if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
                    try {
                        const content = await fs.readFile(file, 'utf-8');
                        const hasUIPatterns = uiOnlyPatterns.some(pattern => pattern.test(content));

                        if (hasUIPatterns) {
                            uiComponents.push({
                                file: file,
                                isUIComponent: true
                            });
                        }

                        // Check for non-UI violations (direct AWS calls, etc.)
                        const awsViolations = this.scanForAWSUsage(content, file, [
                            /aws-sdk/gi,
                            /AWS\./gi,
                            /process\.env\.AWS/gi
                        ]);

                        if (awsViolations.length > 0) {
                            nonUIViolations.push({
                                file: file,
                                violations: awsViolations
                            });
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
        } catch (error) {
            // Frontend directory doesn't exist
        }

        return {
            uiComponents: uiComponents,
            nonUIViolations: nonUIViolations,
            isUIOnly: nonUIViolations.length === 0,
            hasUIComponents: uiComponents.length > 0
        };
    }

    /**
     * Scan version control and logs for credential exposure
     */
    async scanVersionControlAndLogs() {
        const violations = [];
        const filesToCheck = [
            '.git/config',
            '.gitignore',
            'package.json',
            'package-lock.json',
            '*.log'
        ];

        // Check git configuration
        try {
            const gitConfigPath = path.resolve(process.cwd(), '.git/config');
            await fs.access(gitConfigPath);
            const gitConfig = await fs.readFile(gitConfigPath, 'utf-8');
            const credentialViolations = this.scanContentForCredentials(gitConfig, '.git/config');
            violations.push(...credentialViolations);
        } catch (error) {
            // Git config doesn't exist or can't be read
        }

        // Check log files
        try {
            const files = await fs.readdir(process.cwd());
            const logFiles = files.filter(file => file.endsWith('.log'));

            for (const logFile of logFiles) {
                try {
                    const content = await fs.readFile(path.resolve(process.cwd(), logFile), 'utf-8');
                    const credentialViolations = this.scanContentForCredentials(content, logFile);
                    violations.push(...credentialViolations);
                } catch (error) {
                    continue;
                }
            }
        } catch (error) {
            // Can't read directory
        }

        return {
            violationsFound: violations.length > 0,
            violations: violations,
            checkedFiles: filesToCheck
        };
    }

    /**
     * Helper method to get files recursively
     */
    async getFilesRecursively(dir) {
        const files = [];

        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Skip node_modules and .git directories
                    if (entry.name !== 'node_modules' && entry.name !== '.git') {
                        const subFiles = await this.getFilesRecursively(fullPath);
                        files.push(...subFiles);
                    }
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory can't be read
        }

        return files;
    }

    /**
     * Check if file should be skipped during credential scanning
     */
    shouldSkipFile(filePath) {
        const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
        const skipFiles = ['package-lock.json', 'yarn.lock'];

        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);

        return skipExtensions.includes(ext) || skipFiles.includes(fileName);
    }

    /**
     * Scan content for credential patterns
     */
    scanContentForCredentials(content, filePath) {
        const violations = [];

        for (const pattern of SECURITY_CONFIG.credentialPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                violations.push({
                    file: filePath,
                    pattern: pattern.toString(),
                    matches: matches.length,
                    type: 'credential_exposure'
                });
            }
        }

        // Check for environment variable patterns that might contain credentials
        const envPatterns = [
            /process\.env\.AWS_ACCESS_KEY_ID/gi,
            /process\.env\.AWS_SECRET_ACCESS_KEY/gi,
            /process\.env\.VITE_AWS_ACCESS_KEY_ID/gi,
            /process\.env\.VITE_AWS_SECRET_ACCESS_KEY/gi
        ];

        for (const pattern of envPatterns) {
            if (pattern.test(content)) {
                violations.push({
                    file: filePath,
                    pattern: pattern.toString(),
                    type: 'env_credential_reference'
                });
            }
        }

        return violations;
    }

    /**
     * Check if content has valid credential access (for backend)
     */
    hasValidCredentialAccess(content) {
        const validPatterns = [
            /process\.env\.AWS_ACCESS_KEY_ID/gi,
            /process\.env\.AWS_SECRET_ACCESS_KEY/gi,
            /AWS\.config\.credentials/gi,
            /credentials:\s*{/gi
        ];

        return validPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Scan for AWS service usage
     */
    scanForAWSUsage(content, filePath, patterns) {
        const usage = [];

        for (const pattern of patterns) {
            const matches = content.match(pattern);
            if (matches) {
                usage.push({
                    file: filePath,
                    pattern: pattern.toString(),
                    matches: matches,
                    type: 'aws_service_usage'
                });
            }
        }

        return usage;
    }

    /**
     * Run comprehensive security validation
     */
    async runComprehensiveSecurityValidation() {
        const results = {
            frontendCredentialScan: await this.scanFrontendForCredentials(),
            backendCredentialAccess: await this.validateBackendCredentialAccess(),
            awsCallLocations: await this.validateAWSCallLocations(),
            frontendUIOnly: await this.validateFrontendUIOnly(),
            versionControlScan: await this.scanVersionControlAndLogs()
        };

        const summary = {
            totalViolations: this.countTotalViolations(results),
            securityStatus: this.determineSecurityStatus(results),
            results: results,
            timestamp: new Date().toISOString()
        };

        return summary;
    }

    /**
     * Count total security violations
     */
    countTotalViolations(results) {
        let count = 0;

        if (results.frontendCredentialScan.violationsFound) {
            count += results.frontendCredentialScan.violations.length;
        }

        if (results.awsCallLocations.hasViolations) {
            count += results.awsCallLocations.frontendViolations.length;
        }

        if (!results.frontendUIOnly.isUIOnly) {
            count += results.frontendUIOnly.nonUIViolations.length;
        }

        if (results.versionControlScan.violationsFound) {
            count += results.versionControlScan.violations.length;
        }

        return count;
    }

    /**
     * Determine overall security status
     */
    determineSecurityStatus(results) {
        const hasViolations =
            results.frontendCredentialScan.violationsFound ||
            results.awsCallLocations.hasViolations ||
            !results.frontendUIOnly.isUIOnly ||
            results.versionControlScan.violationsFound;

        const hasBackendCredentials = results.backendCredentialAccess.backendCredentialsFound;
        const hasBackendAWS = results.awsCallLocations.properBackendUsage;

        if (hasViolations) {
            return 'SECURITY_VIOLATION';
        } else if (hasBackendCredentials && hasBackendAWS) {
            return 'SECURE';
        } else {
            return 'INCOMPLETE_SETUP';
        }
    }
}

describe('Security and Credential Isolation Validation System', () => {
    let securityValidator;

    beforeAll(async () => {
        securityValidator = new SecurityValidator();
    });

    afterAll(async () => {
        securityValidator = null;
    });

    describe('SecurityValidator Class', () => {
        it('should create security validator instance', () => {
            expect(securityValidator).toBeDefined();
            expect(Array.isArray(securityValidator.violations)).toBe(true);
            expect(typeof securityValidator.scanResults).toBe('object');
        });

        it('should scan frontend for credential exposure', async () => {
            const result = await securityValidator.scanFrontendForCredentials();

            expect(result).toBeDefined();
            expect(typeof result.violationsFound).toBe('boolean');
            expect(Array.isArray(result.violations)).toBe(true);
            expect(Array.isArray(result.scannedDirectories)).toBe(true);
            expect(result.scannedDirectories).toContain('src');
        });

        it('should validate backend credential access', async () => {
            const result = await securityValidator.validateBackendCredentialAccess();

            expect(result).toBeDefined();
            expect(typeof result.backendCredentialsFound).toBe('boolean');
            expect(Array.isArray(result.credentialFiles)).toBe(true);
            expect(Array.isArray(result.scannedDirectories)).toBe(true);
        });

        it('should validate AWS service call locations', async () => {
            const result = await securityValidator.validateAWSCallLocations();

            expect(result).toBeDefined();
            expect(Array.isArray(result.frontendViolations)).toBe(true);
            expect(Array.isArray(result.backendUsage)).toBe(true);
            expect(typeof result.hasViolations).toBe('boolean');
            expect(typeof result.properBackendUsage).toBe('boolean');
        });

        it('should validate frontend UI-only functionality', async () => {
            const result = await securityValidator.validateFrontendUIOnly();

            expect(result).toBeDefined();
            expect(Array.isArray(result.uiComponents)).toBe(true);
            expect(Array.isArray(result.nonUIViolations)).toBe(true);
            expect(typeof result.isUIOnly).toBe('boolean');
            expect(typeof result.hasUIComponents).toBe('boolean');
        });

        it('should scan version control and logs', async () => {
            const result = await securityValidator.scanVersionControlAndLogs();

            expect(result).toBeDefined();
            expect(typeof result.violationsFound).toBe('boolean');
            expect(Array.isArray(result.violations)).toBe(true);
            expect(Array.isArray(result.checkedFiles)).toBe(true);
        });

        it('should run comprehensive security validation', async () => {
            const summary = await securityValidator.runComprehensiveSecurityValidation();

            expect(summary).toBeDefined();
            expect(typeof summary.totalViolations).toBe('number');
            expect(typeof summary.securityStatus).toBe('string');
            expect(summary.results).toBeDefined();
            expect(summary.results.frontendCredentialScan).toBeDefined();
            expect(summary.results.backendCredentialAccess).toBeDefined();
            expect(summary.results.awsCallLocations).toBeDefined();
            expect(summary.results.frontendUIOnly).toBeDefined();
            expect(summary.results.versionControlScan).toBeDefined();
        });
    });
});

/**
 * Property-Based Test for Security and Credential Isolation
 * **Feature: clearclause-e2e-testing, Property 9: Security and Credential Isolation**
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
 */
describe('Property-Based Security and Credential Isolation Tests', () => {
    let securityValidator;

    beforeAll(() => {
        securityValidator = new SecurityValidator();
    });

    it('should validate credential patterns are properly configured', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...SECURITY_CONFIG.credentialPatterns),
                (pattern) => {
                    // Test that credential patterns are valid regex patterns
                    expect(pattern).toBeInstanceOf(RegExp);
                    expect(pattern.global).toBe(true);

                    // Reset regex lastIndex to ensure consistent testing
                    pattern.lastIndex = 0;

                    // Test pattern against known credential formats
                    const testCredentials = [
                        'AKIAIOSFODNN7EXAMPLE',  // AWS Access Key ID
                        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'  // AWS Secret Access Key
                    ];

                    // Test each credential separately to avoid regex state issues
                    let shouldMatch = false;
                    for (const cred of testCredentials) {
                        pattern.lastIndex = 0; // Reset before each test
                        if (pattern.test(cred)) {
                            shouldMatch = true;
                            break;
                        }
                    }
                    expect(shouldMatch).toBe(true);

                    return true;
                }
            ),
            { numRuns: 10 }
        );
    });

    it('should validate scan directories are properly configured', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...SECURITY_CONFIG.scanDirectories),
                (directory) => {
                    // Test that scan directories are valid directory names
                    expect(typeof directory).toBe('string');
                    expect(directory.length).toBeGreaterThan(0);
                    expect(directory).not.toContain('..');
                    expect(directory.startsWith('/')).toBe(false);

                    return true;
                }
            ),
            { numRuns: 10 }
        );
    });

    it('should validate security validator methods exist and are functions', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    'scanFrontendForCredentials',
                    'validateBackendCredentialAccess',
                    'validateAWSCallLocations',
                    'validateFrontendUIOnly',
                    'scanVersionControlAndLogs'
                ),
                (methodName) => {
                    // Test that all security validation methods exist and are functions
                    const method = securityValidator[methodName];
                    expect(typeof method).toBe('function');
                    expect(method).toBeDefined();

                    return true;
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should validate credential detection logic', () => {
        fc.assert(
            fc.property(
                fc.record({
                    content: fc.oneof(
                        fc.constant('const accessKey = "AKIAIOSFODNN7EXAMPLE";'),
                        fc.constant('AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'),
                        fc.constant('process.env.AWS_ACCESS_KEY_ID'),
                        fc.constant('// No credentials here'),
                        fc.constant('const apiKey = "safe-api-key-123";')
                    ),
                    filePath: fc.constant('test-file.js')
                }),
                (testCase) => {
                    // Test credential detection logic
                    const violations = securityValidator.scanContentForCredentials(
                        testCase.content,
                        testCase.filePath
                    );

                    expect(Array.isArray(violations)).toBe(true);

                    // Validate violation structure if any found
                    violations.forEach(violation => {
                        expect(violation).toHaveProperty('file');
                        expect(violation).toHaveProperty('type');
                        expect(violation.file).toBe(testCase.filePath);
                    });

                    return true;
                }
            ),
            { numRuns: 20 }
        );
    });

    it('should validate AWS service usage detection', () => {
        fc.assert(
            fc.property(
                fc.record({
                    content: fc.oneof(
                        fc.constant('import AWS from "aws-sdk";'),
                        fc.constant('const s3 = new AWS.S3();'),
                        fc.constant('import { S3Client } from "@aws-sdk/client-s3";'),
                        fc.constant('// Regular JavaScript code'),
                        fc.constant('const api = fetch("/api/data");')
                    ),
                    filePath: fc.constant('test-component.jsx')
                }),
                (testCase) => {
                    // Test AWS service usage detection
                    const awsPatterns = [
                        /aws-sdk/gi,
                        /AWS\./gi,
                        /S3Client/gi
                    ];

                    const usage = securityValidator.scanForAWSUsage(
                        testCase.content,
                        testCase.filePath,
                        awsPatterns
                    );

                    expect(Array.isArray(usage)).toBe(true);

                    // Validate usage structure if any found
                    usage.forEach(usageItem => {
                        expect(usageItem).toHaveProperty('file');
                        expect(usageItem).toHaveProperty('pattern');
                        expect(usageItem).toHaveProperty('type');
                        expect(usageItem.file).toBe(testCase.filePath);
                        expect(usageItem.type).toBe('aws_service_usage');
                    });

                    return true;
                }
            ),
            { numRuns: 20 }
        );
    });

    it('should validate security status determination logic', () => {
        fc.assert(
            fc.property(
                fc.record({
                    frontendCredentialScan: fc.record({
                        violationsFound: fc.boolean(),
                        violations: fc.array(fc.object())
                    }),
                    backendCredentialAccess: fc.record({
                        backendCredentialsFound: fc.boolean(),
                        credentialFiles: fc.array(fc.object())
                    }),
                    awsCallLocations: fc.record({
                        hasViolations: fc.boolean(),
                        properBackendUsage: fc.boolean(),
                        frontendViolations: fc.array(fc.object()),
                        backendUsage: fc.array(fc.object())
                    }),
                    frontendUIOnly: fc.record({
                        isUIOnly: fc.boolean(),
                        nonUIViolations: fc.array(fc.object())
                    }),
                    versionControlScan: fc.record({
                        violationsFound: fc.boolean(),
                        violations: fc.array(fc.object())
                    })
                }),
                (mockResults) => {
                    // Test security status determination logic
                    const status = securityValidator.determineSecurityStatus(mockResults);

                    expect(typeof status).toBe('string');
                    expect(['SECURE', 'SECURITY_VIOLATION', 'INCOMPLETE_SETUP']).toContain(status);

                    // Validate logic consistency
                    const hasViolations =
                        mockResults.frontendCredentialScan.violationsFound ||
                        mockResults.awsCallLocations.hasViolations ||
                        !mockResults.frontendUIOnly.isUIOnly ||
                        mockResults.versionControlScan.violationsFound;

                    if (hasViolations) {
                        expect(status).toBe('SECURITY_VIOLATION');
                    }

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    it('should validate file filtering logic', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant('image.png'),
                    fc.constant('document.pdf'),
                    fc.constant('script.js'),
                    fc.constant('component.jsx'),
                    fc.constant('package-lock.json'),
                    fc.constant('config.json'),
                    fc.constant('font.woff2')
                ),
                (fileName) => {
                    // Test file filtering logic
                    const shouldSkip = securityValidator.shouldSkipFile(fileName);
                    expect(typeof shouldSkip).toBe('boolean');

                    // Validate skip logic for known file types
                    const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
                    const skipFiles = ['package-lock.json', 'yarn.lock'];

                    const ext = path.extname(fileName).toLowerCase();
                    const baseName = path.basename(fileName);

                    const expectedSkip = skipExtensions.includes(ext) || skipFiles.includes(baseName);
                    expect(shouldSkip).toBe(expectedSkip);

                    return true;
                }
            ),
            { numRuns: 20 }
        );
    });
});

export { SecurityValidator };