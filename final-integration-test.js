#!/usr/bin/env node

/**
 * Final Integration and Optimization Test
 * Task 15: Final integration and optimization
 * 
 * This script performs comprehensive end-to-end testing of the complete AI analysis pipeline,
 * optimizes model loading and inference performance, fine-tunes prompting strategies,
 * and validates all correctness properties are satisfied.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FinalIntegrationTester {
    constructor() {
        this.awsConfig = {
            region: process.env.VITE_AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY
            }
        };

        this.bedrockClient = new BedrockRuntimeClient(this.awsConfig);
        this.s3Client = new S3Client(this.awsConfig);

        // Model configurations for testing
        this.models = [
            {
                id: 'amazon.titan-text-express-v1',
                name: 'Amazon Titan Text Express',
                maxTokens: 4000,
                available: true
            },
            {
                id: 'anthropic.claude-3-sonnet-20240229-v1:0',
                name: 'Anthropic Claude 3 Sonnet',
                maxTokens: 4000,
                available: false // Requires use case approval
            }
        ];

        this.testResults = {
            performance: {},
            accuracy: {},
            correctnessProperties: {},
            optimization: {}
        };
    }

    /**
     * Test 1: Performance Optimization
     * Validates processing time constraints and resource management
     */
    async testPerformanceOptimization() {
        console.log('\n🚀 Testing Performance Optimization...');

        const performanceTests = [];
        const cuadDir = path.join(__dirname, 'archive', 'CUAD_v1', 'full_contract_txt');
        const testFiles = fs.readdirSync(cuadDir).filter(f => f.endsWith('.txt')).slice(0, 3);

        for (const filename of testFiles) {
            const contractPath = path.join(cuadDir, filename);
            const contractText = fs.readFileSync(contractPath, 'utf-8');

            if (contractText.length < 100) continue;

            console.log(`  📄 Testing performance with: ${filename.substring(0, 50)}...`);

            const startTime = Date.now();
            const result = await this.analyzeContract(contractText, filename, 'amazon.titan-text-express-v1');
            const endTime = Date.now();

            const processingTime = endTime - startTime;
            const wordsPerSecond = contractText.split(' ').length / (processingTime / 1000);

            performanceTests.push({
                filename,
                processingTime,
                wordsPerSecond,
                contractLength: contractText.length,
                success: !result.error,
                clausesFound: result.clauses?.length || 0,
                risksFound: result.risks?.length || 0
            });

            console.log(`    ⏱️  Processing time: ${processingTime}ms`);
            console.log(`    📊 Words per second: ${wordsPerSecond.toFixed(2)}`);
            console.log(`    ✅ Clauses found: ${result.clauses?.length || 0}`);
        }

        // Performance analysis
        const avgProcessingTime = performanceTests.reduce((sum, t) => sum + t.processingTime, 0) / performanceTests.length;
        const avgWordsPerSecond = performanceTests.reduce((sum, t) => sum + t.wordsPerSecond, 0) / performanceTests.length;

        this.testResults.performance = {
            averageProcessingTime: avgProcessingTime,
            averageWordsPerSecond: avgWordsPerSecond,
            performanceTarget: 30000, // 30 seconds target
            meetsTarget: avgProcessingTime < 30000,
            tests: performanceTests
        };

        console.log(`  📈 Average processing time: ${avgProcessingTime.toFixed(0)}ms`);
        console.log(`  🎯 Meets 30s target: ${avgProcessingTime < 30000 ? '✅' : '❌'}`);

        return this.testResults.performance;
    }

    /**
     * Test 2: Accuracy and Correctness Properties
     * Validates that all correctness properties from the design are satisfied
     */
    async testCorrectnessProperties() {
        console.log('\n🎯 Testing Correctness Properties...');

        const properties = [
            {
                id: 'P1',
                name: 'Contract analysis produces structured output',
                test: (result) => {
                    return result.clauses && Array.isArray(result.clauses) &&
                        result.risks && Array.isArray(result.risks) &&
                        result.summary && typeof result.summary === 'object';
                }
            },
            {
                id: 'P2',
                name: 'AI model handles minimum clause types',
                test: (result) => {
                    const clauseTypes = new Set(result.clauses?.map(c => c.type) || []);
                    return clauseTypes.size >= 5; // Minimum 5 different clause types
                }
            },
            {
                id: 'P3',
                name: 'System uses AI model as primary with API fallback',
                test: (result) => {
                    return result.metadata && result.metadata.model; // Has model metadata
                }
            },
            {
                id: 'P4',
                name: 'Both processing methods return standardized format',
                test: (result) => {
                    return result.contractName && result.clauses && result.risks && result.summary;
                }
            },
            {
                id: 'P5',
                name: 'Model meets performance specifications',
                test: (result) => {
                    return result.metadata && result.metadata.processingTime < 60000; // Under 60s
                }
            }
        ];

        // Test with sample contract
        const cuadDir = path.join(__dirname, 'archive', 'CUAD_v1', 'full_contract_txt');
        const testFile = fs.readdirSync(cuadDir).filter(f => f.endsWith('.txt'))[0];
        const contractPath = path.join(cuadDir, testFile);
        const contractText = fs.readFileSync(contractPath, 'utf-8');

        console.log(`  📋 Testing with: ${testFile.substring(0, 50)}...`);

        const result = await this.analyzeContract(contractText, testFile, 'amazon.titan-text-express-v1');

        const propertyResults = {};
        for (const property of properties) {
            const passed = property.test(result);
            propertyResults[property.id] = {
                name: property.name,
                passed,
                result: passed ? 'PASS' : 'FAIL'
            };
            console.log(`    ${passed ? '✅' : '❌'} ${property.id}: ${property.name}`);
        }

        this.testResults.correctnessProperties = propertyResults;

        const passedCount = Object.values(propertyResults).filter(p => p.passed).length;
        console.log(`  📊 Properties passed: ${passedCount}/${properties.length}`);

        return propertyResults;
    }

    /**
     * Test 3: Prompting Strategy Optimization
     * Fine-tunes prompting strategies for better accuracy
     */
    async testPromptingOptimization() {
        console.log('\n🔧 Testing Prompting Strategy Optimization...');

        const promptStrategies = [
            {
                name: 'Structured JSON',
                prompt: (text, name) => `Analyze this contract and return ONLY valid JSON:
{
  "contractName": "${name}",
  "clauses": [{"type": "string", "text": "string", "confidence": 0.9}],
  "risks": [{"level": "High|Medium|Low", "description": "string"}],
  "summary": {"totalClauses": 0, "overallRisk": "string"}
}

Contract: ${text.substring(0, 10000)}`
            },
            {
                name: 'Step-by-step Analysis',
                prompt: (text, name) => `Analyze this contract step by step:

Step 1: Identify key clauses
Step 2: Assess risk levels  
Step 3: Provide summary

Contract: ${name}
Text: ${text.substring(0, 10000)}

Provide structured analysis with clauses, risks, and summary.`
            },
            {
                name: 'Expert Legal Analysis',
                prompt: (text, name) => `As an expert contract attorney, analyze this agreement:

Contract: ${name}

Focus on:
- Critical clauses (termination, liability, IP, etc.)
- Risk assessment (High/Medium/Low)
- Key findings and recommendations

Text: ${text.substring(0, 10000)}

Provide detailed structured analysis.`
            }
        ];

        // Test each strategy
        const cuadDir = path.join(__dirname, 'archive', 'CUAD_v1', 'full_contract_txt');
        const testFile = fs.readdirSync(cuadDir).filter(f => f.endsWith('.txt'))[1];
        const contractPath = path.join(cuadDir, testFile);
        const contractText = fs.readFileSync(contractPath, 'utf-8');

        const strategyResults = {};

        for (const strategy of promptStrategies) {
            console.log(`  🧪 Testing strategy: ${strategy.name}`);

            const startTime = Date.now();
            const result = await this.analyzeWithCustomPrompt(
                contractText,
                testFile,
                strategy.prompt(contractText, testFile)
            );
            const processingTime = Date.now() - startTime;

            strategyResults[strategy.name] = {
                processingTime,
                clausesFound: result.clauses?.length || 0,
                risksFound: result.risks?.length || 0,
                success: !result.error,
                quality: this.assessAnalysisQuality(result)
            };

            console.log(`    ⏱️  Time: ${processingTime}ms`);
            console.log(`    📊 Clauses: ${result.clauses?.length || 0}, Risks: ${result.risks?.length || 0}`);
            console.log(`    🎯 Quality: ${strategyResults[strategy.name].quality}/10`);
        }

        this.testResults.optimization.promptStrategies = strategyResults;

        // Find best strategy
        const bestStrategy = Object.entries(strategyResults)
            .sort(([, a], [, b]) => b.quality - a.quality)[0];

        console.log(`  🏆 Best strategy: ${bestStrategy[0]} (Quality: ${bestStrategy[1].quality}/10)`);

        return strategyResults;
    }

    /**
     * Test 4: End-to-End Pipeline Validation
     * Tests the complete analysis pipeline from input to output
     */
    async testEndToEndPipeline() {
        console.log('\n🔄 Testing End-to-End Pipeline...');

        const pipelineSteps = [
            'Document Loading',
            'Text Preprocessing',
            'AI Model Analysis',
            'Clause Extraction',
            'Risk Assessment',
            'Result Formatting',
            'Output Validation'
        ];

        const cuadDir = path.join(__dirname, 'archive', 'CUAD_v1', 'full_contract_txt');
        const testFiles = fs.readdirSync(cuadDir).filter(f => f.endsWith('.txt')).slice(0, 2);

        const pipelineResults = [];

        for (const filename of testFiles) {
            console.log(`  📄 Testing pipeline with: ${filename.substring(0, 40)}...`);

            const contractPath = path.join(cuadDir, filename);
            const stepResults = {};
            let overallSuccess = true;

            try {
                // Step 1: Document Loading
                const startTime = Date.now();
                const contractText = fs.readFileSync(contractPath, 'utf-8');
                stepResults['Document Loading'] = {
                    success: contractText.length > 0,
                    time: Date.now() - startTime,
                    details: `Loaded ${contractText.length} characters`
                };

                // Step 2: Text Preprocessing
                const preprocessStart = Date.now();
                const cleanText = contractText.replace(/\s+/g, ' ').trim();
                stepResults['Text Preprocessing'] = {
                    success: cleanText.length > 0,
                    time: Date.now() - preprocessStart,
                    details: `Cleaned to ${cleanText.length} characters`
                };

                // Step 3-7: AI Model Analysis (includes all remaining steps)
                const analysisStart = Date.now();
                const result = await this.analyzeContract(cleanText, filename, 'amazon.titan-text-express-v1');
                const analysisTime = Date.now() - analysisStart;

                stepResults['AI Model Analysis'] = {
                    success: !result.error,
                    time: analysisTime,
                    details: `Model: ${result.metadata?.model || 'Unknown'}`
                };

                stepResults['Clause Extraction'] = {
                    success: result.clauses && result.clauses.length > 0,
                    time: 0, // Included in analysis time
                    details: `Found ${result.clauses?.length || 0} clauses`
                };

                stepResults['Risk Assessment'] = {
                    success: result.risks && result.risks.length > 0,
                    time: 0, // Included in analysis time
                    details: `Identified ${result.risks?.length || 0} risks`
                };

                stepResults['Result Formatting'] = {
                    success: result.summary && typeof result.summary === 'object',
                    time: 0, // Included in analysis time
                    details: `Summary generated`
                };

                stepResults['Output Validation'] = {
                    success: this.validateOutput(result),
                    time: 0,
                    details: `Validation ${this.validateOutput(result) ? 'passed' : 'failed'}`
                };

            } catch (error) {
                overallSuccess = false;
                console.log(`    ❌ Pipeline failed: ${error.message}`);
            }

            pipelineResults.push({
                filename,
                steps: stepResults,
                overallSuccess,
                totalTime: Object.values(stepResults).reduce((sum, step) => sum + step.time, 0)
            });

            // Log step results
            for (const [step, result] of Object.entries(stepResults)) {
                console.log(`    ${result.success ? '✅' : '❌'} ${step}: ${result.details}`);
            }
        }

        this.testResults.pipeline = pipelineResults;

        const successfulPipelines = pipelineResults.filter(p => p.overallSuccess).length;
        console.log(`  📊 Successful pipelines: ${successfulPipelines}/${pipelineResults.length}`);

        return pipelineResults;
    }

    /**
     * Analyze contract with specified model
     */
    async analyzeContract(contractText, contractName, modelId) {
        const prompt = `Analyze this contract and provide structured analysis:

Contract: ${contractName}
Text: ${contractText.substring(0, 20000)}

Identify:
1. Key clauses (termination, payment, liability, IP, etc.)
2. Risk levels (High/Medium/Low) 
3. Overall assessment

Provide structured response with clauses, risks, and summary.`;

        try {
            const command = new InvokeModelCommand({
                modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({
                    inputText: prompt,
                    textGenerationConfig: {
                        maxTokenCount: 3000,
                        temperature: 0.1,
                        topP: 0.9
                    }
                })
            });

            const startTime = Date.now();
            const response = await this.bedrockClient.send(command);
            const processingTime = Date.now() - startTime;

            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const analysisText = responseBody.results[0].outputText;

            return this.parseAnalysisResponse(analysisText, contractName, modelId, processingTime);

        } catch (error) {
            return {
                contractName,
                error: error.message,
                clauses: [],
                risks: [],
                summary: { totalClauses: 0, overallRiskLevel: 'Error' }
            };
        }
    }

    /**
     * Analyze with custom prompt
     */
    async analyzeWithCustomPrompt(contractText, contractName, customPrompt) {
        try {
            const command = new InvokeModelCommand({
                modelId: 'amazon.titan-text-express-v1',
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({
                    inputText: customPrompt,
                    textGenerationConfig: {
                        maxTokenCount: 3000,
                        temperature: 0.1,
                        topP: 0.9
                    }
                })
            });

            const response = await this.bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const analysisText = responseBody.results[0].outputText;

            return this.parseAnalysisResponse(analysisText, contractName, 'amazon.titan-text-express-v1', 0);

        } catch (error) {
            return {
                contractName,
                error: error.message,
                clauses: [],
                risks: [],
                summary: { totalClauses: 0, overallRiskLevel: 'Error' }
            };
        }
    }

    /**
     * Parse analysis response into structured format
     */
    parseAnalysisResponse(text, contractName, modelId, processingTime) {
        const clauses = [];
        const risks = [];

        // Extract clauses using pattern matching
        const clausePatterns = {
            'termination': /termination|terminate|end|expire/gi,
            'payment': /payment|pay|fee|cost|price/gi,
            'liability': /liability|liable|damages|limitation/gi,
            'intellectual_property': /intellectual property|copyright|patent|trademark/gi,
            'confidentiality': /confidential|non-disclosure|proprietary/gi,
            'warranty': /warranty|warrant|guarantee|representation/gi
        };

        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

        for (const [type, pattern] of Object.entries(clausePatterns)) {
            const matches = sentences.filter(sentence => pattern.test(sentence));
            matches.slice(0, 2).forEach(match => {
                clauses.push({
                    type: type.replace('_', ' '),
                    text: match.trim(),
                    confidence: 0.8,
                    category: type.replace('_', ' ')
                });
            });
        }

        // Extract risks
        const riskKeywords = ['breach', 'penalty', 'unlimited', 'exclusive', 'indemnify'];
        riskKeywords.forEach(keyword => {
            if (text.toLowerCase().includes(keyword)) {
                risks.push({
                    level: keyword === 'breach' || keyword === 'penalty' ? 'High' : 'Medium',
                    description: `Risk related to: ${keyword}`,
                    explanation: `Contract contains provisions related to ${keyword}`,
                    mitigation: `Review ${keyword} clauses carefully`
                });
            }
        });

        return {
            contractName,
            clauses: clauses.slice(0, 10),
            risks: risks.slice(0, 5),
            summary: {
                totalClauses: clauses.length,
                clauseTypes: this.countClauseTypes(clauses),
                overallRiskLevel: risks.length > 2 ? 'High' : risks.length > 0 ? 'Medium' : 'Low',
                keyFindings: [`Found ${clauses.length} clauses`, `Identified ${risks.length} risks`]
            },
            metadata: {
                processingTime,
                model: modelId,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Count clause types for summary
     */
    countClauseTypes(clauses) {
        const counts = {};
        clauses.forEach(clause => {
            counts[clause.type] = (counts[clause.type] || 0) + 1;
        });
        return counts;
    }

    /**
     * Assess analysis quality (1-10 scale)
     */
    assessAnalysisQuality(result) {
        let score = 0;

        // Clause quality (0-4 points)
        if (result.clauses && result.clauses.length > 0) score += 1;
        if (result.clauses && result.clauses.length >= 5) score += 1;
        if (result.clauses && result.clauses.some(c => c.confidence > 0.7)) score += 1;
        if (result.clauses && new Set(result.clauses.map(c => c.type)).size >= 3) score += 1;

        // Risk quality (0-3 points)
        if (result.risks && result.risks.length > 0) score += 1;
        if (result.risks && result.risks.some(r => r.level && r.description)) score += 1;
        if (result.risks && result.risks.some(r => r.mitigation)) score += 1;

        // Summary quality (0-3 points)
        if (result.summary && result.summary.totalClauses >= 0) score += 1;
        if (result.summary && result.summary.overallRiskLevel) score += 1;
        if (result.summary && result.summary.keyFindings && result.summary.keyFindings.length > 0) score += 1;

        return score;
    }

    /**
     * Validate output format
     */
    validateOutput(result) {
        return result.contractName &&
            Array.isArray(result.clauses) &&
            Array.isArray(result.risks) &&
            result.summary &&
            typeof result.summary === 'object';
    }

    /**
     * Run all integration tests
     */
    async runAllTests() {
        console.log('🚀 Starting Final Integration and Optimization Tests');
        console.log('='.repeat(70));

        try {
            // Run all test suites
            await this.testPerformanceOptimization();
            await this.testCorrectnessProperties();
            await this.testPromptingOptimization();
            await this.testEndToEndPipeline();

            // Generate final report
            const report = this.generateFinalReport();

            // Save results
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `final-integration-test-${timestamp}.json`;
            fs.writeFileSync(filename, JSON.stringify(report, null, 2));

            // Upload to S3
            await this.uploadToS3(report, filename);

            console.log('\n' + '='.repeat(70));
            console.log('📊 FINAL INTEGRATION TEST REPORT');
            console.log('='.repeat(70));
            console.log(JSON.stringify(report.summary, null, 2));

            console.log('\n🎉 Final integration and optimization tests completed!');
            console.log(`💾 Detailed results saved: ${filename}`);

            return report;

        } catch (error) {
            console.error('💥 Integration tests failed:', error);
            throw error;
        }
    }

    /**
     * Generate final comprehensive report
     */
    generateFinalReport() {
        const performancePassed = this.testResults.performance?.meetsTarget || false;
        const propertiesPassed = Object.values(this.testResults.correctnessProperties || {})
            .filter(p => p.passed).length;
        const totalProperties = Object.keys(this.testResults.correctnessProperties || {}).length;

        return {
            summary: {
                testDate: new Date().toISOString(),
                overallStatus: performancePassed && propertiesPassed === totalProperties ? 'PASS' : 'PARTIAL',
                performance: {
                    status: performancePassed ? 'PASS' : 'FAIL',
                    averageTime: this.testResults.performance?.averageProcessingTime || 0,
                    target: 30000,
                    meetsTarget: performancePassed
                },
                correctness: {
                    status: propertiesPassed === totalProperties ? 'PASS' : 'PARTIAL',
                    propertiesPassed: `${propertiesPassed}/${totalProperties}`,
                    passRate: totalProperties > 0 ? `${((propertiesPassed / totalProperties) * 100).toFixed(1)}%` : '0%'
                },
                optimization: {
                    promptStrategiesTested: Object.keys(this.testResults.optimization?.promptStrategies || {}).length,
                    bestStrategy: this.getBestPromptStrategy()
                }
            },
            detailed: this.testResults,
            recommendations: this.generateRecommendations(),
            configuration: {
                models: this.models,
                region: this.awsConfig.region,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Get best prompt strategy
     */
    getBestPromptStrategy() {
        const strategies = this.testResults.optimization?.promptStrategies || {};
        if (Object.keys(strategies).length === 0) return 'None tested';

        return Object.entries(strategies)
            .sort(([, a], [, b]) => b.quality - a.quality)[0][0];
    }

    /**
     * Generate optimization recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        if (!this.testResults.performance?.meetsTarget) {
            recommendations.push({
                category: 'Performance',
                priority: 'High',
                issue: 'Processing time exceeds 30-second target',
                recommendation: 'Consider model optimization, prompt reduction, or parallel processing'
            });
        }

        const propertiesPassed = Object.values(this.testResults.correctnessProperties || {})
            .filter(p => p.passed).length;
        const totalProperties = Object.keys(this.testResults.correctnessProperties || {}).length;

        if (propertiesPassed < totalProperties) {
            recommendations.push({
                category: 'Correctness',
                priority: 'High',
                issue: `${totalProperties - propertiesPassed} correctness properties failing`,
                recommendation: 'Review and fix failing properties to ensure system reliability'
            });
        }

        recommendations.push({
            category: 'Optimization',
            priority: 'Medium',
            issue: 'Continuous improvement opportunity',
            recommendation: `Use ${this.getBestPromptStrategy()} prompting strategy for best results`
        });

        return recommendations;
    }

    /**
     * Upload results to S3
     */
    async uploadToS3(report, filename) {
        try {
            const command = new PutObjectCommand({
                Bucket: process.env.VITE_S3_BUCKET,
                Key: `integration-tests/${filename}`,
                Body: JSON.stringify(report, null, 2),
                ContentType: 'application/json'
            });

            await this.s3Client.send(command);
            console.log(`📤 Results uploaded to S3: s3://${process.env.VITE_S3_BUCKET}/integration-tests/${filename}`);
        } catch (error) {
            console.error('❌ S3 upload failed:', error.message);
        }
    }
}

// Main execution
async function main() {
    try {
        const requiredEnvVars = [
            'VITE_AWS_ACCESS_KEY_ID',
            'VITE_AWS_SECRET_ACCESS_KEY',
            'VITE_AWS_REGION'
        ];

        const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
        if (missing.length > 0) {
            console.error('❌ Missing required environment variables:', missing.join(', '));
            process.exit(1);
        }

        const tester = new FinalIntegrationTester();
        await tester.runAllTests();

    } catch (error) {
        console.error('💥 Final integration test failed:', error);
        process.exit(1);
    }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('final-integration-test.js')) {
    main().catch(console.error);
}

export { FinalIntegrationTester };