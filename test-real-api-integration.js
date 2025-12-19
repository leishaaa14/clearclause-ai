#!/usr/bin/env node

/**
 * Real API Integration Test
 * Tests the AI contract analysis system with real AWS Bedrock API calls
 * using actual CUAD dataset contracts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AWS Configuration
const awsConfig = {
    region: process.env.VITE_AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY
    }
};

const bedrockClient = new BedrockRuntimeClient(awsConfig);
const s3Client = new S3Client(awsConfig);
const textractClient = new TextractClient(awsConfig);

class RealAPIContractAnalyzer {
    constructor() {
        this.modelId = process.env.VITE_BEDROCK_MODEL || 'anthropic.claude-3-sonnet-20240229-v1:0';
        this.s3Bucket = process.env.VITE_S3_BUCKET || 'impactxaws-docs';
        this.results = [];
    }

    /**
     * Analyze contract using AWS Bedrock Claude 3 Sonnet
     */
    async analyzeWithBedrock(contractText, contractName) {
        console.log(`🤖 Analyzing ${contractName} with Bedrock Claude 3 Sonnet...`);

        const prompt = `You are an expert contract analyst. Analyze the following contract and provide a structured analysis.

Contract Text:
${contractText.substring(0, 50000)} ${contractText.length > 50000 ? '...[truncated]' : ''}

Please provide your analysis in the following JSON format:
{
    "contractName": "${contractName}",
    "clauses": [
        {
            "type": "clause_type",
            "text": "clause text",
            "confidence": 0.95,
            "category": "category_name"
        }
    ],
    "risks": [
        {
            "level": "High|Medium|Low|Critical",
            "description": "risk description",
            "explanation": "detailed explanation",
            "mitigation": "recommended mitigation"
        }
    ],
    "summary": {
        "totalClauses": 0,
        "clauseTypes": {},
        "overallRiskLevel": "Medium",
        "keyFindings": []
    }
}

Focus on identifying these clause types:
- Termination clauses
- Payment terms
- Liability limitations
- Intellectual property rights
- Confidentiality provisions
- Force majeure clauses
- Governing law
- Dispute resolution
- Indemnification
- Non-compete clauses
- Assignment rights
- Warranty provisions`;

        try {
            const command = new InvokeModelCommand({
                modelId: this.modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({
                    anthropic_version: 'bedrock-2023-05-31',
                    max_tokens: 4000,
                    temperature: 0.1,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });

            const startTime = Date.now();
            const response = await bedrockClient.send(command);
            const processingTime = Date.now() - startTime;

            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const analysisText = responseBody.content[0].text;

            // Try to extract JSON from the response
            let analysis;
            try {
                const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    analysis = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback: create structured response from text
                    analysis = this.parseTextResponse(analysisText, contractName);
                }
            } catch (parseError) {
                console.warn(`⚠️  JSON parsing failed for ${contractName}, using text parsing fallback`);
                analysis = this.parseTextResponse(analysisText, contractName);
            }

            // Add metadata
            analysis.metadata = {
                processingTime,
                model: this.modelId,
                timestamp: new Date().toISOString(),
                tokenUsage: responseBody.usage || {}
            };

            return analysis;

        } catch (error) {
            console.error(`❌ Bedrock analysis failed for ${contractName}:`, error.message);
            return {
                contractName,
                error: error.message,
                clauses: [],
                risks: [],
                summary: { totalClauses: 0, clauseTypes: {}, overallRiskLevel: 'Unknown', keyFindings: [] }
            };
        }
    }

    /**
     * Fallback text parsing when JSON extraction fails
     */
    parseTextResponse(text, contractName) {
        const clauses = [];
        const risks = [];

        // Simple pattern matching for common clause types
        const clausePatterns = {
            'termination': /termination|terminate|end|expire/gi,
            'payment': /payment|pay|fee|cost|price|compensation/gi,
            'liability': /liability|liable|responsible|damages/gi,
            'intellectual_property': /intellectual property|copyright|patent|trademark/gi,
            'confidentiality': /confidential|non-disclosure|proprietary/gi
        };

        // Extract potential clauses
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

        for (const [type, pattern] of Object.entries(clausePatterns)) {
            const matches = sentences.filter(sentence => pattern.test(sentence));
            matches.forEach(match => {
                clauses.push({
                    type,
                    text: match.trim(),
                    confidence: 0.7,
                    category: type.replace('_', ' ')
                });
            });
        }

        // Extract risk indicators
        const riskKeywords = ['shall not', 'penalty', 'breach', 'default', 'violation'];
        riskKeywords.forEach(keyword => {
            if (text.toLowerCase().includes(keyword)) {
                risks.push({
                    level: 'Medium',
                    description: `Potential risk related to: ${keyword}`,
                    explanation: `Contract contains provisions related to ${keyword}`,
                    mitigation: `Review and understand implications of ${keyword} clauses`
                });
            }
        });

        return {
            contractName,
            clauses: clauses.slice(0, 10), // Limit to top 10
            risks: risks.slice(0, 5), // Limit to top 5
            summary: {
                totalClauses: clauses.length,
                clauseTypes: this.countClauseTypes(clauses),
                overallRiskLevel: risks.length > 3 ? 'High' : risks.length > 1 ? 'Medium' : 'Low',
                keyFindings: [`Found ${clauses.length} clauses`, `Identified ${risks.length} potential risks`]
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
     * Upload results to S3 for persistence
     */
    async uploadResultsToS3(results, filename) {
        try {
            const key = `analysis-results/${filename}`;
            const command = new PutObjectCommand({
                Bucket: this.s3Bucket,
                Key: key,
                Body: JSON.stringify(results, null, 2),
                ContentType: 'application/json'
            });

            await s3Client.send(command);
            console.log(`📤 Results uploaded to S3: s3://${this.s3Bucket}/${key}`);
            return key;
        } catch (error) {
            console.error('❌ S3 upload failed:', error.message);
            return null;
        }
    }

    /**
     * Test with sample CUAD contracts
     */
    async runTests() {
        console.log('🚀 Starting Real API Integration Tests with CUAD Dataset');
        console.log('='.repeat(60));

        const cuadDir = path.join(__dirname, 'archive', 'CUAD_v1', 'full_contract_txt');

        if (!fs.existsSync(cuadDir)) {
            console.error('❌ CUAD dataset not found at:', cuadDir);
            return;
        }

        // Get sample contracts (limit to 3 for testing)
        const contractFiles = fs.readdirSync(cuadDir)
            .filter(file => file.endsWith('.txt'))
            .slice(0, 3);

        console.log(`📄 Found ${contractFiles.length} contracts to analyze`);

        const results = [];

        for (const [index, filename] of contractFiles.entries()) {
            console.log(`\n📋 Processing ${index + 1}/${contractFiles.length}: ${filename}`);

            try {
                const contractPath = path.join(cuadDir, filename);
                const contractText = fs.readFileSync(contractPath, 'utf-8');

                if (contractText.length < 100) {
                    console.log('⏭️  Skipping empty/short contract');
                    continue;
                }

                const analysis = await this.analyzeWithBedrock(contractText, filename);
                results.push(analysis);

                // Log summary
                console.log(`✅ Analysis complete:`);
                console.log(`   - Clauses found: ${analysis.clauses?.length || 0}`);
                console.log(`   - Risks identified: ${analysis.risks?.length || 0}`);
                console.log(`   - Processing time: ${analysis.metadata?.processingTime || 'N/A'}ms`);

                // Add delay to respect rate limits
                if (index < contractFiles.length - 1) {
                    console.log('⏳ Waiting 2 seconds before next analysis...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                console.error(`❌ Failed to process ${filename}:`, error.message);
                results.push({
                    contractName: filename,
                    error: error.message,
                    clauses: [],
                    risks: [],
                    summary: { totalClauses: 0, clauseTypes: {}, overallRiskLevel: 'Error', keyFindings: [] }
                });
            }
        }

        // Generate comprehensive report
        const report = this.generateReport(results);

        // Save results locally
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const localFilename = `real-api-test-results-${timestamp}.json`;
        fs.writeFileSync(localFilename, JSON.stringify({ report, results }, null, 2));
        console.log(`💾 Results saved locally: ${localFilename}`);

        // Upload to S3
        await this.uploadResultsToS3({ report, results }, localFilename);

        // Display final report
        console.log('\n' + '='.repeat(60));
        console.log('📊 FINAL TEST REPORT');
        console.log('='.repeat(60));
        console.log(JSON.stringify(report, null, 2));

        return { report, results };
    }

    /**
     * Generate comprehensive test report
     */
    generateReport(results) {
        const successful = results.filter(r => !r.error);
        const failed = results.filter(r => r.error);

        const totalClauses = successful.reduce((sum, r) => sum + (r.clauses?.length || 0), 0);
        const totalRisks = successful.reduce((sum, r) => sum + (r.risks?.length || 0), 0);
        const avgProcessingTime = successful.length > 0
            ? successful.reduce((sum, r) => sum + (r.metadata?.processingTime || 0), 0) / successful.length
            : 0;

        // Clause type distribution
        const clauseTypeDistribution = {};
        successful.forEach(result => {
            result.clauses?.forEach(clause => {
                clauseTypeDistribution[clause.type] = (clauseTypeDistribution[clause.type] || 0) + 1;
            });
        });

        // Risk level distribution
        const riskLevelDistribution = {};
        successful.forEach(result => {
            result.risks?.forEach(risk => {
                riskLevelDistribution[risk.level] = (riskLevelDistribution[risk.level] || 0) + 1;
            });
        });

        return {
            testSummary: {
                totalContracts: results.length,
                successfulAnalyses: successful.length,
                failedAnalyses: failed.length,
                successRate: `${((successful.length / results.length) * 100).toFixed(1)}%`
            },
            performance: {
                averageProcessingTime: `${avgProcessingTime.toFixed(0)}ms`,
                totalClauses,
                totalRisks,
                clausesPerContract: successful.length > 0 ? (totalClauses / successful.length).toFixed(1) : 0,
                risksPerContract: successful.length > 0 ? (totalRisks / successful.length).toFixed(1) : 0
            },
            analysis: {
                clauseTypeDistribution,
                riskLevelDistribution,
                mostCommonClauseType: Object.keys(clauseTypeDistribution).reduce((a, b) =>
                    clauseTypeDistribution[a] > clauseTypeDistribution[b] ? a : b, 'none'),
                mostCommonRiskLevel: Object.keys(riskLevelDistribution).reduce((a, b) =>
                    riskLevelDistribution[a] > riskLevelDistribution[b] ? a : b, 'none')
            },
            errors: failed.map(f => ({ contract: f.contractName, error: f.error })),
            timestamp: new Date().toISOString(),
            configuration: {
                model: this.modelId,
                region: awsConfig.region,
                s3Bucket: this.s3Bucket
            }
        };
    }
}

// Run the tests
async function main() {
    try {
        // Verify environment variables
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

        console.log('✅ Environment variables validated');
        console.log(`🔧 Using model: ${process.env.VITE_BEDROCK_MODEL}`);
        console.log(`🪣 Using S3 bucket: ${process.env.VITE_S3_BUCKET}`);
        console.log(`🌍 Using region: ${process.env.VITE_AWS_REGION}`);

        const analyzer = new RealAPIContractAnalyzer();
        await analyzer.runTests();

        console.log('\n🎉 Real API integration tests completed successfully!');

    } catch (error) {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('test-real-api-integration.js')) {
    main().catch(console.error);
}

export { RealAPIContractAnalyzer };