/**
 * Comprehensive API Key and Connection Test
 * Tests all aspects of the Gemini integration
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_KEY = process.env.VITE_GOOGLE_AI_API_KEY;
const MODEL_NAME = process.env.VITE_GEMINI_MODEL;
const ENDPOINT = process.env.VITE_GEMINI_ENDPOINT;

console.log('🔍 COMPREHENSIVE API CONNECTION TEST');
console.log('=====================================');

async function testAPIKeyAndConnection() {
    console.log('\n1️⃣ ENVIRONMENT CONFIGURATION CHECK');
    console.log('-----------------------------------');
    console.log('API Key:', API_KEY ? `${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}` : '❌ MISSING');
    console.log('Model:', MODEL_NAME || '❌ MISSING');
    console.log('Endpoint:', ENDPOINT || '❌ MISSING');
    
    if (!API_KEY || API_KEY === 'your_google_ai_api_key_here') {
        console.log('❌ CRITICAL ERROR: Invalid or missing Google AI API key');
        return false;
    }
    
    console.log('\n2️⃣ GOOGLE AI CLIENT INITIALIZATION');
    console.log('----------------------------------');
    
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: {
                temperature: 0.2,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 1000,
            }
        });
        console.log('✅ Google AI client initialized successfully');
        
        console.log('\n3️⃣ BASIC CONNECTION TEST');
        console.log('-------------------------');
        
        const testResult = await model.generateContent({
            contents: [{
                parts: [{ text: "Hello, please respond with 'Connection successful'" }]
            }],
            generationConfig: {
                maxOutputTokens: 20
            }
        });

        const response = await testResult.response;
        const responseText = response.text();
        
        console.log('Response:', responseText);
        
        if (responseText.toLowerCase().includes('connection') || responseText.toLowerCase().includes('hello')) {
            console.log('✅ Basic connection test PASSED');
        } else {
            console.log('⚠️ Basic connection test unclear, but API responded');
        }
        
        console.log('\n4️⃣ CONTRACT ANALYSIS TEST');
        console.log('-------------------------');
        
        const contractText = `
EMPLOYMENT AGREEMENT

This Employment Agreement is entered into on January 1, 2024, between TechCorp Inc. and John Smith.

1. POSITION: Employee shall serve as Software Engineer.
2. COMPENSATION: $100,000 per year.
3. TERMINATION: Either party may terminate with 30 days notice.
4. CONFIDENTIALITY: Employee agrees to maintain confidentiality.
`;

        const analysisPrompt = `Analyze this legal contract and respond with ONLY a valid JSON object:

${contractText}

Respond with this JSON structure:
{
  "summary": {
    "documentType": "Employment Agreement",
    "totalClausesIdentified": 4
  },
  "clauses": [
    {
      "id": "clause_1",
      "title": "Position",
      "content": "Employee role definition",
      "category": "employment",
      "riskLevel": "low"
    }
  ],
  "risks": [
    {
      "id": "risk_1",
      "title": "Employment Risk",
      "description": "Standard employment terms",
      "severity": "low"
    }
  ]
}`;

        const analysisResult = await model.generateContent({
            contents: [{
                parts: [{ text: analysisPrompt }]
            }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2000,
                responseMimeType: "application/json"
            }
        });

        const analysisResponse = await analysisResult.response;
        const analysisText = analysisResponse.text();
        
        console.log('Raw Analysis Response Length:', analysisText.length);
        console.log('First 200 chars:', analysisText.substring(0, 200));
        
        try {
            const parsedAnalysis = JSON.parse(analysisText);
            console.log('✅ JSON parsing successful');
            console.log('Clauses found:', parsedAnalysis.clauses?.length || 0);
            console.log('Risks found:', parsedAnalysis.risks?.length || 0);
            console.log('Document type:', parsedAnalysis.summary?.documentType || 'Unknown');
            
            if (parsedAnalysis.clauses && parsedAnalysis.clauses.length > 0) {
                console.log('✅ Contract analysis test PASSED');
                return true;
            } else {
                console.log('⚠️ Contract analysis returned no clauses');
                return false;
            }
            
        } catch (parseError) {
            console.log('❌ JSON parsing failed:', parseError.message);
            console.log('Raw response:', analysisText);
            return false;
        }
        
    } catch (error) {
        console.log('❌ API Error:', error.message);
        
        if (error.message.includes('429')) {
            console.log('💡 QUOTA EXCEEDED: You have hit the API rate limit');
            console.log('   - Free tier: 20 requests per day');
            console.log('   - Wait for quota reset or upgrade to paid tier');
        } else if (error.message.includes('401') || error.message.includes('403')) {
            console.log('💡 AUTHENTICATION ERROR: API key might be invalid');
            console.log('   - Check if API key is correct');
            console.log('   - Verify API key has proper permissions');
        } else if (error.message.includes('400')) {
            console.log('💡 BAD REQUEST: Request format might be incorrect');
        }
        
        return false;
    }
}

async function testBackendIntegration() {
    console.log('\n5️⃣ BACKEND INTEGRATION TEST');
    console.log('---------------------------');
    
    try {
        // Test if server is running
        const healthResponse = await fetch('http://localhost:3003/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                test: 'hello backend'
            })
        });
        
        if (healthResponse.ok) {
            const healthResult = await healthResponse.json();
            console.log('✅ Backend server is running');
            console.log('Services:', healthResult.services);
        } else {
            console.log('❌ Backend server not responding properly');
            return false;
        }
        
        // Test actual analysis
        const analysisResponse = await fetch('http://localhost:3003/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'analyze',
                documentText: 'This is a test contract with employment terms.',
                documentType: 'text/plain',
                filename: 'Test Contract'
            })
        });
        
        if (analysisResponse.ok) {
            const analysisResult = await analysisResponse.json();
            console.log('✅ Backend analysis endpoint working');
            console.log('Using Real AI:', analysisResult.usingRealAI);
            console.log('Model:', analysisResult.model);
            console.log('Clauses found:', analysisResult.analysis?.clauses?.length || 0);
            
            if (analysisResult.usingRealAI) {
                console.log('✅ Backend is using real Gemini AI');
                return true;
            } else {
                console.log('⚠️ Backend is falling back to mock data');
                if (analysisResult.errorDetails) {
                    console.log('Error details:', analysisResult.errorDetails);
                }
                return false;
            }
        } else {
            console.log('❌ Backend analysis endpoint failed');
            return false;
        }
        
    } catch (error) {
        console.log('❌ Backend test failed:', error.message);
        console.log('💡 Make sure the server is running on port 3003');
        return false;
    }
}

async function runAllTests() {
    console.log('Starting comprehensive API and connection tests...\n');
    
    const apiTest = await testAPIKeyAndConnection();
    const backendTest = await testBackendIntegration();
    
    console.log('\n📊 FINAL RESULTS');
    console.log('================');
    console.log('Direct API Test:', apiTest ? '✅ PASSED' : '❌ FAILED');
    console.log('Backend Integration:', backendTest ? '✅ PASSED' : '❌ FAILED');
    
    if (apiTest && backendTest) {
        console.log('\n🎉 ALL TESTS PASSED! Your Gemini integration is working correctly.');
        console.log('If you\'re still seeing mock data in the frontend, it\'s likely a browser cache issue.');
        console.log('Try: Ctrl+Shift+R (hard refresh) or open in incognito mode.');
    } else if (apiTest && !backendTest) {
        console.log('\n⚠️ API works but backend has issues. Check server logs.');
    } else if (!apiTest && backendTest) {
        console.log('\n⚠️ Backend works but API has issues. Check API key and quotas.');
    } else {
        console.log('\n❌ Both tests failed. Check API key, quotas, and server status.');
    }
}

// Run all tests
runAllTests().catch(console.error);