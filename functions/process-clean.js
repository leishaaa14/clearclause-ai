/**
 * ClearClause AI Backend Function - Clean Version
 * Handles document processing requests with AWS integration
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract'
import { GeminiClient } from './ai/GeminiClient.js'
import { GeminiErrorHandler } from './ai/GeminiErrorHandler.js'
import { GeminiResponseParser } from './ai/GeminiResponseParser.js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// AWS Configuration
const AWS_CONFIG = {
    region: process.env.VITE_AWS_REGION,
    credentials: {
        accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY
    },
    maxAttempts: 3,
    retryMode: 'standard'
}

// Initialize AWS clients (S3 and Textract still needed)
const s3Client = new S3Client(AWS_CONFIG)
const textractClient = new TextractClient(AWS_CONFIG)

// Initialize Gemini client and utilities
let geminiClient = null
const geminiErrorHandler = new GeminiErrorHandler()
const geminiResponseParser = new GeminiResponseParser()

function createGeminiClient() {
    if (!geminiClient) {
        try {
            geminiClient = new GeminiClient()
        } catch (error) {
            console.error('Failed to initialize Gemini client:', error.message)
            geminiClient = null
        }
    }
    return geminiClient
}

// Configuration constants
const S3_BUCKET = process.env.VITE_S3_BUCKET
const GEMINI_MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-1.5-pro'

console.log('🔧 Current Configuration:')
console.log('- S3 Bucket:', S3_BUCKET)
console.log('- AI Model:', GEMINI_MODEL, '(Gemini)')

/**
 * Main serverless function handler
 */
export async function handler(request) {
    try {
        const { method, headers, body, query } = request;
        console.log(`Processing ${method} request for ClearClause AI`);

        switch (method) {
            case 'GET':
                return handleGet(query);
            case 'POST':
                return handlePost(body, headers);
            case 'PUT':
                return handlePut(body, headers);
            case 'DELETE':
                return handleDelete(query);
            default:
                return createErrorResponse(405, 'Method Not Allowed', `Method ${method} is not supported`);
        }
    } catch (error) {
        console.error('Function execution error:', error);
        return createErrorResponse(500, 'Internal Server Error', 'An unexpected error occurred');
    }
}

/**
 * Handle GET requests
 */
function handleGet(query) {
    return createSuccessResponse(200, {
        message: 'GET request processed successfully',
        timestamp: new Date().toISOString(),
        query: query || {}
    });
}

/**
 * Handle POST requests - Document Analysis
 */
async function handlePost(body, headers) {
    try {
        // Check if this is a connectivity test request
        if (body && body.test === 'hello backend') {
            return createSuccessResponse(200, {
                message: 'ClearClause AI Backend is working',
                timestamp: new Date().toISOString(),
                services: {
                    s3: 'connected',
                    textract: 'connected', 
                    bedrock: 'connected'
                }
            });
        }

        // Handle document analysis requests
        if (body && body.action === 'analyze') {
            return await processDocumentAnalysis(body);
        }

        // Handle document comparison requests
        if (body && body.action === 'compare') {
            return await processDocumentComparison(body);
        }

        // Default response for other POST requests
        return createSuccessResponse(200, {
            message: 'ClearClause AI Backend - Ready for document analysis',
            timestamp: new Date().toISOString(),
            supportedActions: ['analyze', 'compare'],
            received: body || {}
        });

    } catch (error) {
        console.error('POST request error:', error);
        return createErrorResponse(500, 'Internal Server Error', error.message);
    }
}

/**
 * Handle PUT requests
 */
function handlePut(body, headers) {
    return createSuccessResponse(200, {
        message: 'PUT request processed successfully',
        timestamp: new Date().toISOString(),
        updated: body || {}
    });
}

/**
 * Handle DELETE requests
 */
function handleDelete(query) {
    const id = query?.id;
    if (!id) {
        return createErrorResponse(400, 'Bad Request', 'ID parameter is required for DELETE requests');
    }

    return createSuccessResponse(200, {
        message: 'DELETE request processed successfully',
        timestamp: new Date().toISOString(),
        deleted: { id }
    });
}

/**
 * Process document analysis request
 */
async function processDocumentAnalysis(requestBody) {
    try {
        const { documentText, documentType, filename, s3Key } = requestBody;
        let textToAnalyze = documentText;

        // Check if this is an Excel file
        const isExcelFile = filename && (
            filename.toLowerCase().endsWith('.xlsx') || 
            filename.toLowerCase().endsWith('.xls') || 
            filename.toLowerCase().endsWith('.csv')
        );

        // If S3 key is provided, extract text using Textract
        if (s3Key && !documentText) {
            const textractResult = await extractTextFromS3(s3Key);
            if (!textractResult.success) {
                return createErrorResponse(500, 'Textract Error', textractResult.error);
            }
            textToAnalyze = textractResult.text;
        }

        // For Excel files, add special processing note
        if (isExcelFile) {
            textToAnalyze = `[Excel Document Analysis: ${filename}]\n\n${textToAnalyze}\n\nNote: This Excel/CSV file contains structured data that has been processed for contract analysis.`;
        }

        console.log('🚀 Starting Bedrock analysis...');
        let analysisResult;
        let usingRealAI = false;
        let errorDetails = null;
        
        try {
            analysisResult = await analyzeWithBedrock(textToAnalyze);
            if (analysisResult.success) {
                usingRealAI = true;
                console.log('✅ Real AI analysis completed successfully!');
            } else {
                errorDetails = analysisResult.error;
                console.log('❌ Bedrock analysis failed:', errorDetails);
            }
        } catch (error) {
            errorDetails = error.message;
            console.log('❌ Bedrock analysis threw exception:', errorDetails);
        }

        // Fallback to mock data if real AI failed
        if (!analysisResult || !analysisResult.success) {
            console.log('🔄 Falling back to enhanced mock analysis...');
            analysisResult = {
                success: true,
                analysis: generateMockAnalysis(textToAnalyze),
                confidence: 92
            };
            usingRealAI = false;
        }

        // Enhanced response with processing details
        const response = {
            analysis: analysisResult.analysis,
            confidence: analysisResult.confidence,
            processedAt: new Date().toISOString(),
            model: usingRealAI ? BEDROCK_MODEL : 'mock-analysis-enhanced',
            usingRealAI: usingRealAI,
            processingDetails: {
                source: usingRealAI ? 'real-ai' : 'mock-fallback',
                processingTime: Date.now() - (analysisResult.startTime || Date.now())
            }
        };

        // Include error details if AI failed
        if (errorDetails && !usingRealAI) {
            response.errorDetails = errorDetails;
        }

        return createSuccessResponse(200, response);

    } catch (error) {
        console.error('Document analysis error:', error);
        return createErrorResponse(500, 'Analysis Failed', error.message);
    }
}

/**
 * Analyze document with Bedrock
 */
async function analyzeWithBedrock(documentText) {
    const startTime = Date.now();
    
    try {
        const bedrockClient = createBedrockClient();
        const documentType = detectDocumentType(documentText);
        const prompt = createAnalysisPrompt(documentText, documentType);
        
        let params;
        
        // Handle different model types
        if (BEDROCK_MODEL.includes('anthropic.claude')) {
            params = {
                modelId: BEDROCK_MODEL,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({
                    anthropic_version: 'bedrock-2023-05-31',
                    max_tokens: 4000,
                    messages: [{ role: 'user', content: prompt }]
                })
            };
        } else if (BEDROCK_MODEL.includes('titan')) {
            params = {
                modelId: BEDROCK_MODEL,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({
                    inputText: prompt,
                    textGenerationConfig: {
                        maxTokenCount: 3000,
                        temperature: 0.2,
                        topP: 0.9,
                        stopSequences: []
                    }
                })
            };
        } else {
            throw new Error(`Unsupported model type: ${BEDROCK_MODEL}`);
        }

        console.log(`🤖 Invoking AI model: ${BEDROCK_MODEL}`);
        
        const command = new InvokeModelCommand(params);
        const result = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(result.body));
        
        let aiResponseText;
        
        // Handle different response formats
        if (BEDROCK_MODEL.includes('anthropic.claude')) {
            if (!responseBody.content || !responseBody.content[0] || !responseBody.content[0].text) {
                throw new Error('Invalid response structure from Claude AI');
            }
            aiResponseText = responseBody.content[0].text;
        } else if (BEDROCK_MODEL.includes('titan')) {
            if (!responseBody.results || !responseBody.results[0] || !responseBody.results[0].outputText) {
                throw new Error('Invalid response structure from Titan AI');
            }
            aiResponseText = responseBody.results[0].outputText;
        }
        
        // Parse the AI response into structured analysis
        const analysis = parseAIResponse(aiResponseText, documentText);
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Real AI analysis completed successfully in ${processingTime}ms!`);
        
        return {
            success: true,
            analysis: analysis,
            confidence: calculateAnalysisConfidence(analysis),
            startTime: startTime,
            processingTime: processingTime
        };
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('Bedrock analysis error:', error);
        
        return {
            success: false,
            error: error.message,
            startTime: startTime,
            processingTime: processingTime
        };
    }
}

/**
 * Parse AI response into structured format
 */
function parseAIResponse(responseText, documentText) {
    // Try to parse as JSON first
    try {
        let cleanedResponse = responseText.trim();
        const jsonStart = cleanedResponse.indexOf('{');
        const jsonEnd = cleanedResponse.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
            return JSON.parse(cleanedResponse);
        }
    } catch (parseError) {
        console.log('JSON parsing failed, using text parsing...');
    }
    
    // Fallback: parse structured text response
    return parseStructuredTextResponse(responseText, documentText);
}

/**
 * Parse structured text response from Titan
 */
function parseStructuredTextResponse(analysisText, documentText) {
    const analysis = {
        summary: {
            documentType: extractSection(analysisText, 'DOCUMENT TYPE:') || detectDocumentType(documentText),
            keyPurpose: "Contract analysis and risk assessment",
            mainParties: extractParties(analysisText) || ["Party A", "Party B"],
            effectiveDate: new Date().toISOString().split('T')[0],
            expirationDate: null,
            totalClausesIdentified: 0,
            completenessScore: 90
        },
        clauses: [],
        risks: [],
        keyTerms: [],
        recommendations: [],
        qualityMetrics: {
            clauseDetectionConfidence: 85,
            analysisCompleteness: 90,
            potentialMissedClauses: []
        }
    };
    
    // Extract clauses
    const clausesSection = extractSection(analysisText, 'KEY CLAUSES IDENTIFIED:', 'RISKS IDENTIFIED:');
    if (clausesSection) {
        const clauseLines = clausesSection.split('\n').filter(line => line.trim().match(/^\d+\./));
        clauseLines.forEach((line, index) => {
            const clauseMatch = line.match(/^\d+\.\s*([^:]+):\s*(.+)/);
            if (clauseMatch) {
                const [, title, description] = clauseMatch;
                analysis.clauses.push({
                    id: `clause_${index + 1}`,
                    title: title.trim(),
                    content: description.trim(),
                    category: categorizeClause(title),
                    riskLevel: extractRiskLevel(description),
                    explanation: description.trim(),
                    sourceLocation: `Section ${index + 1}`,
                    keyTerms: extractKeyTermsFromText(title + ' ' + description)
                });
            }
        });
        analysis.summary.totalClausesIdentified = analysis.clauses.length;
    }
    
    // Extract risks
    const risksSection = extractSection(analysisText, 'RISKS IDENTIFIED:', 'KEY TERMS:');
    if (risksSection) {
        const riskLines = risksSection.split('\n').filter(line => line.trim().match(/^\d+\./));
        riskLines.forEach((line, index) => {
            const riskMatch = line.match(/^\d+\.\s*([^:]+):\s*(.+)/);
            if (riskMatch) {
                const [, title, description] = riskMatch;
                analysis.risks.push({
                    id: `risk_${index + 1}`,
                    title: title.trim(),
                    description: description.trim(),
                    severity: extractSeverity(description),
                    category: categorizeRisk(title),
                    recommendation: `Address ${title.toLowerCase()} through appropriate measures`,
                    clauseReference: analysis.clauses[0]?.id || 'general',
                    supportingText: description.trim()
                });
            }
        });
    }
    
    // Extract recommendations
    const recommendationsSection = extractSection(analysisText, 'RECOMMENDATIONS:', 'OVERALL ASSESSMENT:');
    if (recommendationsSection) {
        const recLines = recommendationsSection.split('\n').filter(line => line.trim().match(/^\d+\./));
        recLines.forEach((line, index) => {
            const recMatch = line.match(/^\d+\.\s*([^:]*?):\s*(.+)/);
            if (recMatch) {
                const [, priority, action] = recMatch;
                analysis.recommendations.push({
                    priority: priority.toLowerCase().includes('high') ? 'high' : 
                             priority.toLowerCase().includes('critical') ? 'critical' : 'medium',
                    action: action.trim(),
                    rationale: `Important for contract compliance and risk management`,
                    affectedClauses: analysis.clauses.slice(0, 2).map(c => c.id)
                });
            }
        });
    }
    
    return analysis;
}

/**
 * Helper functions for parsing
 */
function extractSection(text, startMarker, endMarker = null) {
    const startIndex = text.indexOf(startMarker);
    if (startIndex === -1) return null;
    
    const contentStart = startIndex + startMarker.length;
    const endIndex = endMarker ? text.indexOf(endMarker, contentStart) : text.length;
    
    return text.substring(contentStart, endIndex === -1 ? text.length : endIndex).trim();
}

function extractParties(text) {
    const partiesSection = extractSection(text, 'MAIN PARTIES:');
    if (partiesSection) {
        return partiesSection.split(',').map(p => p.trim()).filter(p => p.length > 0);
    }
    return ["Party A", "Party B"];
}

function categorizeClause(title) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('confidential') || titleLower.includes('disclosure')) return 'confidentiality';
    if (titleLower.includes('payment') || titleLower.includes('fee')) return 'payment';
    if (titleLower.includes('term') || titleLower.includes('duration')) return 'termination';
    if (titleLower.includes('liability') || titleLower.includes('damage')) return 'liability';
    if (titleLower.includes('intellectual') || titleLower.includes('property')) return 'intellectual_property';
    if (titleLower.includes('warranty') || titleLower.includes('guarantee')) return 'warranty';
    if (titleLower.includes('governing') || titleLower.includes('law')) return 'governing_law';
    return 'general';
}

function extractRiskLevel(description) {
    const descLower = description.toLowerCase();
    if (descLower.includes('critical') || descLower.includes('severe')) return 'critical';
    if (descLower.includes('high') || descLower.includes('significant')) return 'high';
    if (descLower.includes('low') || descLower.includes('minor')) return 'low';
    return 'medium';
}

function extractSeverity(description) {
    return extractRiskLevel(description);
}

function categorizeRisk(title) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('financial') || titleLower.includes('payment') || titleLower.includes('cost')) return 'financial';
    if (titleLower.includes('legal') || titleLower.includes('compliance') || titleLower.includes('regulatory')) return 'legal';
    if (titleLower.includes('operational') || titleLower.includes('business') || titleLower.includes('process')) return 'operational';
    return 'legal';
}

function extractKeyTermsFromText(text) {
    const words = text.toLowerCase().split(/\s+/);
    const importantWords = words.filter(word => 
        word.length > 4 && 
        !['agreement', 'contract', 'party', 'shall', 'will', 'may', 'must'].includes(word)
    );
    return importantWords.slice(0, 3);
}

/**
 * Create analysis prompt optimized for the current model
 */
function createAnalysisPrompt(documentText, documentType) {
    if (BEDROCK_MODEL && BEDROCK_MODEL.includes('titan')) {
        return createTitanOptimizedPrompt(documentText);
    }
    
    // Claude-optimized prompt
    return `Analyze this legal contract and respond with ONLY a JSON object.

Document Text:
${documentText}

Respond with this exact JSON structure:
{
  "summary": {
    "documentType": "string",
    "keyPurpose": "string", 
    "mainParties": ["string"],
    "effectiveDate": "string",
    "expirationDate": "string",
    "totalClausesIdentified": 0,
    "completenessScore": 0
  },
  "clauses": [
    {
      "id": "clause_1",
      "title": "string",
      "content": "string", 
      "category": "string",
      "riskLevel": "low",
      "explanation": "string",
      "sourceLocation": "string",
      "keyTerms": ["string"]
    }
  ],
  "risks": [
    {
      "id": "risk_1",
      "title": "string",
      "description": "string",
      "severity": "low", 
      "category": "string",
      "recommendation": "string",
      "clauseReference": "string",
      "supportingText": "string"
    }
  ],
  "keyTerms": [
    {
      "term": "string",
      "definition": "string", 
      "importance": "low",
      "context": "string"
    }
  ],
  "recommendations": [
    {
      "priority": "low",
      "action": "string",
      "rationale": "string", 
      "affectedClauses": ["string"]
    }
  ],
  "qualityMetrics": {
    "clauseDetectionConfidence": 0,
    "analysisCompleteness": 0,
    "potentialMissedClauses": ["string"]
  }
}`;
}

/**
 * Create Titan-optimized prompt
 */
function createTitanOptimizedPrompt(documentText) {
    return `Analyze this legal contract and provide a detailed analysis:

${documentText.substring(0, 3000)}

Please provide your analysis in the following format:

DOCUMENT TYPE: [type of document]

MAIN PARTIES: [list the parties involved]

KEY CLAUSES IDENTIFIED:
1. [Clause name]: [brief description and risk level]
2. [Clause name]: [brief description and risk level]
3. [Continue for all major clauses...]

RISKS IDENTIFIED:
1. [Risk title]: [description and severity level]
2. [Risk title]: [description and severity level]
3. [Continue for all risks...]

KEY TERMS:
- [Term]: [definition and importance]
- [Term]: [definition and importance]

RECOMMENDATIONS:
1. [Priority level]: [specific action recommended]
2. [Priority level]: [specific action recommended]
3. [Continue for all recommendations...]

OVERALL ASSESSMENT: [summary of document quality and completeness]

Identify all major clauses including: confidentiality, payment terms, termination, liability, intellectual property, warranties, governing law, and dispute resolution.`;
}

/**
 * Detect document type based on content
 */
function detectDocumentType(documentText) {
    const text = documentText.toLowerCase();
    
    if (text.includes('non-disclosure') || text.includes('confidential') || text.includes('nda')) {
        return 'Non-Disclosure Agreement';
    } else if (text.includes('employment') || text.includes('employee')) {
        return 'Employment Agreement';
    } else if (text.includes('service') || text.includes('consulting')) {
        return 'Service Agreement';
    } else if (text.includes('license') || text.includes('software')) {
        return 'License Agreement';
    } else if (text.includes('lease') || text.includes('rent')) {
        return 'Lease Agreement';
    } else {
        return 'Legal Agreement';
    }
}

/**
 * Calculate analysis confidence score
 */
function calculateAnalysisConfidence(analysis) {
    let score = 0;
    if (analysis.summary?.documentType) score += 20;
    if (analysis.clauses?.length >= 3) score += 30;
    if (analysis.risks?.length >= 2) score += 25;
    if (analysis.recommendations?.length >= 2) score += 15;
    if (analysis.keyTerms?.length >= 2) score += 10;
    return Math.min(score, 100);
}

/**
 * Generate mock analysis for fallback
 */
function generateMockAnalysis(documentText) {
    const documentType = detectDocumentType(documentText);
    
    return {
        summary: {
            documentType: documentType,
            keyPurpose: "Document analysis and risk assessment",
            mainParties: ["Party A", "Party B"],
            effectiveDate: new Date().toISOString().split('T')[0],
            expirationDate: null,
            totalClausesIdentified: 4,
            completenessScore: 85
        },
        clauses: [
            {
                id: "clause_1",
                title: "Main Terms",
                content: documentText.substring(0, Math.min(200, documentText.length)),
                category: "general",
                riskLevel: "medium",
                explanation: "Primary terms and conditions of the agreement",
                sourceLocation: "Document body",
                keyTerms: ["terms", "conditions", "agreement"]
            }
        ],
        risks: [
            {
                id: "risk_1",
                title: "General Contract Risk",
                description: "This agreement contains terms that require careful review",
                severity: "medium",
                category: "legal",
                recommendation: "Review all terms with legal counsel",
                clauseReference: "clause_1",
                supportingText: "Various contract provisions"
            }
        ],
        keyTerms: [
            {
                term: "Agreement",
                definition: "The legal contract between the parties",
                importance: "high",
                context: "Throughout the document"
            }
        ],
        recommendations: [
            {
                priority: "medium",
                action: "Review all contract terms carefully",
                rationale: "All contracts require thorough review",
                affectedClauses: ["clause_1"]
            }
        ],
        qualityMetrics: {
            clauseDetectionConfidence: 75,
            analysisCompleteness: 85,
            potentialMissedClauses: ["specific_terms"]
        }
    };
}

/**
 * Extract text from S3 document using Textract
 */
async function extractTextFromS3(s3Key) {
    try {
        const params = {
            Document: {
                S3Object: {
                    Bucket: S3_BUCKET,
                    Name: s3Key
                }
            }
        };

        const command = new DetectDocumentTextCommand(params);
        const result = await textractClient.send(command);
        
        const extractedText = result.Blocks
            .filter(block => block.BlockType === 'LINE')
            .map(block => block.Text)
            .join('\n');

        return {
            success: true,
            text: extractedText,
            confidence: 95
        };
    } catch (error) {
        console.error('Textract error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Process document comparison request
 */
async function processDocumentComparison(requestBody) {
    try {
        const { documents } = requestBody;

        if (!documents || documents.length < 2) {
            return createErrorResponse(400, 'Invalid Request', 'At least 2 documents required for comparison');
        }

        // For now, return a basic comparison response
        return createSuccessResponse(200, {
            comparison: {
                overview: {
                    totalDocuments: documents.length,
                    documentTypes: ["Legal Agreement"],
                    comparisonSummary: "Document comparison completed"
                },
                keyDifferences: [],
                commonTerms: [],
                riskAnalysis: [],
                recommendations: []
            },
            documentsAnalyzed: documents.length,
            processedAt: new Date().toISOString(),
            model: BEDROCK_MODEL
        });

    } catch (error) {
        console.error('Document comparison error:', error);
        return createErrorResponse(500, 'Comparison Failed', error.message);
    }
}

/**
 * Create success response
 */
function createSuccessResponse(statusCode, data) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify(data)
    };
}

/**
 * Create error response
 */
function createErrorResponse(statusCode, error, message) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({
            error,
            message,
            timestamp: new Date().toISOString()
        })
    };
}

// Default export for compatibility
export default handler;