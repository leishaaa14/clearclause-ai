/**
 * Gemini Error Handler
 * Comprehensive error handling for Gemini API integration
 */

export class GeminiErrorHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3
    this.baseDelay = options.baseDelay || 1000 // 1 second
    this.maxDelay = options.maxDelay || 32000 // 32 seconds
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5
    this.circuitBreakerTimeout = options.circuitBreakerTimeout || 60000 // 1 minute
    
    this.consecutiveFailures = 0
    this.circuitBreakerOpen = false
    this.circuitBreakerOpenTime = null
  }

  /**
   * Handle errors with categorization and appropriate response
   */
  async handleError(error, context = {}) {
    const errorType = this.categorizeError(error)
    const errorInfo = {
      type: errorType,
      message: error.message,
      context: context,
      timestamp: new Date().toISOString()
    }

    console.error(`🚨 Gemini API Error [${errorType}]:`, errorInfo)

    switch (errorType) {
      case 'AUTHENTICATION_ERROR':
        return this.handleAuthError(error, context)
      
      case 'RATE_LIMIT_EXCEEDED':
        return this.handleRateLimit(error, context)
      
      case 'CONTENT_SAFETY_VIOLATION':
        return this.handleSafetyViolation(error, context)
      
      case 'NETWORK_ERROR':
        return this.handleNetworkError(error, context)
      
      case 'QUOTA_EXHAUSTED':
        return this.handleQuotaExhaustion(error, context)
      
      case 'INVALID_REQUEST':
        return this.handleInvalidRequest(error, context)
      
      case 'SERVICE_UNAVAILABLE':
        return this.handleServiceUnavailable(error, context)
      
      default:
        return this.handleGenericError(error, context)
    }
  }

  /**
   * Categorize error based on error message and properties
   */
  categorizeError(error) {
    const message = error.message?.toLowerCase() || ''
    const code = error.code || error.status

    // Authentication errors
    if (message.includes('api key') || message.includes('unauthorized') || 
        message.includes('authentication') || code === 401) {
      return 'AUTHENTICATION_ERROR'
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests') || 
        code === 429) {
      return 'RATE_LIMIT_EXCEEDED'
    }

    // Content safety
    if (message.includes('safety') || message.includes('blocked') || 
        message.includes('content policy')) {
      return 'CONTENT_SAFETY_VIOLATION'
    }

    // Network errors
    if (message.includes('network') || message.includes('connection') || 
        message.includes('timeout') || message.includes('econnreset') ||
        code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
      return 'NETWORK_ERROR'
    }

    // Quota exhaustion
    if (message.includes('quota') || message.includes('limit exceeded') || 
        code === 403) {
      return 'QUOTA_EXHAUSTED'
    }

    // Invalid request
    if (message.includes('invalid') || message.includes('bad request') || 
        code === 400) {
      return 'INVALID_REQUEST'
    }

    // Service unavailable
    if (message.includes('unavailable') || message.includes('service') || 
        code === 503 || code === 502 || code === 504) {
      return 'SERVICE_UNAVAILABLE'
    }

    return 'GENERIC_ERROR'
  }

  /**
   * Handle authentication errors
   */
  async handleAuthError(error, context) {
    console.error('🔐 Authentication error - check API key configuration')
    
    return {
      success: false,
      error: 'AUTHENTICATION_ERROR',
      message: 'Invalid or missing Google AI API key. Please check your configuration.',
      userMessage: 'Authentication failed. Please verify your API key is correctly configured.',
      shouldFallback: true,
      retryable: false
    }
  }

  /**
   * Handle rate limiting with exponential backoff
   */
  async handleRateLimit(error, context) {
    const retryAfter = this.extractRetryAfter(error)
    const delay = retryAfter || this.calculateBackoffDelay(context.attempt || 0)
    
    console.warn(`⏱️ Rate limit exceeded, retrying after ${delay}ms`)
    
    if ((context.attempt || 0) < this.maxRetries) {
      await this.sleep(delay)
      return {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded, retrying after ${delay}ms`,
        shouldRetry: true,
        retryDelay: delay,
        retryable: true
      }
    }

    return {
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded and max retries reached',
      userMessage: 'Service is temporarily busy. Please try again later.',
      shouldFallback: true,
      retryable: false
    }
  }

  /**
   * Handle content safety violations
   */
  async handleSafetyViolation(error, context) {
    console.warn('🛡️ Content safety violation detected')
    
    return {
      success: false,
      error: 'CONTENT_SAFETY_VIOLATION',
      message: 'Content was blocked by safety filters',
      userMessage: 'The document content was flagged by safety filters. Please review the content and try again.',
      shouldFallback: true,
      retryable: false
    }
  }

  /**
   * Handle network errors with retry logic
   */
  async handleNetworkError(error, context) {
    console.warn('🌐 Network error detected')
    
    if ((context.attempt || 0) < this.maxRetries) {
      const delay = this.calculateBackoffDelay(context.attempt || 0)
      await this.sleep(delay)
      
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: `Network error, retrying after ${delay}ms`,
        shouldRetry: true,
        retryDelay: delay,
        retryable: true
      }
    }

    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Network error and max retries reached',
      userMessage: 'Unable to connect to the AI service. Please check your internet connection and try again.',
      shouldFallback: true,
      retryable: false
    }
  }

  /**
   * Handle quota exhaustion
   */
  async handleQuotaExhaustion(error, context) {
    console.error('💳 API quota exhausted')
    
    return {
      success: false,
      error: 'QUOTA_EXHAUSTED',
      message: 'API quota has been exhausted',
      userMessage: 'API usage limit reached. Please try again later or upgrade your plan.',
      shouldFallback: true,
      retryable: false
    }
  }

  /**
   * Handle invalid request errors
   */
  async handleInvalidRequest(error, context) {
    console.error('❌ Invalid request error')
    
    return {
      success: false,
      error: 'INVALID_REQUEST',
      message: `Invalid request: ${error.message}`,
      userMessage: 'The request format was invalid. Please try again.',
      shouldFallback: true,
      retryable: false
    }
  }

  /**
   * Handle service unavailable
   */
  async handleServiceUnavailable(error, context) {
    console.warn('🚫 Service unavailable')
    
    // Check circuit breaker
    if (this.shouldOpenCircuitBreaker()) {
      this.openCircuitBreaker()
    }

    if ((context.attempt || 0) < this.maxRetries && !this.circuitBreakerOpen) {
      const delay = this.calculateBackoffDelay(context.attempt || 0)
      await this.sleep(delay)
      
      return {
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: `Service unavailable, retrying after ${delay}ms`,
        shouldRetry: true,
        retryDelay: delay,
        retryable: true
      }
    }

    return {
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Gemini API service is currently unavailable',
      userMessage: 'The AI service is temporarily unavailable. Please try again later.',
      shouldFallback: true,
      retryable: false
    }
  }

  /**
   * Handle generic errors
   */
  async handleGenericError(error, context) {
    console.error('⚠️ Generic error:', error)
    
    return {
      success: false,
      error: 'GENERIC_ERROR',
      message: error.message || 'Unknown error occurred',
      userMessage: 'An unexpected error occurred. Please try again.',
      shouldFallback: true,
      retryable: false
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  calculateBackoffDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt)
    const jitter = Math.random() * 0.1 * exponentialDelay // 10% jitter
    const delay = Math.min(exponentialDelay + jitter, this.maxDelay)
    return Math.floor(delay)
  }

  /**
   * Extract retry-after header from error
   */
  extractRetryAfter(error) {
    if (error.response?.headers?.['retry-after']) {
      const retryAfter = parseInt(error.response.headers['retry-after'])
      return retryAfter * 1000 // Convert to milliseconds
    }
    return null
  }

  /**
   * Sleep for specified duration
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Circuit breaker logic
   */
  shouldOpenCircuitBreaker() {
    this.consecutiveFailures++
    return this.consecutiveFailures >= this.circuitBreakerThreshold
  }

  openCircuitBreaker() {
    this.circuitBreakerOpen = true
    this.circuitBreakerOpenTime = Date.now()
    console.warn('🔌 Circuit breaker opened - temporarily disabling Gemini API calls')
    
    // Auto-close circuit breaker after timeout
    setTimeout(() => {
      this.closeCircuitBreaker()
    }, this.circuitBreakerTimeout)
  }

  closeCircuitBreaker() {
    this.circuitBreakerOpen = false
    this.circuitBreakerOpenTime = null
    this.consecutiveFailures = 0
    console.info('🔌 Circuit breaker closed - resuming Gemini API calls')
  }

  isCircuitBreakerOpen() {
    return this.circuitBreakerOpen
  }

  resetCircuitBreaker() {
    this.consecutiveFailures = 0
    if (this.circuitBreakerOpen) {
      this.closeCircuitBreaker()
    }
  }

  /**
   * Create fallback analysis when all else fails
   */
  createFallbackAnalysis(originalText, errorType, errorMessage) {
    const documentType = this.detectDocumentType(originalText)
    
    return {
      success: true, // Mark as success since we're providing fallback
      analysis: {
        summary: {
          documentType: documentType,
          keyPurpose: "Fallback analysis due to AI service error",
          mainParties: ["Party A", "Party B"],
          effectiveDate: new Date().toISOString().split('T')[0],
          expirationDate: null,
          totalClausesIdentified: 1,
          completenessScore: 60
        },
        clauses: [
          {
            id: "clause_1",
            title: "Document Content",
            content: originalText.substring(0, Math.min(300, originalText.length)),
            category: "general",
            riskLevel: "medium",
            explanation: "Basic document content - detailed analysis unavailable due to service error",
            sourceLocation: "Document body",
            keyTerms: ["document", "agreement", "terms"]
          }
        ],
        risks: [
          {
            id: "risk_1",
            title: "Analysis Limitation Risk",
            description: `Detailed analysis unavailable due to ${errorType}: ${errorMessage}`,
            severity: "medium",
            category: "operational",
            recommendation: "Manual legal review recommended due to automated analysis limitations",
            clauseReference: "clause_1",
            supportingText: "AI service error prevented detailed analysis"
          }
        ],
        keyTerms: [
          {
            term: "Agreement",
            definition: "Legal document requiring manual review",
            importance: "high",
            context: "Document analysis"
          }
        ],
        recommendations: [
          {
            priority: "high",
            action: "Seek professional legal review due to automated analysis limitations",
            rationale: "AI service error prevented comprehensive analysis",
            affectedClauses: ["clause_1"]
          }
        ],
        qualityMetrics: {
          clauseDetectionConfidence: 40,
          analysisCompleteness: 60,
          potentialMissedClauses: ["service_error_affected"]
        }
      },
      confidence: 60,
      model: 'fallback-analysis',
      usingRealAI: false,
      errorDetails: {
        type: errorType,
        message: errorMessage,
        fallbackUsed: true
      }
    }
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
}

export default GeminiErrorHandler