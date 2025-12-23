/**
 * Property-based tests for environment variable validation
 * Feature: claude-to-gemini-migration, Property 20: Environment Variable Validation
 * Validates: Requirements 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'

// Environment validator for Gemini configuration
class EnvironmentValidator {
  validateGeminiEnvironment() {
    const requiredVars = [
      'VITE_GOOGLE_AI_API_KEY',
      'VITE_GEMINI_MODEL',
      'VITE_GEMINI_ENDPOINT'
    ]

    const missing = []
    const invalid = []

    requiredVars.forEach(varName => {
      const value = process.env[varName]
      
      if (!value) {
        missing.push(varName)
      } else if (this.isInvalidValue(varName, value)) {
        invalid.push({ name: varName, value, reason: this.getInvalidReason(varName, value) })
      }
    })

    return {
      valid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
      errors: [
        ...missing.map(name => `Missing required environment variable: ${name}`),
        ...invalid.map(item => `Invalid ${item.name}: ${item.reason}`)
      ]
    }
  }

  isInvalidValue(varName, value) {
    switch (varName) {
      case 'VITE_GOOGLE_AI_API_KEY':
        return value === 'your_google_ai_api_key_here' || 
               value.length < 10 || 
               !/^[A-Za-z0-9_-]+$/.test(value)
      
      case 'VITE_GEMINI_MODEL':
        return !value.startsWith('gemini')
      
      case 'VITE_GEMINI_ENDPOINT':
        return !value.startsWith('https://') || 
               !value.includes('generativelanguage.googleapis.com')
      
      default:
        return false
    }
  }

  getInvalidReason(varName, value) {
    switch (varName) {
      case 'VITE_GOOGLE_AI_API_KEY':
        if (value === 'your_google_ai_api_key_here') return 'placeholder value not replaced'
        if (value.length < 10) return 'too short'
        if (!/^[A-Za-z0-9_-]+$/.test(value)) return 'invalid characters'
        return 'unknown validation error'
      
      case 'VITE_GEMINI_MODEL':
        return 'must start with "gemini"'
      
      case 'VITE_GEMINI_ENDPOINT':
        if (!value.startsWith('https://')) return 'must use HTTPS'
        if (!value.includes('generativelanguage.googleapis.com')) return 'must use Google AI endpoint'
        return 'unknown validation error'
      
      default:
        return 'unknown validation error'
    }
  }
}

describe('Environment Variable Validation', () => {
  let validator

  beforeEach(() => {
    validator = new EnvironmentValidator()
    vi.unstubAllEnvs()
  })

  /**
   * Feature: claude-to-gemini-migration, Property 20: Environment Variable Validation
   * For any system startup, the system should check for required Gemini configuration parameters
   */
  it('should validate all required Gemini environment variables', () => {
    fc.assert(fc.property(
      fc.record({
        apiKey: fc.option(fc.string({ minLength: 10, maxLength: 100 }).filter(s => /^[A-Za-z0-9_-]+$/.test(s)), { nil: undefined }),
        model: fc.option(fc.constantFrom('gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro'), { nil: undefined }),
        endpoint: fc.option(fc.constant('https://generativelanguage.googleapis.com/v1beta/models'), { nil: undefined })
      }),
      (envConfig) => {
        // Set up environment variables
        if (envConfig.apiKey) vi.stubEnv('VITE_GOOGLE_AI_API_KEY', envConfig.apiKey)
        if (envConfig.model) vi.stubEnv('VITE_GEMINI_MODEL', envConfig.model)
        if (envConfig.endpoint) vi.stubEnv('VITE_GEMINI_ENDPOINT', envConfig.endpoint)

        const result = validator.validateGeminiEnvironment()

        // Check if all required variables are present
        const allPresent = envConfig.apiKey && envConfig.model && envConfig.endpoint
        
        if (allPresent) {
          expect(result.valid).toBe(true)
          expect(result.missing).toHaveLength(0)
          expect(result.invalid).toHaveLength(0)
          expect(result.errors).toHaveLength(0)
        } else {
          expect(result.valid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
          
          // Check that missing variables are reported
          if (!envConfig.apiKey) {
            expect(result.missing).toContain('VITE_GOOGLE_AI_API_KEY')
          }
          if (!envConfig.model) {
            expect(result.missing).toContain('VITE_GEMINI_MODEL')
          }
          if (!envConfig.endpoint) {
            expect(result.missing).toContain('VITE_GEMINI_ENDPOINT')
          }
        }
      }
    ), { numRuns: 100 })
  })

  it('should reject invalid API key formats', () => {
    fc.assert(fc.property(
      fc.oneof(
        fc.constant('your_google_ai_api_key_here'), // Placeholder
        fc.string({ maxLength: 9 }), // Too short
        fc.string().filter(s => /[^A-Za-z0-9_-]/.test(s)) // Invalid characters
      ),
      (invalidApiKey) => {
        vi.stubEnv('VITE_GOOGLE_AI_API_KEY', invalidApiKey)
        vi.stubEnv('VITE_GEMINI_MODEL', 'gemini-1.5-pro')
        vi.stubEnv('VITE_GEMINI_ENDPOINT', 'https://generativelanguage.googleapis.com/v1beta/models')

        const result = validator.validateGeminiEnvironment()

        expect(result.valid).toBe(false)
        expect(result.invalid.some(item => item.name === 'VITE_GOOGLE_AI_API_KEY')).toBe(true)
      }
    ), { numRuns: 50 })
  })

  it('should reject invalid model names', () => {
    fc.assert(fc.property(
      fc.string().filter(s => !s.startsWith('gemini')),
      (invalidModel) => {
        vi.stubEnv('VITE_GOOGLE_AI_API_KEY', 'valid-api-key-12345')
        vi.stubEnv('VITE_GEMINI_MODEL', invalidModel)
        vi.stubEnv('VITE_GEMINI_ENDPOINT', 'https://generativelanguage.googleapis.com/v1beta/models')

        const result = validator.validateGeminiEnvironment()

        expect(result.valid).toBe(false)
        expect(result.invalid.some(item => item.name === 'VITE_GEMINI_MODEL')).toBe(true)
      }
    ), { numRuns: 50 })
  })

  it('should reject invalid endpoints', () => {
    fc.assert(fc.property(
      fc.oneof(
        fc.string().filter(s => !s.startsWith('https://')), // Not HTTPS
        fc.string().filter(s => s.startsWith('https://') && !s.includes('generativelanguage.googleapis.com')) // Wrong domain
      ),
      (invalidEndpoint) => {
        vi.stubEnv('VITE_GOOGLE_AI_API_KEY', 'valid-api-key-12345')
        vi.stubEnv('VITE_GEMINI_MODEL', 'gemini-1.5-pro')
        vi.stubEnv('VITE_GEMINI_ENDPOINT', invalidEndpoint)

        const result = validator.validateGeminiEnvironment()

        expect(result.valid).toBe(false)
        expect(result.invalid.some(item => item.name === 'VITE_GEMINI_ENDPOINT')).toBe(true)
      }
    ), { numRuns: 50 })
  })

  it('should provide detailed error messages', () => {
    // Test with completely missing environment
    const result = validator.validateGeminiEnvironment()

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required environment variable: VITE_GOOGLE_AI_API_KEY')
    expect(result.errors).toContain('Missing required environment variable: VITE_GEMINI_MODEL')
    expect(result.errors).toContain('Missing required environment variable: VITE_GEMINI_ENDPOINT')
  })

  it('should validate complete valid configuration', () => {
    vi.stubEnv('VITE_GOOGLE_AI_API_KEY', 'AIzaSyBvalidApiKey123456789')
    vi.stubEnv('VITE_GEMINI_MODEL', 'gemini-1.5-pro')
    vi.stubEnv('VITE_GEMINI_ENDPOINT', 'https://generativelanguage.googleapis.com/v1beta/models')

    const result = validator.validateGeminiEnvironment()

    expect(result.valid).toBe(true)
    expect(result.missing).toHaveLength(0)
    expect(result.invalid).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })
})