// Unit Tests for Core AI Components
// Tests ModelManager, ClauseExtractor, RiskAnalyzer, DocumentParser, and APIClient

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ModelManager from '../../model/core/ModelManager.js';
import { ClauseExtractor } from '../../model/extractors/ClauseExtractor.js';
import { RiskAnalyzer } from '../../model/analyzers/RiskAnalyzer.js';
import { DocumentParser } from '../../model/parsers/DocumentParser.js';
import { APIClient } from '../../api/clients/APIClient.js';

describe('Core AI Components Unit Tests', () => {
    describe('ModelManager', () => {
        let modelManager;

        beforeEach(() => {
            modelManager = new ModelManager();
        });

        afterEach(async () => {
            if (modelManager.isLoaded) {
                await modelManager.unloadModel();
            }
        });

        it('should initialize with default configuration', () => {
            expect(modelManager.isLoaded).toBe(false);
            expect(modelManager.modelConfig).toBeDefined();
            expect(modelManager.modelConfig.modelName).toBe('llama-3.1-8b-instruct');
            expect(modelManager.modelConfig.temperature).toBe(0.1);
            expect(modelManager.modelConfig.contextWindow).toBe(128000);
        });

        it('should validate configuration correctly', () => {
            const validConfig = {
                modelName: 'test-model',
                maxTokens: 2048,
                contextWindow: 128000,
                temperature: 0.5
            };

            const result = modelManager.validateConfig(validConfig);
            expect(result).toBe(true);
        });

        it('should reject invalid configuration', () => {
            const invalidConfig = {
                modelName: '', // Invalid empty name
                maxTokens: -1, // Invalid negative tokens
                contextWindow: 0 // Invalid zero context
            };

            const result = modelManager.validateConfig(invalidConfig);
            expect(result).toBe(false);
        });

        it('should get model status correctly', () => {
            const status = modelManager.getModelStatus();

            expect(status).toHaveProperty('isLoaded');
            expect(status).toHaveProperty('modelName');
            expect(status).toHaveProperty('memoryUsage');
            expect(status).toHaveProperty('healthStatus');
            expect(status).toHaveProperty('performanceMetrics');
            expect(status.isLoaded).toBe(false);
        });

        it('should update configuration at runtime', async () => {
            const newConfig = {
                temperature: 0.3,
                maxTokens: 1024,
                timeout: 20000
            };

            const success = await modelManager.updateConfiguration(newConfig);
            expect(success).toBe(true);

            const updatedConfig = modelManager.getConfiguration();
            expect(updatedConfig.temperature).toBe(0.3);
            expect(updatedConfig.maxTokens).toBe(1024);
        });

        it('should validate configuration parameters correctly', () => {
            // Valid configurations
            expect(modelManager.validateConfiguration({ temperature: 0.5 }).isValid).toBe(true);
            expect(modelManager.validateConfiguration({ maxTokens: 2048 }).isValid).toBe(true);
            expect(modelManager.validateConfiguration({ contextWindow: 128000 }).isValid).toBe(true);

            // Invalid configurations
            expect(modelManager.validateConfiguration({ temperature: -1 }).isValid).toBe(false);
            expect(modelManager.validateConfiguration({ temperature: 3 }).isValid).toBe(false);
            expect(modelManager.validateConfiguration({ maxTokens: 0 }).isValid).toBe(false);
            expect(modelManager.validateConfiguration({ maxTokens: 10000 }).isValid).toBe(false);
            expect(modelManager.validateConfiguration({ contextWindow: 1000 }).isValid).toBe(false);
        });

        it('should backup and restore configuration', async () => {
            const originalConfig = modelManager.getConfiguration();
            const backup = modelManager.backupConfiguration();

            expect(backup).toHaveProperty('timestamp');
            expect(backup.modelName).toBe(originalConfig.modelName);

            // Modify configuration
            await modelManager.updateConfiguration({ temperature: 0.8 });
            expect(modelManager.getConfiguration().temperature).toBe(0.8);

            // Restore from backup
            const restoreSuccess = await modelManager.restoreConfiguration(backup);
            expect(restoreSuccess).toBe(true);
            expect(modelManager.getConfiguration().temperature).toBe(originalConfig.temperature);
        });

        it('should handle memory optimization', async () => {
            const initialMemory = modelManager.memoryUsage;
            await modelManager.optimizeMemory();

            // Memory optimization should complete without error
            expect(modelManager.memoryUsage).toBeGreaterThanOrEqual(0);
        });

        it('should reset performance metrics', () => {
            // Set some metrics
            modelManager.inferenceCount = 5;
            modelManager.totalInferenceTime = 1000;
            modelManager.performanceMetrics.totalRequests = 10;

            modelManager.resetMetrics();

            expect(modelManager.inferenceCount).toBe(0);
            expect(modelManager.totalInferenceTime).toBe(0);
            expect(modelManager.performanceMetrics.totalRequests).toBe(0);
        });
    });

    describe('ClauseExtractor', () => {
        let clauseExtractor;

        beforeEach(() => {
            clauseExtractor = new ClauseExtractor();
        });

        it('should initialize with default configuration', () => {
            expect(clauseExtractor).toBeDefined();
            expect(clauseExtractor.supportedClauseTypes).toBeDefined();
            expect(clauseExtractor.supportedClauseTypes.length).toBeGreaterThan(10);
        });

        it('should extract clauses from contract text', async () => {
            const contractText = `
        This Agreement shall commence on January 1, 2024 and continue for a period of twelve (12) months.
        Payment shall be due within thirty (30) days of invoice receipt.
        Either party may terminate this agreement with thirty (30) days written notice.
      `;

            const result = await clauseExtractor.extractClauses(contractText);

            expect(result).toHaveProperty('clauses');
            expect(result).toHaveProperty('summary');
            expect(Array.isArray(result.clauses)).toBe(true);
            expect(result.clauses.length).toBeGreaterThan(0);

            // Check clause structure
            const firstClause = result.clauses[0];
            expect(firstClause).toHaveProperty('id');
            expect(firstClause).toHaveProperty('text');
            expect(firstClause).toHaveProperty('type');
            expect(firstClause).toHaveProperty('category');
            expect(firstClause).toHaveProperty('confidence');
            expect(firstClause.confidence).toBeGreaterThanOrEqual(0);
            expect(firstClause.confidence).toBeLessThanOrEqual(1);
        });

        it('should categorize clauses correctly', async () => {
            const paymentText = "Payment shall be due within thirty (30) days of invoice receipt.";
            const result = await clauseExtractor.extractClauses(paymentText);

            expect(result.clauses.length).toBeGreaterThan(0);
            const paymentClause = result.clauses.find(c => c.type === 'payment_terms');
            expect(paymentClause).toBeDefined();
        });

        it('should provide confidence scores', async () => {
            const contractText = "This is a clear termination clause. Either party may terminate this agreement.";
            const result = await clauseExtractor.extractClauses(contractText);

            result.clauses.forEach(clause => {
                expect(clause.confidence).toBeGreaterThanOrEqual(0);
                expect(clause.confidence).toBeLessThanOrEqual(1);
                expect(typeof clause.confidence).toBe('number');
            });
        });

        it('should handle empty or invalid text', async () => {
            await expect(clauseExtractor.extractClauses('')).rejects.toThrow();
            await expect(clauseExtractor.extractClauses(null)).rejects.toThrow();
            await expect(clauseExtractor.extractClauses(undefined)).rejects.toThrow();
        });

        it('should generate clause summary counts', async () => {
            const contractText = `
        Payment terms: Payment due in 30 days.
        Termination: Either party may terminate.
        Liability: Liability is limited to contract value.
      `;

            const result = await clauseExtractor.extractClauses(contractText);

            expect(result.summary).toBeDefined();
            expect(result.summary).toHaveProperty('totalClauses');
            expect(result.summary).toHaveProperty('clauseTypes');
            expect(result.summary.totalClauses).toBeGreaterThan(0);
            expect(typeof result.summary.clauseTypes).toBe('object');
        });

        it('should preserve clause text and positions', async () => {
            const contractText = "This is a test contract with payment terms.";
            const result = await clauseExtractor.extractClauses(contractText);

            result.clauses.forEach(clause => {
                expect(clause.text).toBeDefined();
                expect(clause.text.length).toBeGreaterThan(0);
                expect(clause).toHaveProperty('startPosition');
                expect(clause).toHaveProperty('endPosition');
                expect(clause.startPosition).toBeGreaterThanOrEqual(0);
                expect(clause.endPosition).toBeGreaterThan(clause.startPosition);
            });
        });

        it('should identify clauses using rule-based approach', async () => {
            const contractText = "Payment shall be due within thirty days. Either party may terminate this agreement.";
            const clauses = await clauseExtractor.identifyClauses(contractText);

            expect(Array.isArray(clauses)).toBe(true);
            expect(clauses.length).toBeGreaterThan(0);

            clauses.forEach(clause => {
                expect(clause).toHaveProperty('id');
                expect(clause).toHaveProperty('text');
                expect(clause).toHaveProperty('startPosition');
                expect(clause).toHaveProperty('endPosition');
            });
        });

        it('should categorize clauses by type', async () => {
            const clauses = [
                { id: 'c1', text: 'Payment shall be due within 30 days', startPosition: 0, endPosition: 35 },
                { id: 'c2', text: 'Either party may terminate this agreement', startPosition: 36, endPosition: 76 }
            ];

            const categorized = await clauseExtractor.categorizeClauses(clauses);

            expect(categorized.length).toBe(2);
            expect(categorized[0]).toHaveProperty('type');
            expect(categorized[0]).toHaveProperty('confidence');
            expect(categorized[1]).toHaveProperty('type');
            expect(categorized[1]).toHaveProperty('confidence');
        });

        it('should group clauses by type', () => {
            const categorizedClauses = [
                { id: 'c1', text: 'Payment clause', type: 'payment_terms', confidence: 0.9, startPosition: 0, endPosition: 14 },
                { id: 'c2', text: 'Another payment clause', type: 'payment_terms', confidence: 0.8, startPosition: 15, endPosition: 37 },
                { id: 'c3', text: 'Termination clause', type: 'termination_clause', confidence: 0.95, startPosition: 38, endPosition: 56 }
            ];

            const grouped = clauseExtractor.groupClausesByType(categorizedClauses);

            expect(grouped).toHaveProperty('payment_terms');
            expect(grouped).toHaveProperty('termination_clause');
            expect(grouped.payment_terms.count).toBe(2);
            expect(grouped.termination_clause.count).toBe(1);
            expect(grouped.payment_terms.clauses.length).toBe(2);
        });
    });

    describe('RiskAnalyzer', () => {
        let riskAnalyzer;

        beforeEach(() => {
            riskAnalyzer = new RiskAnalyzer();
        });

        it('should initialize with default configuration', () => {
            expect(riskAnalyzer).toBeDefined();
            expect(riskAnalyzer.riskCategories).toBeDefined();
            expect(riskAnalyzer.riskLevels).toBeDefined();
        });

        it('should analyze risks from clauses using rule-based approach', async () => {
            const clauses = [
                {
                    id: 'clause_1',
                    text: 'Payment shall be due within ninety (90) days of invoice receipt.',
                    type: 'payment_terms',
                    category: 'Payment',
                    confidence: 0.95
                },
                {
                    id: 'clause_2',
                    text: 'Liability shall be unlimited for all damages.',
                    type: 'liability_limitation',
                    category: 'Liability',
                    confidence: 0.88
                }
            ];

            const result = await riskAnalyzer.analyzeRisks(clauses);

            expect(result).toHaveProperty('risks');
            expect(result).toHaveProperty('summary');
            expect(Array.isArray(result.risks)).toBe(true);
            expect(result.risks.length).toBeGreaterThan(0);

            // Check risk structure
            const firstRisk = result.risks[0];
            expect(firstRisk).toHaveProperty('id');
            expect(firstRisk).toHaveProperty('title');
            expect(firstRisk).toHaveProperty('description');
            expect(firstRisk).toHaveProperty('severity');
            expect(firstRisk).toHaveProperty('category');
            expect(firstRisk).toHaveProperty('affectedClauses');
            expect(firstRisk).toHaveProperty('confidence');
        });

        it('should assign appropriate risk levels', async () => {
            const highRiskClause = {
                id: 'clause_1',
                text: 'Liability is unlimited and includes all consequential damages.',
                type: 'liability_limitation',
                category: 'Liability',
                confidence: 0.95
            };

            const result = await riskAnalyzer.analyzeRisks([highRiskClause]);

            expect(result.risks.length).toBeGreaterThan(0);
            const risk = result.risks[0];
            expect(['Low', 'Medium', 'High', 'Critical']).toContain(risk.severity);
        });

        it('should provide risk explanations', async () => {
            const clause = {
                id: 'clause_1',
                text: 'Payment terms are net 120 days.',
                type: 'payment_terms',
                category: 'Payment',
                confidence: 0.90
            };

            const result = await riskAnalyzer.analyzeRisks([clause]);

            if (result.risks.length > 0) {
                result.risks.forEach(risk => {
                    expect(risk.description).toBeDefined();
                    expect(risk.description.length).toBeGreaterThan(10);
                    expect(typeof risk.description).toBe('string');
                });
            }
        });

        it('should generate mitigation recommendations', async () => {
            const clause = {
                id: 'clause_1',
                text: 'Liability is unlimited for all damages.',
                type: 'liability_limitation',
                category: 'Liability',
                confidence: 0.85
            };

            const result = await riskAnalyzer.analyzeRisks([clause]);

            if (result.risks.length > 0) {
                result.risks.forEach(risk => {
                    expect(risk.mitigation).toBeDefined();
                    expect(risk.mitigation.length).toBeGreaterThan(10);
                    expect(typeof risk.mitigation).toBe('string');
                });
            }
        });

        it('should prioritize risks by severity', async () => {
            const clauses = [
                {
                    id: 'low_risk',
                    text: 'Standard payment terms of 30 days.',
                    type: 'payment_terms',
                    category: 'Payment',
                    confidence: 0.95
                },
                {
                    id: 'high_risk',
                    text: 'Unlimited liability for all damages including consequential.',
                    type: 'liability_limitation',
                    category: 'Liability',
                    confidence: 0.90
                }
            ];

            const result = await riskAnalyzer.analyzeRisks(clauses);

            expect(result.summary).toHaveProperty('riskDistribution');
            expect(result.summary).toHaveProperty('highestRisk');
            expect(result.summary.riskDistribution).toBeDefined();
        });

        it('should handle empty clause arrays', async () => {
            const result = await riskAnalyzer.analyzeRisks([]);

            expect(result.risks).toEqual([]);
            expect(result.summary).toBeDefined();
            expect(result.summary.totalRisks).toBe(0);
        });

        it('should validate risk confidence scores', async () => {
            const clause = {
                id: 'clause_1',
                text: 'Payment shall be due within ninety days.',
                type: 'payment_terms',
                category: 'Payment',
                confidence: 0.80
            };

            const result = await riskAnalyzer.analyzeRisks([clause]);

            result.risks.forEach(risk => {
                expect(risk.confidence).toBeGreaterThanOrEqual(0);
                expect(risk.confidence).toBeLessThanOrEqual(1);
                expect(typeof risk.confidence).toBe('number');
            });
        });

        it('should get risk categories and levels', () => {
            const categories = riskAnalyzer.getRiskCategories();
            const levels = riskAnalyzer.getRiskLevels();

            expect(Array.isArray(categories)).toBe(true);
            expect(Array.isArray(levels)).toBe(true);
            expect(categories.length).toBeGreaterThan(0);
            expect(levels).toEqual(['Low', 'Medium', 'High', 'Critical']);
        });

        it('should prioritize risks correctly', async () => {
            const risks = [
                {
                    id: 'risk_1',
                    title: 'Low Risk',
                    severity: 'Low',
                    confidence: 0.8,
                    riskScore: 0.3,
                    businessImpact: 'Low'
                },
                {
                    id: 'risk_2',
                    title: 'High Risk',
                    severity: 'High',
                    confidence: 0.9,
                    riskScore: 0.8,
                    businessImpact: 'High'
                }
            ];

            const result = await riskAnalyzer.prioritizeRisks(risks);

            expect(result).toHaveProperty('prioritized');
            expect(result).toHaveProperty('summary');
            expect(result.prioritized.length).toBe(2);
            expect(result.prioritized[0].priorityRank).toBe(1);
            expect(result.prioritized[1].priorityRank).toBe(2);

            // Higher risk should be prioritized first
            expect(result.prioritized[0].severity).toBe('High');
        });
    });

    describe('DocumentParser', () => {
        let documentParser;

        beforeEach(() => {
            documentParser = new DocumentParser();
        });

        it('should initialize with supported formats', () => {
            expect(documentParser.supportedFormats).toContain('pdf');
            expect(documentParser.supportedFormats).toContain('docx');
            expect(documentParser.supportedFormats).toContain('txt');
        });

        it('should parse plain text documents', async () => {
            const textContent = "This is a test contract document with various clauses.";
            const result = await documentParser.parseDocument(textContent, 'txt');

            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('metadata');
            expect(result.text).toBe(textContent);
            expect(result.metadata.format).toBe('txt');
            expect(result.metadata.wordCount).toBeGreaterThan(0);
            expect(result.metadata.characterCount).toBe(textContent.length);
        });

        it('should validate input correctly', () => {
            // Valid inputs should not throw
            expect(() => documentParser.validateInput("test", "txt")).not.toThrow();
            expect(() => documentParser.validateInput(Buffer.from("test"), "pdf")).not.toThrow();

            // Invalid inputs should throw
            expect(() => documentParser.validateInput("", "txt")).toThrow();
            expect(() => documentParser.validateInput(null, "txt")).toThrow();
            expect(() => documentParser.validateInput("test", "")).toThrow();
            expect(() => documentParser.validateInput("test", "invalid")).toThrow();
        });

        it('should clean text properly', () => {
            const dirtyText = "  This   is\r\n\r\n\r\na   test\t\tdocument  \n\n\n  ";
            const cleanText = documentParser.cleanText(dirtyText);

            expect(cleanText).not.toMatch(/\r/);
            expect(cleanText).not.toMatch(/\t/);
            expect(cleanText).not.toMatch(/   +/); // No triple spaces
            expect(cleanText).not.toMatch(/\n{3,}/); // No triple newlines
            expect(cleanText.trim()).toBe(cleanText); // No leading/trailing whitespace
        });

        it('should count words accurately', () => {
            expect(documentParser.countWords("")).toBe(0);
            expect(documentParser.countWords("word")).toBe(1);
            expect(documentParser.countWords("two words")).toBe(2);
            expect(documentParser.countWords("  multiple   spaces   between  ")).toBe(3);
            expect(documentParser.countWords("punctuation, counts! as? separate.")).toBe(4);
        });

        it('should check format support', () => {
            expect(documentParser.isFormatSupported('pdf')).toBe(true);
            expect(documentParser.isFormatSupported('PDF')).toBe(true);
            expect(documentParser.isFormatSupported('docx')).toBe(true);
            expect(documentParser.isFormatSupported('txt')).toBe(true);
            expect(documentParser.isFormatSupported('unsupported')).toBe(false);
        });

        it('should handle buffer inputs for text parsing', async () => {
            const textBuffer = Buffer.from("Test contract content", 'utf8');
            const result = await documentParser.parseDocument(textBuffer, 'txt');

            expect(result.text).toBe("Test contract content");
            expect(result.metadata.format).toBe('txt');
            expect(result.metadata.encoding).toBe('utf8');
        });

        it('should reject oversized documents', () => {
            const largeText = 'a'.repeat(documentParser.maxFileSize + 1);
            expect(() => documentParser.validateInput(largeText, 'txt')).toThrow(/exceeds maximum/);

            const largeBuffer = Buffer.alloc(documentParser.maxFileSize + 1);
            expect(() => documentParser.validateInput(largeBuffer, 'pdf')).toThrow(/exceeds maximum/);
        });

        it('should handle empty documents gracefully', () => {
            expect(() => documentParser.validateInput("", 'txt')).toThrow(/empty/);
            expect(() => documentParser.validateInput(Buffer.alloc(0), 'pdf')).toThrow(/empty/);
        });
    });

    describe('APIClient', () => {
        let apiClient;

        beforeEach(() => {
            apiClient = new APIClient({
                baseUrl: 'https://test-api.example.com',
                timeout: 5000,
                retryAttempts: 2
            });
        });

        afterEach(async () => {
            await apiClient.shutdown();
        });

        it('should initialize with configuration', () => {
            expect(apiClient.baseUrl).toBe('https://test-api.example.com');
            expect(apiClient.timeout).toBe(5000);
            expect(apiClient.retryAttempts).toBe(2);
        });

        it('should analyze contract and return structured response', async () => {
            const contractText = "This is a test contract with payment terms due in 30 days.";
            const result = await apiClient.analyzeContract(contractText);

            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('clauses');
            expect(result).toHaveProperty('risks');
            expect(result).toHaveProperty('recommendations');
            expect(result).toHaveProperty('metadata');

            expect(Array.isArray(result.clauses)).toBe(true);
            expect(Array.isArray(result.risks)).toBe(true);
            expect(Array.isArray(result.recommendations)).toBe(true);
        });

        it('should generate intelligent mock responses', async () => {
            const paymentText = "Payment shall be due within thirty (30) days of invoice receipt.";
            const result = await apiClient.analyzeContract(paymentText);

            // Should identify payment-related clauses
            const paymentClause = result.clauses.find(c => c.type === 'payment_terms');
            expect(paymentClause).toBeDefined();
            expect(paymentClause.category).toBe('Payment');

            // Should generate related risks
            const paymentRisk = result.risks.find(r => r.category === 'financial');
            expect(paymentRisk).toBeDefined();
        });

        it('should validate API responses', () => {
            const validResponse = {
                summary: {},
                clauses: [],
                risks: [],
                recommendations: []
            };

            expect(() => apiClient.validateAPIResponse(validResponse)).not.toThrow();

            const invalidResponse = {
                summary: {},
                clauses: []
                // Missing risks and recommendations
            };

            expect(() => apiClient.validateAPIResponse(invalidResponse)).toThrow(/missing required fields/);
        });

        it('should handle API errors appropriately', () => {
            const networkError = new Error('Network error');
            networkError.code = 'ECONNREFUSED';

            const processedError = apiClient.handleAPIErrors(networkError);
            expect(processedError.status).toBe(503);
            expect(processedError.code).toBe('SERVICE_UNAVAILABLE');

            const timeoutError = new Error('Timeout');
            timeoutError.code = 'ETIMEDOUT';

            const processedTimeout = apiClient.handleAPIErrors(timeoutError);
            expect(processedTimeout.status).toBe(408);
            expect(processedTimeout.code).toBe('TIMEOUT');
        });

        it('should update configuration at runtime', () => {
            const newConfig = {
                timeout: 10000,
                retryAttempts: 5,
                baseUrl: 'https://new-api.example.com'
            };

            apiClient.updateConfiguration(newConfig);

            expect(apiClient.timeout).toBe(10000);
            expect(apiClient.retryAttempts).toBe(5);
            expect(apiClient.baseUrl).toBe('https://new-api.example.com');
        });

        it('should provide status information', () => {
            const status = apiClient.getStatus();

            expect(status).toHaveProperty('baseUrl');
            expect(status).toHaveProperty('hasApiKey');
            expect(status).toHaveProperty('timeout');
            expect(status).toHaveProperty('retryAttempts');
            expect(status).toHaveProperty('rateLimiter');

            expect(typeof status.hasApiKey).toBe('boolean');
            expect(typeof status.rateLimiter).toBe('object');
        });

        it('should detect test environment correctly', () => {
            expect(apiClient.isTestEnvironment()).toBe(true);
        });

        it('should test connection', async () => {
            const result = await apiClient.testConnection();

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('status');
            expect(typeof result.success).toBe('boolean');
        });

        it('should handle HTTP response errors', () => {
            const httpError = new Error('HTTP Error');
            httpError.response = {
                status: 401,
                data: { message: 'Unauthorized' }
            };

            const processedError = apiClient.handleAPIErrors(httpError);
            expect(processedError.status).toBe(401);
            expect(processedError.code).toBe('AUTHENTICATION_FAILED');
            expect(processedError.message).toContain('authentication failed');
        });
    });

    describe('Integration Tests', () => {
        it('should work together in a complete analysis workflow', async () => {
            const documentParser = new DocumentParser();
            const clauseExtractor = new ClauseExtractor();
            const riskAnalyzer = new RiskAnalyzer();

            // Parse document
            const contractText = `
        This Service Agreement shall commence on January 1, 2024 and continue for twelve months.
        Payment shall be due within sixty (60) days of invoice receipt.
        Either party may terminate this agreement with thirty days written notice.
        Liability is limited to the total contract value.
      `;

            const parsedDoc = await documentParser.parseDocument(contractText, 'txt');
            expect(parsedDoc.text).toBeDefined();

            // Extract clauses
            const clauseResult = await clauseExtractor.extractClauses(parsedDoc.text);
            expect(clauseResult.clauses.length).toBeGreaterThan(0);

            // Analyze risks
            const riskResult = await riskAnalyzer.analyzeRisks(clauseResult.clauses);
            expect(riskResult.risks.length).toBeGreaterThanOrEqual(0);

            // Verify complete workflow
            expect(clauseResult.clauses.every(c => c.confidence >= 0)).toBe(true);
            expect(riskResult.summary).toBeDefined();
        });

        it('should handle error propagation correctly', async () => {
            const documentParser = new DocumentParser();

            // Test error handling in document parsing
            await expect(documentParser.parseDocument('', 'txt')).rejects.toThrow();
            await expect(documentParser.parseDocument(null, 'txt')).rejects.toThrow();
            await expect(documentParser.parseDocument('test', 'invalid')).rejects.toThrow();
        });
    });
});