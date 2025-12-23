// Unified Contract Processor
// Single entry point managing both AI model and API fallback processing

import ModelManager from '../../model/core/ModelManager.js';
import APIClient from '../../api/clients/APIClient.js';
import { apiConfig } from '../../api/config/APIConfig.js';
import ResponseNormalizer from '../../api/normalizers/ResponseNormalizer.js';
import ModelConfig from '../../model/config/ModelConfig.js';
import { PluginManager } from '../../model/plugins/PluginManager.js';
import { OllamaModelPlugin } from '../../model/plugins/OllamaModelPlugin.js';
import { ConfigurationManager } from '../../model/config/ConfigurationManager.js';
import { BackwardCompatibility } from '../../model/compatibility/BackwardCompatibility.js';

export class ContractProcessor {
  constructor(config = {}) {
    this.modelManager = new ModelManager();

    // Use APIConfig to get proper configuration for API client
    const apiServiceConfig = apiConfig.getServiceConfig('primary');
    this.apiClient = new APIClient(apiServiceConfig);

    this.responseNormalizer = new ResponseNormalizer();

    // Initialize extensibility components
    this.pluginManager = new PluginManager();
    this.configManager = new ConfigurationManager(config.configPath);
    this.compatibility = new BackwardCompatibility();

    this.config = {
      preferAIModel: true,
      fallbackToAPI: true,
      maxRetries: 3,
      timeout: 30000,
      enablePlugins: true,
      enableCompatibility: true,
      apiVersion: '1.2.0',
      ...config
    };

    this.processingStats = {
      totalRequests: 0,
      aiModelRequests: 0,
      apiRequests: 0,
      pluginRequests: 0,
      failures: 0
    };

    // Initialize components
    this.initializeExtensibilityFeatures();
  }

  /**
   * Process contract document using AI model or API fallback
   * @param {Object} document - Document to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Standardized analysis results
   */
  async processContract(document, options = {}) {
    const startTime = Date.now();
    this.processingStats.totalRequests++;

    try {
      // Validate input
      this.validateInput(document);

      // Determine processing method
      const method = await this.determineProcessingMethod();

      let result;

      if (method === 'ai_model') {
        result = await this.tryAIModel(document, options);
      } else {
        result = await this.fallbackToAPI(document, options);
      }

      // Validate and return results
      const validatedResult = this.validateResults(result);
      validatedResult.metadata.processingTime = Date.now() - startTime;

      return validatedResult;
    } catch (error) {
      this.processingStats.failures++;
      console.error('Contract processing failed:', error);

      // Try fallback if primary method failed
      if (this.config.fallbackToAPI && !error.message.includes('api_fallback')) {
        try {
          console.log('Attempting API fallback after AI model failure');
          const fallbackResult = await this.fallbackToAPI(document, options);
          fallbackResult.metadata.processingTime = Date.now() - startTime;
          fallbackResult.metadata.fallbackReason = error.message;

          return this.validateResults(fallbackResult);
        } catch (fallbackError) {
          console.error('API fallback also failed:', fallbackError);
          throw new Error(`Both AI model and API fallback failed: ${error.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Try processing with AI model
   * @param {Object} document - Document to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - AI model results
   */
  async tryAIModel(document, options = {}) {
    try {
      this.processingStats.aiModelRequests++;

      // Ensure model is loaded
      if (!this.modelManager.getModelStatus().isLoaded) {
        const loadSuccess = await this.modelManager.loadModel(ModelConfig.primary);
        if (!loadSuccess) {
          throw new Error('Failed to load AI model');
        }
      }

      // TODO: Implement actual AI model processing
      // This is a placeholder that will be replaced with real AI analysis
      console.log('Processing with AI model...');

      const mockResult = {
        summary: {
          title: document.filename || "AI Analyzed Contract",
          documentType: "contract",
          totalClauses: 12,
          riskScore: 72,
          processingTime: 0,
          confidence: 0.91
        },
        clauses: [
          {
            id: "ai_clause_1",
            text: "This Agreement shall commence on the Effective Date and continue for a period of twelve (12) months.",
            type: "termination_clause",
            category: "Termination",
            confidence: 0.94,
            startPosition: 0,
            endPosition: 95
          },
          {
            id: "ai_clause_2",
            text: "Payment shall be due within thirty (30) days of invoice receipt.",
            type: "payment_terms",
            category: "Payment",
            confidence: 0.97,
            startPosition: 96,
            endPosition: 160
          }
        ],
        risks: [
          {
            id: "ai_risk_1",
            title: "Extended Payment Terms",
            description: "30-day payment terms may impact cash flow and increase collection risk",
            severity: "Medium",
            category: "financial",
            affectedClauses: ["ai_clause_2"],
            mitigation: "Consider negotiating shorter payment terms or requiring deposits",
            confidence: 0.85
          }
        ],
        recommendations: [
          {
            id: "ai_rec_1",
            title: "Optimize Payment Terms",
            description: "Negotiate shorter payment terms to improve cash flow",
            priority: "Medium",
            category: "financial_optimization",
            actionRequired: true
          }
        ],
        metadata: {
          processingMethod: "ai_model",
          modelUsed: this.modelManager.modelConfig?.modelName || "llama-3.1-8b-instruct",
          processingTime: 0,
          tokenUsage: 2847,
          confidence: 0.91
        }
      };

      return mockResult;
    } catch (error) {
      console.error('AI model processing failed:', error);
      throw new Error(`AI model processing failed: ${error.message}`);
    }
  }

  /**
   * Fallback to API processing
   * @param {Object} document - Document to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - API results (normalized)
   */
  async fallbackToAPI(document, options = {}) {
    try {
      this.processingStats.apiRequests++;
      console.log('Processing with API fallback...');

      const apiResult = await this.apiClient.analyzeContract(
        document.text || document.content,
        options
      );

      // Normalize API response to match AI model format
      return this.responseNormalizer.normalizeToStandardFormat(apiResult);
    } catch (error) {
      console.error('API fallback processing failed:', error);
      throw new Error(`API fallback processing failed: ${error.message}`);
    }
  }

  /**
   * Determine which processing method to use
   * @returns {Promise<string>} - Processing method ('ai_model' or 'api_fallback')
   */
  async determineProcessingMethod() {
    if (!this.config.preferAIModel) {
      return 'api_fallback';
    }

    try {
      // Check if AI model is available and healthy
      const modelStatus = this.modelManager.getModelStatus();

      if (modelStatus.isLoaded) {
        return 'ai_model';
      }

      // Try to load the model
      const loadSuccess = await this.modelManager.loadModel(ModelConfig.primary);

      if (loadSuccess) {
        return 'ai_model';
      } else {
        console.log('AI model unavailable, using API fallback');
        return 'api_fallback';
      }
    } catch (error) {
      console.warn('AI model check failed, using API fallback:', error.message);
      return 'api_fallback';
    }
  }

  /**
   * Validate input document
   * @param {Object} document - Document to validate
   * @throws {Error} - If validation fails
   * @private
   */
  validateInput(document) {
    if (!document) {
      throw new Error('Document is required');
    }

    if (!document.text && !document.content) {
      throw new Error('Document must contain text or content');
    }

    const text = document.text || document.content;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Document text must be a non-empty string');
    }

    // Check document size (50,000 tokens ≈ 200,000 characters)
    if (text.length > 200000) {
      throw new Error('Document too large. Maximum size is approximately 50,000 tokens.');
    }
  }

  /**
   * Validate processing results
   * @param {Object} results - Results to validate
   * @returns {Object} - Validated results
   * @private
   */
  validateResults(results) {
    if (!results || typeof results !== 'object') {
      throw new Error('Invalid processing results');
    }

    const required = ['summary', 'clauses', 'risks', 'recommendations', 'metadata'];
    const missing = required.filter(field => !results.hasOwnProperty(field));

    if (missing.length > 0) {
      throw new Error(`Processing results missing required fields: ${missing.join(', ')}`);
    }

    // Ensure arrays are actually arrays
    ['clauses', 'risks', 'recommendations'].forEach(field => {
      if (!Array.isArray(results[field])) {
        results[field] = [];
      }
    });

    return results;
  }

  /**
   * Get processing statistics
   * @returns {Object} - Processing statistics
   */
  getProcessingStats() {
    return {
      ...this.processingStats,
      aiModelSuccessRate: this.processingStats.aiModelRequests > 0
        ? (this.processingStats.aiModelRequests - this.processingStats.failures) / this.processingStats.aiModelRequests
        : 0,
      totalSuccessRate: this.processingStats.totalRequests > 0
        ? (this.processingStats.totalRequests - this.processingStats.failures) / this.processingStats.totalRequests
        : 0
    };
  }

  /**
   * Reset processing statistics
   */
  resetStats() {
    this.processingStats = {
      totalRequests: 0,
      aiModelRequests: 0,
      apiRequests: 0,
      failures: 0
    };
  }

  /**
   * Get current model configuration
   * @returns {Object} - Current model configuration
   */
  getModelConfiguration() {
    return this.modelManager.getConfiguration();
  }

  /**
   * Update model configuration at runtime
   * @param {Object} newConfig - New configuration parameters
   * @returns {Promise<boolean>} - Success status
   */
  async updateModelConfiguration(newConfig) {
    try {
      const success = await this.modelManager.updateConfiguration(newConfig);

      if (success) {
        // Update processor-level configuration if needed
        if (newConfig.timeout) {
          this.config.timeout = newConfig.timeout;
        }
        if (newConfig.maxRetries) {
          this.config.maxRetries = newConfig.maxRetries;
        }
      }

      return success;
    } catch (error) {
      console.error('Failed to update model configuration:', error);
      return false;
    }
  }

  /**
   * Get processor configuration
   * @returns {Object} - Current processor configuration
   */
  getProcessorConfiguration() {
    return {
      ...this.config,
      modelConfig: this.modelManager.getConfiguration(),
      apiConfig: this.apiClient.getStatus()
    };
  }

  /**
   * Update processor configuration
   * @param {Object} newConfig - New configuration parameters
   * @returns {boolean} - Success status
   */
  updateProcessorConfiguration(newConfig) {
    try {
      // Update processor-level configuration
      this.config = {
        ...this.config,
        ...newConfig
      };

      // Update API client configuration if provided
      if (newConfig.api) {
        this.apiClient.updateConfiguration(newConfig.api);
      }

      return true;
    } catch (error) {
      console.error('Failed to update processor configuration:', error);
      return false;
    }
  }

  /**
   * Initialize extensibility features
   * @private
   */
  async initializeExtensibilityFeatures() {
    try {
      // Initialize configuration manager
      if (this.config.enablePlugins) {
        await this.configManager.initialize();

        // Register default Ollama plugin
        const ollamaPlugin = new OllamaModelPlugin({
          model: this.config.model,
          autoLoad: false
        });

        await this.pluginManager.registerPlugin('ollama-model', ollamaPlugin);
      }
    } catch (error) {
      console.warn('Extensibility features initialization failed:', error.message);
    }
  }

  /**
   * Switch to a different model plugin
   * @param {string} pluginName - Name of plugin to switch to
   * @returns {Promise<boolean>} - Success status
   */
  async switchPlugin(pluginName) {
    if (!this.config.enablePlugins) {
      console.warn('Plugin support is disabled');
      return false;
    }

    try {
      const success = await this.pluginManager.switchPlugin(pluginName);
      if (success) {
        console.log(`Switched to plugin: ${pluginName}`);
      }
      return success;
    } catch (error) {
      console.error('Plugin switch failed:', error);
      return false;
    }
  }

  /**
   * Register a new model plugin
   * @param {string} name - Plugin name
   * @param {ModelPlugin} plugin - Plugin instance
   * @returns {Promise<boolean>} - Success status
   */
  async registerPlugin(name, plugin) {
    if (!this.config.enablePlugins) {
      console.warn('Plugin support is disabled');
      return false;
    }

    return await this.pluginManager.registerPlugin(name, plugin);
  }

  /**
   * List available plugins
   * @returns {Array} - List of plugin metadata
   */
  listPlugins() {
    if (!this.config.enablePlugins) {
      return [];
    }

    return this.pluginManager.listPlugins();
  }

  /**
   * Update analysis method configuration
   * @param {Object} methodConfig - Method configuration
   * @returns {Promise<boolean>} - Success status
   */
  async updateAnalysisMethodConfiguration(methodConfig) {
    try {
      await this.configManager.updateConfiguration('analysis', methodConfig);

      // Update processor config
      if (methodConfig.primaryMethod) {
        this.config.preferAIModel = methodConfig.primaryMethod === 'ai_model';
      }
      if (methodConfig.fallbackEnabled !== undefined) {
        this.config.fallbackToAPI = methodConfig.fallbackEnabled;
      }
      if (methodConfig.timeout) {
        this.config.timeout = methodConfig.timeout;
      }

      return true;
    } catch (error) {
      console.error('Failed to update analysis method configuration:', error);
      return false;
    }
  }

  /**
   * Get analysis method configuration
   * @returns {Object} - Current analysis configuration
   */
  getAnalysisMethodConfiguration() {
    return this.configManager.getConfiguration('analysis');
  }

  /**
   * Process contract with backward compatibility
   * @param {Object} document - Document to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Analysis results
   */
  async processContractWithCompatibility(document, options = {}) {
    const apiVersion = options.apiVersion || this.config.apiVersion;

    try {
      // Transform input for current version
      let transformedDocument = document;
      let transformedOptions = options;

      if (this.config.enableCompatibility && apiVersion !== '1.2.0') {
        transformedDocument = this.compatibility.transformInput(document, apiVersion);
        transformedOptions = this.compatibility.transformInput(options, apiVersion);
      }

      // Process with current system
      let result;
      if (this.config.enablePlugins && this.pluginManager.getActivePlugin()) {
        result = await this.processWithPlugin(transformedDocument, transformedOptions);
      } else {
        result = await this.processContract(transformedDocument, transformedOptions);
      }

      // Transform output for requested version
      if (this.config.enableCompatibility && apiVersion !== '1.2.0') {
        result = this.compatibility.transformOutput(result, apiVersion);
      }

      return result;
    } catch (error) {
      console.error('Contract processing with compatibility failed:', error);
      throw error;
    }
  }

  /**
   * Process contract using active plugin
   * @param {Object} document - Document to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Analysis results
   * @private
   */
  async processWithPlugin(document, options = {}) {
    const activePlugin = this.pluginManager.getActivePlugin();
    if (!activePlugin) {
      throw new Error('No active plugin available');
    }

    try {
      this.processingStats.pluginRequests++;

      const result = await activePlugin.processContract(document.text || document.content, options);

      // Ensure result has proper structure
      return this.validateResults(result);
    } catch (error) {
      console.error('Plugin processing failed:', error);

      // Fallback to regular processing
      if (this.config.fallbackToAPI) {
        console.log('Falling back to regular processing after plugin failure');
        return await this.processContract(document, options);
      }

      throw error;
    }
  }

  /**
   * Get extensibility status
   * @returns {Object} - Status of extensibility features
   */
  getExtensibilityStatus() {
    return {
      pluginsEnabled: this.config.enablePlugins,
      compatibilityEnabled: this.config.enableCompatibility,
      apiVersion: this.config.apiVersion,
      pluginManager: this.config.enablePlugins ? this.pluginManager.getStatus() : null,
      configManager: this.configManager.getStatus(),
      compatibility: this.config.enableCompatibility ? this.compatibility.getCompatibilityReport() : null
    };
  }

  /**
   * Cleanup resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      await this.modelManager.unloadModel();

      if (this.config.enablePlugins) {
        await this.pluginManager.cleanup();
      }

      await this.configManager.cleanup();

      console.log('ContractProcessor cleanup completed');
    } catch (error) {
      console.error('ContractProcessor cleanup failed:', error);
    }
  }
}

export default ContractProcessor;