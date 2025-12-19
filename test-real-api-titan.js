#!/usr/bin/env node

/**
 * Real API Integration Test with Amazon Titan
 * Tests the AI contract analysis system with real AWS Bedrock API calls
 * using Amazon Titan models (no use case approval required)
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

class TitanContractAnalyzer {
    constructor() {
        // Use Amazon Titan Text G1 - Express (no use case approval required)
        this.modelId = 'amazon.titan-text-express-v1';
        this.s3Bucket = process.env.VITE_S3_BUCKET || 'impactxaws-docs';
        this.results = [];
    }

    /**
     * Analyze contract using Amazon Titan Text Express
     */
    async analyzeWithTitan(contractText, contractName) {
        console.log(`🤖 Analyzing ${contractName} with Amazon Titan Text Express...`);

        const prompt = `Analyze the following contract and provide a structured analysis.

Contract: ${contractName}

Contract Text:
${contractText.substring(0, 30000)} ${contractText.length > 30000 ? '...[truncated for length]' : ''}

Please analyze this contract and identify:

1. CLAUSES - Extract and categorize key contract clauses:
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
   - Warranty provisions

2. RISKS - Identify potential risks and their levels:
   - High Risk: Critical issues that could cause significant problems
   - Medium Risk: Important issues that should be addressed
   - Low Risk: Minor issues or standard provisions

3. SUMMARY - Provide overall assessment

Format your response as a structured analysis with clear sections for Clauses, Risks, and Summary.`;

        try {
            const command = new InvokeModelCommand({
                modelId: this.modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({
                    inputText: prompt,
                    textGenerationConfig: {
                        maxTokenCount: 4000,
                        temperature: 0.1,
                        topP: 0.9
                    }
                })
            });

            const startTime = Date.now();
            const response = await bedrockClient.send(command);
            const processingTime = Date.now() - startTime;

            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const analysisText = responseBody.results[0].outputText;

            // Parse the structured response
            const analysis = this.parseAnalysisText(analysisText, contractName);

            // Add metadata
            analysis.metadata = {
                processingTime,
                model: this.modelId,
                timestamp: new Date().toISOString(),
                tokenUsage: {
                    inputTokens: responseBody.inputTextTokenCount || 0,
                    outputTokens: responseBody.results[0].tokenCount || 0
                }
            };

            return analysis;

        } catch (error) {
            console.error(`❌ Titan analysis failed for ${contractName}:`, error.message);
            return {
                contractName,
                error: error.message,
                clauses: [],
                risks: [],
                summary: { totalClauses: 0, clauseTypes: {}, overallRiskLevel: 'Error', keyFindings: [] }
            };
        }
    }

    /**
     * Parse the analysis text from Titan into structured format
     */
    parseAnalysisText(text, contractName) {
        const clauses = [];
        const risks = [];

        // Extract clauses using pattern matching
        const clausePatterns = {
            'termination': /termination|terminate|end|expire|dissolution/gi,
            'payment': /payment|pay|fee|cost|price|compensation|invoice|billing/gi,
            'liability': /liability|liable|responsible|damages|limitation|limit/gi,
            'intellectual_property': /intellectual property|copyright|patent|trademark|proprietary|ip rights/gi,
            'confidentiality': /confidential|non-disclosure|proprietary|secret|nda/gi,
            'force_majeure': /force majeure|act of god|unforeseeable|beyond control/gi,
            'governing_law': /governing law|jurisdiction|applicable law|governed by/gi,
            'dispute_resolution': /dispute|arbitration|mediation|litigation|court/gi,
            'indemnification': /indemnify|indemnification|hold harmless|defend/gi,
            'non_compete': /non-compete|non-competition|restraint|covenant not to compete/gi,
            'assignment': /assignment|assign|transfer|delegate/gi,
            'warranty': /warranty|warrant|guarantee|representation|condition/gi
        };

        // Split text into sentences for analysis
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

        // Extract clauses
        for (const [type, pattern] of Object.entries(clausePatterns)) {
            const matches = sentences.filter(sentence => pattern.test(sentence));
            matches.slice(0, 3).forEach(match => { // Limit to top 3 matches per type
                clauses.push({
                    type: type.replace('_', ' '),
                    text: match.trim(),
                    confidence: 0.8,
                    category: type.replace('_', ' ')
                });
            });
        }

        // Extract risks based on keywords and context
        const riskIndicators = [
            { keywords: ['breach', 'default', 'violation'], level: 'High', description: 'Breach and default provisions' },
            { keywords: ['penalty', 'liquidated damages', 'fine'], level: 'High', description: 'Penalty clauses' },
            { keywords: ['unlimited liability', 'no limitation'], level: 'High', description: 'Unlimited liability exposure' },
            { keywords: ['exclusive', 'sole', 'only'], level: 'Medium', description: 'Exclusivity provisions' },
            { keywords: ['automatic renewal', 'evergreen'], level: 'Medium', description: 'Automatic renewal clauses' },
            { keywords: ['broad indemnification', 'indemnify'], level: 'Medium', description: 'Indemnification obligations' },
            { keywords: ['standard', 'typical', 'common'], level: 'Low', description: 'Standard contractual provisions' }
        ];

        const lowerText = text.toLowerCase();
        riskIndicators.forEach(indicator => {
            const hasKeywords = indicator.keywords.some(keyword => lowerText.includes(keyword));
            if (hasKeywords) {
                risks.push({
                    level: indicator.level,
                    description: indicator.description,
                    explanation: `Contract contains provisions related to ${indicator.keywords.join(', ')}`,
                    mitigation: `Review and understand implications of ${indicator.description.toLowerCase()}`
                });
            }
        });

        // Generate summary
        const clauseTypes = {};
        clauses.forEach(clause => {
            clauseTypes[clause.type] = (clauseTypes[clause.type] || 0) + 1;
        });

        const riskLevels = {};
        risks.forEach(risk => {
            riskLevels[risk.level] = (riskLevels[risk.level] || 0) + 1;
        });

        const overallRiskLevel = riskLevels['High'] > 0 ? 'High' :
            riskLevels['Medium'] > 0 ? 'Medium' : 'Low';

        return {
            contractName,
            clauses: clauses.slice(0, 15), // Limit to top 15 clauses
            risks: risks.slice(0, 10), // Limit to top 10 risks
            summary: {
                totalClauses: clauses.length,
                clauseTypes,
                overallRiskLevel,
                keyFindings: [
                    `Identified ${clauses.length} contract clauses`,
                    `Found ${risks.length} potential risk areas`,
                    `Overall risk assessment: ${overallRiskLevel}`,
                    `Most common clause type: ${Object.keys(clauseTypes).reduce((a, b) => clauseTypes[a] > clauseTypes[b] ? a : b, 'none')}`
                ]
            }
        };
    }

    /**
     * Upload results to S3
     */
    async uploadResultsToS3(results, filename) {
        try {
            const key = `analysis-results/titan-${filename}`;
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
     * Run tests with Titan model
     */
    async runTests() {
        console.log('🚀 Starting Real API Integration Tests with Amazon Titan');
        console.log('='.repeat(60));

        const cuadDir = path.join(__dirname, 'archive', 'CUAD_v1', 'full_contract_txt');

        if (!fs.existsSync(cuadDir)) {
            console.error('❌ CUAD dataset not found at:', cuadDir);
            return;
        }

        // Get sample contracts (limit to 5 for testing)
        const contractFiles = fs.readdirSync(cuadDir)
            .filter(file => file.endsWith('.txt'))
            .slice(0, 5);

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

                const analysis = await this.analyzeWithTitan(contractText, filename);
                results.push(analysis);

                // Log summary
                console.log(`✅ Analysis complete:`);
                console.log(`   - Clauses found: ${analysis.clauses?.length || 0}`);
                console.log(`   - Risks identified: ${analysis.risks?.length || 0}`);
                console.log(`   - Processing time: ${analysis.metadata?.processingTime || 'N/A'}ms`);
                console.log(`   - Overall risk: ${analysis.summary?.overallRiskLevel || 'Unknown'}`);

                // Add delay to respect rate limits
                if (index < contractFiles.length - 1) {
                    console.log('⏳ Waiting 3 seconds before next analysis...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
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
        const localFilename = `titan-api-test-results-${timestamp}.json`;
        fs.writeFileSync(localFilename, JSON.stringify({ report, results }, null, 2));
        console.log(`💾 Results saved locally: ${localFilename}`);

        // Upload to S3
        await this.uploadResultsToS3({ report, results }, localFilename);

        // Display final report
        console.log('\n' + '='.repeat(60));
        console.log('📊 FINAL TITAN TEST REPORT');
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
                successRate: `${((successful.length / results.length) * 100).toFixed(1)}%`,
                model: 'Amazon Titan Text Express v1'
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
        console.log(`🔧 Using model: Amazon Titan Text Express v1`);
        console.log(`🪣 Using S3 bucket: ${process.env.VITE_S3_BUCKET}`);
        console.log(`🌍 Using region: ${process.env.VITE_AWS_REGION}`);

        const analyzer = new TitanContractAnalyzer();
        await analyzer.runTests();

        console.log('\n🎉 Titan API integration tests completed successfully!');

    } catch (error) {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('test-real-api-titan.js')) {
    main().catch(console.error);
}

export { TitanContractAnalyzer };