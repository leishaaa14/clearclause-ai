#!/usr/bin/env node

// Test script for real API connection
// This script will test the actual API endpoints with real data

import dotenv from 'dotenv';
import { ContractProcessor } from './src/processors/ContractProcessor.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

async function testRealAPI() {
    console.log('🚀 Testing Real API Connection...\n');

    // Check environment variables
    console.log('Environment Configuration:');
    console.log(`- FALLBACK_API_URL: ${process.env.FALLBACK_API_URL || 'Not set'}`);
    console.log(`- FALLBACK_API_KEY: ${process.env.FALLBACK_API_KEY ? '***' + process.env.FALLBACK_API_KEY.slice(-4) : 'Not set'}`);
    console.log(`- FORCE_REAL_API: ${process.env.FORCE_REAL_API}`);
    console.log(`- NODE_ENV: ${process.env.NODE_ENV}\n`);

    // Initialize processor
    const processor = new ContractProcessor({
        preferAIModel: false, // Force API usage
        fallbackToAPI: true
    });

    // Load sample contract from CUAD dataset
    let sampleContract;
    try {
        const cuadPath = join(process.cwd(), 'archive', 'CUAD_v1', 'full_contract_txt');
        // Try to find a sample contract file
        sampleContract = {
            text: `CONSULTING AGREEMENT

This Consulting Agreement ("Agreement") is entered into on January 1, 2024, between TechCorp Inc., a Delaware corporation ("Company"), and John Smith ("Consultant").

1. SERVICES
Consultant agrees to provide software development consulting services to Company, including but not limited to system architecture design, code review, and technical advisory services.

2. COMPENSATION
Company shall pay Consultant $150 per hour for services rendered. Payment shall be made within thirty (30) days of receipt of invoice.

3. TERM AND TERMINATION
This Agreement shall commence on January 1, 2024 and continue until December 31, 2024, unless terminated earlier by either party with thirty (30) days written notice.

4. CONFIDENTIALITY
Consultant acknowledges that during the course of this engagement, Consultant may have access to confidential and proprietary information of Company. Consultant agrees to maintain the confidentiality of such information.

5. INTELLECTUAL PROPERTY
All work product, inventions, and intellectual property created by Consultant in the course of providing services under this Agreement shall be the exclusive property of Company.

6. LIABILITY LIMITATION
In no event shall either party be liable for any indirect, incidental, special, or consequential damages arising out of or relating to this Agreement, regardless of the theory of liability.

7. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.`,
            filename: 'sample_consulting_agreement.txt'
        };
    } catch (error) {
        console.log('Could not load CUAD sample, using built-in sample contract');
    }

    try {
        console.log('📄 Processing Sample Contract...');
        console.log(`Contract length: ${sampleContract.text.length} characters\n`);

        const startTime = Date.now();
        const result = await processor.processContract(sampleContract, {
            extractClauses: true,
            assessRisks: true,
            generateRecommendations: true
        });

        const processingTime = Date.now() - startTime;

        console.log('✅ API Processing Successful!\n');
        console.log('📊 Results Summary:');
        console.log(`- Processing Method: ${result.metadata.processingMethod}`);
        console.log(`- Processing Time: ${processingTime}ms`);
        console.log(`- Confidence Score: ${result.summary.confidence}`);
        console.log(`- Risk Score: ${result.summary.riskScore}`);
        console.log(`- Total Clauses Found: ${result.clauses.length}`);
        console.log(`- Risks Identified: ${result.risks.length}`);
        console.log(`- Recommendations: ${result.recommendations.length}\n`);

        console.log('🔍 Detailed Results:');

        if (result.clauses.length > 0) {
            console.log('\n📋 Clauses Found:');
            result.clauses.forEach((clause, index) => {
                console.log(`${index + 1}. [${clause.category}] ${clause.type}`);
                console.log(`   Text: "${clause.text.substring(0, 100)}${clause.text.length > 100 ? '...' : ''}"`);
                console.log(`   Confidence: ${clause.confidence}\n`);
            });
        }

        if (result.risks.length > 0) {
            console.log('⚠️  Risks Identified:');
            result.risks.forEach((risk, index) => {
                console.log(`${index + 1}. ${risk.title} (${risk.severity})`);
                console.log(`   ${risk.description}`);
                console.log(`   Mitigation: ${risk.mitigation}\n`);
            });
        }

        if (result.recommendations.length > 0) {
            console.log('💡 Recommendations:');
            result.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec.title} (${rec.priority})`);
                console.log(`   ${rec.description}\n`);
            });
        }

        // Test API client status
        console.log('🔧 API Client Status:');
        const apiStatus = processor.apiClient.getStatus();
        console.log(`- Base URL: ${apiStatus.baseUrl}`);
        console.log(`- Has API Key: ${apiStatus.hasApiKey}`);
        console.log(`- Timeout: ${apiStatus.timeout}ms`);
        console.log(`- Retry Attempts: ${apiStatus.retryAttempts}`);
        console.log(`- Rate Limiter - Running: ${apiStatus.rateLimiter.running}`);
        console.log(`- Rate Limiter - Queued: ${apiStatus.rateLimiter.queued}`);

    } catch (error) {
        console.error('❌ API Processing Failed:');
        console.error(`Error: ${error.message}`);
        console.error(`Code: ${error.code || 'Unknown'}`);
        console.error(`Status: ${error.status || 'Unknown'}\n`);

        if (error.response) {
            console.error('API Response Details:');
            console.error(JSON.stringify(error.response, null, 2));
        }

        // Test connectivity
        console.log('\n🔍 Testing API Connectivity...');
        try {
            const connectionTest = await processor.apiClient.testConnection();
            console.log('Connection Test Result:', connectionTest);
        } catch (connError) {
            console.error('Connection test failed:', connError.message);
        }
    }

    // Get processing stats
    console.log('\n📈 Processing Statistics:');
    const stats = processor.getProcessingStats();
    console.log(JSON.stringify(stats, null, 2));
}

// Run the test
testRealAPI().catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
});