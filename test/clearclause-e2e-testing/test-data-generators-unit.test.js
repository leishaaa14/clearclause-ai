/**
 * Unit Tests for Test Data Generators
 * 
 * This file contains comprehensive unit tests for all test data generators
 * and utilities used in the ClearClause End-to-End testing framework.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

import {
    legalTextGenerator,
    urlGenerator,
    fileMetadataGenerator,
    apiRequestGenerator,
    analysisOutputGenerator,
    awsServiceResponseGenerator,
    testScenarioGenerator,
    errorScenarioGenerator,
    syntheticLegalDocumentGenerator,
    mockAWSResponseGenerators,
    TestFileSelector,
    TestResultValidator,
    getSampleDatasetFiles
} from './utils/test-data-generators.js';

describe('Test Data Generators Unit Tests', () => {

    describe('Input Scenario Generators', () => {

        it('should generate valid legal text with required characteristics', () => {
            fc.assert(
                fc.property(legalTextGenerator, (text) => {
                    expect(typeof text).toBe('string');
                    expect(text.length).toBeGreaterThan(50);
                    expect(text.length).toBeLessThan(2500);

                    // Should contain legal-sounding phrases
                    const legalPhrases = [
                        'agreement', 'contract', 'legal', 'clause', 'provision',
                        'parties', 'hereby', 'consideration', 'terms', 'conditions'
                    ];

                    const hasLegalContent = legalPhrases.some(phrase =>
                        text.toLowerCase().includes(phrase)
                    );
                    expect(hasLegalContent).toBe(true);
                }),
                { numRuns: 50 }
            );
        });

        it('should generate valid URLs for testing', () => {
            fc.assert(
                fc.property(urlGenerator, (url) => {
                    expect(typeof url).toBe('string');
                    expect(url).toMatch(/^https?:\/\//);

                    // Should be a valid URL format
                    expect(() => new URL(url)).not.toThrow();
                }),
                { numRuns: 30 }
            );
        });

        it('should generate valid file metadata structures', () => {
            fc.assert(
                fc.property(fileMetadataGenerator, (metadata) => {
                    expect(metadata).toHaveProperty('name');
                    expect(metadata).toHaveProperty('size');
                    expect(metadata).toHaveProperty('type');
                    expect(metadata).toHaveProperty('lastModified');

                    expect(typeof metadata.name).toBe('string');
                    expect(metadata.name).toMatch(/\.(pdf|png|jpeg|xlsx)$/);

                    expect(typeof metadata.size).toBe('number');
                    expect(metadata.size).toBeGreaterThanOrEqual(1024);
                    expect(metadata.size).toBeLessThanOrEqual(10 * 1024 * 1024);

                    expect(typeof metadata.type).toBe('string');
                    expect(['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
                        .toContain(metadata.type);

                    expect(metadata.lastModified).toBeInstanceOf(Date);
                }),
                { numRuns: 30 }
            );
        });

        it('should generate valid API request payloads', () => {
            fc.assert(
                fc.property(apiRequestGenerator, (request) => {
                    expect(request).toHaveProperty('type');
                    expect(request).toHaveProperty('content');

                    expect(['text', 'url', 'file']).toContain(request.type);

                    if (request.type === 'text') {
                        expect(typeof request.content).toBe('string');
                        expect(request.content.length).toBeGreaterThan(50);
                    } else if (request.type === 'url') {
                        expect(typeof request.content).toBe('string');
                        expect(request.content).toMatch(/^https?:\/\//);
                    } else if (request.type === 'file') {
                        expect(request.content).toHaveProperty('name');
                        expect(request.content).toHaveProperty('size');
                        expect(request.content).toHaveProperty('type');
                    }
                }),
                { numRuns: 50 }
            );
        });

        it('should generate valid test scenarios', () => {
            fc.assert(
                fc.property(testScenarioGenerator, (scenario) => {
                    expect(scenario).toHaveProperty('scenario');
                    expect(scenario).toHaveProperty('input');
                    expect(scenario).toHaveProperty('expectedOutcome');

                    const validScenarios = [
                        'small_text_input', 'large_text_input', 'pdf_file_upload',
                        'image_file_upload', 'excel_file_upload', 'url_content_fetch',
                        'malformed_input', 'empty_input'
                    ];
                    expect(validScenarios).toContain(scenario.scenario);

                    expect(['success', 'error', 'timeout']).toContain(scenario.expectedOutcome);
                }),
                { numRuns: 30 }
            );
        });

        it('should generate valid error scenarios', () => {
            fc.assert(
                fc.property(errorScenarioGenerator, (error) => {
                    expect(error).toHaveProperty('errorType');
                    expect(error).toHaveProperty('errorMessage');
                    expect(error).toHaveProperty('shouldTriggerFallback');

                    const validErrorTypes = [
                        'aws_service_unavailable', 'invalid_credentials', 'file_too_large',
                        'unsupported_format', 'network_timeout', 'malformed_response'
                    ];
                    expect(validErrorTypes).toContain(error.errorType);

                    expect(typeof error.errorMessage).toBe('string');
                    expect(error.errorMessage.length).toBeGreaterThanOrEqual(10);
                    expect(error.errorMessage.length).toBeLessThan(100);

                    expect(typeof error.shouldTriggerFallback).toBe('boolean');
                }),
                { numRuns: 30 }
            );
        });
    });

    describe('Analysis Output Generators', () => {

        it('should generate valid analysis output structures', () => {
            fc.assert(
                fc.property(analysisOutputGenerator, (output) => {
                    expect(output).toHaveProperty('summary');
                    expect(output).toHaveProperty('clauses');
                    expect(output).toHaveProperty('risks');
                    expect(output).toHaveProperty('metadata');

                    // Validate summary
                    expect(typeof output.summary).toBe('string');
                    expect(output.summary.length).toBeGreaterThan(20);

                    // Validate clauses
                    expect(Array.isArray(output.clauses)).toBe(true);
                    expect(output.clauses.length).toBeGreaterThan(0);

                    output.clauses.forEach(clause => {
                        expect(clause).toHaveProperty('type');
                        expect(clause).toHaveProperty('text');
                        expect(clause).toHaveProperty('confidence');
                        expect(clause).toHaveProperty('risk_level');

                        expect(['termination', 'payment', 'liability', 'confidentiality', 'intellectual_property'])
                            .toContain(clause.type);
                        expect(['Low', 'Medium', 'High', 'Critical']).toContain(clause.risk_level);
                        expect(clause.confidence).toBeGreaterThanOrEqual(0.5);
                        expect(clause.confidence).toBeLessThanOrEqual(1.0);
                    });

                    // Validate risks
                    expect(Array.isArray(output.risks)).toBe(true);
                    expect(output.risks.length).toBeGreaterThan(0);

                    output.risks.forEach(risk => {
                        expect(risk).toHaveProperty('level');
                        expect(risk).toHaveProperty('description');
                        expect(risk).toHaveProperty('explanation');
                        expect(risk).toHaveProperty('recommendation');

                        expect(['Low', 'Medium', 'High', 'Critical']).toContain(risk.level);
                        expect(typeof risk.description).toBe('string');
                        expect(typeof risk.explanation).toBe('string');
                        expect(typeof risk.recommendation).toBe('string');
                    });

                    // Validate metadata
                    expect(output.metadata).toHaveProperty('processing_time');
                    expect(output.metadata).toHaveProperty('input_type');
                    expect(output.metadata).toHaveProperty('model_used');
                    expect(output.metadata).toHaveProperty('timestamp');

                    expect(typeof output.metadata.processing_time).toBe('number');
                    expect(['text', 'url', 'file']).toContain(output.metadata.input_type);
                    expect(output.metadata.model_used).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
                    expect(output.metadata.timestamp).toBeInstanceOf(Date);
                }),
                { numRuns: 20 }
            );
        });
    });

    describe('Synthetic Legal Document Generator', () => {

        it('should generate valid synthetic legal documents', () => {
            fc.assert(
                fc.property(syntheticLegalDocumentGenerator, (document) => {
                    expect(document).toHaveProperty('documentType');
                    expect(document).toHaveProperty('content');
                    expect(document).toHaveProperty('clauses');
                    expect(document).toHaveProperty('metadata');

                    const validTypes = [
                        'service_agreement', 'privacy_policy', 'terms_of_use',
                        'employment_contract', 'nda', 'license_agreement'
                    ];
                    expect(validTypes).toContain(document.documentType);

                    expect(typeof document.content).toBe('string');
                    expect(document.content.length).toBeGreaterThan(100);

                    expect(Array.isArray(document.clauses)).toBe(true);
                    expect(document.clauses.length).toBeGreaterThanOrEqual(3);
                    expect(document.clauses.length).toBeLessThanOrEqual(15);

                    document.clauses.forEach(clause => {
                        expect(clause).toHaveProperty('type');
                        expect(clause).toHaveProperty('severity');
                        expect(clause).toHaveProperty('text');

                        const validClauseTypes = [
                            'termination', 'payment', 'liability', 'confidentiality',
                            'intellectual_property', 'dispute_resolution'
                        ];
                        expect(validClauseTypes).toContain(clause.type);
                        expect(['Low', 'Medium', 'High', 'Critical']).toContain(clause.severity);
                    });

                    expect(document.metadata).toHaveProperty('wordCount');
                    expect(document.metadata).toHaveProperty('pageCount');
                    expect(document.metadata).toHaveProperty('language');
                    expect(document.metadata).toHaveProperty('jurisdiction');

                    expect(document.metadata.language).toBe('en');
                    expect(['US', 'UK', 'CA', 'AU', 'EU']).toContain(document.metadata.jurisdiction);
                }),
                { numRuns: 20 }
            );
        });
    });

    describe('Mock AWS Response Generators', () => {

        it('should generate valid S3 responses', () => {
            fc.assert(
                fc.property(mockAWSResponseGenerators.s3.putObject, (response) => {
                    expect(response).toHaveProperty('ETag');
                    expect(response).toHaveProperty('ServerSideEncryption');
                    expect(response).toHaveProperty('VersionId');

                    expect(typeof response.ETag).toBe('string');
                    expect(response.ETag.length).toBe(32);
                    expect(response.ServerSideEncryption).toBe('AES256');
                }),
                { numRuns: 10 }
            );

            fc.assert(
                fc.property(mockAWSResponseGenerators.s3.getObject, (response) => {
                    expect(response).toHaveProperty('Body');
                    expect(response).toHaveProperty('ContentType');
                    expect(response).toHaveProperty('ContentLength');
                    expect(response).toHaveProperty('LastModified');
                    expect(response).toHaveProperty('ETag');

                    expect(response.Body).toBeInstanceOf(Uint8Array);
                    expect(['application/pdf', 'image/png', 'text/plain']).toContain(response.ContentType);
                    expect(response.LastModified).toBeInstanceOf(Date);
                }),
                { numRuns: 10 }
            );
        });

        it('should generate valid Lambda responses', () => {
            fc.assert(
                fc.property(mockAWSResponseGenerators.lambda.invoke, (response) => {
                    expect(response).toHaveProperty('StatusCode');
                    expect(response).toHaveProperty('Payload');
                    expect(response).toHaveProperty('ExecutedVersion');

                    expect([200, 202]).toContain(response.StatusCode);
                    expect(response.ExecutedVersion).toBe('$LATEST');

                    // Validate payload is valid JSON
                    expect(() => JSON.parse(response.Payload)).not.toThrow();

                    const payload = JSON.parse(response.Payload);
                    expect(payload).toHaveProperty('statusCode');
                    expect(payload).toHaveProperty('body');
                }),
                { numRuns: 10 }
            );
        });

        it('should generate valid Textract responses', () => {
            fc.assert(
                fc.property(mockAWSResponseGenerators.textract.getDocumentTextDetection, (response) => {
                    expect(response).toHaveProperty('JobStatus');
                    expect(response).toHaveProperty('DocumentMetadata');
                    expect(response).toHaveProperty('Blocks');

                    expect(['SUCCEEDED', 'IN_PROGRESS', 'FAILED']).toContain(response.JobStatus);
                    expect(response.DocumentMetadata).toHaveProperty('Pages');
                    expect(Array.isArray(response.Blocks)).toBe(true);

                    response.Blocks.forEach(block => {
                        expect(block).toHaveProperty('BlockType');
                        expect(block).toHaveProperty('Id');
                        expect(block).toHaveProperty('Confidence');
                        expect(block).toHaveProperty('Geometry');

                        expect(['PAGE', 'LINE', 'WORD']).toContain(block.BlockType);
                        expect(block.Confidence).toBeGreaterThanOrEqual(Math.fround(0.7));
                        expect(block.Confidence).toBeLessThanOrEqual(1.0);
                    });
                }),
                { numRuns: 10 }
            );
        });

        it('should generate valid Bedrock responses', () => {
            fc.assert(
                fc.property(mockAWSResponseGenerators.bedrock.invokeModel, (response) => {
                    expect(response).toHaveProperty('body');
                    expect(response).toHaveProperty('contentType');

                    expect(ArrayBuffer.isView(response.body) || response.body instanceof Uint8Array).toBe(true);
                    expect(response.contentType).toBe('application/json');

                    // Decode and validate the response body
                    const decodedBody = new TextDecoder().decode(response.body);
                    expect(() => JSON.parse(decodedBody)).not.toThrow();

                    const parsedBody = JSON.parse(decodedBody);
                    expect(parsedBody).toHaveProperty('content');
                    expect(parsedBody).toHaveProperty('usage');
                    expect(Array.isArray(parsedBody.content)).toBe(true);
                }),
                { numRuns: 10 }
            );
        });
    });
});

describe('Test File Selection Utilities', () => {
    let fileSelector;

    beforeEach(() => {
        fileSelector = new TestFileSelector();
    });

    it('should initialize with default dataset path', () => {
        expect(fileSelector.datasetPath).toBe('./archive/CUAD_v1/full_contract_txt');
    });

    it('should initialize with custom dataset path', () => {
        const customSelector = new TestFileSelector('/custom/path');
        expect(customSelector.datasetPath).toBe('/custom/path');
    });

    it('should select files by type with default criteria', () => {
        const files = fileSelector.selectFilesByType('agreement');

        expect(Array.isArray(files)).toBe(true);
        expect(files.length).toBeLessThanOrEqual(5); // Default count

        files.forEach(file => {
            expect(file).toHaveProperty('name');
            expect(file).toHaveProperty('path');
            expect(file).toHaveProperty('type');
            expect(file).toHaveProperty('size');
            expect(file).toHaveProperty('category');

            expect(typeof file.name).toBe('string');
            expect(typeof file.path).toBe('string');
            expect(typeof file.type).toBe('string');
            expect(typeof file.size).toBe('number');
            expect(typeof file.category).toBe('string');
        });
    });

    it('should select files with custom criteria', () => {
        const files = fileSelector.selectFilesByType('all', {
            count: 3,
            minSize: 5000,
            maxSize: 50000,
            pattern: 'agreement'
        });

        expect(files.length).toBeLessThanOrEqual(3);

        files.forEach(file => {
            expect(file.size).toBeGreaterThanOrEqual(5000);
            expect(file.size).toBeLessThanOrEqual(50000);
        });
    });

    it('should select representative files for comprehensive testing', () => {
        const representative = fileSelector.selectRepresentativeFiles();

        expect(representative).toHaveProperty('small');
        expect(representative).toHaveProperty('medium');
        expect(representative).toHaveProperty('large');
        expect(representative).toHaveProperty('agreements');
        expect(representative).toHaveProperty('licenses');
        expect(representative).toHaveProperty('services');

        expect(Array.isArray(representative.small)).toBe(true);
        expect(Array.isArray(representative.medium)).toBe(true);
        expect(Array.isArray(representative.large)).toBe(true);
        expect(Array.isArray(representative.agreements)).toBe(true);
        expect(Array.isArray(representative.licenses)).toBe(true);
        expect(Array.isArray(representative.services)).toBe(true);
    });

    it('should generate mock files when dataset is unavailable', () => {
        const mockSelector = new TestFileSelector('/nonexistent/path');
        const files = mockSelector.selectFilesByType('test', { count: 3 });

        expect(files.length).toBe(3);
        files.forEach(file => {
            expect(file.name).toMatch(/^mock_test_\d+\.txt$/);
            expect(file.path).toMatch(/^\/mock\/path\/mock_test_\d+\.txt$/);
            expect(file.type).toBe('text/plain');
            expect(file.category).toBe('test');
        });
    });

    it('should correctly categorize files', () => {
        expect(fileSelector.categorizeFile('service_agreement.txt')).toBe('agreement');
        expect(fileSelector.categorizeFile('software_license.txt')).toBe('license');
        expect(fileSelector.categorizeFile('terms_of_service.txt')).toBe('service');
        expect(fileSelector.categorizeFile('privacy_policy.txt')).toBe('privacy');
        expect(fileSelector.categorizeFile('terms_and_conditions.txt')).toBe('terms');
        expect(fileSelector.categorizeFile('random_document.txt')).toBe('general');
    });

    it('should correctly determine file types', () => {
        expect(fileSelector.getFileType('document.pdf')).toBe('application/pdf');
        expect(fileSelector.getFileType('image.png')).toBe('image/png');
        expect(fileSelector.getFileType('photo.jpg')).toBe('image/jpeg');
        expect(fileSelector.getFileType('spreadsheet.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(fileSelector.getFileType('text.txt')).toBe('text/plain');
        expect(fileSelector.getFileType('unknown.xyz')).toBe('text/plain');
    });

    it('should shuffle arrays correctly', () => {
        const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const shuffled = fileSelector.shuffleArray(original);

        expect(shuffled.length).toBe(original.length);
        expect(shuffled).toEqual(expect.arrayContaining(original));

        // Original array should not be modified
        expect(original).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
});

describe('Test Result Validation Utilities', () => {
    let validator;

    beforeEach(() => {
        validator = new TestResultValidator();
    });

    it('should initialize with default validation rules', () => {
        expect(validator.validationRules).toHaveProperty('summary');
        expect(validator.validationRules).toHaveProperty('clauses');
        expect(validator.validationRules).toHaveProperty('risks');
        expect(validator.validationRules).toHaveProperty('metadata');
    });

    it('should validate valid analysis results', () => {
        const validResult = {
            summary: "This is a comprehensive analysis of a legal document containing various clauses and provisions.",
            clauses: [
                {
                    type: "termination",
                    text: "Either party may terminate this agreement with 30 days notice.",
                    confidence: 0.95,
                    risk_level: "Medium"
                }
            ],
            risks: [
                {
                    level: "Medium",
                    description: "Termination clause may be too broad",
                    explanation: "The termination clause allows for termination without cause",
                    recommendation: "Consider adding specific termination conditions"
                }
            ],
            metadata: {
                processing_time: 2500,
                input_type: "text",
                model_used: "anthropic.claude-3-sonnet-20240229-v1:0"
            }
        };

        const validation = validator.validateAnalysisResult(validResult);

        expect(validation).toHaveProperty('isValid');
        expect(validation).toHaveProperty('errors');
        expect(validation).toHaveProperty('warnings');
        expect(validation).toHaveProperty('score');

        expect(validation.isValid).toBe(true);
        expect(validation.errors.length).toBe(0);
        expect(validation.score).toBeGreaterThan(0);
    });

    it('should detect invalid summary', () => {
        const invalidResult = {
            summary: "Short", // Too short
            clauses: [],
            risks: [],
            metadata: {}
        };

        const validation = validator.validateAnalysisResult(invalidResult);

        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => error.includes('Summary too short'))).toBe(true);
    });

    it('should detect missing required fields in clauses', () => {
        const invalidResult = {
            summary: "This is a valid summary of a legal document analysis.",
            clauses: [
                {
                    type: "termination"
                    // Missing text, confidence, risk_level
                }
            ],
            risks: [],
            metadata: {}
        };

        const validation = validator.validateAnalysisResult(invalidResult);

        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => error.includes('missing field'))).toBe(true);
    });

    it('should detect invalid risk levels', () => {
        const invalidResult = {
            summary: "This is a valid summary of a legal document analysis.",
            clauses: [],
            risks: [
                {
                    level: "Invalid", // Invalid risk level
                    description: "Some risk",
                    explanation: "Risk explanation",
                    recommendation: "Risk recommendation"
                }
            ],
            metadata: {}
        };

        const validation = validator.validateAnalysisResult(invalidResult);

        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => error.includes('invalid level'))).toBe(true);
    });

    it('should validate metadata fields', () => {
        const invalidResult = {
            summary: "This is a valid summary of a legal document analysis.",
            clauses: [],
            risks: [],
            metadata: {
                // Missing required fields
                processing_time: 2500
            }
        };

        const validation = validator.validateAnalysisResult(invalidResult);

        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => error.includes('Metadata missing field'))).toBe(true);
    });

    it('should generate validation reports', () => {
        const results = [
            { isValid: true, errors: [], warnings: [], score: 85 },
            { isValid: false, errors: ['Error 1'], warnings: ['Warning 1'], score: 45 },
            { isValid: true, errors: [], warnings: ['Warning 2'], score: 90 }
        ];

        const report = validator.generateValidationReport(results);

        expect(report).toHaveProperty('totalTests');
        expect(report).toHaveProperty('passed');
        expect(report).toHaveProperty('failed');
        expect(report).toHaveProperty('averageScore');
        expect(report).toHaveProperty('commonErrors');
        expect(report).toHaveProperty('commonWarnings');
        expect(report).toHaveProperty('recommendations');

        expect(report.totalTests).toBe(3);
        expect(report.passed).toBe(2);
        expect(report.failed).toBe(1);
        expect(report.averageScore).toBe(Math.round((85 + 45 + 90) / 3));
        expect(Array.isArray(report.recommendations)).toBe(true);
    });
});

describe('Dataset File Utilities', () => {

    it('should get sample dataset files', () => {
        const files = getSampleDatasetFiles('all', 3);

        expect(Array.isArray(files)).toBe(true);
        expect(files.length).toBeLessThanOrEqual(3);

        files.forEach(file => {
            expect(file).toHaveProperty('name');
            expect(file).toHaveProperty('path');
            expect(file).toHaveProperty('type');
            expect(file).toHaveProperty('size');

            expect(typeof file.name).toBe('string');
            expect(typeof file.path).toBe('string');
            expect(typeof file.type).toBe('string');
            expect(typeof file.size).toBe('number');
        });
    });

    it('should handle missing dataset gracefully', () => {
        // This should not throw and should return mock files
        const files = getSampleDatasetFiles('nonexistent', 2);

        expect(Array.isArray(files)).toBe(true);
        expect(files.length).toBe(2);

        files.forEach(file => {
            expect(file.name).toMatch(/^sample_nonexistent_\d+\.txt$/);
            expect(file.type).toBe('text/plain');
        });
    });

    it('should filter files by type', () => {
        const agreementFiles = getSampleDatasetFiles('agreement', 5);

        expect(Array.isArray(agreementFiles)).toBe(true);
        expect(agreementFiles.length).toBeLessThanOrEqual(5);

        // If real files are available, they should contain 'agreement' in the name
        // If mock files, they should follow the mock pattern
        agreementFiles.forEach(file => {
            const isRealFile = !file.path.includes('/mock/path/');
            const isMockFile = file.path.includes('/mock/path/');

            if (isRealFile) {
                expect(file.name.toLowerCase()).toMatch(/agreement/);
            } else if (isMockFile) {
                expect(file.name).toMatch(/^sample_agreement_\d+\.txt$/);
            }
        });
    });
});