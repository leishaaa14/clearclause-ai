/**
 * Security Validation Unit Tests for ClearClause End-to-End Testing
 * 
 * This test suite provides unit tests for individual security validation components
 * including frontend credential scanning, backend credential isolation,
 * AWS call location validation, and frontend UI-only validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { SecurityValidator } from './security-credential-isolation.test.js';
import { SECURITY_CONFIG } from './config/test-config.js';

describe('Security Validation Unit Tests', () => {
    let securityValidator;
    let mockFs;

    beforeEach(() => {
        securityValidator = new SecurityValidator();

        // Mock filesystem operations for controlled testing
        mockFs = {
            access: vi.fn(),
            readdir: vi.fn(),
            readFile: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Frontend Credential Scanning Unit Tests', () => {
        it('should detect AWS access key patterns in frontend code', () => {
            const testContent = `
                const config = {
                    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
                    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
                };
            `;

            const violations = securityValidator.scanContentForCredentials(testContent, 'test-file.js');

            expect(violations.length).toBeGreaterThan(0);
            expect(violations.some(v => v.type === 'credential_exposure')).toBe(true);
        });

        it('should detect environment variable credential references', () => {
            const testContent = `
                const awsConfig = {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                };
            `;

            const violations = securityValidator.scanContentForCredentials(testContent, 'config.js');

            expect(violations.length).toBeGreaterThan(0);
            expect(violations.some(v => v.type === 'env_credential_reference')).toBe(true);
        });

        it('should not flag safe configuration patterns', () => {
            const testContent = `
                const config = {
                    apiUrl: 'https://api.example.com',
                    timeout: 5000,
                    retries: 3
                };
            `;

            const violations = securityValidator.scanContentForCredentials(testContent, 'safe-config.js');

            expect(violations.length).toBe(0);
        });

        it('should properly filter files that should be skipped', () => {
            const testFiles = [
                'image.png',
                'document.pdf',
                'script.js',
                'package-lock.json',
                'font.woff2'
            ];

            testFiles.forEach(fileName => {
                const shouldSkip = securityValidator.shouldSkipFile(fileName);

                if (fileName.endsWith('.png') || fileName.endsWith('.woff2') || fileName === 'package-lock.json') {
                    expect(shouldSkip).toBe(true);
                } else {
                    expect(shouldSkip).toBe(false);
                }
            });
        });

        it('should handle file reading errors gracefully', async () => {
            // Mock fs.readFile to throw an error
            vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not readable'));
            vi.spyOn(fs, 'access').mockResolvedValue();
            vi.spyOn(fs, 'readdir').mockResolvedValue([
                { name: 'test.js', isDirectory: () => false }
            ]);

            const result = await securityValidator.scanFrontendForCredentials();

            expect(result).toBeDefined();
            expect(result.violationsFound).toBe(false);
            expect(Array.isArray(result.violations)).toBe(true);
        });
    });

    describe('Backend Credential Isolation Unit Tests', () => {
        it('should detect valid credential access patterns in backend code', () => {
            const backendContent = `
                const AWS = require('aws-sdk');
                AWS.config.credentials = {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                };
            `;

            const hasValidAccess = securityValidator.hasValidCredentialAccess(backendContent);

            expect(hasValidAccess).toBe(true);
        });

        it('should not flag frontend code without credential access', () => {
            const frontendContent = `
                import React from 'react';
                const Component = () => {
                    return <div>Hello World</div>;
                };
            `;

            const hasValidAccess = securityValidator.hasValidCredentialAccess(frontendContent);

            expect(hasValidAccess).toBe(false);
        });

        it('should validate backend credential configuration patterns', () => {
            const testPatterns = [
                'AWS.config.credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID }',
                'credentials: { accessKeyId: "test" }',
                'const key = process.env.AWS_SECRET_ACCESS_KEY'
            ];

            testPatterns.forEach(pattern => {
                const hasValidAccess = securityValidator.hasValidCredentialAccess(pattern);
                expect(hasValidAccess).toBe(true);
            });
        });

        it('should handle missing backend directories gracefully', async () => {
            vi.spyOn(fs, 'access').mockRejectedValue(new Error('Directory not found'));

            const result = await securityValidator.validateBackendCredentialAccess();

            expect(result).toBeDefined();
            expect(result.backendCredentialsFound).toBe(false);
            expect(Array.isArray(result.credentialFiles)).toBe(true);
            expect(result.credentialFiles.length).toBe(0);
        });
    });

    describe('AWS Call Location Validation Unit Tests', () => {
        it('should detect AWS SDK usage in code', () => {
            const testContent = `
                import AWS from 'aws-sdk';
                const s3 = new AWS.S3();
                const textract = new AWS.Textract();
            `;

            const awsPatterns = [/aws-sdk/gi, /AWS\./gi, /S3/gi];
            const usage = securityValidator.scanForAWSUsage(testContent, 'aws-service.js', awsPatterns);

            expect(usage.length).toBeGreaterThan(0);
            expect(usage.some(u => u.type === 'aws_service_usage')).toBe(true);
        });

        it('should detect modern AWS SDK v3 usage', () => {
            const testContent = `
                import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
                import { TextractClient } from '@aws-sdk/client-textract';
                const s3Client = new S3Client({ region: 'us-east-1' });
            `;

            const awsPatterns = [/S3Client/gi, /TextractClient/gi, /@aws-sdk/gi];
            const usage = securityValidator.scanForAWSUsage(testContent, 'modern-aws.js', awsPatterns);

            expect(usage.length).toBeGreaterThan(0);
        });

        it('should not flag non-AWS service usage', () => {
            const testContent = `
                import axios from 'axios';
                const api = axios.create({ baseURL: '/api' });
                const response = await api.get('/data');
            `;

            const awsPatterns = [/aws-sdk/gi, /AWS\./gi, /S3Client/gi];
            const usage = securityValidator.scanForAWSUsage(testContent, 'api-client.js', awsPatterns);

            expect(usage.length).toBe(0);
        });

        it('should validate AWS service patterns are comprehensive', () => {
            const awsServices = [
                'AWS.S3',
                'AWS.Textract',
                'AWS.Bedrock',
                'AWS.Lambda',
                'S3Client',
                'TextractClient',
                'BedrockClient',
                'LambdaClient'
            ];

            const awsPatterns = [
                /AWS\./gi,
                /S3Client/gi,
                /TextractClient/gi,
                /BedrockClient/gi,
                /LambdaClient/gi
            ];

            awsServices.forEach(service => {
                // Reset regex lastIndex for each test
                awsPatterns.forEach(pattern => pattern.lastIndex = 0);
                const shouldMatch = awsPatterns.some(pattern => {
                    pattern.lastIndex = 0;
                    return pattern.test(service);
                });
                expect(shouldMatch).toBe(true);
            });
        });
    });

    describe('Frontend UI-Only Validation Unit Tests', () => {
        it('should detect React UI component patterns', () => {
            const uiContent = `
                import React, { useState, useEffect } from 'react';
                
                const FileUpload = () => {
                    const [file, setFile] = useState(null);
                    
                    const handleFileChange = (event) => {
                        setFile(event.target.files[0]);
                    };
                    
                    return (
                        <div className="upload-container">
                            <input type="file" onChange={handleFileChange} />
                            <button onClick={handleSubmit}>Upload</button>
                        </div>
                    );
                };
            `;

            const uiPatterns = [
                /useState/gi,
                /useEffect/gi,
                /onClick/gi,
                /onChange/gi,
                /className/gi,
                /React/gi
            ];

            const hasUIPatterns = uiPatterns.some(pattern => pattern.test(uiContent));
            expect(hasUIPatterns).toBe(true);
        });

        it('should detect non-UI violations in frontend components', () => {
            const violatingContent = `
                import React from 'react';
                import AWS from 'aws-sdk';
                
                const Component = () => {
                    const s3 = new AWS.S3();
                    return <div>Component</div>;
                };
            `;

            const awsPatterns = [/aws-sdk/gi, /AWS\./gi];
            const violations = securityValidator.scanForAWSUsage(violatingContent, 'bad-component.jsx', awsPatterns);

            expect(violations.length).toBeGreaterThan(0);
        });

        it('should validate pure UI components have no AWS violations', () => {
            const pureUIContent = `
                import React, { useState } from 'react';
                
                const PureComponent = ({ data, onSubmit }) => {
                    const [value, setValue] = useState('');
                    
                    return (
                        <form onSubmit={onSubmit}>
                            <input 
                                value={value} 
                                onChange={(e) => setValue(e.target.value)}
                                className="form-input"
                            />
                            <button type="submit">Submit</button>
                        </form>
                    );
                };
            `;

            const awsPatterns = [/aws-sdk/gi, /AWS\./gi, /process\.env\.AWS/gi];
            const violations = securityValidator.scanForAWSUsage(pureUIContent, 'pure-component.jsx', awsPatterns);

            expect(violations.length).toBe(0);
        });

        it('should handle missing frontend directory gracefully', async () => {
            vi.spyOn(fs, 'access').mockRejectedValue(new Error('Directory not found'));

            const result = await securityValidator.validateFrontendUIOnly();

            expect(result).toBeDefined();
            expect(result.isUIOnly).toBe(true); // No violations found = UI only
            expect(Array.isArray(result.uiComponents)).toBe(true);
            expect(Array.isArray(result.nonUIViolations)).toBe(true);
        });
    });

    describe('Version Control and Log Scanning Unit Tests', () => {
        it('should detect credentials in git configuration', () => {
            const gitConfigContent = `
                [core]
                    repositoryformatversion = 0
                [remote "origin"]
                    url = https://AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG@github.com/user/repo.git
            `;

            const violations = securityValidator.scanContentForCredentials(gitConfigContent, '.git/config');

            expect(violations.length).toBeGreaterThan(0);
        });

        it('should detect credentials in log files', () => {
            const logContent = `
                2023-12-18 10:30:00 INFO Starting application
                2023-12-18 10:30:01 DEBUG AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
                2023-12-18 10:30:02 ERROR Authentication failed
            `;

            const violations = securityValidator.scanContentForCredentials(logContent, 'application.log');

            expect(violations.length).toBeGreaterThan(0);
        });

        it('should not flag safe log entries', () => {
            const safeLogContent = `
                2023-12-18 10:30:00 INFO Application started successfully
                2023-12-18 10:30:01 DEBUG Processing file: document.pdf
                2023-12-18 10:30:02 INFO Analysis completed
            `;

            const violations = securityValidator.scanContentForCredentials(safeLogContent, 'safe.log');

            expect(violations.length).toBe(0);
        });

        it('should handle missing git directory gracefully', async () => {
            vi.spyOn(fs, 'access').mockRejectedValue(new Error('Git directory not found'));
            vi.spyOn(fs, 'readdir').mockResolvedValue([]);

            const result = await securityValidator.scanVersionControlAndLogs();

            expect(result).toBeDefined();
            expect(result.violationsFound).toBe(false);
            expect(Array.isArray(result.violations)).toBe(true);
        });
    });

    describe('Security Status Determination Unit Tests', () => {
        it('should return SECURE status for proper configuration', () => {
            const secureResults = {
                frontendCredentialScan: { violationsFound: false, violations: [] },
                backendCredentialAccess: { backendCredentialsFound: true, credentialFiles: [{}] },
                awsCallLocations: { hasViolations: false, properBackendUsage: true, frontendViolations: [], backendUsage: [{}] },
                frontendUIOnly: { isUIOnly: true, nonUIViolations: [] },
                versionControlScan: { violationsFound: false, violations: [] }
            };

            const status = securityValidator.determineSecurityStatus(secureResults);

            expect(status).toBe('SECURE');
        });

        it('should return SECURITY_VIOLATION for credential exposure', () => {
            const violationResults = {
                frontendCredentialScan: { violationsFound: true, violations: [{}] },
                backendCredentialAccess: { backendCredentialsFound: true, credentialFiles: [{}] },
                awsCallLocations: { hasViolations: false, properBackendUsage: true, frontendViolations: [], backendUsage: [{}] },
                frontendUIOnly: { isUIOnly: true, nonUIViolations: [] },
                versionControlScan: { violationsFound: false, violations: [] }
            };

            const status = securityValidator.determineSecurityStatus(violationResults);

            expect(status).toBe('SECURITY_VIOLATION');
        });

        it('should return SECURITY_VIOLATION for frontend AWS usage', () => {
            const violationResults = {
                frontendCredentialScan: { violationsFound: false, violations: [] },
                backendCredentialAccess: { backendCredentialsFound: true, credentialFiles: [{}] },
                awsCallLocations: { hasViolations: true, properBackendUsage: true, frontendViolations: [{}], backendUsage: [{}] },
                frontendUIOnly: { isUIOnly: true, nonUIViolations: [] },
                versionControlScan: { violationsFound: false, violations: [] }
            };

            const status = securityValidator.determineSecurityStatus(violationResults);

            expect(status).toBe('SECURITY_VIOLATION');
        });

        it('should return INCOMPLETE_SETUP for missing backend credentials', () => {
            const incompleteResults = {
                frontendCredentialScan: { violationsFound: false, violations: [] },
                backendCredentialAccess: { backendCredentialsFound: false, credentialFiles: [] },
                awsCallLocations: { hasViolations: false, properBackendUsage: false, frontendViolations: [], backendUsage: [] },
                frontendUIOnly: { isUIOnly: true, nonUIViolations: [] },
                versionControlScan: { violationsFound: false, violations: [] }
            };

            const status = securityValidator.determineSecurityStatus(incompleteResults);

            expect(status).toBe('INCOMPLETE_SETUP');
        });
    });

    describe('Violation Counting Unit Tests', () => {
        it('should correctly count total violations', () => {
            const resultsWithViolations = {
                frontendCredentialScan: { violationsFound: true, violations: [{}, {}] },
                backendCredentialAccess: { backendCredentialsFound: true, credentialFiles: [] },
                awsCallLocations: { hasViolations: true, frontendViolations: [{}], properBackendUsage: true, backendUsage: [] },
                frontendUIOnly: { isUIOnly: false, nonUIViolations: [{}, {}, {}] },
                versionControlScan: { violationsFound: true, violations: [{}] }
            };

            const count = securityValidator.countTotalViolations(resultsWithViolations);

            expect(count).toBe(7); // 2 + 1 + 3 + 1 = 7 violations
        });

        it('should return zero for no violations', () => {
            const resultsWithoutViolations = {
                frontendCredentialScan: { violationsFound: false, violations: [] },
                backendCredentialAccess: { backendCredentialsFound: true, credentialFiles: [] },
                awsCallLocations: { hasViolations: false, frontendViolations: [], properBackendUsage: true, backendUsage: [] },
                frontendUIOnly: { isUIOnly: true, nonUIViolations: [] },
                versionControlScan: { violationsFound: false, violations: [] }
            };

            const count = securityValidator.countTotalViolations(resultsWithoutViolations);

            expect(count).toBe(0);
        });
    });

    describe('File System Utility Unit Tests', () => {
        it('should recursively get files from directory structure', async () => {
            // Mock directory structure
            vi.spyOn(fs, 'readdir')
                .mockResolvedValueOnce([
                    { name: 'file1.js', isDirectory: () => false },
                    { name: 'subdir', isDirectory: () => true },
                    { name: 'file2.jsx', isDirectory: () => false }
                ])
                .mockResolvedValueOnce([
                    { name: 'file3.ts', isDirectory: () => false }
                ]);

            const files = await securityValidator.getFilesRecursively('/test/dir');

            expect(files.length).toBe(3);
            expect(files.some(f => f.includes('file1.js'))).toBe(true);
            expect(files.some(f => f.includes('file2.jsx'))).toBe(true);
            expect(files.some(f => f.includes('file3.ts'))).toBe(true);
        });

        it('should skip node_modules and .git directories', async () => {
            const mockReaddir = vi.spyOn(fs, 'readdir');

            // First call - root directory
            mockReaddir.mockResolvedValueOnce([
                { name: 'src', isDirectory: () => true },
                { name: 'node_modules', isDirectory: () => true },
                { name: '.git', isDirectory: () => true },
                { name: 'file.js', isDirectory: () => false }
            ]);

            // Second call - src directory
            mockReaddir.mockResolvedValueOnce([
                { name: 'component.jsx', isDirectory: () => false }
            ]);

            const files = await securityValidator.getFilesRecursively('/test/dir');

            expect(files.length).toBe(2); // file.js and component.jsx
            expect(files.some(f => f.includes('node_modules'))).toBe(false);
            expect(files.some(f => f.includes('.git'))).toBe(false);
        });

        it('should handle directory read errors gracefully', async () => {
            vi.spyOn(fs, 'readdir').mockRejectedValue(new Error('Permission denied'));

            const files = await securityValidator.getFilesRecursively('/restricted/dir');

            expect(Array.isArray(files)).toBe(true);
            expect(files.length).toBe(0);
        });
    });

    describe('Configuration Validation Unit Tests', () => {
        it('should validate security configuration structure', () => {
            expect(SECURITY_CONFIG).toBeDefined();
            expect(Array.isArray(SECURITY_CONFIG.credentialPatterns)).toBe(true);
            expect(Array.isArray(SECURITY_CONFIG.scanDirectories)).toBe(true);
            expect(Array.isArray(SECURITY_CONFIG.excludeFiles)).toBe(true);
        });

        it('should validate credential patterns are valid regex', () => {
            SECURITY_CONFIG.credentialPatterns.forEach(pattern => {
                expect(pattern).toBeInstanceOf(RegExp);
                expect(pattern.global).toBe(true);
            });
        });

        it('should validate scan directories are reasonable', () => {
            SECURITY_CONFIG.scanDirectories.forEach(dir => {
                expect(typeof dir).toBe('string');
                expect(dir.length).toBeGreaterThan(0);
                expect(dir).not.toContain('..');
                expect(dir.startsWith('/')).toBe(false);
            });
        });
    });
});