/**
 * Test Data Generators for ClearClause End-to-End Testing
 * 
 * This module provides generators for various input types and test scenarios
 * used in comprehensive end-to-end testing of the ClearClause AI system.
 */

import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * Generate random legal text content for testing
 */
export const legalTextGenerator = fc.string({
    minLength: 50,
    maxLength: 2000
}).map(text => {
    // Add legal-sounding phrases to make it more realistic
    const legalPhrases = [
        'This agreement shall be governed by',
        'The parties hereby agree that',
        'In consideration of the mutual covenants',
        'Subject to the terms and conditions',
        'The effective date of this agreement',
        'Either party may terminate this agreement',
        'This agreement constitutes the entire',
        'Any modification to this agreement'
    ];

    const phrase = legalPhrases[Math.floor(Math.random() * legalPhrases.length)];
    return `${phrase} ${text}. This document contains legal clauses and provisions that require careful analysis.`;
});

/**
 * Generate random URL inputs for testing
 */
export const urlGenerator = fc.oneof(
    fc.constant('https://example.com/terms-of-service'),
    fc.constant('https://example.com/privacy-policy'),
    fc.constant('https://example.com/user-agreement'),
    fc.webUrl()
);

/**
 * Generate file metadata for testing
 */
export const fileMetadataGenerator = fc.record({
    name: fc.string({ minLength: 5, maxLength: 50 }).map(name => `${name}.pdf`),
    size: fc.integer({ min: 1024, max: 10 * 1024 * 1024 }), // 1KB to 10MB
    type: fc.constantFrom('application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    lastModified: fc.date({ min: new Date('2020-01-01'), max: new Date() })
});

/**
 * Generate API request payloads for testing
 */
export const apiRequestGenerator = fc.oneof(
    // Raw text request
    fc.record({
        type: fc.constant('text'),
        content: legalTextGenerator
    }),

    // URL request
    fc.record({
        type: fc.constant('url'),
        content: urlGenerator
    }),

    // File upload request
    fc.record({
        type: fc.constant('file'),
        content: fileMetadataGenerator
    })
);

/**
 * Generate expected analysis output structure
 */
export const analysisOutputGenerator = fc.record({
    summary: fc.string({ minLength: 20, maxLength: 100 }).filter(text => text.trim().length > 10).map(text => {
        const cleanText = text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        return `This document contains ${cleanText} and provides important legal analysis. The contract includes various clauses that require careful review and consideration by legal professionals.`;
    }),
    clauses: fc.array(fc.record({
        type: fc.constantFrom('termination', 'payment', 'liability', 'confidentiality', 'intellectual_property'),
        text: fc.string({ minLength: 10, maxLength: 50 }).filter(text => text.trim().length > 5).map(text => {
            const cleanText = text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
            return `This clause states that ${cleanText} and applies to the parties involved in this agreement.`;
        }),
        confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0), noNaN: true }),
        risk_level: fc.constantFrom('Low', 'Medium', 'High', 'Critical')
    }), { minLength: 1, maxLength: 10 }),
    risks: fc.array(fc.record({
        level: fc.constantFrom('Low', 'Medium', 'High', 'Critical'),
        description: fc.string({ minLength: 10, maxLength: 50 }).filter(text => text.trim().length > 5).map(text => {
            const cleanText = text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
            return `This risk involves ${cleanText} which could impact the agreement and parties involved.`;
        }),
        explanation: fc.string({ minLength: 15, maxLength: 80 }).filter(text => text.trim().length > 10).map(text => {
            const cleanText = text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
            return `This risk exists because ${cleanText} and may result in significant legal consequences for the parties involved in this agreement.`;
        }),
        recommendation: fc.string({ minLength: 10, maxLength: 50 }).filter(text => text.trim().length > 5).map(text => {
            const cleanText = text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
            return `To mitigate this risk, consider ${cleanText} and review the relevant contract provisions carefully with legal counsel.`;
        })
    }), { minLength: 1, maxLength: 5 }),
    metadata: fc.record({
        processing_time: fc.integer({ min: 100, max: 30000 }),
        input_type: fc.constantFrom('text', 'url', 'file'),
        model_used: fc.constant('anthropic.claude-3-sonnet-20240229-v1:0'),
        timestamp: fc.date()
    })
});

/**
 * Generate AWS service response structures
 */
export const awsServiceResponseGenerator = {
    s3Upload: fc.record({
        ETag: fc.string({ minLength: 32, maxLength: 32 }),
        Location: fc.webUrl(),
        Key: fc.string({ minLength: 10, maxLength: 100 }),
        Bucket: fc.constant('impactxaws-docs')
    }),

    textractResponse: fc.record({
        JobStatus: fc.constantFrom('SUCCEEDED', 'FAILED', 'IN_PROGRESS'),
        DocumentMetadata: fc.record({
            Pages: fc.integer({ min: 1, max: 50 })
        }),
        Blocks: fc.array(fc.record({
            BlockType: fc.constantFrom('LINE', 'WORD', 'PAGE'),
            Text: fc.string({ minLength: 1, maxLength: 100 }),
            Confidence: fc.float({ min: Math.fround(0.7), max: Math.fround(1.0) })
        }), { minLength: 1, maxLength: 100 })
    }),

    bedrockResponse: fc.record({
        body: fc.record({
            content: fc.array(fc.record({
                text: analysisOutputGenerator.map(output => JSON.stringify(output))
            }))
        }),
        contentType: fc.constant('application/json')
    })
};

/**
 * Get sample files from the CUAD dataset
 */
export function getSampleDatasetFiles(fileType = 'all', count = 5) {
    const datasetPath = './archive/CUAD_v1/full_contract_txt';

    try {
        if (!fs.existsSync(datasetPath)) {
            console.warn('Dataset path not found, returning mock file list');
            return generateMockFileList(fileType, count);
        }

        const files = fs.readdirSync(datasetPath);
        const filteredFiles = files.filter(file => {
            if (fileType === 'all') return true;
            return file.toLowerCase().includes(fileType.toLowerCase());
        });

        if (filteredFiles.length === 0) {
            console.warn(`No files found for type '${fileType}', returning mock file list`);
            return generateMockFileList(fileType, count);
        }

        return filteredFiles.slice(0, count).map(filename => ({
            name: filename,
            path: path.join(datasetPath, filename),
            type: 'text/plain',
            size: fs.statSync(path.join(datasetPath, filename)).size
        }));
    } catch (error) {
        console.warn('Error reading dataset files:', error.message);
        return generateMockFileList(fileType, count);
    }
}

/**
 * Generate mock file list when dataset is not available
 */
function generateMockFileList(fileType, count) {
    const mockFiles = [];
    for (let i = 0; i < count; i++) {
        mockFiles.push({
            name: `sample_${fileType}_${i + 1}.txt`,
            path: `/mock/path/sample_${fileType}_${i + 1}.txt`,
            type: 'text/plain',
            size: Math.floor(Math.random() * 100000) + 1000
        });
    }
    return mockFiles;
}

/**
 * Generate test scenarios for different input types
 */
export const testScenarioGenerator = fc.record({
    scenario: fc.constantFrom(
        'small_text_input',
        'large_text_input',
        'pdf_file_upload',
        'image_file_upload',
        'excel_file_upload',
        'url_content_fetch',
        'malformed_input',
        'empty_input'
    ),
    input: fc.oneof(
        legalTextGenerator,
        urlGenerator,
        fileMetadataGenerator
    ),
    expectedOutcome: fc.constantFrom('success', 'error', 'timeout')
});

/**
 * Generate error scenarios for testing
 */
export const errorScenarioGenerator = fc.record({
    errorType: fc.constantFrom(
        'aws_service_unavailable',
        'invalid_credentials',
        'file_too_large',
        'unsupported_format',
        'network_timeout',
        'malformed_response'
    ),
    errorMessage: fc.string({ minLength: 10, maxLength: 100 }),
    shouldTriggerFallback: fc.boolean()
});

/**
 * Generate synthetic legal documents for edge case testing
 */
export const syntheticLegalDocumentGenerator = fc.record({
    documentType: fc.constantFrom(
        'service_agreement',
        'privacy_policy',
        'terms_of_use',
        'employment_contract',
        'nda',
        'license_agreement'
    ),
    content: fc.string({ minLength: 100, maxLength: 5000 }).map(text => {
        const templates = {
            service_agreement: `SERVICE AGREEMENT\n\nThis Service Agreement ("Agreement") is entered into on [DATE] between [PARTY1] and [PARTY2].\n\n1. SERVICES\nThe Provider agrees to provide the following services: ${text}\n\n2. PAYMENT TERMS\nPayment shall be made within 30 days of invoice date.\n\n3. TERMINATION\nEither party may terminate this agreement with 30 days written notice.\n\n4. LIABILITY\nProvider's liability shall not exceed the total amount paid under this agreement.`,

            privacy_policy: `PRIVACY POLICY\n\nLast updated: [DATE]\n\n1. INFORMATION WE COLLECT\nWe collect information you provide directly to us: ${text}\n\n2. HOW WE USE YOUR INFORMATION\nWe use the information we collect to provide, maintain, and improve our services.\n\n3. INFORMATION SHARING\nWe do not sell, trade, or otherwise transfer your personal information to third parties.\n\n4. DATA SECURITY\nWe implement appropriate security measures to protect your personal information.`,

            terms_of_use: `TERMS OF USE\n\nEffective Date: [DATE]\n\n1. ACCEPTANCE OF TERMS\nBy accessing this service, you agree to be bound by these terms: ${text}\n\n2. USER RESPONSIBILITIES\nYou are responsible for maintaining the confidentiality of your account.\n\n3. PROHIBITED USES\nYou may not use our service for any unlawful purpose.\n\n4. LIMITATION OF LIABILITY\nIn no event shall we be liable for any indirect, incidental, or consequential damages.`,

            employment_contract: `EMPLOYMENT AGREEMENT\n\nThis Employment Agreement is made between [EMPLOYER] and [EMPLOYEE].\n\n1. POSITION AND DUTIES\nEmployee shall perform the following duties: ${text}\n\n2. COMPENSATION\nEmployee shall receive a salary as agreed upon.\n\n3. CONFIDENTIALITY\nEmployee agrees to maintain confidentiality of proprietary information.\n\n4. TERMINATION\nEmployment may be terminated by either party with appropriate notice.`,

            nda: `NON-DISCLOSURE AGREEMENT\n\nThis Non-Disclosure Agreement ("NDA") is entered into between the parties.\n\n1. CONFIDENTIAL INFORMATION\nConfidential information includes: ${text}\n\n2. OBLIGATIONS\nReceiving party agrees to maintain confidentiality of disclosed information.\n\n3. TERM\nThis agreement shall remain in effect for a period of [YEARS] years.\n\n4. REMEDIES\nBreach of this agreement may result in irreparable harm requiring injunctive relief.`,

            license_agreement: `SOFTWARE LICENSE AGREEMENT\n\nThis License Agreement governs the use of the licensed software.\n\n1. GRANT OF LICENSE\nLicensor grants a non-exclusive license to use the software: ${text}\n\n2. RESTRICTIONS\nLicensee may not modify, distribute, or reverse engineer the software.\n\n3. SUPPORT AND MAINTENANCE\nLicensor will provide reasonable support during the license term.\n\n4. WARRANTY DISCLAIMER\nSoftware is provided "as is" without warranty of any kind.`
        };

        return templates[Math.random() > 0.5 ? 'service_agreement' : 'privacy_policy'] || templates.service_agreement;
    }),
    clauses: fc.array(fc.record({
        type: fc.constantFrom('termination', 'payment', 'liability', 'confidentiality', 'intellectual_property', 'dispute_resolution'),
        severity: fc.constantFrom('Low', 'Medium', 'High', 'Critical'),
        text: fc.string({ minLength: 20, maxLength: 200 })
    }), { minLength: 3, maxLength: 15 }),
    metadata: fc.record({
        wordCount: fc.integer({ min: 100, max: 5000 }),
        pageCount: fc.integer({ min: 1, max: 50 }),
        language: fc.constant('en'),
        jurisdiction: fc.constantFrom('US', 'UK', 'CA', 'AU', 'EU')
    })
});

/**
 * Mock AWS response generators for offline testing
 */
export const mockAWSResponseGenerators = {
    s3: {
        putObject: fc.record({
            ETag: fc.string({ minLength: 32, maxLength: 32 }),
            ServerSideEncryption: fc.constant('AES256'),
            VersionId: fc.string({ minLength: 32, maxLength: 32 })
        }),

        getObject: fc.record({
            Body: fc.uint8Array({ minLength: 100, maxLength: 10000 }),
            ContentType: fc.constantFrom('application/pdf', 'image/png', 'text/plain'),
            ContentLength: fc.integer({ min: 100, max: 10000 }),
            LastModified: fc.date(),
            ETag: fc.string({ minLength: 32, maxLength: 32 })
        }),

        headObject: fc.record({
            ContentLength: fc.integer({ min: 100, max: 10000000 }),
            ContentType: fc.constantFrom('application/pdf', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
            LastModified: fc.date(),
            ETag: fc.string({ minLength: 32, maxLength: 32 })
        })
    },

    lambda: {
        invoke: fc.record({
            StatusCode: fc.constantFrom(200, 202),
            Payload: fc.string().map(str => JSON.stringify({
                statusCode: 200,
                body: JSON.stringify({
                    result: 'success',
                    data: str,
                    processingTime: Math.floor(Math.random() * 5000) + 1000
                })
            })),
            ExecutedVersion: fc.constant('$LATEST')
        }),

        invokeAsync: fc.record({
            Status: fc.constant(202)
        })
    },

    textract: {
        startDocumentTextDetection: fc.record({
            JobId: fc.string({ minLength: 20, maxLength: 50 })
        }),

        getDocumentTextDetection: fc.record({
            JobStatus: fc.constantFrom('SUCCEEDED', 'IN_PROGRESS', 'FAILED'),
            DocumentMetadata: fc.record({
                Pages: fc.integer({ min: 1, max: 100 })
            }),
            Blocks: fc.array(fc.record({
                BlockType: fc.constantFrom('PAGE', 'LINE', 'WORD'),
                Id: fc.string({ minLength: 10, maxLength: 20 }),
                Text: fc.string({ minLength: 1, maxLength: 100 }),
                Confidence: fc.float({ min: Math.fround(0.7), max: Math.fround(1.0) }),
                Geometry: fc.record({
                    BoundingBox: fc.record({
                        Width: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
                        Height: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
                        Left: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
                        Top: fc.float({ min: Math.fround(0), max: Math.fround(1) })
                    })
                })
            }), { minLength: 1, maxLength: 1000 })
        })
    },

    bedrock: {
        invokeModel: fc.record({
            body: fc.string({ minLength: 100, maxLength: 1000 }).map(str => {
                const response = {
                    content: [{
                        text: JSON.stringify({
                            summary: "This is a comprehensive analysis of the legal document.",
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
                        })
                    }],
                    usage: {
                        input_tokens: Math.floor(Math.random() * 1000) + 100,
                        output_tokens: Math.floor(Math.random() * 500) + 50
                    }
                };
                return new TextEncoder().encode(JSON.stringify(response));
            }),
            contentType: fc.constant('application/json')
        })
    }
};

/**
 * Test file selection utilities for dataset processing
 */
export class TestFileSelector {
    constructor(datasetPath = './archive/CUAD_v1/full_contract_txt') {
        this.datasetPath = datasetPath;
    }

    /**
     * Select files by type and criteria
     */
    selectFilesByType(fileType, criteria = {}) {
        const { count = 5, minSize = 1000, maxSize = 1000000, pattern = null } = criteria;

        try {
            if (!fs.existsSync(this.datasetPath)) {
                return this.generateMockFileSelection(fileType, count);
            }

            const files = fs.readdirSync(this.datasetPath);
            let filteredFiles = files;

            // Filter by pattern if provided
            if (pattern) {
                filteredFiles = files.filter(file => file.match(new RegExp(pattern, 'i')));
            }

            // Filter by file type
            if (fileType !== 'all') {
                filteredFiles = filteredFiles.filter(file =>
                    file.toLowerCase().includes(fileType.toLowerCase())
                );
            }

            // Filter by size
            filteredFiles = filteredFiles.filter(file => {
                try {
                    const stats = fs.statSync(path.join(this.datasetPath, file));
                    return stats.size >= minSize && stats.size <= maxSize;
                } catch {
                    return false;
                }
            });

            // Select random files up to count
            const selectedFiles = this.shuffleArray(filteredFiles).slice(0, count);

            return selectedFiles.map(filename => ({
                name: filename,
                path: path.join(this.datasetPath, filename),
                type: this.getFileType(filename),
                size: fs.statSync(path.join(this.datasetPath, filename)).size,
                category: this.categorizeFile(filename)
            }));

        } catch (error) {
            console.warn('Error selecting files:', error.message);
            return this.generateMockFileSelection(fileType, count);
        }
    }

    /**
     * Select representative files for comprehensive testing
     */
    selectRepresentativeFiles() {
        return {
            small: this.selectFilesByType('all', { count: 3, maxSize: 10000 }),
            medium: this.selectFilesByType('all', { count: 3, minSize: 10000, maxSize: 100000 }),
            large: this.selectFilesByType('all', { count: 2, minSize: 100000 }),
            agreements: this.selectFilesByType('agreement', { count: 5 }),
            licenses: this.selectFilesByType('license', { count: 3 }),
            services: this.selectFilesByType('service', { count: 3 })
        };
    }

    /**
     * Generate mock file selection when dataset is unavailable
     */
    generateMockFileSelection(fileType, count) {
        const mockFiles = [];
        for (let i = 0; i < count; i++) {
            mockFiles.push({
                name: `mock_${fileType}_${i + 1}.txt`,
                path: `/mock/path/mock_${fileType}_${i + 1}.txt`,
                type: 'text/plain',
                size: Math.floor(Math.random() * 50000) + 1000,
                category: fileType
            });
        }
        return mockFiles;
    }

    /**
     * Utility methods
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    getFileType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const typeMap = {
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain'
        };
        return typeMap[ext] || 'text/plain';
    }

    categorizeFile(filename) {
        const name = filename.toLowerCase();
        if (name.includes('agreement')) return 'agreement';
        if (name.includes('license')) return 'license';
        if (name.includes('service')) return 'service';
        if (name.includes('privacy')) return 'privacy';
        if (name.includes('terms')) return 'terms';
        return 'general';
    }
}

/**
 * Test result validation utilities
 */
export class TestResultValidator {
    constructor() {
        this.validationRules = {
            summary: {
                minLength: 20,
                maxLength: 1000,
                requiredPhrases: ['document', 'analysis', 'contract', 'agreement']
            },
            clauses: {
                minCount: 1,
                maxCount: 50,
                requiredFields: ['type', 'text', 'confidence', 'risk_level'],
                validTypes: ['termination', 'payment', 'liability', 'confidentiality', 'intellectual_property', 'dispute_resolution'],
                validRiskLevels: ['Low', 'Medium', 'High', 'Critical']
            },
            risks: {
                minCount: 1,
                maxCount: 20,
                requiredFields: ['level', 'description', 'explanation', 'recommendation'],
                validLevels: ['Low', 'Medium', 'High', 'Critical']
            },
            metadata: {
                requiredFields: ['processing_time', 'input_type', 'model_used'],
                validInputTypes: ['text', 'url', 'file'],
                validModels: ['anthropic.claude-3-sonnet-20240229-v1:0']
            }
        };
    }

    /**
     * Validate analysis result structure and content
     */
    validateAnalysisResult(result) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            score: 0
        };

        try {
            // Validate summary
            const summaryValidation = this.validateSummary(result.summary);
            validation.errors.push(...summaryValidation.errors);
            validation.warnings.push(...summaryValidation.warnings);
            validation.score += summaryValidation.score;

            // Validate clauses
            const clausesValidation = this.validateClauses(result.clauses);
            validation.errors.push(...clausesValidation.errors);
            validation.warnings.push(...clausesValidation.warnings);
            validation.score += clausesValidation.score;

            // Validate risks
            const risksValidation = this.validateRisks(result.risks);
            validation.errors.push(...risksValidation.errors);
            validation.warnings.push(...risksValidation.warnings);
            validation.score += risksValidation.score;

            // Validate metadata
            const metadataValidation = this.validateMetadata(result.metadata);
            validation.errors.push(...metadataValidation.errors);
            validation.warnings.push(...metadataValidation.warnings);
            validation.score += metadataValidation.score;

            validation.isValid = validation.errors.length === 0;
            validation.score = Math.round(validation.score / 4); // Average score

        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Validation error: ${error.message}`);
            validation.score = 0;
        }

        return validation;
    }

    validateSummary(summary) {
        const validation = { errors: [], warnings: [], score: 0 };
        const rules = this.validationRules.summary;

        if (!summary || typeof summary !== 'string') {
            validation.errors.push('Summary must be a non-empty string');
            return validation;
        }

        if (summary.length < rules.minLength) {
            validation.errors.push(`Summary too short (${summary.length} < ${rules.minLength})`);
        } else if (summary.length > rules.maxLength) {
            validation.warnings.push(`Summary very long (${summary.length} > ${rules.maxLength})`);
        } else {
            validation.score += 25;
        }

        const hasRequiredPhrases = rules.requiredPhrases.some(phrase =>
            summary.toLowerCase().includes(phrase)
        );

        if (hasRequiredPhrases) {
            validation.score += 25;
        } else {
            validation.warnings.push('Summary lacks legal document context phrases');
        }

        return validation;
    }

    validateClauses(clauses) {
        const validation = { errors: [], warnings: [], score: 0 };
        const rules = this.validationRules.clauses;

        if (!Array.isArray(clauses)) {
            validation.errors.push('Clauses must be an array');
            return validation;
        }

        if (clauses.length < rules.minCount) {
            validation.errors.push(`Too few clauses (${clauses.length} < ${rules.minCount})`);
        } else if (clauses.length > rules.maxCount) {
            validation.warnings.push(`Many clauses (${clauses.length} > ${rules.maxCount})`);
        } else {
            validation.score += 25;
        }

        clauses.forEach((clause, index) => {
            rules.requiredFields.forEach(field => {
                if (!clause.hasOwnProperty(field)) {
                    validation.errors.push(`Clause ${index} missing field: ${field}`);
                }
            });

            if (clause.type && !rules.validTypes.includes(clause.type)) {
                validation.warnings.push(`Clause ${index} has unusual type: ${clause.type}`);
            }

            if (clause.risk_level && !rules.validRiskLevels.includes(clause.risk_level)) {
                validation.errors.push(`Clause ${index} has invalid risk level: ${clause.risk_level}`);
            }

            if (clause.confidence && (clause.confidence < 0 || clause.confidence > 1)) {
                validation.errors.push(`Clause ${index} has invalid confidence: ${clause.confidence}`);
            }
        });

        if (validation.errors.length === 0) {
            validation.score += 25;
        }

        return validation;
    }

    validateRisks(risks) {
        const validation = { errors: [], warnings: [], score: 0 };
        const rules = this.validationRules.risks;

        if (!Array.isArray(risks)) {
            validation.errors.push('Risks must be an array');
            return validation;
        }

        if (risks.length < rules.minCount) {
            validation.errors.push(`Too few risks (${risks.length} < ${rules.minCount})`);
        } else if (risks.length > rules.maxCount) {
            validation.warnings.push(`Many risks (${risks.length} > ${rules.maxCount})`);
        } else {
            validation.score += 25;
        }

        risks.forEach((risk, index) => {
            rules.requiredFields.forEach(field => {
                if (!risk.hasOwnProperty(field)) {
                    validation.errors.push(`Risk ${index} missing field: ${field}`);
                }
            });

            if (risk.level && !rules.validLevels.includes(risk.level)) {
                validation.errors.push(`Risk ${index} has invalid level: ${risk.level}`);
            }
        });

        if (validation.errors.length === 0) {
            validation.score += 25;
        }

        return validation;
    }

    validateMetadata(metadata) {
        const validation = { errors: [], warnings: [], score: 0 };
        const rules = this.validationRules.metadata;

        if (!metadata || typeof metadata !== 'object') {
            validation.errors.push('Metadata must be an object');
            return validation;
        }

        rules.requiredFields.forEach(field => {
            if (!metadata.hasOwnProperty(field)) {
                validation.errors.push(`Metadata missing field: ${field}`);
            }
        });

        if (metadata.input_type && !rules.validInputTypes.includes(metadata.input_type)) {
            validation.errors.push(`Invalid input type: ${metadata.input_type}`);
        }

        if (metadata.model_used && !rules.validModels.includes(metadata.model_used)) {
            validation.warnings.push(`Unusual model used: ${metadata.model_used}`);
        }

        if (metadata.processing_time && (metadata.processing_time < 0 || metadata.processing_time > 300000)) {
            validation.warnings.push(`Unusual processing time: ${metadata.processing_time}ms`);
        }

        if (validation.errors.length === 0) {
            validation.score += 25;
        }

        return validation;
    }

    /**
     * Generate validation report
     */
    generateValidationReport(results) {
        const report = {
            totalTests: results.length,
            passed: 0,
            failed: 0,
            averageScore: 0,
            commonErrors: {},
            commonWarnings: {},
            recommendations: []
        };

        results.forEach(result => {
            if (result.isValid) {
                report.passed++;
            } else {
                report.failed++;
            }

            report.averageScore += result.score;

            result.errors.forEach(error => {
                report.commonErrors[error] = (report.commonErrors[error] || 0) + 1;
            });

            result.warnings.forEach(warning => {
                report.commonWarnings[warning] = (report.commonWarnings[warning] || 0) + 1;
            });
        });

        report.averageScore = Math.round(report.averageScore / results.length);

        // Generate recommendations
        if (report.failed > 0) {
            report.recommendations.push('Review failed test cases for common patterns');
        }

        if (report.averageScore < 70) {
            report.recommendations.push('Consider improving analysis quality thresholds');
        }

        const mostCommonError = Object.keys(report.commonErrors).reduce((a, b) =>
            report.commonErrors[a] > report.commonErrors[b] ? a : b, ''
        );

        if (mostCommonError) {
            report.recommendations.push(`Address most common error: ${mostCommonError}`);
        }

        return report;
    }
}

export default {
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
};