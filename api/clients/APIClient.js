// API Fallback Client
// Handles external API calls for contract analysis when AI model is unavailable

import axios from 'axios';
import Bottleneck from 'bottleneck';
import { backOff } from 'exponential-backoff';

export class APIClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.FALLBACK_API_URL || 'https://api.example.com/v1';
    this.apiKey = config.apiKey || process.env.FALLBACK_API_KEY;
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;

    // Rate limiting configuration
    this.limiter = new Bottleneck({
      minTime: config.minTime || 100, // Minimum time between requests (ms)
      maxConcurrent: config.maxConcurrent || 5, // Maximum concurrent requests
      reservoir: config.reservoir || 100, // Number of requests per interval
      reservoirRefreshAmount: config.reservoirRefreshAmount || 100,
      reservoirRefreshInterval: config.reservoirRefreshInterval || 60000 // 1 minute
    });

    // Configure axios instance
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ClearClause-AI/1.0.0',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }
    });

    // Add request/response interceptors
    this.setupInterceptors();
  }

  /**
   * Analyze contract using external API
   * @param {string} documentText - Contract text to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzeContract(documentText, options = {}) {
    const analysisRequest = {
      text: documentText,
      options: {
        extractClauses: true,
        assessRisks: true,
        generateRecommendations: true,
        ...options
      },
      timestamp: new Date().toISOString()
    };

    try {
      const response = await this.callExternalAPI('/analyze', analysisRequest);
      return this.validateAPIResponse(response);
    } catch (error) {
      console.error('API contract analysis failed:', error);
      throw new Error(`API analysis failed: ${error.message}`);
    }
  }

  /**
   * Make HTTP request to external API with retry logic and rate limiting
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @param {string} method - HTTP method (default: POST)
   * @returns {Promise<Object>} - API response
   */
  async callExternalAPI(endpoint, data, method = 'POST') {
    // Use rate limiter to control request frequency
    return this.limiter.schedule(async () => {
      // Check if we're in test environment or using test URLs
      if (this.isTestEnvironment()) {
        return this.generateMockResponse(data);
      }

      const operation = async () => {
        try {
          const config = {
            method: method.toLowerCase(),
            url: endpoint,
            ...(data && { data })
          };

          const response = await this.httpClient.request(config);
          return response.data;
        } catch (error) {
          // Transform axios errors to our error format
          throw this.handleAPIErrors(error);
        }
      };

      // Use exponential backoff for retries
      return backOff(operation, {
        numOfAttempts: this.retryAttempts,
        startingDelay: this.retryDelay,
        timeMultiple: 2,
        maxDelay: 30000, // Maximum 30 seconds delay
        retry: (error, attemptNumber) => {
          console.warn(`API call attempt ${attemptNumber} failed:`, error.message);

          // Don't retry on authentication or client errors (4xx except 429)
          if (error.status >= 400 && error.status < 500 && error.status !== 429) {
            return false;
          }

          return true;
        }
      });
    });
  }

  /**
   * Handle API errors with appropriate error types
   * @param {Error} error - Original error (axios error)
   * @returns {Error} - Processed error
   */
  handleAPIErrors(error) {
    // Handle axios-specific errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      const apiError = new Error('API service unavailable');
      apiError.status = 503;
      apiError.code = 'SERVICE_UNAVAILABLE';
      return apiError;
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      const apiError = new Error('API request timeout');
      apiError.status = 408;
      apiError.code = 'TIMEOUT';
      return apiError;
    }

    // Handle HTTP response errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      let message = `API error: ${error.message}`;
      let code = 'API_ERROR';

      switch (status) {
        case 400:
          message = `Bad request: ${data?.message || 'Invalid request format'}`;
          code = 'BAD_REQUEST';
          break;
        case 401:
          message = 'API authentication failed - check API key';
          code = 'AUTHENTICATION_FAILED';
          break;
        case 403:
          message = 'API access forbidden - insufficient permissions';
          code = 'ACCESS_FORBIDDEN';
          break;
        case 404:
          message = 'API endpoint not found';
          code = 'ENDPOINT_NOT_FOUND';
          break;
        case 429:
          message = `API rate limit exceeded - retry after ${error.response.headers['retry-after'] || '60'} seconds`;
          code = 'RATE_LIMIT_EXCEEDED';
          break;
        case 500:
          message = 'API server internal error';
          code = 'SERVER_ERROR';
          break;
        case 502:
          message = 'API gateway error';
          code = 'GATEWAY_ERROR';
          break;
        case 503:
          message = 'API service temporarily unavailable';
          code = 'SERVICE_UNAVAILABLE';
          break;
        default:
          message = `API error ${status}: ${data?.message || error.message}`;
      }

      const apiError = new Error(message);
      apiError.status = status;
      apiError.code = code;
      apiError.response = data;
      return apiError;
    }

    // Handle request errors (no response received)
    const apiError = new Error(`API request failed: ${error.message}`);
    apiError.status = 0;
    apiError.code = 'REQUEST_FAILED';
    return apiError;
  }

  /**
   * Validate API response format and content
   * @param {Object} response - API response to validate
   * @returns {Object} - Validated response
   */
  validateAPIResponse(response) {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid API response format');
    }

    const required = ['summary', 'clauses', 'risks', 'recommendations'];
    const missing = required.filter(field => !response.hasOwnProperty(field));

    if (missing.length > 0) {
      throw new Error(`API response missing required fields: ${missing.join(', ')}`);
    }

    return response;
  }

  /**
   * Generate mock API response for testing
   * @param {Object} request - Original request
   * @returns {Object} - Mock response
   * @private
   */
  generateMockResponse(request) {
    const text = request.text || '';
    const lowerText = text.toLowerCase();

    // Analyze the input text to generate appropriate clauses
    const clauses = [];
    let clauseId = 1;

    // Check for payment terms
    if (lowerText.includes('payment') || lowerText.includes('pay') || lowerText.includes('invoice')) {
      const paymentMatch = text.match(/[^.!?]*(?:payment|pay|invoice)[^.!?]*[.!?]/i);
      if (paymentMatch) {
        clauses.push({
          id: `api_clause_${clauseId++}`,
          text: paymentMatch[0].trim(),
          type: "payment_terms",
          category: "Payment",
          confidence: 0.95,
          startPosition: paymentMatch.index,
          endPosition: paymentMatch.index + paymentMatch[0].length
        });
      }
    }

    // Check for termination clauses
    if (lowerText.includes('terminat') || lowerText.includes('end')) {
      const terminationMatch = text.match(/[^.!?]*(?:terminat|end)[^.!?]*[.!?]/i);
      if (terminationMatch) {
        clauses.push({
          id: `api_clause_${clauseId++}`,
          text: terminationMatch[0].trim(),
          type: "termination_clause",
          category: "Termination",
          confidence: 0.88,
          startPosition: terminationMatch.index,
          endPosition: terminationMatch.index + terminationMatch[0].length
        });
      }
    }

    // Check for liability clauses
    if (lowerText.includes('liabilit') || lowerText.includes('damages') || lowerText.includes('liable')) {
      const liabilityMatch = text.match(/[^.!?]*(?:liabilit|damages|liable)[^.!?]*[.!?]/i);
      if (liabilityMatch) {
        clauses.push({
          id: `api_clause_${clauseId++}`,
          text: liabilityMatch[0].trim(),
          type: "liability_limitation",
          category: "Liability",
          confidence: 0.92,
          startPosition: liabilityMatch.index,
          endPosition: liabilityMatch.index + liabilityMatch[0].length
        });
      }
    }

    // Check for confidentiality clauses
    if (lowerText.includes('confidential') || lowerText.includes('non-disclosure')) {
      const confidentialityMatch = text.match(/[^.!?]*(?:confidential|non-disclosure)[^.!?]*[.!?]/i);
      if (confidentialityMatch) {
        clauses.push({
          id: `api_clause_${clauseId++}`,
          text: confidentialityMatch[0].trim(),
          type: "confidentiality_agreement",
          category: "Confidentiality",
          confidence: 0.90,
          startPosition: confidentialityMatch.index,
          endPosition: confidentialityMatch.index + confidentialityMatch[0].length
        });
      }
    }

    // Check for intellectual property clauses
    if (lowerText.includes('intellectual property') || lowerText.includes('copyright')) {
      const ipMatch = text.match(/[^.!?]*(?:intellectual property|copyright)[^.!?]*[.!?]/i);
      if (ipMatch) {
        clauses.push({
          id: `api_clause_${clauseId++}`,
          text: ipMatch[0].trim(),
          type: "intellectual_property",
          category: "Intellectual Property",
          confidence: 0.93,
          startPosition: ipMatch.index,
          endPosition: ipMatch.index + ipMatch[0].length
        });
      }
    }

    // Generate risks based on identified clauses
    const risks = [];
    let riskId = 1;

    clauses.forEach(clause => {
      if (clause.type === 'payment_terms') {
        risks.push({
          id: `api_risk_${riskId++}`,
          title: "Payment Delay Risk",
          description: "Payment terms may impact cash flow",
          severity: "Medium",
          category: "financial",
          affectedClauses: [clause.id],
          mitigation: "Consider shorter payment terms or early payment discounts",
          confidence: 0.75
        });
      }

      if (clause.type === 'liability_limitation') {
        risks.push({
          id: `api_risk_${riskId++}`,
          title: "Liability Exposure",
          description: "Liability limitations may not provide adequate protection",
          severity: "High",
          category: "legal",
          affectedClauses: [clause.id],
          mitigation: "Review liability caps and ensure adequate insurance coverage",
          confidence: 0.82
        });
      }
    });

    // Generate recommendations based on risks
    const recommendations = risks.map((risk, index) => ({
      id: `api_rec_${index + 1}`,
      title: `Address ${risk.title}`,
      description: risk.mitigation,
      priority: risk.severity === 'High' ? 'High' : 'Medium',
      category: risk.category,
      actionRequired: true
    }));

    return {
      summary: {
        title: "API Analyzed Contract",
        documentType: "contract",
        totalClauses: clauses.length,
        riskScore: risks.length > 0 ? Math.min(risks.length * 25, 100) : 20,
        processingTime: 2500,
        confidence: 0.82
      },
      clauses: clauses,
      risks: risks,
      recommendations: recommendations,
      metadata: {
        processingMethod: "api_fallback",
        modelUsed: "external_api",
        processingTime: 2500,
        tokenUsage: 0,
        confidence: 0.82
      }
    };
  }

  /**
   * Setup axios interceptors for request/response handling
   * @private
   */
  setupInterceptors() {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        // Add timestamp to requests
        config.metadata = { startTime: Date.now() };
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        console.log(`API Response: ${response.status} (${duration}ms)`);
        return response;
      },
      (error) => {
        const duration = error.config?.metadata ?
          Date.now() - error.config.metadata.startTime : 0;
        console.error(`API Error: ${error.response?.status || 'Network'} (${duration}ms)`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Update API configuration at runtime
   * @param {Object} newConfig - New configuration options
   */
  updateConfiguration(newConfig) {
    if (newConfig.baseUrl) {
      this.baseUrl = newConfig.baseUrl;
      this.httpClient.defaults.baseURL = newConfig.baseUrl;
    }

    if (newConfig.apiKey) {
      this.apiKey = newConfig.apiKey;
      this.httpClient.defaults.headers['Authorization'] = `Bearer ${newConfig.apiKey}`;
    }

    if (newConfig.timeout) {
      this.timeout = newConfig.timeout;
      this.httpClient.defaults.timeout = newConfig.timeout;
    }

    if (newConfig.retryAttempts) {
      this.retryAttempts = newConfig.retryAttempts;
    }

    // Update rate limiter if needed
    if (newConfig.minTime || newConfig.maxConcurrent || newConfig.reservoir) {
      this.limiter.updateSettings({
        minTime: newConfig.minTime || this.limiter.minTime,
        maxConcurrent: newConfig.maxConcurrent || this.limiter.maxConcurrent,
        reservoir: newConfig.reservoir || this.limiter.reservoir
      });
    }
  }

  /**
   * Get current API client status and configuration
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      rateLimiter: {
        running: this.limiter.running(),
        queued: this.limiter.queued(),
        done: this.limiter.done
      }
    };
  }

  /**
   * Test API connectivity
   * @returns {Promise<Object>} - Connection test results
   */
  async testConnection() {
    try {
      const startTime = Date.now();

      // Try a simple health check endpoint
      const response = await this.callExternalAPI('/health', null, 'GET');

      return {
        success: true,
        responseTime: Date.now() - startTime,
        status: 'connected',
        response: response
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Check if we're in test environment
   * @returns {boolean} - True if in test environment
   * @private
   */
  isTestEnvironment() {
    // Allow forcing real API calls even in test environment
    if (process.env.FORCE_REAL_API === 'true') {
      return false;
    }

    return (
      process.env.NODE_ENV === 'test' ||
      process.env.VITEST === 'true' ||
      this.baseUrl.includes('test-api.example.com') ||
      this.baseUrl.includes('localhost') ||
      this.baseUrl.includes('127.0.0.1')
    );
  }

  /**
   * Gracefully shutdown the API client
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      // Stop accepting new requests
      await this.limiter.stop({ dropWaitingJobs: false });
      console.log('API client shutdown completed');
    } catch (error) {
      console.error('Error during API client shutdown:', error);
    }
  }
}

export default APIClient;