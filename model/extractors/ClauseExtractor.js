// Clause Extraction System
// Handles identification, categorization, and grouping of contract clauses

export class ClauseExtractor {
  constructor(modelManager = null) {
    this.modelManager = modelManager;
    this.supportedClauseTypes = [
      'payment_terms',
      'termination_clause',
      'liability_limitation',
      'confidentiality_agreement',
      'intellectual_property',
      'force_majeure',
      'governing_law',
      'dispute_resolution',
      'warranties_representations',
      'indemnification',
      'assignment_rights',
      'amendment_modification',
      'severability_clause',
      'entire_agreement',
      'notice_provisions'
    ];
  }

  /**
   * Identify clauses in contract text
   * @param {string} text - Contract text to analyze
   * @returns {Promise<Array>} - Array of identified clauses
   */
  async identifyClauses(text) {
    // Check if text is a string first
    if (typeof text !== 'string') {
      throw new Error('Valid text string is required for clause identification');
    }

    // Handle empty or whitespace-only text (return empty array, don't throw)
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Use AI model if available, otherwise fall back to rule-based approach
    if (this.modelManager && this.modelManager.isLoaded) {
      try {
        return await this._identifyClausesWithAI(text);
      } catch (error) {
        console.warn('AI clause identification failed, falling back to rule-based approach:', error.message);
        return await this._identifyClausesRuleBased(text);
      }
    } else {
      return await this._identifyClausesRuleBased(text);
    }
  }

  /**
   * Categorize clauses into predefined types
   * @param {Array} clauses - Array of clause objects
   * @returns {Promise<Array>} - Array of categorized clauses
   */
  async categorizeClauses(clauses) {
    if (!Array.isArray(clauses)) {
      throw new Error('Clauses must be an array');
    }

    const categorizedClauses = [];

    for (const clause of clauses) {
      const category = await this.determineClauseType(clause.text);
      const confidence = await this.calculateConfidence(clause, category);

      categorizedClauses.push({
        ...clause,
        type: category,
        category: category,
        confidence: confidence
      });
    }

    return categorizedClauses;
  }

  /**
   * Group clauses by type while preserving individual text
   * @param {Array} categorizedClauses - Array of categorized clauses
   * @returns {Object} - Grouped clauses with individual text preserved
   */
  groupClausesByType(categorizedClauses) {
    if (!Array.isArray(categorizedClauses)) {
      throw new Error('Categorized clauses must be an array');
    }

    const grouped = {};

    // Initialize groups for all supported types
    this.supportedClauseTypes.forEach(type => {
      grouped[type] = {
        type: type,
        clauses: [],
        count: 0
      };
    });

    // Group clauses by type
    categorizedClauses.forEach(clause => {
      const type = clause.type || 'unknown';

      if (!grouped[type]) {
        grouped[type] = {
          type: type,
          clauses: [],
          count: 0
        };
      }

      // Preserve individual clause text and metadata exactly as provided
      grouped[type].clauses.push({
        id: clause.id,
        text: clause.text,
        confidence: clause.confidence,
        startPosition: clause.startPosition,
        endPosition: clause.endPosition
      });

      grouped[type].count = grouped[type].clauses.length;
    });

    return grouped;
  }

  /**
   * Calculate confidence score for clause categorization
   * @param {Object} clause - Clause object
   * @param {string} category - Assigned category
   * @returns {Promise<number>} - Confidence score between 0 and 1
   */
  async calculateConfidence(clause, category) {
    if (!clause || !clause.text) {
      return 0;
    }

    // Enhanced confidence calculation based on keyword matching
    const keywords = this.getKeywordsForCategory(category);
    const text = clause.text.toLowerCase();

    let matchCount = 0;
    let strongMatchCount = 0;

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      if (text.includes(keywordLower)) {
        matchCount++;

        // Check for strong matches (keyword appears multiple times or is prominent)
        const occurrences = (text.match(new RegExp(keywordLower, 'g')) || []).length;
        if (occurrences > 1) {
          strongMatchCount++;
        }
      }
    });

    // Base confidence from keyword matches
    let confidence = 0;

    if (matchCount > 0) {
      // At least one keyword match gives minimum 0.6 confidence
      confidence = 0.6 + (matchCount / keywords.length) * 0.3;

      // Strong matches boost confidence
      if (strongMatchCount > 0) {
        confidence += 0.1;
      }
    } else if (category === 'unknown') {
      // Unknown category gets low confidence
      confidence = 0.3;
    }

    // Ensure confidence is between 0 and 1
    confidence = Math.min(Math.max(confidence, 0), 1.0);

    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Extract clauses from contract text (main entry point)
   * @param {string} text - Contract text to analyze
   * @returns {Promise<Object>} - Extraction results with clauses and summary
   */
  async extractClauses(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Valid text string is required for clause extraction');
    }

    try {
      // Step 1: Identify clauses in the text
      const identifiedClauses = await this.identifyClauses(text);

      // Step 2: Categorize the identified clauses
      const categorizedClauses = await this.categorizeClauses(identifiedClauses);

      // Step 3: Group clauses by type
      const groupedClauses = this.groupClausesByType(categorizedClauses);

      // Step 4: Generate summary
      const summary = this.generateClauseSummary(categorizedClauses, groupedClauses);

      return {
        clauses: categorizedClauses,
        grouped: groupedClauses,
        summary: summary
      };
    } catch (error) {
      throw new Error(`Clause extraction failed: ${error.message}`);
    }
  }

  /**
   * Generate clause summary with counts and statistics
   * @param {Array} categorizedClauses - Array of categorized clauses
   * @param {Object} groupedClauses - Grouped clauses by type
   * @returns {Object} - Summary statistics
   */
  generateClauseSummary(categorizedClauses, groupedClauses) {
    const clauseTypes = {};

    // Count clauses by type
    categorizedClauses.forEach(clause => {
      const type = clause.type || 'unknown';
      clauseTypes[type] = (clauseTypes[type] || 0) + 1;
    });

    // Calculate average confidence
    const totalConfidence = categorizedClauses.reduce((sum, clause) => sum + (clause.confidence || 0), 0);
    const averageConfidence = categorizedClauses.length > 0 ? totalConfidence / categorizedClauses.length : 0;

    return {
      totalClauses: categorizedClauses.length,
      clauseTypes: clauseTypes,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      supportedTypes: this.supportedClauseTypes.length,
      identifiedTypes: Object.keys(clauseTypes).length
    };
  }

  /**
   * Get supported clause types
   * @returns {Array} - Array of supported clause types
   */
  getSupportedClauseTypes() {
    return [...this.supportedClauseTypes];
  }

  /**
   * Identify clauses using AI model
   * @param {string} text - Contract text
   * @returns {Promise<Array>} - Array of identified clauses
   * @private
   */
  async _identifyClausesWithAI(text) {
    const prompt = this._buildClauseExtractionPrompt(text);

    try {
      const response = await this.modelManager.inference(prompt, {
        temperature: 0.1,
        maxTokens: 4000,
        format: 'json'
      });

      const parsedResponse = JSON.parse(response);

      if (!parsedResponse.clauses || !Array.isArray(parsedResponse.clauses)) {
        throw new Error('Invalid AI response format');
      }

      return parsedResponse.clauses.map((clause, index) => ({
        id: clause.id || `clause_${index + 1}`,
        text: clause.text || '',
        startPosition: clause.startPosition || 0,
        endPosition: clause.endPosition || clause.text?.length || 0
      }));
    } catch (error) {
      throw new Error(`AI clause identification failed: ${error.message}`);
    }
  }

  /**
   * Identify clauses using rule-based approach (fallback)
   * @param {string} text - Contract text
   * @returns {Promise<Array>} - Array of identified clauses
   * @private
   */
  async _identifyClausesRuleBased(text) {
    const clauses = [];

    // Enhanced clause identification with multiple strategies

    // Strategy 1: Split by common clause separators and patterns
    const sectionPatterns = [
      /(?:\n\s*\d+\.)/g,
      /(?:\n\s*[A-Z]\.)/g,
      /(?:Section \d+)/gi,
      /(?:Article \d+)/gi,
      /(?:\n\s*\([a-z]\))/g,
      /(?:\n\s*\d+\.\d+)/g
    ];

    let sections = [text];

    // Apply each pattern to split the text
    for (const pattern of sectionPatterns) {
      const newSections = [];
      for (const section of sections) {
        newSections.push(...section.split(pattern));
      }
      sections = newSections;
    }

    // Process sections
    sections.forEach((section, index) => {
      const trimmed = section.trim();
      if (trimmed.length > 30) { // Lowered threshold for better detection
        const startPos = text.indexOf(trimmed);
        clauses.push({
          id: `clause_${index + 1}`,
          text: trimmed,
          startPosition: startPos >= 0 ? startPos : 0,
          endPosition: startPos >= 0 ? startPos + trimmed.length : trimmed.length
        });
      }
    });

    // Strategy 2: If no clear sections found, use sentence-based splitting with keyword detection
    if (clauses.length === 0) {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

      sentences.forEach((sentence, index) => {
        const trimmed = sentence.trim();
        if (trimmed.length > 15) { // Lowered threshold
          const startPos = text.indexOf(trimmed);
          clauses.push({
            id: `clause_${index + 1}`,
            text: trimmed,
            startPosition: startPos >= 0 ? startPos : 0,
            endPosition: startPos >= 0 ? startPos + trimmed.length : trimmed.length
          });
        }
      });
    }

    // Strategy 3: If still no clauses, create clauses based on keyword presence
    if (clauses.length === 0) {
      const keywordPatterns = [
        /payment[^.]*\./gi,
        /termination[^.]*\./gi,
        /liability[^.]*\./gi,
        /confidential[^.]*\./gi,
        /intellectual property[^.]*\./gi,
        /indemnif[^.]*\./gi
      ];

      let clauseIndex = 1;
      for (const pattern of keywordPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const startPos = text.indexOf(match);
            clauses.push({
              id: `clause_${clauseIndex++}`,
              text: match.trim(),
              startPosition: startPos >= 0 ? startPos : 0,
              endPosition: startPos >= 0 ? startPos + match.length : match.length
            });
          });
        }
      }
    }

    // Strategy 4: Final fallback - create artificial clauses from paragraphs
    if (clauses.length === 0 && text.trim().length > 0) {
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

      if (paragraphs.length > 0) {
        paragraphs.forEach((paragraph, index) => {
          const trimmed = paragraph.trim();
          if (trimmed.length > 10) {
            const startPos = text.indexOf(trimmed);
            clauses.push({
              id: `clause_${index + 1}`,
              text: trimmed,
              startPosition: startPos >= 0 ? startPos : 0,
              endPosition: startPos >= 0 ? startPos + trimmed.length : trimmed.length
            });
          }
        });
      } else {
        // Last resort: treat entire text as one clause
        clauses.push({
          id: 'clause_1',
          text: text.trim(),
          startPosition: 0,
          endPosition: text.length
        });
      }
    }

    return clauses;
  }

  /**
   * Build clause extraction prompt for AI model
   * @param {string} text - Contract text
   * @returns {string} - Formatted prompt
   * @private
   */
  _buildClauseExtractionPrompt(text) {
    return `You are a legal AI assistant specialized in contract analysis. Extract and identify individual clauses from the following contract text.

CONTRACT TEXT:
${text}

INSTRUCTIONS:
1. Identify individual clauses in the contract
2. Extract the full text of each clause
3. Determine the start and end positions of each clause
4. Assign unique IDs to each clause

Return your response in the following JSON format:
{
  "clauses": [
    {
      "id": "clause_1",
      "text": "full clause text",
      "startPosition": 0,
      "endPosition": 100
    }
  ]
}

Focus on identifying meaningful contract provisions, not just sentences. Look for:
- Payment and billing terms
- Termination conditions
- Liability and indemnification clauses
- Intellectual property provisions
- Confidentiality agreements
- Governing law and dispute resolution
- Warranties and representations
- Assignment and transfer rights`;
  }

  /**
   * Determine clause type based on text content
   * @param {string} text - Clause text
   * @returns {string} - Determined clause type
   * @private
   */
  async determineClauseType(text) {
    if (!text) return 'unknown';

    // Use AI model if available for better categorization
    if (this.modelManager && this.modelManager.isLoaded) {
      try {
        return await this._categorizeWithAI(text);
      } catch (error) {
        console.warn('AI categorization failed, using rule-based approach:', error.message);
        return this._categorizeRuleBased(text);
      }
    } else {
      return this._categorizeRuleBased(text);
    }
  }

  /**
   * Categorize clause using AI model
   * @param {string} text - Clause text
   * @returns {Promise<string>} - Clause type
   * @private
   */
  async _categorizeWithAI(text) {
    const prompt = `You are a legal AI assistant. Categorize the following contract clause into one of these types:

CLAUSE TYPES: ${this.supportedClauseTypes.join(', ')}

CLAUSE TEXT:
${text}

Respond with only the clause type from the list above. If the clause doesn't clearly fit any category, respond with "unknown".`;

    try {
      const response = await this.modelManager.inference(prompt, {
        temperature: 0.1,
        maxTokens: 50
      });

      const category = response.trim().toLowerCase();
      return this.supportedClauseTypes.includes(category) ? category : 'unknown';
    } catch (error) {
      throw new Error(`AI categorization failed: ${error.message}`);
    }
  }

  /**
   * Categorize clause using rule-based approach
   * @param {string} text - Clause text
   * @returns {string} - Clause type
   * @private
   */
  _categorizeRuleBased(text) {
    const lowerText = text.toLowerCase();

    // Enhanced keyword-based categorization with scoring system
    const categoryScores = {};

    // Score each category based on keyword matches
    const categories = {
      'confidentiality_agreement': ['confidential', 'non-disclosure', 'secret', 'proprietary', 'confidentiality'],
      'payment_terms': ['payment', 'pay', 'invoice', 'billing', 'fee', 'cost'],
      'termination_clause': ['terminate', 'termination', 'end', 'expire', 'cancel'],
      'liability_limitation': ['liability', 'liable', 'damages', 'loss', 'harm', 'limitation'],
      'intellectual_property': ['intellectual property', 'copyright', 'patent', 'trademark', 'ip rights'],
      'force_majeure': ['force majeure', 'act of god', 'unforeseeable', 'beyond control'],
      'governing_law': ['governing law', 'jurisdiction', 'applicable law', 'courts'],
      'dispute_resolution': ['dispute', 'arbitration', 'mediation', 'resolution'],
      'warranties_representations': ['warrant', 'represent', 'guarantee', 'assure'],
      'indemnification': ['indemnify', 'hold harmless', 'defend', 'protect'],
      'assignment_rights': ['assign', 'transfer', 'delegate', 'convey'],
      'amendment_modification': ['amend', 'modify', 'change', 'alter'],
      'severability_clause': ['severable', 'invalid', 'unenforceable', 'separate'],
      'entire_agreement': ['entire agreement', 'complete agreement', 'supersede', 'merge'],
      'notice_provisions': ['notice', 'notification', 'inform', 'notify']
    };

    // Calculate scores for each category
    Object.entries(categories).forEach(([category, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (lowerText.includes(keywordLower)) {
          // Give higher score for exact matches and multiple occurrences
          const occurrences = (lowerText.match(new RegExp(keywordLower, 'g')) || []).length;
          score += occurrences * (keyword.length > 5 ? 2 : 1); // Longer keywords get higher weight
        }
      });
      categoryScores[category] = score;
    });

    // Find the category with the highest score
    let bestCategory = 'unknown';
    let bestScore = 0;

    Object.entries(categoryScores).forEach(([category, score]) => {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    });

    // Only return a category if we have a reasonable confidence (at least one keyword match)
    return bestScore > 0 ? bestCategory : 'unknown';
  }

  /**
   * Get keywords for a specific category
   * @param {string} category - Clause category
   * @returns {Array} - Array of keywords
   * @private
   */
  getKeywordsForCategory(category) {
    const keywordMap = {
      'payment_terms': ['payment', 'pay', 'invoice', 'billing', 'fee'],
      'termination_clause': ['terminate', 'termination', 'end', 'expire', 'cancel'],
      'liability_limitation': ['liability', 'liable', 'damages', 'loss', 'harm'],
      'confidentiality_agreement': ['confidential', 'non-disclosure', 'secret', 'proprietary'],
      'intellectual_property': ['intellectual property', 'copyright', 'patent', 'trademark'],
      'force_majeure': ['force majeure', 'act of god', 'unforeseeable', 'beyond control'],
      'governing_law': ['governing law', 'jurisdiction', 'applicable law', 'courts'],
      'dispute_resolution': ['dispute', 'arbitration', 'mediation', 'resolution'],
      'warranties_representations': ['warrant', 'represent', 'guarantee', 'assure'],
      'indemnification': ['indemnify', 'hold harmless', 'defend', 'protect'],
      'assignment_rights': ['assign', 'transfer', 'delegate', 'convey'],
      'amendment_modification': ['amend', 'modify', 'change', 'alter'],
      'severability_clause': ['severable', 'invalid', 'unenforceable', 'separate'],
      'entire_agreement': ['entire agreement', 'complete agreement', 'supersede', 'merge'],
      'notice_provisions': ['notice', 'notification', 'inform', 'notify']
    };

    return keywordMap[category] || [];
  }
}

export default ClauseExtractor;