// AI Model Management System
// Handles loading, configuration, and lifecycle of AI models for contract analysis

import { OllamaConfig } from '../config/OllamaConfig.js';
import { ModelConfig } from '../config/ModelConfig.js';
import winston from 'winston';

// Configure logger for model management
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'model-manager.log' })
  ]
});

export class ModelManager {
  constructor(config = {}) {
    this.model = null;

    // Initialize default model configuration
    this.modelConfig = {
      modelName: 'llama-3.1-8b-instruct',
      temperature: 0.1,
      maxTokens: 2048,
      contextWindow: 128000,
      memoryOptimization: true,
      timeout: 30000,
      retryAttempts: 3,
      batchSize: 1
    };
    this.isLoaded = false;
    this.memoryUsage = 0;
    this.lastActivity = null;
    this.healthStatus = 'unknown';
    this.loadTime = null;
    this.inferenceCount = 0;
    this.totalInferenceTime = 0;

    // Initialize Ollama client
    this.ollama = new OllamaConfig(config.ollama || ModelConfig.ollama);

    // Performance monitoring
    this.performanceMetrics = {
      averageInferenceTime: 0,
      successRate: 0,
      totalRequests: 0,
      failedRequests: 0
    };

    // Resource management
    this.resourceLimits = {
      maxMemoryUsage: config.maxMemoryUsage || ModelConfig.performance.memoryLimit,
      maxProcessingTime: config.maxProcessingTime || ModelConfig.performance.maxProcessingTime
    };
  }

  /**
   * Load AI model with specified configuration
   * @param {Object} modelConfig - Model configuration parameters
   * @returns {Promise<boolean>} - Success status
   */
  async loadModel(modelConfig = {}) {
    const startTime = Date.now();

    try {
      // Merge with default configuration
      this.modelConfig = {
        ...ModelConfig.primary,
        ...modelConfig
      };

      // Validate configuration
      if (!this.validateConfig(this.modelConfig)) {
        throw new Error('Invalid model configuration provided');
      }

      logger.info('Starting model load process', {
        modelName: this.modelConfig.modelName,
        contextWindow: this.modelConfig.contextWindow,
        memoryOptimization: this.modelConfig.memoryOptimization
      });

      // Check if Ollama service is available
      const ollamaAvailable = await this.ollama.isAvailable();
      if (!ollamaAvailable) {
        throw new Error('Ollama service is not available. Please ensure Ollama is running.');
      }

      // Check if model is available, pull if necessary
      const modelAvailable = await this.ollama.isModelAvailable(this.modelConfig.modelName);
      if (!modelAvailable) {
        logger.info('Model not found locally, attempting to pull', { modelName: this.modelConfig.modelName });
        const pullSuccess = await this.ollama.pullModel(this.modelConfig.modelName);
        if (!pullSuccess) {
          throw new Error(`Failed to pull model: ${this.modelConfig.modelName}`);
        }
      }

      // Get model information for validation
      const modelInfo = await this.ollama.getModelInfo(this.modelConfig.modelName);
      if (!modelInfo) {
        throw new Error(`Failed to get model information for: ${this.modelConfig.modelName}`);
      }

      // Validate model meets minimum requirements (7B+ parameters)
      if (!this.validateModelRequirements(modelInfo)) {
        throw new Error('Model does not meet minimum performance requirements');
      }

      // Test model with a simple inference to ensure it's working
      await this.performHealthCheck();

      // Update status
      this.isLoaded = true;
      this.loadTime = Date.now();
      this.memoryUsage = this.estimateMemoryUsage();
      this.healthStatus = 'healthy';
      this.lastActivity = new Date().toISOString();

      const loadDuration = Date.now() - startTime;
      logger.info('Model loaded successfully', {
        modelName: this.modelConfig.modelName,
        loadTime: loadDuration,
        memoryUsage: this.memoryUsage,
        contextWindow: this.modelConfig.contextWindow
      });

      return true;
    } catch (error) {
      logger.error('Failed to load model', {
        error: error.message,
        modelName: this.modelConfig?.modelName,
        loadTime: Date.now() - startTime
      });

      this.isLoaded = false;
      this.healthStatus = 'error';
      return false;
    }
  }

  /**
   * Unload the current model and free resources
   * @returns {Promise<boolean>} - Success status
   */
  async unloadModel() {
    try {
      logger.info('Starting model unload process', {
        modelName: this.modelConfig?.modelName,
        memoryUsage: this.memoryUsage
      });

      // Reset all model-related state
      this.model = null;
      this.isLoaded = false;
      this.memoryUsage = 0;
      this.healthStatus = 'unloaded';
      this.lastActivity = null;
      this.loadTime = null;

      // Reset performance metrics
      this.inferenceCount = 0;
      this.totalInferenceTime = 0;
      this.performanceMetrics = {
        averageInferenceTime: 0,
        successRate: 0,
        totalRequests: 0,
        failedRequests: 0
      };

      // Force garbage collection if available
      await this.optimizeMemory();

      logger.info('Model unloaded successfully');
      return true;
    } catch (error) {
      logger.error('Failed to unload model', { error: error.message });
      return false;
    }
  }

  /**
   * Perform inference with the loaded model
   * @param {string} prompt - Input prompt for the model
   * @param {Object} options - Inference options
   * @returns {Promise<string>} - Model response
   */
  async inference(prompt, options = {}) {
    if (!this.isLoaded) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Valid prompt string is required for inference');
    }

    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    const inferenceOptions = {
      temperature: this.modelConfig.temperature,
      maxTokens: this.modelConfig.maxTokens,
      topP: this.modelConfig.topP,
      ...options
    };

    try {
      // Check if we're within resource limits
      if (this.memoryUsage > this.resourceLimits.maxMemoryUsage) {
        await this.optimizeMemory();
      }

      logger.debug('Starting inference', {
        modelName: this.modelConfig.modelName,
        promptLength: prompt.length,
        options: inferenceOptions
      });

      // Perform inference using Ollama
      const response = await this.ollama.generate(
        this.modelConfig.modelName,
        prompt,
        inferenceOptions
      );

      // Update performance metrics
      const inferenceTime = Date.now() - startTime;
      this.inferenceCount++;
      this.totalInferenceTime += inferenceTime;
      this.performanceMetrics.averageInferenceTime = this.totalInferenceTime / this.inferenceCount;
      this.performanceMetrics.successRate =
        (this.performanceMetrics.totalRequests - this.performanceMetrics.failedRequests) /
        this.performanceMetrics.totalRequests;

      // Check if inference time exceeds limits
      if (inferenceTime > this.resourceLimits.maxProcessingTime) {
        logger.warn('Inference time exceeded limit', {
          inferenceTime,
          limit: this.resourceLimits.maxProcessingTime
        });
      }

      this.lastActivity = new Date().toISOString();
      this.healthStatus = 'healthy';

      logger.debug('Inference completed successfully', {
        inferenceTime,
        responseLength: response.length,
        averageTime: this.performanceMetrics.averageInferenceTime
      });

      return response;
    } catch (error) {
      this.performanceMetrics.failedRequests++;
      this.performanceMetrics.successRate =
        (this.performanceMetrics.totalRequests - this.performanceMetrics.failedRequests) /
        this.performanceMetrics.totalRequests;

      logger.error('Inference failed', {
        error: error.message,
        modelName: this.modelConfig.modelName,
        promptLength: prompt.length,
        inferenceTime: Date.now() - startTime
      });

      throw new Error(`Model inference failed: ${error.message}`);
    }
  }

  /**
   * Get current model status and health information
   * @returns {Object} - Model status information
   */
  getModelStatus() {
    return {
      isLoaded: this.isLoaded,
      modelName: this.modelConfig?.modelName || null,
      memoryUsage: this.memoryUsage,
      contextWindow: this.modelConfig?.contextWindow || 0,
      lastActivity: this.lastActivity,
      healthStatus: this.healthStatus,
      loadTime: this.loadTime,
      inferenceCount: this.inferenceCount,
      performanceMetrics: { ...this.performanceMetrics },
      resourceLimits: { ...this.resourceLimits },
      configuration: this.modelConfig ? { ...this.modelConfig } : null
    };
  }

  /**
   * Optimize memory usage and perform cleanup
   * @returns {Promise<void>}
   */
  async optimizeMemory() {
    try {
      const beforeMemory = this.memoryUsage;

      logger.info('Starting memory optimization', {
        currentMemoryUsage: beforeMemory,
        memoryLimit: this.resourceLimits.maxMemoryUsage
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear any cached data or temporary resources
      if (this.isLoaded) {
        // Update memory usage estimate
        this.memoryUsage = this.estimateMemoryUsage();

        // If memory usage is still too high, consider more aggressive cleanup
        if (this.memoryUsage > this.resourceLimits.maxMemoryUsage * 0.9) {
          logger.warn('Memory usage still high after optimization', {
            memoryUsage: this.memoryUsage,
            limit: this.resourceLimits.maxMemoryUsage
          });
        }
      } else {
        this.memoryUsage = 0;
      }

      const memoryFreed = beforeMemory - this.memoryUsage;
      logger.info('Memory optimization completed', {
        memoryFreed,
        currentMemoryUsage: this.memoryUsage
      });
    } catch (error) {
      logger.error('Memory optimization failed', { error: error.message });
    }
  }

  /**
   * Cleanup resources and unload model
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      logger.info('Starting model cleanup');

      // Unload the model if loaded
      if (this.isLoaded) {
        await this.unloadModel();
      }

      // Clear performance metrics
      this.performanceMetrics = {
        averageInferenceTime: 0,
        successRate: 0,
        totalRequests: 0,
        failedRequests: 0,
        lastInferenceTime: 0
      };

      // Reset counters
      this.inferenceCount = 0;
      this.totalInferenceTime = 0;
      this.memoryUsage = 0;
      this.lastActivity = null;
      this.healthStatus = 'unknown';

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      logger.info('Model cleanup completed');
    } catch (error) {
      logger.error('Model cleanup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Estimate current memory usage
   * @returns {number} - Estimated memory usage in MB
   * @private
   */
  estimateMemoryUsage() {
    if (!this.isLoaded) return 0;

    // Rough estimate for 8B parameter model
    const baseMemory = 8000; // 8GB for model weights
    const quantizationReduction = this.modelConfig?.quantization === 'int8' ? 0.5 : 1;

    return Math.round(baseMemory * quantizationReduction);
  }

  /**
   * Perform health check on the loaded model
   * @returns {Promise<boolean>} - Health check result
   */
  async performHealthCheck() {
    try {
      if (!this.isLoaded) {
        this.healthStatus = 'not_loaded';
        return false;
      }

      logger.debug('Performing model health check');

      // Simple test inference to verify model is responding
      const testPrompt = "Test prompt for health check. Respond with 'OK'.";
      const startTime = Date.now();

      const response = await this.ollama.generate(
        this.modelConfig.modelName,
        testPrompt,
        { maxTokens: 10, temperature: 0.1 }
      );

      const responseTime = Date.now() - startTime;

      // Check if response is reasonable
      if (!response || response.length === 0) {
        this.healthStatus = 'unhealthy';
        return false;
      }

      // Check if response time is within acceptable limits
      if (responseTime > this.resourceLimits.maxProcessingTime) {
        this.healthStatus = 'slow';
        logger.warn('Model health check slow', { responseTime });
        return false;
      }

      this.healthStatus = 'healthy';
      logger.debug('Model health check passed', { responseTime });
      return true;
    } catch (error) {
      this.healthStatus = 'error';
      logger.error('Model health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Validate that model meets minimum requirements
   * @param {Object} modelInfo - Model information from Ollama
   * @returns {boolean} - Validation result
   * @private
   */
  validateModelRequirements(modelInfo) {
    try {
      // Check if model has sufficient parameters (7B+ requirement)
      // This is a simplified check - in practice, you'd parse model info more thoroughly
      const modelName = this.modelConfig.modelName.toLowerCase();

      // Extract parameter count from model name (e.g., "llama3.1:8b" -> 8B)
      const parameterMatch = modelName.match(/(\d+)b/);
      if (parameterMatch) {
        const parameterCount = parseInt(parameterMatch[1]);
        if (parameterCount < 7) {
          logger.warn('Model does not meet minimum parameter requirement', {
            modelName: this.modelConfig.modelName,
            parameters: `${parameterCount}B`,
            minimum: '7B'
          });
          return false;
        }
      }

      // Check context window requirement (50K+ tokens)
      if (this.modelConfig.contextWindow < 50000) {
        logger.warn('Model context window too small', {
          contextWindow: this.modelConfig.contextWindow,
          minimum: 50000
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Model requirement validation failed', { error: error.message });
      return false;
    }
  }

  /**
   * Validate model configuration parameters
   * @param {Object} config - Configuration to validate
   * @returns {boolean} - Validation result
   * @private
   */
  validateConfig(config) {
    const required = ['modelName', 'maxTokens', 'contextWindow'];
    const hasRequired = required.every(field => config.hasOwnProperty(field));

    if (!hasRequired) {
      logger.error('Missing required configuration fields', {
        required,
        provided: Object.keys(config)
      });
      return false;
    }

    // Validate specific field values
    if (typeof config.modelName !== 'string' || config.modelName.length === 0) {
      logger.error('Invalid modelName in configuration');
      return false;
    }

    if (typeof config.maxTokens !== 'number' || config.maxTokens <= 0) {
      logger.error('Invalid maxTokens in configuration');
      return false;
    }

    if (typeof config.contextWindow !== 'number' || config.contextWindow <= 0) {
      logger.error('Invalid contextWindow in configuration');
      return false;
    }

    return true;
  }

  /**
   * Get detailed performance metrics
   * @returns {Object} - Performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      memoryUsage: this.memoryUsage,
      memoryLimit: this.resourceLimits.maxMemoryUsage,
      memoryUtilization: this.memoryUsage / this.resourceLimits.maxMemoryUsage,
      uptime: this.loadTime ? Date.now() - this.loadTime : 0,
      healthStatus: this.healthStatus
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.inferenceCount = 0;
    this.totalInferenceTime = 0;
    this.performanceMetrics = {
      averageInferenceTime: 0,
      successRate: 0,
      totalRequests: 0,
      failedRequests: 0
    };

    logger.info('Performance metrics reset');
  }

  /**
   * Get current model configuration
   * @returns {Object} - Current configuration
   */
  getConfiguration() {
    return {
      ...this.modelConfig,
      resourceLimits: { ...this.resourceLimits },
      isLoaded: this.isLoaded,
      healthStatus: this.healthStatus
    };
  }

  /**
   * Update model configuration at runtime
   * @param {Object} newConfig - New configuration parameters
   * @returns {Promise<boolean>} - Success status
   */
  async updateConfiguration(newConfig) {
    try {
      // Validate new configuration
      const validationResult = this.validateConfiguration(newConfig);
      if (!validationResult.isValid) {
        throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
      }

      // Create backup of current configuration
      const backup = this.backupConfiguration();

      try {
        // Update configuration
        this.modelConfig = {
          ...this.modelConfig,
          ...newConfig
        };

        // Update resource limits if provided
        if (newConfig.maxMemoryUsage) {
          this.resourceLimits.maxMemoryUsage = newConfig.maxMemoryUsage;
        }
        if (newConfig.maxProcessingTime) {
          this.resourceLimits.maxProcessingTime = newConfig.maxProcessingTime;
        }

        // If model is loaded and critical parameters changed, reload model
        const criticalParams = ['modelName', 'contextWindow', 'memoryOptimization'];
        const criticalChanged = criticalParams.some(param =>
          newConfig.hasOwnProperty(param) && newConfig[param] !== backup[param]
        );

        if (this.isLoaded && criticalChanged) {
          logger.info('Critical parameters changed, reloading model', {
            changedParams: criticalParams.filter(param =>
              newConfig.hasOwnProperty(param) && newConfig[param] !== backup[param]
            )
          });

          await this.unloadModel();
          const reloadSuccess = await this.loadModel(this.modelConfig);
          if (!reloadSuccess) {
            // Restore backup on reload failure
            await this.restoreConfiguration(backup);
            throw new Error('Failed to reload model with new configuration');
          }
        }

        logger.info('Configuration updated successfully', {
          updatedFields: Object.keys(newConfig),
          reloadRequired: criticalChanged
        });

        return true;
      } catch (error) {
        // Restore backup on any error
        await this.restoreConfiguration(backup);
        throw error;
      }
    } catch (error) {
      logger.error('Failed to update configuration', {
        error: error.message,
        newConfig: Object.keys(newConfig)
      });
      return false;
    }
  }

  /**
   * Validate configuration parameters
   * @param {Object} config - Configuration to validate
   * @returns {Object} - Validation result with isValid and errors
   */
  validateConfiguration(config) {
    const errors = [];

    // Validate temperature
    if (config.hasOwnProperty('temperature')) {
      if (typeof config.temperature !== 'number' ||
        config.temperature < 0 || config.temperature > 2 ||
        isNaN(config.temperature) || !isFinite(config.temperature)) {
        errors.push('Temperature must be a number between 0 and 2');
      }
    }

    // Validate maxTokens
    if (config.hasOwnProperty('maxTokens')) {
      if (typeof config.maxTokens !== 'number' ||
        config.maxTokens <= 0 || config.maxTokens > 8192 ||
        isNaN(config.maxTokens) || !isFinite(config.maxTokens)) {
        errors.push('MaxTokens must be a positive number up to 8192');
      }
    }

    // Validate contextWindow
    if (config.hasOwnProperty('contextWindow')) {
      const validSizes = [4096, 8192, 16384, 32768, 65536, 128000];
      if (typeof config.contextWindow !== 'number' ||
        !validSizes.includes(config.contextWindow)) {
        errors.push(`ContextWindow must be one of: ${validSizes.join(', ')}`);
      }
    }

    // Validate timeout
    if (config.hasOwnProperty('timeout')) {
      if (typeof config.timeout !== 'number' ||
        config.timeout <= 0 || config.timeout > 300000 ||
        isNaN(config.timeout) || !isFinite(config.timeout)) {
        errors.push('Timeout must be a positive number up to 300000ms (5 minutes)');
      }
    }

    // Validate retryAttempts
    if (config.hasOwnProperty('retryAttempts')) {
      if (typeof config.retryAttempts !== 'number' ||
        config.retryAttempts < 1 || config.retryAttempts > 10 ||
        !Number.isInteger(config.retryAttempts)) {
        errors.push('RetryAttempts must be an integer between 1 and 10');
      }
    }

    // Validate batchSize
    if (config.hasOwnProperty('batchSize')) {
      if (typeof config.batchSize !== 'number' ||
        config.batchSize < 1 || config.batchSize > 20 ||
        !Number.isInteger(config.batchSize)) {
        errors.push('BatchSize must be an integer between 1 and 20');
      }
    }

    // Validate memoryOptimization
    if (config.hasOwnProperty('memoryOptimization')) {
      if (typeof config.memoryOptimization !== 'boolean') {
        errors.push('MemoryOptimization must be a boolean');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Create backup of current configuration
   * @returns {Object} - Configuration backup
   */
  backupConfiguration() {
    return {
      ...this.modelConfig,
      resourceLimits: { ...this.resourceLimits },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Restore configuration from backup
   * @param {Object} backup - Configuration backup
   * @returns {Promise<boolean>} - Success status
   */
  async restoreConfiguration(backup) {
    try {
      // Remove timestamp from backup
      const { timestamp, resourceLimits, ...configToRestore } = backup;

      // Restore configuration
      this.modelConfig = { ...configToRestore };
      this.resourceLimits = { ...resourceLimits };

      logger.info('Configuration restored from backup', {
        backupTimestamp: timestamp,
        restoredFields: Object.keys(configToRestore)
      });

      return true;
    } catch (error) {
      logger.error('Failed to restore configuration', {
        error: error.message
      });
      return false;
    }
  }
}

export default ModelManager;