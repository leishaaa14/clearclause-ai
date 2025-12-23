/**
 * File Type Processors Unit Tests
 * 
 * Unit tests for individual file type processors including PDF processing
 * through Textract, image OCR extraction, Excel text extraction,
 * and text normalization functionality.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatasetFileProcessor } from './utils/DatasetFileProcessor.js';
import { TestEnvironmentSetup } from './utils/aws-test-utilities.js';
import { TEST_CONFIG, VALIDATION_THRESHOLDS } from './config/test-config.js';

describe('File Type Processors Unit Tests', () => {
    let testEnvironment;
    let processor;

    beforeAll(async () => {
        testEnvironment = new TestEnvironmentSetup();
        await testEnvironment.initializeMockServices();
    });

    beforeEach(async () => {
        processor = new DatasetFileProcessor(false); // Use mock services
    });

    afterAll(async () => {
        await testEnvironment.cleanup();
    });

    describe('PDF File Processing through Textract', () => {
        test('should upload PDF file to S3 successfully', async () => {
            const pdfFile = {
                name: 'test-contract.pdf',
                path: '/mock/test-contract.pdf',
                type: 'application/pdf',
                size: 150000,
                category: 'pdf',
                isMock: true
            };

            const s3Key = `test-files/${Date.now()}-${pdfFile.name}`;
            const result = await processor.uploadFileToS3(pdfFile, s3Key);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.s3Key).toBe(s3Key);
            expect(result.etag).toBeDefined();
            expect(result.location).toBeDefined();
            expect(result.location).toContain(s3Key);
        });

        test('should extract text from PDF via Textract', async () => {
            const s3Key = 'test-files/sample-contract.pdf';
            const result = await processor.extractTextViaTextract(s3Key, 'pdf');

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.extractedText).toBeDefined();
            expect(typeof result.extractedText).toBe('string');
            expect(result.extractedText.length).toBeGreaterThan(0);
            expect(result.confidence).toBeDefined();
            expect(typeof result.confidence).toBe('number');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            expect(result.pageCount).toBeDefined();
            expect(typeof result.pageCount).toBe('number');
            expect(result.pageCount).toBeGreaterThan(0);
        });

        test('should handle PDF processing errors gracefully', async () => {
            const invalidFile = {
                name: 'invalid.pdf',
                path: '/nonexistent/invalid.pdf',
                type: 'application/pdf',
                size: 0,
                category: 'pdf',
                isMock: false
            };

            const s3Key = 'test-files/invalid.pdf';

            // This should handle the error gracefully
            const uploadResult = await processor.uploadFileToS3(invalidFile, s3Key);

            // Upload might fail for invalid files
            if (!uploadResult.success) {
                expect(uploadResult.error).toBeDefined();
                expect(typeof uploadResult.error).toBe('string');
                expect(uploadResult.s3Key).toBe(s3Key);
            }
        });

        test('should process complete PDF pipeline', async () => {
            const pdfFile = {
                name: 'legal-document.pdf',
                path: '/mock/legal-document.pdf',
                type: 'application/pdf',
                size: 200000,
                category: 'pdf',
                isMock: true
            };

            const result = await processor.processFile(pdfFile);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.steps.s3Upload).toBeDefined();
            expect(result.steps.s3Upload.success).toBe(true);
            expect(result.steps.textExtraction).toBeDefined();
            expect(result.steps.textExtraction.success).toBe(true);
            expect(result.steps.textNormalization).toBeDefined();
            expect(result.steps.textNormalization.success).toBe(true);
            expect(result.steps.bedrockAnalysis).toBeDefined();
            expect(result.steps.bedrockAnalysis.success).toBe(true);
            expect(result.analysis).toBeDefined();
            expect(result.processingTime).toBeGreaterThan(0);
        });
    });

    describe('Image OCR Extraction', () => {
        test('should extract text from image files via Textract', async () => {
            const imageFile = {
                name: 'contract-scan.png',
                path: '/mock/contract-scan.png',
                type: 'image/png',
                size: 500000,
                category: 'png',
                isMock: true
            };

            const s3Key = `test-files/${Date.now()}-${imageFile.name}`;

            // Upload image to S3
            const uploadResult = await processor.uploadFileToS3(imageFile, s3Key);
            expect(uploadResult.success).toBe(true);

            // Extract text via Textract
            const extractResult = await processor.extractTextViaTextract(s3Key, 'png');

            expect(extractResult).toBeDefined();
            expect(extractResult.success).toBe(true);
            expect(extractResult.extractedText).toBeDefined();
            expect(typeof extractResult.extractedText).toBe('string');
            expect(extractResult.extractedText.length).toBeGreaterThan(0);
            expect(extractResult.confidence).toBeDefined();
            expect(extractResult.confidence).toBeGreaterThanOrEqual(VALIDATION_THRESHOLDS.minimumTextractConfidence);
        });

        test('should handle different image formats', async () => {
            const imageFormats = [
                { name: 'scan.jpg', type: 'image/jpeg', category: 'jpg' },
                { name: 'scan.jpeg', type: 'image/jpeg', category: 'jpeg' },
                { name: 'scan.png', type: 'image/png', category: 'png' }
            ];

            for (const format of imageFormats) {
                const imageFile = {
                    name: format.name,
                    path: `/mock/${format.name}`,
                    type: format.type,
                    size: 300000,
                    category: format.category,
                    isMock: true
                };

                const result = await processor.processFile(imageFile);

                expect(result.success).toBe(true);
                expect(result.steps.textExtraction.success).toBe(true);
                expect(result.steps.textExtraction.extractedText).toBeDefined();
                expect(result.analysis).toBeDefined();
            }
        });
    });

    describe('Excel Text Extraction', () => {
        test('should extract text from Excel files', async () => {
            const excelFile = {
                name: 'clauses-spreadsheet.xlsx',
                path: '/mock/clauses-spreadsheet.xlsx',
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 75000,
                category: 'xlsx',
                isMock: true
            };

            const result = await processor.extractTextFromExcel(excelFile);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.extractedText).toBeDefined();
            expect(typeof result.extractedText).toBe('string');
            expect(result.extractedText.length).toBeGreaterThan(0);
            expect(result.sheetCount).toBeDefined();
            expect(typeof result.sheetCount).toBe('number');
            expect(result.sheetCount).toBeGreaterThan(0);
        });

        test('should handle both .xlsx and .xls formats', async () => {
            const excelFormats = [
                {
                    name: 'legal-clauses.xlsx',
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                },
                {
                    name: 'contract-terms.xls',
                    type: 'application/vnd.ms-excel'
                }
            ];

            for (const format of excelFormats) {
                const excelFile = {
                    name: format.name,
                    path: `/mock/${format.name}`,
                    type: format.type,
                    size: 50000,
                    category: 'xlsx',
                    isMock: true
                };

                const result = await processor.extractTextFromExcel(excelFile);

                expect(result.success).toBe(true);
                expect(result.extractedText).toBeDefined();
                expect(result.extractedText.length).toBeGreaterThan(0);
            }
        });

        test('should process complete Excel pipeline', async () => {
            const excelFile = {
                name: 'contract-analysis.xlsx',
                path: '/mock/contract-analysis.xlsx',
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 100000,
                category: 'xlsx',
                isMock: true
            };

            const result = await processor.processFile(excelFile);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.steps.textExtraction).toBeDefined();
            expect(result.steps.textExtraction.success).toBe(true);
            expect(result.steps.textNormalization).toBeDefined();
            expect(result.steps.textNormalization.success).toBe(true);
            expect(result.steps.bedrockAnalysis).toBeDefined();
            expect(result.steps.bedrockAnalysis.success).toBe(true);
            expect(result.analysis).toBeDefined();

            // Excel files should not have S3 upload step
            expect(result.steps.s3Upload).toBeUndefined();
        });
    });

    describe('Text Normalization', () => {
        test('should normalize text with multiple spaces', async () => {
            const textWithSpaces = 'This   document   has   multiple   spaces   between   words.';
            const result = await processor.normalizeExtractedText(textWithSpaces);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.normalizedText).toBeDefined();
            expect(result.normalizedText).not.toMatch(/  +/); // No multiple spaces
            expect(result.normalizedText).toContain('This document has multiple spaces between words.');
            expect(result.originalLength).toBe(textWithSpaces.length);
            expect(result.normalizedLength).toBe(result.normalizedText.length);
        });

        test('should normalize text with multiple newlines', async () => {
            const textWithNewlines = 'Line 1\n\n\nLine 2\n\n\n\nLine 3';
            const result = await processor.normalizeExtractedText(textWithNewlines);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.normalizedText).toBeDefined();
            expect(result.normalizedText).not.toMatch(/\n\n+/); // No multiple newlines
            // The normalization converts multiple newlines to single newlines, then may convert to spaces
            expect(result.normalizedText).toContain('Line 1');
            expect(result.normalizedText).toContain('Line 2');
            expect(result.normalizedText).toContain('Line 3');
        });

        test('should trim leading and trailing whitespace', async () => {
            const textWithWhitespace = '   \n  This is a test document.  \n   ';
            const result = await processor.normalizeExtractedText(textWithWhitespace);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.normalizedText).toBeDefined();
            expect(result.normalizedText).toBe(result.normalizedText.trim());
            expect(result.normalizedText.startsWith('This is a test document.')).toBe(true);
        });

        test('should ensure minimum length for analysis', async () => {
            const shortText = 'Short';
            const result = await processor.normalizeExtractedText(shortText);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.normalizedText).toBeDefined();
            expect(result.normalizedText.length).toBeGreaterThanOrEqual(VALIDATION_THRESHOLDS.minimumSummaryLength);
            expect(result.normalizedText).toContain(shortText);
        });

        test('should handle empty or null text', async () => {
            const emptyTexts = ['', '   ', '\n\n\n', null, undefined];

            for (const text of emptyTexts) {
                const result = await processor.normalizeExtractedText(text || '');

                expect(result).toBeDefined();
                expect(result.success).toBe(true);
                expect(result.normalizedText).toBeDefined();
                expect(result.normalizedText.length).toBeGreaterThanOrEqual(VALIDATION_THRESHOLDS.minimumSummaryLength);
            }
        });

        test('should preserve important legal text structure', async () => {
            const legalText = 'WHEREAS, the parties agree to the following terms:\n1. Payment terms\n2. Termination clause\n3. Liability provisions';
            const result = await processor.normalizeExtractedText(legalText);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.normalizedText).toBeDefined();
            expect(result.normalizedText).toContain('WHEREAS');
            expect(result.normalizedText).toContain('Payment terms');
            expect(result.normalizedText).toContain('Termination clause');
            expect(result.normalizedText).toContain('Liability provisions');
        });
    });

    describe('Text File Processing', () => {
        test('should extract text from plain text files', async () => {
            const textFile = {
                name: 'contract.txt',
                path: '/mock/contract.txt',
                type: 'text/plain',
                size: 25000,
                category: 'txt',
                isMock: true
            };

            const result = await processor.extractTextFromFile(textFile);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.extractedText).toBeDefined();
            expect(typeof result.extractedText).toBe('string');
            expect(result.extractedText.length).toBeGreaterThan(0);
        });

        test('should process complete text file pipeline', async () => {
            const textFile = {
                name: 'legal-agreement.txt',
                path: '/mock/legal-agreement.txt',
                type: 'text/plain',
                size: 15000,
                category: 'txt',
                isMock: true
            };

            const result = await processor.processFile(textFile);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.steps.textExtraction).toBeDefined();
            expect(result.steps.textExtraction.success).toBe(true);
            expect(result.steps.textNormalization).toBeDefined();
            expect(result.steps.textNormalization.success).toBe(true);
            expect(result.steps.bedrockAnalysis).toBeDefined();
            expect(result.steps.bedrockAnalysis.success).toBe(true);
            expect(result.analysis).toBeDefined();

            // Text files should not have S3 upload step
            expect(result.steps.s3Upload).toBeUndefined();
        });
    });

    describe('File Selection Logic', () => {
        test('should select PDF files from dataset', async () => {
            const files = await processor.getFilesOfType('pdf', 3);

            expect(files).toBeDefined();
            expect(Array.isArray(files)).toBe(true);
            expect(files.length).toBeGreaterThan(0);
            expect(files.length).toBeLessThanOrEqual(3);

            for (const file of files) {
                expect(file.name).toBeDefined();
                expect(file.path).toBeDefined();
                expect(file.type).toBe('application/pdf');
                expect(file.category).toBe('pdf');
                expect(file.size).toBeGreaterThan(0);
            }
        });

        test('should select text files from dataset', async () => {
            const files = await processor.getFilesOfType('txt', 2);

            expect(files).toBeDefined();
            expect(Array.isArray(files)).toBe(true);
            expect(files.length).toBeGreaterThan(0);
            expect(files.length).toBeLessThanOrEqual(2);

            for (const file of files) {
                expect(file.name).toBeDefined();
                expect(file.path).toBeDefined();
                expect(file.type).toBe('text/plain');
                expect(file.category).toBe('txt');
                expect(file.size).toBeGreaterThan(0);
            }
        });

        test('should select Excel files from dataset', async () => {
            const files = await processor.getFilesOfType('xlsx', 2);

            expect(files).toBeDefined();
            expect(Array.isArray(files)).toBe(true);
            expect(files.length).toBeGreaterThan(0);
            expect(files.length).toBeLessThanOrEqual(2);

            for (const file of files) {
                expect(file.name).toBeDefined();
                expect(file.path).toBeDefined();
                expect(file.type).toContain('spreadsheet');
                expect(file.category).toBe('xlsx');
                expect(file.size).toBeGreaterThan(0);
            }
        });

        test('should handle unsupported file types gracefully', async () => {
            const files = await processor.getFilesOfType('unsupported', 1);

            expect(files).toBeDefined();
            expect(Array.isArray(files)).toBe(true);
            // Unsupported file types return mock files as fallback
            expect(files.length).toBeGreaterThanOrEqual(0);
            if (files.length > 0) {
                expect(files[0].isMock).toBe(true);
            }
        });

        test('should generate mock files when dataset unavailable', async () => {
            // This tests the fallback mechanism
            const mockFiles = processor.generateMockFiles('pdf', 3);

            expect(mockFiles).toBeDefined();
            expect(Array.isArray(mockFiles)).toBe(true);
            expect(mockFiles.length).toBe(3);

            for (const file of mockFiles) {
                expect(file.name).toBeDefined();
                expect(file.path).toBeDefined();
                expect(file.type).toBe('application/pdf');
                expect(file.category).toBe('pdf');
                expect(file.size).toBeGreaterThan(0);
                expect(file.isMock).toBe(true);
            }
        });
    });

    describe('Processing Summary and Metrics', () => {
        test('should track processing results and generate summary', async () => {
            const testFiles = [
                {
                    name: 'test1.txt',
                    path: '/mock/test1.txt',
                    type: 'text/plain',
                    size: 10000,
                    category: 'txt',
                    isMock: true
                },
                {
                    name: 'test2.pdf',
                    path: '/mock/test2.pdf',
                    type: 'application/pdf',
                    size: 50000,
                    category: 'pdf',
                    isMock: true
                }
            ];

            // Process files
            await processor.processFiles(testFiles);

            // Get summary
            const summary = processor.getProcessingSummary();

            expect(summary).toBeDefined();
            expect(summary.total).toBe(2);
            expect(summary.successful).toBe(2);
            expect(summary.failed).toBe(0);
            expect(summary.averageProcessingTime).toBeGreaterThan(0);
            expect(summary.results).toBeDefined();
            expect(summary.results.length).toBe(2);

            for (const result of summary.results) {
                expect(result.success).toBe(true);
                expect(result.processingTime).toBeGreaterThan(0);
            }
        });
    });
});