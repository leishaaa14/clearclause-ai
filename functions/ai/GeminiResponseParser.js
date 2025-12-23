/**
 * Gemini Response Parser
 * Handles parsing of Gemini API responses into the application's expected data structure
 */

export class GeminiResponseParser {
  constructor() {
    this.fallbackEnabled = true
  }

  /**
   * Parse Gemini API response into structured analysis format
   */
  parseGeminiResponse(geminiResponse, originalText) {
    try {
      // Handle Gemini API response structure
      let responseText = ''
      
      if (geminiResponse.candidates && geminiResponse.candidates[0]) {
        const candidate = geminiResponse.candidates[0]
        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
          responseText = candidate.content.parts[0].text
        }
      } else if (typeof geminiResponse === 'string') {
        responseText = geminiResponse
      } else {
        throw new Error('Invalid Gemini response structure')
      }

      // Parse the response text as JSON
      return this.parseResponseText(responseText, originalText)
    } catch (error) {
      console.error('Gemini response parsing error:', error)
      
      if (this.fallbackEnabled) {
        console.log('Using fallback parsing for Gemini response...')
        return this.createFallbackAnalysis(originalText, error.message)
      }
      
      throw error
    }
  }

  /**
   * Parse response text into structured format
   */
  parseResponseText(responseText, originalText) {
    try {
      // Clean the response text
      let cleanedResponse = this.cleanResponseText(responseText)
      
      // Try to parse as JSON
      const analysis = JSON.parse(cleanedResponse)
      
      // Validate the parsed analysis
      this.validateAnalysisStructure(analysis)
      
      return analysis
    } catch (parseError) {
      console.log('JSON parsing failed, attempting text parsing...', parseError.message)
      
      // Fallback to text parsing for non-JSON responses
      return this.parseStructuredTextResponse(responseText, originalText)
    }
  }

  /**
   * Clean response text to extract valid JSON
   */
  cleanResponseText(responseText) {
    let cleaned = responseText.trim()
    
    // Remove markdown code blocks if present
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    
    // Remove any leading/trailing text that's not JSON
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd = cleaned.lastIndexOf('}')
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
    }
    
    return cleaned
  }

  /**
   * Validate that the analysis has the expected structure
   */
  validateAnalysisStructure(analysis) {
    const requiredFields = ['summary', 'clauses', 'risks', 'keyTerms', 'recommendations', 'qualityMetrics']
    
    for (const field of requiredFields) {
      if (!analysis.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // Validate summary structure
    if (!analysis.summary.documentType) {
      throw new Error('Missing documentType in summary')
    }

    // Ensure arrays are actually arrays
    const arrayFields = ['clauses', 'risks', 'keyTerms', 'recommendations']
    for (const field of arrayFields) {
      if (!Array.isArray(analysis[field])) {
        analysis[field] = []
      }
    }
  }

  /**
   * Parse structured text response (fallback for non-JSON responses)
   */
  parseStructuredTextResponse(responseText, originalText) {
    const analysis = {
      summary: {
        documentType: this.extractDocumentType(responseText, originalText),
        keyPurpose: "Contract analysis and risk assessment",
        mainParties: this.extractParties(responseText) || ["Party A", "Party B"],
        effectiveDate: new Date().toISOString().split('T')[0],
        expirationDate: null,
        totalClausesIdentified: 0,
        completenessScore: 85
      },
      clauses: [],
      risks: [],
      keyTerms: [],
      recommendations: [],
      qualityMetrics: {
        clauseDetectionConfidence: 75,
        analysisCompleteness: 85,
        potentialMissedClauses: []
      }
    }

    // Extract clauses from structured text
    this.extractClausesFromText(responseText, analysis)
    
    // Extract risks from structured text
    this.extractRisksFromText(responseText, analysis)
    
    // Extract key terms
    this.extractKeyTermsFromText(responseText, analysis)
    
    // Extract recommendations
    this.extractRecommendationsFromText(responseText, analysis)

    // Update summary with extracted data
    analysis.summary.totalClausesIdentified = analysis.clauses.length

    return analysis
  }

  /**
   * Extract clauses from structured text response
   */
  extractClausesFromText(responseText, analysis) {
    const clausePatterns = [
      /CLAUSES?[\s\S]*?(?=RISKS?|KEY TERMS?|RECOMMENDATIONS?|$)/i,
      /KEY CLAUSES IDENTIFIED:[\s\S]*?(?=RISKS IDENTIFIED:|KEY TERMS:|RECOMMENDATIONS:|$)/i
    ]

    for (const pattern of clausePatterns) {
      const match = responseText.match(pattern)
      if (match) {
        const clausesSection = match[0]
        const clauseLines = clausesSection.split('\n').filter(line => 
          line.trim().match(/^\d+\./) || line.trim().match(/^-\s/)
        )

        clauseLines.forEach((line, index) => {
          const clauseMatch = line.match(/^\d*\.?\s*([^:]+):\s*(.+)/) || 
                             line.match(/^-\s*([^:]+):\s*(.+)/)
          
          if (clauseMatch) {
            const [, title, description] = clauseMatch
            analysis.clauses.push({
              id: `clause_${index + 1}`,
              title: title.trim(),
              content: description.trim(),
              category: this.categorizeClause(title),
              riskLevel: this.extractRiskLevel(description),
              explanation: description.trim(),
              sourceLocation: `Section ${index + 1}`,
              keyTerms: this.extractKeyTermsFromClause(title + ' ' + description)
            })
          }
        })
        break
      }
    }
  }

  /**
   * Extract risks from structured text response
   */
  extractRisksFromText(responseText, analysis) {
    const riskPatterns = [
      /RISKS?[\s\S]*?(?=KEY TERMS?|RECOMMENDATIONS?|OVERALL|$)/i,
      /RISKS IDENTIFIED:[\s\S]*?(?=KEY TERMS:|RECOMMENDATIONS:|OVERALL ASSESSMENT:|$)/i
    ]

    for (const pattern of riskPatterns) {
      const match = responseText.match(pattern)
      if (match) {
        const risksSection = match[0]
        const riskLines = risksSection.split('\n').filter(line => 
          line.trim().match(/^\d+\./) || line.trim().match(/^-\s/)
        )

        riskLines.forEach((line, index) => {
          const riskMatch = line.match(/^\d*\.?\s*([^:]+):\s*(.+)/) || 
                           line.match(/^-\s*([^:]+):\s*(.+)/)
          
          if (riskMatch) {
            const [, title, description] = riskMatch
            analysis.risks.push({
              id: `risk_${index + 1}`,
              title: title.trim(),
              description: description.trim(),
              severity: this.extractSeverity(description),
              category: this.categorizeRisk(title),
              recommendation: `Address ${title.toLowerCase()} through appropriate measures`,
              clauseReference: analysis.clauses[0]?.id || 'general',
              supportingText: description.trim()
            })
          }
        })
        break
      }
    }
  }

  /**
   * Extract key terms from structured text response
   */
  extractKeyTermsFromText(responseText, analysis) {
    const keyTermsPattern = /KEY TERMS?:[\s\S]*?(?=RECOMMENDATIONS?|OVERALL|$)/i
    const match = responseText.match(keyTermsPattern)
    
    if (match) {
      const termsSection = match[0]
      const termLines = termsSection.split('\n').filter(line => 
        line.trim().match(/^-\s/) || line.trim().match(/^\*\s/)
      )

      termLines.forEach(line => {
        const termMatch = line.match(/^[-*]\s*([^:]+):\s*(.+)/)
        if (termMatch) {
          const [, term, definition] = termMatch
          analysis.keyTerms.push({
            term: term.trim(),
            definition: definition.trim(),
            importance: 'medium',
            context: 'Document analysis'
          })
        }
      })
    }
  }

  /**
   * Extract recommendations from structured text response
   */
  extractRecommendationsFromText(responseText, analysis) {
    const recommendationsPattern = /RECOMMENDATIONS?:[\s\S]*?(?=OVERALL|$)/i
    const match = responseText.match(recommendationsPattern)
    
    if (match) {
      const recSection = match[0]
      const recLines = recSection.split('\n').filter(line => 
        line.trim().match(/^\d+\./) || line.trim().match(/^-\s/)
      )

      recLines.forEach(line => {
        const recMatch = line.match(/^\d*\.?\s*([^:]*?):\s*(.+)/) || 
                        line.match(/^-\s*(.+)/)
        
        if (recMatch) {
          const action = recMatch[2] || recMatch[1]
          const priority = recMatch[1] && recMatch[2] ? 
            (recMatch[1].toLowerCase().includes('high') ? 'high' : 
             recMatch[1].toLowerCase().includes('critical') ? 'critical' : 'medium') : 'medium'
          
          analysis.recommendations.push({
            priority: priority,
            action: action.trim(),
            rationale: 'Important for contract compliance and risk management',
            affectedClauses: analysis.clauses.slice(0, 2).map(c => c.id)
          })
        }
      })
    }
  }

  /**
   * Create fallback analysis when all parsing fails
   */
  createFallbackAnalysis(originalText, errorMessage) {
    const documentType = this.detectDocumentType(originalText)
    
    return {
      summary: {
        documentType: documentType,
        keyPurpose: "Document analysis and risk assessment",
        mainParties: ["Party A", "Party B"],
        effectiveDate: new Date().toISOString().split('T')[0],
        expirationDate: null,
        totalClausesIdentified: 1,
        completenessScore: 70
      },
      clauses: [
        {
          id: "clause_1",
          title: "Main Terms",
          content: originalText.substring(0, Math.min(200, originalText.length)),
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
          title: "Parsing Error Risk",
          description: `Analysis may be incomplete due to parsing error: ${errorMessage}`,
          severity: "medium",
          category: "operational",
          recommendation: "Manual review recommended due to parsing limitations",
          clauseReference: "clause_1",
          supportingText: "Automated analysis encountered technical difficulties"
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
          priority: "high",
          action: "Manual review recommended due to parsing error",
          rationale: "Automated analysis was incomplete",
          affectedClauses: ["clause_1"]
        }
      ],
      qualityMetrics: {
        clauseDetectionConfidence: 50,
        analysisCompleteness: 70,
        potentialMissedClauses: ["parsing_error_affected"]
      }
    }
  }

  // Helper methods (similar to existing ones but optimized for Gemini responses)
  
  extractDocumentType(responseText, originalText) {
    // Try to extract from response first
    const typeMatch = responseText.match(/DOCUMENT TYPE:\s*([^\n]+)/i)
    if (typeMatch) {
      return typeMatch[1].trim()
    }
    
    // Fallback to content detection
    return this.detectDocumentType(originalText)
  }

  detectDocumentType(documentText) {
    const text = documentText.toLowerCase()
    
    if (text.includes('non-disclosure') || text.includes('confidential') || text.includes('nda')) {
      return 'Non-Disclosure Agreement'
    } else if (text.includes('employment') || text.includes('employee')) {
      return 'Employment Agreement'
    } else if (text.includes('service') || text.includes('consulting')) {
      return 'Service Agreement'
    } else if (text.includes('license') || text.includes('software')) {
      return 'License Agreement'
    } else if (text.includes('lease') || text.includes('rent')) {
      return 'Lease Agreement'
    } else {
      return 'Legal Agreement'
    }
  }

  extractParties(responseText) {
    const partiesMatch = responseText.match(/MAIN PARTIES?:\s*([^\n]+)/i)
    if (partiesMatch) {
      return partiesMatch[1].split(',').map(p => p.trim()).filter(p => p.length > 0)
    }
    return null
  }

  categorizeClause(title) {
    const titleLower = title.toLowerCase()
    if (titleLower.includes('confidential') || titleLower.includes('disclosure')) return 'confidentiality'
    if (titleLower.includes('payment') || titleLower.includes('fee')) return 'payment'
    if (titleLower.includes('term') || titleLower.includes('duration')) return 'termination'
    if (titleLower.includes('liability') || titleLower.includes('damage')) return 'liability'
    if (titleLower.includes('intellectual') || titleLower.includes('property')) return 'intellectual_property'
    if (titleLower.includes('warranty') || titleLower.includes('guarantee')) return 'warranty'
    if (titleLower.includes('governing') || titleLower.includes('law')) return 'governing_law'
    return 'general'
  }

  extractRiskLevel(description) {
    const descLower = description.toLowerCase()
    if (descLower.includes('critical') || descLower.includes('severe')) return 'critical'
    if (descLower.includes('high') || descLower.includes('significant')) return 'high'
    if (descLower.includes('low') || descLower.includes('minor')) return 'low'
    return 'medium'
  }

  extractSeverity(description) {
    return this.extractRiskLevel(description)
  }

  categorizeRisk(title) {
    const titleLower = title.toLowerCase()
    if (titleLower.includes('financial') || titleLower.includes('payment') || titleLower.includes('cost')) return 'financial'
    if (titleLower.includes('legal') || titleLower.includes('compliance') || titleLower.includes('regulatory')) return 'legal'
    if (titleLower.includes('operational') || titleLower.includes('business') || titleLower.includes('process')) return 'operational'
    return 'legal'
  }

  extractKeyTermsFromClause(text) {
    const words = text.toLowerCase().split(/\s+/)
    const importantWords = words.filter(word => 
      word.length > 4 && 
      !['agreement', 'contract', 'party', 'shall', 'will', 'may', 'must'].includes(word)
    )
    return importantWords.slice(0, 3)
  }
}

export default GeminiResponseParser