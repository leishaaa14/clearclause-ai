// Performance Benchmarking Tests for AI Contract Analysis System
// Tests processing speed, memory usage, and scalability under various loads

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContractProcessor } from '../../src/processors/ContractProcessor.js';
import { DocumentParser } from '../../model/parsers/DocumentParser.js';
import { TextPreprocessor } from '../../model/preprocessing/TextPreprocessor.js';
import { ClauseExtractor } from '../../model/extractors/ClauseExtractor.js';
import { RiskAnalyzer } from '../../model/analyzers/RiskAnalyzer.js';

describe('Performance Benchmarking Tests', () => {
    let contractProcessor;
    let performanceMetrics;

    beforeEach(() => {
        contractProcessor = new ContractProcessor({
            preferAIModel: false, // Use API fallback for consistent performance testing
            fallbackToAPI: true,
            timeout: 60000
        });

        performanceMetrics = {
            startTime: 0,
            endTime: 0,
            memoryBefore: 0,
            memoryAfter: 0,
            processingTimes: [],
            throughput: 0
        };
    });

    afterEach(async () => {
        if (contractProcessor) {
            await contractProcessor.cleanup();
        }
    });

    describe('Processing Speed Benchmarks', () => {
        it('should process small contracts within 5 seconds', async () => {
            const smallContract = `
        SIMPLE SERVICE AGREEMENT
        Payment due in 30 days.
        Either party may terminate with 15 days notice.
        Liability limited to contract value.
      `;

            const document = { text: smallContract, filename: 'small-contract.txt' };

            const startTime = Date.now();
            const result = await contractProcessor.processContract(document);
            const processingTime = Date.now() - startTime;

            expect(processingTime).toBeLessThan(5000);
            expect(result.clauses.length).toBeGreaterThan(0);
            expect(result.metadata.processingTime).toBeLessThan(5000);

            console.log(`Small contract processing time: ${processingTime}ms`);
        }, 10000);

        it('should process medium contracts within 15 seconds', async () => {
            const mediumContract = `
        COMPREHENSIVE SERVICE AGREEMENT
        
        This Service Agreement is entered into between the parties for professional services.
        
        1. SCOPE OF WORK
        Contractor shall provide consulting services as detailed in Exhibit A.
        All work shall be performed in accordance with industry standards.
        
        2. PAYMENT TERMS
        Payment shall be due within forty-five (45) days of invoice receipt.
        Late payments will incur a service charge of 1.5% per month.
        All expenses must be pre-approved in writing.
        
        3. TERMINATION
        Either party may terminate this agreement with sixty (60) days written notice.
        Upon termination, all work in progress shall be completed within 30 days.
        Final payment is due within 15 days of completion.
        
        4. LIABILITY AND INDEMNIFICATION
        Contractor's liability is limited to the total fees paid under this agreement.
        Client agrees to indemnify contractor against third-party claims.
        Neither party shall be liable for consequential or punitive damages.
        
        5. CONFIDENTIALITY
        Both parties agree to maintain confidentiality of proprietary information.
        This obligation survives termination for a period of three (3) years.
        
        6. INTELLECTUAL PROPERTY
        All work product shall be owned by client upon full payment.
        Contractor retains rights to general methodologies and know-how.
        
        7. GOVERNING LAW
        This agreement shall be governed by the laws of the State of California.
        Any disputes shall be resolved through binding arbitration.
      `;

            const document = { text: mediumContract, filename: 'medium-contract.txt' };

            const startTime = Date.now();
            const result = await contractProcessor.processContract(document);
            const processingTime = Date.now() - startTime;

            expect(processingTime).toBeLessThan(15000);
            expect(result.clauses.length).toBeGreaterThanOrEqual(3);
            expect(result.risks.length).toBeGreaterThan(0);
            expect(result.metadata.processingTime).toBeLessThan(15000);

            console.log(`Medium contract processing time: ${processingTime}ms`);
            console.log(`Clauses identified: ${result.clauses.length}`);
            console.log(`Risks identified: ${result.risks.length}`);
        }, 20000);

        it('should process large contracts within 30 seconds', async () => {
            // Generate a large contract by repeating sections
            const contractSection = `
        SECTION: TERMS AND CONDITIONS
        
        The parties hereby agree to the following terms and conditions which shall govern their relationship.
        Payment terms are net thirty (30) days from invoice date with a 2% discount for early payment.
        Either party may terminate this agreement with ninety (90) days written notice to the other party.
        Liability is limited to the total contract value and excludes consequential damages.
        Both parties agree to maintain strict confidentiality of all proprietary information disclosed.
        All intellectual property developed shall be jointly owned by both parties unless otherwise specified.
        This agreement shall be governed by applicable state and federal laws.
        Any disputes shall be resolved through mediation followed by binding arbitration if necessary.
        
      `;

            const largeContract = `
        MASTER SERVICE AGREEMENT
        
        This comprehensive agreement governs the relationship between the contracting parties.
        
        ${Array(15).fill(contractSection).join('\n')}
        
        IN WITNESS WHEREOF, the parties have executed this agreement on the date first written above.
      `;

            const document = { text: largeContract, filename: 'large-contract.txt' };

            const startTime = Date.now();
            const result = await contractProcessor.processContract(document);
            const processingTime = Date.now() - startTime;

            expect(processingTime).toBeLessThan(30000);
            expect(result.clauses.length).toBeGreaterThanOrEqual(4);
            expect(result.summary.totalClauses).toBe(result.clauses.length);
            expect(result.metadata.processingTime).toBeLessThan(30000);

            console.log(`Large contract processing time: ${processingTime}ms`);
            console.log(`Contract length: ${largeContract.length} characters`);
            console.log(`Clauses identified: ${result.clauses.length}`);
            console.log(`Processing rate: ${(largeContract.length / processingTime * 1000).toFixed(2)} chars/sec`);
        }, 35000);
    });

    describe('Throughput Benchmarks', () => {
        it('should process multiple small contracts concurrently', async () => {
            const contracts = Array(5).fill(null).map((_, index) => ({
                text: `
          CONTRACT ${index + 1}
          Payment due in ${30 + index * 5} days.
          Termination with ${15 + index * 5} days notice.
          Liability limited to contract value.
        `,
                filename: `concurrent-${index + 1}.txt`
            }));

            const startTime = Date.now();

            // Process all contracts concurrently
            const promises = contracts.map(doc => contractProcessor.processContract(doc));
            const results = await Promise.all(promises);

            const totalTime = Date.now() - startTime;
            const throughput = contracts.length / (totalTime / 1000); // contracts per second

            expect(results.length).toBe(5);
            expect(totalTime).toBeLessThan(20000); // Should complete within 20 seconds
            expect(throughput).toBeGreaterThan(0.1); // At least 0.1 contracts per second

            results.forEach((result, index) => {
                expect(result.clauses.length).toBeGreaterThan(0);
                expect(result.metadata.processingMethod).toBe('api_fallback');
            });

            console.log(`Concurrent processing time: ${totalTime}ms`);
            console.log(`Throughput: ${throughput.toFixed(3)} contracts/sec`);

            // Verify processing stats
            const stats = contractProcessor.getProcessingStats();
            expect(stats.totalRequests).toBeGreaterThanOrEqual(5);
        }, 25000);

        it('should maintain performance under sequential load', async () => {
            const contractTemplate = `
        SEQUENTIAL LOAD TEST CONTRACT
        Payment terms: Net 30 days from invoice date.
        Termination: Either party may terminate with 30 days notice.
        Liability: Limited to total contract value.
        Confidentiality: Both parties agree to maintain confidentiality.
      `;

            const processingTimes = [];
            const numContracts = 10;

            for (let i = 0; i < numContracts; i++) {
                const document = {
                    text: contractTemplate.replace('CONTRACT', `CONTRACT ${i + 1}`),
                    filename: `sequential-${i + 1}.txt`
                };

                const startTime = Date.now();
                const result = await contractProcessor.processContract(document);
                const processingTime = Date.now() - startTime;

                processingTimes.push(processingTime);

                expect(result.clauses.length).toBeGreaterThan(0);
                expect(processingTime).toBeLessThan(10000); // Each should be under 10 seconds
            }

            // Calculate performance metrics
            const avgProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
            const maxProcessingTime = Math.max(...processingTimes);
            const minProcessingTime = Math.min(...processingTimes);

            // Performance should be reasonably consistent (max shouldn't be more than 10x min)
            // Allow for more variance due to system load and initialization overhead
            expect(maxProcessingTime / minProcessingTime).toBeLessThan(10);
            expect(avgProcessingTime).toBeLessThan(8000);

            console.log(`Sequential processing stats:`);
            console.log(`  Average: ${avgProcessingTime.toFixed(2)}ms`);
            console.log(`  Min: ${minProcessingTime}ms`);
            console.log(`  Max: ${maxProcessingTime}ms`);
            console.log(`  Consistency ratio: ${(maxProcessingTime / minProcessingTime).toFixed(2)}`);
        }, 120000);
    });

    describe('Memory Usage Benchmarks', () => {
        it('should maintain reasonable memory usage during processing', async () => {
            const getMemoryUsage = () => {
                if (typeof process !== 'undefined' && process.memoryUsage) {
                    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
                }
                return 0; // Browser environment
            };

            const initialMemory = getMemoryUsage();

            const contractText = `
        MEMORY USAGE TEST CONTRACT
        
        This contract is designed to test memory usage during processing.
        It contains multiple sections with various clause types.
        
        Payment terms: Payment shall be due within thirty (30) days.
        Termination: Either party may terminate with sixty (60) days notice.
        Liability: Liability is limited to the total contract value.
        Confidentiality: Both parties agree to maintain confidentiality.
        Intellectual Property: All IP shall remain with the original owner.
        Governing Law: This agreement is governed by state law.
        Dispute Resolution: Disputes shall be resolved through arbitration.
      `;

            const document = { text: contractText, filename: 'memory-test.txt' };

            // Process contract and measure memory
            const result = await contractProcessor.processContract(document);
            const peakMemory = getMemoryUsage();

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            // Wait a bit for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
            const finalMemory = getMemoryUsage();

            expect(result.clauses.length).toBeGreaterThan(0);

            if (initialMemory > 0) { // Only test in Node.js environment
                const memoryIncrease = peakMemory - initialMemory;
                const memoryRetained = finalMemory - initialMemory;

                // Memory increase should be reasonable (less than 50MB for a single contract)
                expect(memoryIncrease).toBeLessThan(50);

                // Most memory should be cleaned up (retained should be less than 20MB)
                expect(memoryRetained).toBeLessThan(20);

                console.log(`Memory usage:`);
                console.log(`  Initial: ${initialMemory.toFixed(2)}MB`);
                console.log(`  Peak: ${peakMemory.toFixed(2)}MB`);
                console.log(`  Final: ${finalMemory.toFixed(2)}MB`);
                console.log(`  Increase: ${memoryIncrease.toFixed(2)}MB`);
                console.log(`  Retained: ${memoryRetained.toFixed(2)}MB`);
            }
        }, 15000);

        it('should handle memory cleanup after multiple processing cycles', async () => {
            const getMemoryUsage = () => {
                if (typeof process !== 'undefined' && process.memoryUsage) {
                    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
                }
                return 0;
            };

            const initialMemory = getMemoryUsage();
            const contractText = `
        MEMORY CLEANUP TEST
        Payment due in 30 days.
        Termination with 30 days notice.
        Liability limited to contract value.
      `;

            // Process multiple contracts to test memory cleanup
            for (let i = 0; i < 5; i++) {
                const document = {
                    text: contractText + ` Contract ${i + 1}`,
                    filename: `cleanup-test-${i + 1}.txt`
                };

                const result = await contractProcessor.processContract(document);
                expect(result.clauses.length).toBeGreaterThan(0);

                // Force cleanup periodically
                if (i % 2 === 1 && global.gc) {
                    global.gc();
                }
            }

            // Final cleanup
            if (global.gc) {
                global.gc();
            }

            await new Promise(resolve => setTimeout(resolve, 200));
            const finalMemory = getMemoryUsage();

            if (initialMemory > 0) {
                const memoryIncrease = finalMemory - initialMemory;

                // Memory increase should be minimal after cleanup (less than 30MB)
                expect(memoryIncrease).toBeLessThan(30);

                console.log(`Memory cleanup test:`);
                console.log(`  Initial: ${initialMemory.toFixed(2)}MB`);
                console.log(`  Final: ${finalMemory.toFixed(2)}MB`);
                console.log(`  Net increase: ${memoryIncrease.toFixed(2)}MB`);
            }
        }, 30000);
    });

    describe('Component Performance Benchmarks', () => {
        it('should benchmark document parsing performance', async () => {
            const documentParser = new DocumentParser();
            const testTexts = [
                'Short contract text for parsing test.',
                'Medium length contract text with multiple clauses including payment terms, termination conditions, and liability limitations for comprehensive parsing performance evaluation.',
                Array(100).fill('Long contract text with extensive content to test parsing performance under load with multiple sections and detailed clauses.').join(' ')
            ];

            const parsingTimes = [];

            for (const text of testTexts) {
                const startTime = Date.now();
                const result = await documentParser.parseDocument(text, 'txt');
                const parsingTime = Date.now() - startTime;

                parsingTimes.push({
                    textLength: text.length,
                    parsingTime: parsingTime,
                    wordsPerSecond: (result.metadata.wordCount / parsingTime * 1000).toFixed(2)
                });

                expect(result.text).toBeDefined();
                expect(parsingTime).toBeLessThan(1000); // Should parse within 1 second
            }

            console.log('Document parsing performance:');
            parsingTimes.forEach((metric, index) => {
                console.log(`  Text ${index + 1}: ${metric.textLength} chars, ${metric.parsingTime}ms, ${metric.wordsPerSecond} words/sec`);
            });
        }, 10000);

        it('should benchmark clause extraction performance', async () => {
            const clauseExtractor = new ClauseExtractor();
            const contractTexts = [
                'Payment due in 30 days. Termination with notice.',
                'Payment shall be due within thirty days. Either party may terminate this agreement with sixty days written notice. Liability is limited to contract value.',
                Array(10).fill('Payment terms are net 30 days. Termination requires 60 days notice. Liability is limited. Confidentiality must be maintained. Intellectual property rights are reserved.').join(' ')
            ];

            const extractionTimes = [];

            for (const text of contractTexts) {
                const startTime = Date.now();
                const result = await clauseExtractor.extractClauses(text);
                const extractionTime = Date.now() - startTime;

                extractionTimes.push({
                    textLength: text.length,
                    extractionTime: extractionTime,
                    clausesFound: result.clauses.length,
                    clausesPerSecond: (result.clauses.length / extractionTime * 1000).toFixed(2)
                });

                expect(result.clauses.length).toBeGreaterThan(0);
                expect(extractionTime).toBeLessThan(5000); // Should extract within 5 seconds
            }

            console.log('Clause extraction performance:');
            extractionTimes.forEach((metric, index) => {
                console.log(`  Text ${index + 1}: ${metric.textLength} chars, ${metric.extractionTime}ms, ${metric.clausesFound} clauses, ${metric.clausesPerSecond} clauses/sec`);
            });
        }, 20000);

        it('should benchmark risk analysis performance', async () => {
            const riskAnalyzer = new RiskAnalyzer();
            const clauseSets = [
                [
                    { id: 'c1', text: 'Payment due in 30 days', type: 'payment_terms', confidence: 0.9 }
                ],
                [
                    { id: 'c1', text: 'Payment due in 90 days', type: 'payment_terms', confidence: 0.9 },
                    { id: 'c2', text: 'Unlimited liability', type: 'liability_limitation', confidence: 0.95 },
                    { id: 'c3', text: 'Immediate termination allowed', type: 'termination_clause', confidence: 0.8 }
                ],
                Array(20).fill(null).map((_, i) => ({
                    id: `c${i + 1}`,
                    text: `Clause ${i + 1} with potential risk factors`,
                    type: i % 3 === 0 ? 'payment_terms' : i % 3 === 1 ? 'liability_limitation' : 'termination_clause',
                    confidence: 0.8 + Math.random() * 0.2
                }))
            ];

            const analysisTimes = [];

            for (const clauses of clauseSets) {
                const startTime = Date.now();
                const result = await riskAnalyzer.analyzeRisks(clauses);
                const analysisTime = Date.now() - startTime;

                analysisTimes.push({
                    clauseCount: clauses.length,
                    analysisTime: analysisTime,
                    risksFound: result.risks.length,
                    risksPerSecond: (result.risks.length / analysisTime * 1000).toFixed(2)
                });

                expect(analysisTime).toBeLessThan(3000); // Should analyze within 3 seconds
            }

            console.log('Risk analysis performance:');
            analysisTimes.forEach((metric, index) => {
                console.log(`  Set ${index + 1}: ${metric.clauseCount} clauses, ${metric.analysisTime}ms, ${metric.risksFound} risks, ${metric.risksPerSecond} risks/sec`);
            });
        }, 15000);
    });

    describe('Scalability Tests', () => {
        it('should maintain performance with increasing contract complexity', async () => {
            const complexityLevels = [
                { name: 'Simple', sections: 3, clausesPerSection: 1 },
                { name: 'Medium', sections: 7, clausesPerSection: 2 },
                { name: 'Complex', sections: 12, clausesPerSection: 3 }
            ];

            const performanceResults = [];

            for (const level of complexityLevels) {
                const contractSections = Array(level.sections).fill(null).map((_, sectionIndex) => {
                    const clauses = Array(level.clausesPerSection).fill(null).map((_, clauseIndex) => {
                        const clauseTypes = ['payment', 'termination', 'liability', 'confidentiality', 'intellectual property'];
                        const clauseType = clauseTypes[clauseIndex % clauseTypes.length];
                        return `${clauseType} clause with specific terms and conditions for section ${sectionIndex + 1}.`;
                    });
                    return `SECTION ${sectionIndex + 1}: ${clauses.join(' ')}`;
                });

                const contractText = contractSections.join('\n\n');
                const document = { text: contractText, filename: `${level.name.toLowerCase()}-contract.txt` };

                const startTime = Date.now();
                const result = await contractProcessor.processContract(document);
                const processingTime = Date.now() - startTime;

                performanceResults.push({
                    complexity: level.name,
                    sections: level.sections,
                    totalClauses: level.sections * level.clausesPerSection,
                    textLength: contractText.length,
                    processingTime: processingTime,
                    clausesIdentified: result.clauses.length,
                    risksIdentified: result.risks.length,
                    efficiency: (result.clauses.length / processingTime * 1000).toFixed(3) // clauses per second
                });

                expect(result.clauses.length).toBeGreaterThan(0);
                expect(processingTime).toBeLessThan(45000); // Should complete within 45 seconds even for complex contracts
            }

            console.log('Scalability test results:');
            performanceResults.forEach(result => {
                console.log(`  ${result.complexity}: ${result.processingTime}ms, ${result.clausesIdentified} clauses, ${result.efficiency} clauses/sec`);
            });

            // Verify that efficiency doesn't degrade too much with complexity
            const simpleEfficiency = parseFloat(performanceResults[0].efficiency);
            const complexEfficiency = parseFloat(performanceResults[2].efficiency);
            const efficiencyRatio = complexEfficiency / simpleEfficiency;

            // Complex contracts should maintain at least 30% of simple contract efficiency
            expect(efficiencyRatio).toBeGreaterThan(0.3);
        }, 180000);
    });
});