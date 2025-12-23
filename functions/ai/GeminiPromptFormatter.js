/**
 * Gemini-specific prompt formatting utilities
 * Handles document-type-specific prompt generation and token management
 */

export class GeminiPromptFormatter {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 30000 // Conservative limit for Gemini
    this.temperature = options.temperature || 0.2
    this.topP = options.topP || 0.8
    this.topK = options.topK || 40
  }

  /**
   * Create analysis prompt optimized for Gemini API
   */
  createAnalysisPrompt(documentText, documentType) {
    // Handle token limits and truncation
    const truncatedText = this.handleTokenLimits(documentText)
    
    // Get document-type-specific instructions
    const typeSpecificInstructions = this.getDocumentTypeInstructions(documentType)
    
    // Create the main prompt
    const prompt = `${this.getSystemInstructions()}

${typeSpecificInstructions}

Document Text:
${truncatedText}

${this.getOutputFormatInstructions()}`

    return prompt
  }

  /**
   * Handle token limits and truncate appropriately
   */
  handleTokenLimits(documentText) {
    if (documentText.length <= this.maxTokens) {
      return documentText
    }

    // Truncate with context preservation
    const truncatedLength = Math.floor(this.maxTokens * 0.8) // Leave room for prompt overhead
    const truncated = documentText.substring(0, truncatedLength)
    
    // Try to truncate at a sentence boundary
    const lastSentence = truncated.lastIndexOf('.')
    const lastParagraph = truncated.lastIndexOf('\n\n')
    
    const cutPoint = Math.max(lastSentence, lastParagraph)
    const finalText = cutPoint > truncatedLength * 0.7 
      ? truncated.substring(0, cutPoint + 1)
      : truncated

    return `${finalText}\n\n[Document truncated due to length constraints. Analysis based on first ${finalText.length} characters.]`
  }

  /**
   * Get system-level instructions for Gemini
   */
  getSystemInstructions() {
    return `You are a legal document analysis expert. Analyze the provided legal contract and extract key information with high accuracy and detail.

CRITICAL INSTRUCTIONS:
- Respond with ONLY a valid JSON object
- No markdown formatting, no code blocks, no additional text
- Follow the exact JSON structure provided
- Be thorough and specific in your analysis
- Identify all major contract clauses and potential risks`
  }

  /**
   * Get document-type-specific analysis instructions
   */
  getDocumentTypeInstructions(documentType) {
    const instructions = {
      'Non-Disclosure Agreement': `
FOCUS AREAS for NDA Analysis:
- Confidential information definition and scope
- Permitted uses and restrictions
- Duration of confidentiality obligations
- Return or destruction of information clauses
- Exceptions to confidentiality (public domain, independently developed)
- Remedies for breach (injunctive relief, damages)`,

      'Employment Agreement': `
FOCUS AREAS for Employment Agreement Analysis:
- Job title, duties, and reporting structure
- Compensation, benefits, and equity arrangements
- Termination conditions and notice requirements
- Non-compete and non-solicitation clauses
- Intellectual property assignment
- Confidentiality and trade secret protection`,

      'Service Agreement': `
FOCUS AREAS for Service Agreement Analysis:
- Scope of services and deliverables
- Payment terms, rates, and invoicing
- Performance standards and acceptance criteria
- Intellectual property ownership
- Limitation of liability and indemnification
- Termination rights and transition procedures`,

      'License Agreement': `
FOCUS AREAS for License Agreement Analysis:
- Licensed rights and restrictions
- Territory and field of use limitations
- Royalty or fee structures
- Quality control and compliance requirements
- Termination and post-termination rights
- Warranty disclaimers and liability limits`,

      'Lease Agreement': `
FOCUS AREAS for Lease Agreement Analysis:
- Property description and permitted uses
- Rent amount, escalations, and payment terms
- Lease term and renewal options
- Maintenance and repair responsibilities
- Insurance and indemnification requirements
- Default remedies and termination rights`,

      'Legal Agreement': `
FOCUS AREAS for General Legal Agreement Analysis:
- Parties' rights and obligations
- Performance requirements and deadlines
- Payment or consideration terms
- Risk allocation and liability provisions
- Dispute resolution mechanisms
- Termination and breach remedies`
    }

    return instructions[documentType] || instructions['Legal Agreement']
  }

  /**
   * Get JSON schema requirements for structured output
   */
  getOutputFormatInstructions() {
    return `Respond with this exact JSON structure (no additional text, no markdown formatting):
{
  "summary": {
    "documentType": "string",
    "keyPurpose": "string", 
    "mainParties": ["string"],
    "effectiveDate": "string or null",
    "expirationDate": "string or null",
    "totalClausesIdentified": 0,
    "completenessScore": 0
  },
  "clauses": [
    {
      "id": "clause_1",
      "title": "string",
      "content": "string", 
      "category": "confidentiality|payment|termination|liability|intellectual_property|warranty|governing_law|general",
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

IMPORTANT: Identify ALL major clauses including confidentiality, payment terms, termination, liability, intellectual property, warranties, governing law, and dispute resolution. Provide specific, actionable recommendations.`
  }

  /**
   * Get generation configuration for Gemini API
   */
  getGenerationConfig() {
    return {
      temperature: this.temperature,
      topP: this.topP,
      topK: this.topK,
      maxOutputTokens: 4000,
      responseMimeType: "application/json"
    }
  }

  /**
   * Validate prompt length and adjust if necessary
   */
  validateAndAdjustPrompt(prompt) {
    if (prompt.length > this.maxTokens) {
      console.warn(`Prompt length (${prompt.length}) exceeds limit (${this.maxTokens}), truncating...`)
      return prompt.substring(0, this.maxTokens - 100) + '\n\n[Prompt truncated due to length constraints]'
    }
    return prompt
  }

  /**
   * Create prompt for document comparison
   */
  createComparisonPrompt(documents) {
    const systemInstructions = `You are a legal document comparison expert. Compare the provided documents and identify key differences, similarities, and potential conflicts.`
    
    const documentsText = documents.map((doc, index) => 
      `DOCUMENT ${index + 1}:\n${this.handleTokenLimits(doc.text)}\n\n`
    ).join('')

    return `${systemInstructions}

${documentsText}

Respond with a JSON object containing:
{
  "comparison": {
    "overview": {
      "totalDocuments": ${documents.length},
      "documentTypes": ["string"],
      "comparisonSummary": "string"
    },
    "keyDifferences": [
      {
        "category": "string",
        "description": "string",
        "documents": ["string"],
        "impact": "low|medium|high"
      }
    ],
    "commonTerms": [
      {
        "term": "string",
        "description": "string",
        "documents": ["string"]
      }
    ],
    "riskAnalysis": [
      {
        "risk": "string",
        "severity": "low|medium|high|critical",
        "affectedDocuments": ["string"],
        "recommendation": "string"
      }
    ],
    "recommendations": [
      {
        "priority": "low|medium|high|critical",
        "action": "string",
        "rationale": "string"
      }
    ]
  }
}`
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokenCount(text) {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4)
  }

  /**
   * Check if text exceeds token limits
   */
  exceedsTokenLimit(text) {
    return this.estimateTokenCount(text) > this.maxTokens
  }
}

export default GeminiPromptFormatter