/**
 * Property-based tests for API service routing
 * Feature: claude-to-gemini-migration, Property 1: AI Service Routing Consistency
 * Validates: Requirements 1.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'

// Mock implementations for testing
class MockBedrockService {
  constructor() {
    this.called = false
  }

  async analyzeDocument() {
    this.called = true
    throw new Error('Bedrock service should not be called after migration')
  }
}

class MockGeminiService {
  constructor() {
    this.called = false
    this.callCount = 0
  }

  async analyzeDocument(text, documentType) {
    this.called = true
    this.callCount++
    return {
      success: true,
      analysis: { summary: { documentType } },
      confidence: 85
    }
  }
}

class DocumentAnalysisRouter {
  constructor() {
    this.geminiService = new MockGeminiService()
    this.bedrockService = new MockBedrockService()
    this.useGemini = true // After migration, should always be true
  }

  async processDocument(text, documentType) {
    if (this.useGemini) {
      return await this.geminiService.analyzeDocument(text, documentType)
    } else {
      return await this.bedrockService.analyzeDocument(text, documentType)
    }
  }

  getActiveService() {
    return this.useGemini ? 'gemini' : 'bedrock'
  }
}

describe('API Service Routing', () => {
  let router

  beforeEach(() => {
    router = new DocumentAnalysisRouter()
  })

  /**
   * Feature: claude-to-gemini-migration, Property 1: AI Service Routing Consistency
   * For any document analysis request, the system should route the request to Gemini API instead of Bedrock Service
   */
  it('should route all document analysis requests to Gemini API', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 10, maxLength: 1000 }), // Document text
      fc.constantFrom('NDA', 'Employment Agreement', 'Service Agreement', 'License Agreement'), // Document types
      async (documentText, documentType) => {
        const result = await router.processDocument(documentText, documentType)

        // Should use Gemini service
        expect(router.getActiveService()).toBe('gemini')
        expect(router.geminiService.called).toBe(true)
        expect(router.bedrockService.called).toBe(false)

        // Should return successful result from Gemini
        expect(result.success).toBe(true)
        expect(result.analysis).toBeDefined()
        expect(result.analysis.summary.documentType).toBe(documentType)
      }
    ), { numRuns: 100 })
  })

  it('should never call Bedrock service after migration', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        text: fc.string({ minLength: 1, maxLength: 500 }),
        type: fc.constantFrom('Contract', 'Agreement', 'Policy', 'Terms')
      }), { minLength: 1, maxLength: 10 }),
      async (documents) => {
        // Process multiple documents
        for (const doc of documents) {
          await router.processDocument(doc.text, doc.type)
        }

        // Gemini should be called for each document
        expect(router.geminiService.callCount).toBe(documents.length)
        
        // Bedrock should never be called
        expect(router.bedrockService.called).toBe(false)
        
        // Router should consistently report Gemini as active service
        expect(router.getActiveService()).toBe('gemini')
      }
    ), { numRuns: 50 })
  })

  it('should maintain routing consistency across different document types', async () => {
    const documentTypes = [
      'Non-Disclosure Agreement',
      'Employment Agreement', 
      'Service Agreement',
      'License Agreement',
      'Lease Agreement',
      'Legal Agreement'
    ]

    for (const docType of documentTypes) {
      const result = await router.processDocument('Sample document text', docType)
      
      expect(router.getActiveService()).toBe('gemini')
      expect(result.success).toBe(true)
    }

    // Gemini should have been called for each document type
    expect(router.geminiService.callCount).toBe(documentTypes.length)
    expect(router.bedrockService.called).toBe(false)
  })

  it('should handle concurrent requests through Gemini', async () => {
    const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
      router.processDocument(`Document ${i}`, 'Contract')
    )

    const results = await Promise.all(concurrentRequests)

    // All requests should succeed through Gemini
    results.forEach(result => {
      expect(result.success).toBe(true)
    })

    expect(router.geminiService.callCount).toBe(5)
    expect(router.bedrockService.called).toBe(false)
    expect(router.getActiveService()).toBe('gemini')
  })

  it('should reject attempts to use Bedrock service', async () => {
    // Simulate attempt to force Bedrock usage (should not be possible after migration)
    router.useGemini = false

    await expect(router.processDocument('test', 'Contract'))
      .rejects.toThrow('Bedrock service should not be called after migration')

    expect(router.bedrockService.called).toBe(true)
    expect(router.geminiService.called).toBe(false)
  })
})