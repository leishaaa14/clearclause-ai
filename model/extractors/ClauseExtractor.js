// Clause Extraction System
// Handles identification, categorization, and grouping of contract clauses

import { ModelConfig } from '../config/ModelConfig.js';
import winston from 'winston';

// Configure logger for clause extraction
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'clause-extractor.log' })
  ]
});

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
    
    // Performance tracking
    this.extractionMetrics = {
      totalExtractions: 0,
      averageClausesPerDocument: 0,
      averageConfidence: 0,
      processingTime: 0
    };
  }

  /**
   * Identify clauses in contract text using AI-powered analysis
   * @param {string} text - Contract text to analyze
   * @returns {Promise<Array>} - Array of identified clauses
   */
  async identifyClauses(text) {
    if (typeof text !== 'string') {
      throw new Error('Valid text string is required for clause identification');
    }

    // Handle empty or very short text
    if (text.trim().length === 0) {
      return [];
    }

    const startTime = Date.now();
    
    try {
      logger.info('Starting clause identification', {
        textLength: text.length,
        modelAvailable: !!this.modelManager
      });

      let clauses = [];

      if (this.modelManager && this.modelManager.isLoaded) {
        // Use AI model for advanced clause identification
        clauses = await this.identifyClausesWithAI(text);
      } else {
        // Fallback to pattern-based identification
        logger.warn('AI model not available, using fallback clause identification');
        clauses = await this.identifyClausesWithPatterns(text);
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(clauses, processingTime);

      logger.info('Clause identification completed', {
        clausesFound: clauses.length,
        processingTime,
        averageClauseLength: clauses.reduce((sum, c) => sum + c.text.length, 0) / clauses.length
      });

      return clauses;
    } catch (error) {
      logger.error('Clause identification failed', {
        error: error.message,
        textLength: text.length,
        processingTime: Date.now() - startTime
      });
      throw new Error(`Clause identification failed: ${error.message}`);
    }
  }

  /**
   * Identify clauses using AI model inference
   * @param {string} text - Contract text
   * @returns {Promise<Array>} - Array of identified clauses
   * @private
   */
  async identifyClausesWithAI(text) {
    const prompt = `
You are a legal AI assistant specialized in contract analysis. Identify individual clauses in the following contract text.

Contract Text:
${text}

Instructions:
1. Identify distinct legal clauses (not just sentences)
2. Each clause should represent a complete legal concept or obligation
3. Provide the exact text of each clause
4. Include position information for each clause
5. Assign a unique ID to each clause

Return your response in the following JSON format:
{
  "clauses": [
    {
      "id": "clause_1",
      "text": "exact clause text from the contract",
      "startPosition": 0,
      "endPosition": 100
    }
  ]
}

Only return valid JSON, no additional text.`;

    try {
      const response = await this.modelManager.inference(prompt, {
        temperature: 0.1,
        maxTokens: 4000
      });

      const parsed = JSON.parse(response);
      
      if (!parsed.clauses || !Array.isArray(parsed.clauses)) {
        throw new Error('Invalid AI response format');
      }

      return parsed.clauses.map((clause, index) => {
        const startPos = clause.startPosition !== undefined ? clause.startPosition : text.indexOf(clause.text);
        const validStartPos = startPos >= 0 ? startPos : 0;
        
        return {
          id: clause.id || `ai_clause_${index}`,
          text: clause.text,
          startPosition: validStartPos,
          endPosition: clause.endPosition !== undefined ? clause.endPosition : (validStartPos + clause.text.length)
        };
      });
    } catch (error) {
      logger.warn('AI clause identification failed, falling back to patterns', {
        error: error.message
      });
      return await this.identifyClausesWithPatterns(text);
    }
  }

  /**
   * Identify clauses using pattern-based analysis (fallback)
   * @param {string} text - Contract text
   * @returns {Promise<Array>} - Array of identified clauses
   * @private
   */
  async identifyClausesWithPatterns(text) {
    const clauses = [];
    
    // Split by common clause separators
    const clausePatterns = [
      /\n\s*\d+\.\s+/g,  // Numbered clauses (1. 2. etc.)
      /\n\s*\([a-z]\)\s+/g,  // Lettered subclauses (a) b) etc.)
      /\n\s*[A-Z][A-Z\s]+:\s*/g,  // Section headers (PAYMENT TERMS:)
      /\.\s+(?=[A-Z])/g  // Sentence boundaries followed by capital letters
    ];

    let segments = [text];
    
    // Apply each pattern to split the text
    clausePatterns.forEach(pattern => {
      const newSegments = [];
      segments.forEach(segment => {
        const parts = segment.split(pattern);
        newSegments.push(...parts);
      });
      segments = newSegments;
    });

    // Filter and process segments into clauses
    segments.forEach((segment, index) => {
      const trimmed = segment.trim();
      if (trimmed.length > 30) { // Only consider substantial clauses
        const startPos = text.indexOf(trimmed);
        const validStartPos = startPos >= 0 ? startPos : 0;
        clauses.push({
          id: `pattern_clause_${index}`,
          text: trimmed,
          startPosition: validStartPos,
          endPosition: validStartPos + trimmed.length
        });
      }
    });

    return clauses;
  }

  /**
   * Categorize clauses into predefined types using AI analysis
   * @param {Array} clauses - Array of clause objects
   * @returns {Promise<Array>} - Array of categorized clauses
   */
  async categorizeClauses(clauses) {
    if (!Array.isArray(clauses)) {
      throw new Error('Clauses must be an array');
    }

    logger.info('Starting clause categorization', {
      clauseCount: clauses.length,
      supportedTypes: this.supportedClauseTypes.length
    });

    const categorizedClauses = [];

    for (const clause of clauses) {
      try {
        let category, confidence;
        
        if (this.modelManager && this.modelManager.isLoaded) {
          // Use AI model for categorization
          const result = await this.categorizeClauseWithAI(clause);
          category = result.category;
          confidence = result.confidence;
        } else {
          // Fallback to keyword-based categorization
          category = await this.determineClauseType(clause.text);
          confidence = await this.calculateConfidence(clause, category);
        }
        
        categorizedClauses.push({
          ...clause,
          type: category,
          category: category,
          confidence: confidence
        });

        logger.debug('Clause categorized', {
          clauseId: clause.id,
          category,
          confidence,
          textLength: clause.text.length
        });
      } catch (error) {
        logger.error('Failed to categorize clause', {
          clauseId: clause.id,
          error: error.message
        });
        
        // Add clause with unknown category on error
        categorizedClauses.push({
          ...clause,
          type: 'unknown',
          category: 'unknown',
          confidence: 0
        });
      }
    }

    logger.info('Clause categorization completed', {
      totalClauses: categorizedClauses.length,
      averageConfidence: categorizedClauses.reduce((sum, c) => sum + c.confidence, 0) / categorizedClauses.length
    });

    return categorizedClauses;
  }

  /**
   * Categorize a single clause using AI model
   * @param {Object} clause - Clause object
   * @returns {Promise<Object>} - Category and confidence
   * @private
   */
  async categorizeClauseWithAI(clause) {
    const prompt = `
You are a legal AI assistant specialized in contract clause categorization. Categorize the following clause into one of the predefined types.

Clause Text:
"${clause.text}"

Supported Clause Types:
${this.supportedClauseTypes.join(', ')}

Instructions:
1. Analyze the clause content and legal meaning
2. Select the most appropriate category from the supported types
3. Assign a confidence score (0.0-1.0) based on how certain you are
4. If the clause doesn't fit any category well, use "unknown"

Return your response in the following JSON format:
{
  "category": "selected_category",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this category was chosen"
}

Only return valid JSON, no additional text.`;

    try {
      const response = await this.modelManager.inference(prompt, {
        temperature: 0.1,
        maxTokens: 200
      });

      const parsed = JSON.parse(response);
      
      if (!parsed.category) {
        throw new Error('Invalid AI categorization response');
      }

      // Validate category is supported
      const category = this.supportedClauseTypes.includes(parsed.category) 
        ? parsed.category 
        : 'unknown';

      return {
        category,
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1)
      };
    } catch (error) {
      logger.warn('AI categorization failed, using fallback', {
        clauseId: clause.id,
        error: error.message
      });
      
      // Fallback to keyword-based categorization
      const category = await this.determineClauseType(clause.text);
      const confidence = await this.calculateConfidence(clause, category);
      
      return { category, confidence };
    }
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

    // Simple confidence calculation based on keyword matching
    // In a real implementation, this would use AI model confidence scores
    const keywords = this.getKeywordsForCategory(category);
    const text = clause.text.toLowerCase();
    
    if (keywords.length === 0) {
      return 0.5; // Default confidence for unknown categories
    }
    
    let matchCount = 0;
    keywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    });

    const confidence = Math.min(matchCount / keywords.length, 1.0);
    const result = Math.round(confidence * 100) / 100; // Round to 2 decimal places
    
    // Ensure we never return NaN
    return isNaN(result) ? 0 : result;
  }

  /**
   * Generate clause type summary counts
   * @param {Array} categorizedClauses - Array of categorized clauses
   * @returns {Object} - Summary with total counts and type breakdown
   */
  generateClauseSummary(categorizedClauses) {
    if (!Array.isArray(categorizedClauses)) {
      throw new Error('Categorized clauses must be an array');
    }

    const summary = {
      totalClauses: categorizedClauses.length,
      clauseTypeCounts: {},
      averageConfidence: 0,
      highConfidenceClauses: 0,
      unknownClauses: 0
    };

    // Initialize counts for all supported types
    this.supportedClauseTypes.forEach(type => {
      summary.clauseTypeCounts[type] = 0;
    });

    // Count clauses by type and calculate metrics
    let totalConfidence = 0;
    let highConfidenceCount = 0;

    categorizedClauses.forEach(clause => {
      const type = clause.type || 'unknown';
      
      if (summary.clauseTypeCounts.hasOwnProperty(type)) {
        summary.clauseTypeCounts[type]++;
      } else {
        summary.clauseTypeCounts[type] = 1;
      }

      if (type === 'unknown') {
        summary.unknownClauses++;
      }

      totalConfidence += clause.confidence || 0;
      
      if (clause.confidence >= 0.8) {
        highConfidenceCount++;
      }
    });

    summary.averageConfidence = categorizedClauses.length > 0 
      ? Math.round((totalConfidence / categorizedClauses.length) * 100) / 100 
      : 0;
    
    summary.highConfidenceClauses = highConfidenceCount;

    logger.info('Clause summary generated', {
      totalClauses: summary.totalClauses,
      averageConfidence: summary.averageConfidence,
      highConfidenceClauses: summary.highConfidenceClauses,
      unknownClauses: summary.unknownClauses
    });

    return summary;
  }

  /**
   * Get supported clause types
   * @returns {Array} - Array of supported clause types
   */
  getSupportedClauseTypes() {
    return [...this.supportedClauseTypes];
  }

  /**
   * Update extraction metrics
   * @param {Array} clauses - Extracted clauses
   * @param {number} processingTime - Processing time in milliseconds
   * @private
   */
  updateMetrics(clauses, processingTime) {
    this.extractionMetrics.totalExtractions++;
    
    const currentAvg = this.extractionMetrics.averageClausesPerDocument;
    this.extractionMetrics.averageClausesPerDocument = 
      (currentAvg * (this.extractionMetrics.totalExtractions - 1) + clauses.length) / 
      this.extractionMetrics.totalExtractions;

    this.extractionMetrics.processingTime = processingTime;

    if (clauses.length > 0) {
      const avgConfidence = clauses.reduce((sum, c) => sum + (c.confidence || 0), 0) / clauses.length;
      const currentConfidenceAvg = this.extractionMetrics.averageConfidence;
      this.extractionMetrics.averageConfidence = 
        (currentConfidenceAvg * (this.extractionMetrics.totalExtractions - 1) + avgConfidence) / 
        this.extractionMetrics.totalExtractions;
    }
  }

  /**
   * Get extraction performance metrics
   * @returns {Object} - Performance metrics
   */
  getMetrics() {
    return { ...this.extractionMetrics };
  }

  /**
   * Reset extraction metrics
   */
  resetMetrics() {
    this.extractionMetrics = {
      totalExtractions: 0,
      averageClausesPerDocument: 0,
      averageConfidence: 0,
      processingTime: 0
    };
    
    logger.info('Extraction metrics reset');
  }

  /**
   * Determine clause type based on text content
   * @param {string} text - Clause text
   * @returns {string} - Determined clause type
   * @private
   */
  async determineClauseType(text) {
    if (!text) return 'unknown';

    const lowerText = text.toLowerCase();
    
    // Simple keyword-based categorization
    // In a real implementation, this would use AI model inference
    if (lowerText.includes('payment') || lowerText.includes('pay') || lowerText.includes('invoice')) {
      return 'payment_terms';
    }
    if (lowerText.includes('terminate') || lowerText.includes('termination') || lowerText.includes('end')) {
      return 'termination_clause';
    }
    if (lowerText.includes('liability') || lowerText.includes('liable') || lowerText.includes('damages')) {
      return 'liability_limitation';
    }
    if (lowerText.includes('confidential') || lowerText.includes('non-disclosure') || lowerText.includes('secret')) {
      return 'confidentiality_agreement';
    }
    if (lowerText.includes('intellectual property') || lowerText.includes('copyright') || lowerText.includes('patent')) {
      return 'intellectual_property';
    }
    if (lowerText.includes('force majeure') || lowerText.includes('act of god') || lowerText.includes('unforeseeable')) {
      return 'force_majeure';
    }
    if (lowerText.includes('governing law') || lowerText.includes('jurisdiction') || lowerText.includes('applicable law')) {
      return 'governing_law';
    }
    if (lowerText.includes('dispute') || lowerText.includes('arbitration') || lowerText.includes('mediation')) {
      return 'dispute_resolution';
    }
    if (lowerText.includes('warrant') || lowerText.includes('represent') || lowerText.includes('guarantee')) {
      return 'warranties_representations';
    }
    if (lowerText.includes('indemnif') || lowerText.includes('hold harmless') || lowerText.includes('defend')) {
      return 'indemnification';
    }
    if (lowerText.includes('assign') || lowerText.includes('transfer') || lowerText.includes('delegate')) {
      return 'assignment_rights';
    }
    if (lowerText.includes('amend') || lowerText.includes('modif') || lowerText.includes('change')) {
      return 'amendment_modification';
    }
    if (lowerText.includes('severab') || lowerText.includes('invalid') || lowerText.includes('unenforceable')) {
      return 'severability_clause';
    }
    if (lowerText.includes('entire agreement') || lowerText.includes('complete agreement') || lowerText.includes('supersede')) {
      return 'entire_agreement';
    }
    if (lowerText.includes('notice') || lowerText.includes('notification') || lowerText.includes('inform')) {
      return 'notice_provisions';
    }

    return 'unknown';
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