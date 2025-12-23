import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

async function debugGeminiResponse() {
    try {
        console.log('🔍 Debugging Gemini response...')
        
        const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_AI_API_KEY)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

        const testContract = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on December 23, 2024, between TechCorp Inc. ("Disclosing Party") and ConsultantCo LLC ("Receiving Party").

1. CONFIDENTIAL INFORMATION
The Disclosing Party may share proprietary business information, technical data, and trade secrets with the Receiving Party.

2. OBLIGATIONS
The Receiving Party agrees to:
- Keep all confidential information strictly confidential
- Not disclose information to third parties
- Use information only for the agreed purpose

3. TERM
This agreement shall remain in effect for 2 years from the date of signing.`

        const prompt = `Analyze this legal contract and respond with ONLY a valid JSON object following this exact structure:

Document Text:
${testContract}

Respond with this exact JSON structure (no additional text, no markdown formatting):
{
  "summary": {
    "documentType": "string",
    "keyPurpose": "string", 
    "mainParties": ["string"],
    "effectiveDate": "string",
    "expirationDate": "string or null",
    "totalClausesIdentified": 0,
    "completenessScore": 0
  },
  "clauses": [
    {
      "id": "clause_1",
      "title": "string",
      "content": "string", 
      "category": "string",
      "riskLevel": "low|medium|high|critical",
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
      "severity": "low|medium|high|critical", 
      "category": "financial|legal|operational",
      "recommendation": "string",
      "clauseReference": "string",
      "supportingText": "string"
    }
  ],
  "keyTerms": [
    {
      "term": "string",
      "definition": "string", 
      "importance": "low|medium|high",
      "context": "string"
    }
  ],
  "recommendations": [
    {
      "priority": "low|medium|high|critical",
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
}

Important: Identify all major clauses including confidentiality, payment terms, termination, liability, intellectual property, warranties, governing law, and dispute resolution. Provide specific, actionable recommendations.`

        console.log('📤 Sending request to Gemini...')
        
        const result = await model.generateContent({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 4000,
                responseMimeType: "application/json"
            }
        })

        const response = await result.response
        const responseText = response.text()
        
        console.log('📥 Raw Gemini Response:')
        console.log('=' .repeat(80))
        console.log(responseText)
        console.log('=' .repeat(80))
        
        // Try to parse it
        try {
            const parsed = JSON.parse(responseText)
            console.log('✅ JSON parsing successful!')
            console.log('📊 Clauses found:', parsed.clauses?.length || 0)
            console.log('⚠️ Risks found:', parsed.risks?.length || 0)
        } catch (parseError) {
            console.log('❌ JSON parsing failed:', parseError.message)
            
            // Try to find JSON boundaries
            const jsonStart = responseText.indexOf('{')
            const jsonEnd = responseText.lastIndexOf('}')
            
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const extractedJson = responseText.substring(jsonStart, jsonEnd + 1)
                console.log('🔧 Extracted JSON:')
                console.log(extractedJson)
                
                try {
                    const parsed = JSON.parse(extractedJson)
                    console.log('✅ Extracted JSON parsing successful!')
                    console.log('📊 Clauses found:', parsed.clauses?.length || 0)
                } catch (e) {
                    console.log('❌ Extracted JSON also failed:', e.message)
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message)
    }
}

debugGeminiResponse()