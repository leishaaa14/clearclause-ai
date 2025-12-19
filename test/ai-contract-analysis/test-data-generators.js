// Test Data Generators for AI Contract Analysis Testing
// Provides utilities to generate realistic contract data for comprehensive testing

import * as fc from 'fast-check';

/**
 * Contract Template Generator
 * Generates various types of contract templates with configurable parameters
 */
export class ContractTemplateGenerator {
    constructor() {
        this.clauseTemplates = {
            payment_terms: [
                'Payment shall be due within {{days}} days of invoice receipt.',
                'Payment terms are net {{days}} days from invoice date.',
                'Invoice payment is due {{days}} days after receipt.',
                'Payment shall be made within {{days}} days of billing.',
                'All payments are due within {{days}} days of invoice submission.'
            ],
            termination_clause: [
                'Either party may terminate this agreement with {{days}} days written notice.',
                'This agreement may be terminated by either party with {{days}} days notice.',
                'Termination requires {{days}} days advance written notice.',
                'Either party can terminate with {{days}} days prior notice.',
                'Agreement termination requires {{days}} days written notification.'
            ],
            liability_limitation: [
                'Liability is limited to the total contract value.',
                'Maximum liability shall not exceed ${{amount}}.',
                'Liability is capped at {{percentage}}% of contract value.',
                'Total liability is limited to the fees paid under this agreement.',
                'Neither party shall be liable for consequential damages.'
            ],
            confidentiality_agreement: [
                'Both parties agree to maintain confidentiality of proprietary information.',
                'Confidential information shall be protected for {{years}} years.',
                'All proprietary information must remain confidential during and after this agreement.',
                'Confidentiality obligations survive termination for {{years}} years.',
                'Both parties shall maintain strict confidentiality of all shared information.'
            ],
            intellectual_property: [
                'All intellectual property rights remain with the original owner.',
                'Work product shall be owned by {{party}} upon completion.',
                'Intellectual property created jointly shall be shared equally.',
                'All IP developed under this agreement belongs to {{party}}.',
                'Existing IP rights are retained by respective parties.'
            ],
            force_majeure: [
                'Neither party shall be liable for delays due to force majeure events.',
                'Force majeure includes acts of God, war, and government actions.',
                'Performance is excused during force majeure conditions.',
                'Force majeure events suspend obligations until resolution.',
                'Parties must notify each other of force majeure events within {{days}} days.'
            ],
            governing_law: [
                'This agreement shall be governed by the laws of {{jurisdiction}}.',
                'All disputes shall be resolved under {{jurisdiction}} law.',
                'The laws of {{jurisdiction}} apply to this agreement.',
                'Legal proceedings shall be conducted in {{jurisdiction}}.',
                'This contract is subject to {{jurisdiction}} jurisdiction.'
            ],
            dispute_resolution: [
                'Disputes shall be resolved through binding arbitration.',
                'All disputes must first go through mediation before litigation.',
                'Arbitration shall be conducted under {{rules}} rules.',
                'Disputes shall be resolved in {{location}} courts.',
                'Mediation is required before any legal proceedings.'
            ],
            warranties: [
                'Each party warrants it has authority to enter this agreement.',
                'Services shall be performed in a workmanlike manner.',
                'All warranties are limited to {{period}} from completion.',
                'No warranties are provided beyond those expressly stated.',
                'Warranties survive termination for {{period}}.'
            ],
            indemnification: [
                '{{party}} shall indemnify the other party against third-party claims.',
                'Indemnification covers legal fees and damages from covered claims.',
                'Each party indemnifies for breaches of their obligations.',
                'Indemnification is limited to {{amount}} per incident.',
                'Indemnification obligations survive agreement termination.'
            ]
        };

        this.contractTypes = [
            'Service Agreement',
            'Employment Contract',
            'Software License Agreement',
            'Consulting Agreement',
            'Non-Disclosure Agreement',
            'Partnership Agreement',
            'Supply Agreement',
            'Distribution Agreement',
            'Maintenance Agreement',
            'Development Agreement'
        ];

        this.parties = [
            'Company A',
            'Company B',
            'Contractor',
            'Client',
            'Vendor',
            'Supplier',
            'Developer',
            'Consultant',
            'Service Provider',
            'Customer'
        ];
    }

    /**
     * Generate a complete contract with specified parameters
     */
    generateContract(options = {}) {
        const {
            contractType = this.getRandomContractType(),
            numClauses = fc.sample(fc.integer({ min: 3, max: 12 }), 1)[0],
            clauseTypes = this.getRandomClauseTypes(numClauses),
            parties = this.getRandomParties(),
            includeHeader = true,
            includeFooter = true
        } = options;

        let contract = '';

        if (includeHeader) {
            contract += this.generateContractHeader(contractType, parties);
        }

        contract += '\n\n';

        clauseTypes.forEach((clauseType, index) => {
            contract += `${index + 1}. ${this.generateClause(clauseType)}\n\n`;
        });

        if (includeFooter) {
            contract += this.generateContractFooter(parties);
        }

        return {
            text: contract.trim(),
            metadata: {
                contractType,
                numClauses,
                clauseTypes,
                parties,
                wordCount: contract.split(/\s+/).length,
                characterCount: contract.length
            }
        };
    }

    /**
     * Generate contract header
     */
    generateContractHeader(contractType, parties) {
        const date = new Date().toLocaleDateString();
        return `${contractType.toUpperCase()}

This ${contractType} ("Agreement") is entered into on ${date}, between ${parties[0]} ("Party A") and ${parties[1]} ("Party B").

TERMS AND CONDITIONS:`;
    }

    /**
     * Generate contract footer
     */
    generateContractFooter(parties) {
        return `IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

${parties[0]}: _________________________    Date: _________

${parties[1]}: _________________________    Date: _________`;
    }

    /**
     * Generate a single clause of specified type
     */
    generateClause(clauseType) {
        const templates = this.clauseTemplates[clauseType] || ['Standard clause text.'];
        const template = templates[Math.floor(Math.random() * templates.length)];

        return this.fillTemplate(template, clauseType);
    }

    /**
     * Fill template placeholders with realistic values
     */
    fillTemplate(template, clauseType) {
        let filled = template;

        // Replace common placeholders
        filled = filled.replace(/\{\{days\}\}/g, () => {
            const days = [15, 30, 45, 60, 90];
            return days[Math.floor(Math.random() * days.length)];
        });

        filled = filled.replace(/\{\{amount\}\}/g, () => {
            const amounts = ['$10,000', '$25,000', '$50,000', '$100,000', '$250,000'];
            return amounts[Math.floor(Math.random() * amounts.length)];
        });

        filled = filled.replace(/\{\{percentage\}\}/g, () => {
            const percentages = [50, 75, 100, 150, 200];
            return percentages[Math.floor(Math.random() * percentages.length)];
        });

        filled = filled.replace(/\{\{years\}\}/g, () => {
            const years = [1, 2, 3, 5, 7];
            return years[Math.floor(Math.random() * years.length)];
        });

        filled = filled.replace(/\{\{party\}\}/g, () => {
            const parties = ['Client', 'Contractor', 'Company A', 'Company B'];
            return parties[Math.floor(Math.random() * parties.length)];
        });

        filled = filled.replace(/\{\{jurisdiction\}\}/g, () => {
            const jurisdictions = ['California', 'New York', 'Delaware', 'Texas', 'Florida'];
            return jurisdictions[Math.floor(Math.random() * jurisdictions.length)];
        });

        filled = filled.replace(/\{\{location\}\}/g, () => {
            const locations = ['San Francisco', 'New York', 'Los Angeles', 'Chicago', 'Miami'];
            return locations[Math.floor(Math.random() * locations.length)];
        });

        filled = filled.replace(/\{\{rules\}\}/g, () => {
            const rules = ['AAA', 'JAMS', 'ICC', 'LCIA'];
            return rules[Math.floor(Math.random() * rules.length)];
        });

        filled = filled.replace(/\{\{period\}\}/g, () => {
            const periods = ['30 days', '60 days', '90 days', '6 months', '1 year'];
            return periods[Math.floor(Math.random() * periods.length)];
        });

        return filled;
    }

    /**
     * Get random contract type
     */
    getRandomContractType() {
        return this.contractTypes[Math.floor(Math.random() * this.contractTypes.length)];
    }

    /**
     * Get random clause types
     */
    getRandomClauseTypes(count) {
        const allTypes = Object.keys(this.clauseTemplates);
        const shuffled = [...allTypes].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, allTypes.length));
    }

    /**
     * Get random parties
     */
    getRandomParties() {
        const shuffled = [...this.parties].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 2);
    }
}

/**
 * Fast-check arbitraries for property-based testing
 */

// Generate valid contract documents
export const contractDocumentArbitrary = fc.record({
    text: fc.oneof(
        // Short contracts
        fc.string({ minLength: 100, maxLength: 500 }).map(text =>
            `SIMPLE CONTRACT\nPayment due in 30 days.\nTermination with notice.\n${text}`
        ),
        // Medium contracts
        fc.string({ minLength: 500, maxLength: 2000 }).map(text =>
            `SERVICE AGREEMENT\n1. PAYMENT: Payment due in 45 days.\n2. TERMINATION: 60 days notice.\n3. LIABILITY: Limited.\n${text}`
        ),
        // Generated contracts
        fc.constant(null).map(() => {
            const generator = new ContractTemplateGenerator();
            return generator.generateContract().text;
        })
    ),
    type: fc.constantFrom('pdf', 'docx', 'txt'),
    metadata: fc.record({
        filename: fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '.txt'),
        fileSize: fc.integer({ min: 1000, max: 1000000 }),
        uploadTimestamp: fc.date().map(d => d.toISOString())
    })
});

// Generate clause data
export const clauseArbitrary = fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }),
    text: fc.oneof(
        fc.constant('Payment shall be due within thirty (30) days of invoice receipt.'),
        fc.constant('Either party may terminate this agreement with sixty (60) days written notice.'),
        fc.constant('Liability is limited to the total contract value and excludes consequential damages.'),
        fc.constant('Both parties agree to maintain confidentiality of proprietary information.'),
        fc.constant('All intellectual property rights remain with the original owner.'),
        fc.string({ minLength: 50, maxLength: 200 })
    ),
    type: fc.constantFrom(
        'payment_terms',
        'termination_clause',
        'liability_limitation',
        'confidentiality_agreement',
        'intellectual_property',
        'force_majeure',
        'governing_law',
        'dispute_resolution',
        'warranties',
        'indemnification'
    ),
    category: fc.constantFrom('Payment', 'Legal', 'Risk', 'Compliance', 'General'),
    confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
    startPosition: fc.integer({ min: 0, max: 1000 }),
    endPosition: fc.integer({ min: 100, max: 2000 })
});

// Generate risk data
export const riskArbitrary = fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }),
    title: fc.oneof(
        fc.constant('Payment Delay Risk'),
        fc.constant('Termination Risk'),
        fc.constant('Liability Exposure'),
        fc.constant('Confidentiality Breach'),
        fc.constant('IP Ownership Dispute'),
        fc.string({ minLength: 10, maxLength: 50 })
    ),
    description: fc.string({ minLength: 20, maxLength: 200 }),
    severity: fc.constantFrom('Low', 'Medium', 'High', 'Critical'),
    category: fc.constantFrom('financial', 'legal', 'operational', 'compliance', 'reputational'),
    affectedClauses: fc.array(fc.string({ minLength: 5, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    mitigation: fc.string({ minLength: 20, max: 150 }),
    confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
});

// Generate recommendation data
export const recommendationArbitrary = fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }),
    title: fc.string({ minLength: 10, maxLength: 50 }),
    description: fc.string({ minLength: 20, maxLength: 200 }),
    priority: fc.constantFrom('Low', 'Medium', 'High'),
    category: fc.constantFrom('financial', 'legal', 'operational', 'compliance'),
    actionRequired: fc.boolean()
});

// Generate analysis output structure
export const analysisOutputArbitrary = fc.record({
    summary: fc.record({
        title: fc.string({ minLength: 5, maxLength: 100 }),
        documentType: fc.constantFrom('contract', 'agreement', 'license', 'nda'),
        totalClauses: fc.integer({ min: 0, max: 50 }),
        riskScore: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
        processingTime: fc.integer({ min: 100, max: 30000 }),
        confidence: fc.float({ min: Math.fround(0), max: Math.fround(1) })
    }),
    clauses: fc.array(clauseArbitrary, { minLength: 0, maxLength: 20 }),
    risks: fc.array(riskArbitrary, { minLength: 0, maxLength: 15 }),
    recommendations: fc.array(recommendationArbitrary, { minLength: 0, maxLength: 10 }),
    metadata: fc.record({
        processingMethod: fc.constantFrom('ai_model', 'api_fallback'),
        modelUsed: fc.constantFrom('llama-3.1-8b-instruct', 'gpt-4', 'claude-3'),
        processingTime: fc.integer({ min: 100, max: 30000 }),
        tokenUsage: fc.integer({ min: 100, max: 10000 }),
        confidence: fc.float({ min: Math.fround(0), max: Math.fround(1) })
    })
});

// Generate document parsing input
export const documentParsingInputArbitrary = fc.record({
    content: fc.oneof(
        fc.uint8Array({ minLength: 100, maxLength: 10000 }), // Binary content (PDF)
        fc.string({ minLength: 100, maxLength: 5000 }), // Text content
        fc.record({ // DOCX-like structure
            text: fc.string({ minLength: 100, maxLength: 5000 }),
            metadata: fc.record({
                title: fc.string({ minLength: 5, maxLength: 100 }),
                author: fc.string({ minLength: 5, maxLength: 50 })
            })
        })
    ),
    format: fc.constantFrom('pdf', 'docx', 'txt'),
    filename: fc.string({ minLength: 5, maxLength: 50 }).map(s => s + '.txt')
});

// Generate model configuration
export const modelConfigArbitrary = fc.record({
    modelName: fc.constantFrom('llama-3.1-8b-instruct', 'llama-3.2-3b', 'mistral-7b'),
    maxTokens: fc.constantFrom(4096, 8192, 16384, 32768, 128000),
    temperature: fc.float({ min: Math.fround(0.0), max: Math.fround(1.0) }),
    topP: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
    contextWindow: fc.constantFrom(4096, 8192, 32768, 128000),
    batchSize: fc.integer({ min: 1, max: 8 }),
    memoryOptimization: fc.boolean(),
    quantization: fc.constantFrom('none', 'int8', 'int4', 'fp16')
});

// Generate API configuration
export const apiConfigArbitrary = fc.record({
    endpoint: fc.webUrl(),
    apiKey: fc.string({ minLength: 20, maxLength: 100 }),
    timeout: fc.integer({ min: 5000, max: 60000 }),
    retryAttempts: fc.integer({ min: 1, max: 5 }),
    rateLimitPerMinute: fc.integer({ min: 10, max: 1000 }),
    fallbackEnabled: fc.boolean()
});

/**
 * Validation utilities for testing
 */

export function validateContractStructure(contract) {
    if (typeof contract !== 'object' || !contract.text) {
        throw new Error('Contract must have text property');
    }

    if (contract.text.length < 50) {
        throw new Error('Contract text too short');
    }

    if (contract.metadata && typeof contract.metadata !== 'object') {
        throw new Error('Contract metadata must be object');
    }

    return true;
}

export function validateAnalysisOutput(output) {
    const requiredFields = ['summary', 'clauses', 'risks', 'recommendations', 'metadata'];

    for (const field of requiredFields) {
        if (!(field in output)) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    if (!Array.isArray(output.clauses)) {
        throw new Error('Clauses must be array');
    }

    if (!Array.isArray(output.risks)) {
        throw new Error('Risks must be array');
    }

    if (!Array.isArray(output.recommendations)) {
        throw new Error('Recommendations must be array');
    }

    // Validate summary fields
    const summaryFields = ['title', 'documentType', 'totalClauses', 'riskScore', 'confidence'];
    for (const field of summaryFields) {
        if (!(field in output.summary)) {
            throw new Error(`Missing summary field: ${field}`);
        }
    }

    // Validate numeric ranges
    if (output.summary.riskScore < 0 || output.summary.riskScore > 1) {
        throw new Error('Risk score must be between 0 and 1');
    }

    if (output.summary.confidence < 0 || output.summary.confidence > 1) {
        throw new Error('Confidence must be between 0 and 1');
    }

    return true;
}

export function validateClause(clause) {
    const requiredFields = ['id', 'text', 'type', 'category', 'confidence'];

    for (const field of requiredFields) {
        if (!(field in clause)) {
            throw new Error(`Missing clause field: ${field}`);
        }
    }

    if (clause.confidence < 0 || clause.confidence > 1) {
        throw new Error('Clause confidence must be between 0 and 1');
    }

    return true;
}

export function validateRisk(risk) {
    const requiredFields = ['id', 'title', 'description', 'severity', 'category', 'confidence'];

    for (const field of requiredFields) {
        if (!(field in risk)) {
            throw new Error(`Missing risk field: ${field}`);
        }
    }

    const validSeverities = ['Low', 'Medium', 'High', 'Critical'];
    if (!validSeverities.includes(risk.severity)) {
        throw new Error(`Invalid risk severity: ${risk.severity}`);
    }

    if (risk.confidence < 0 || risk.confidence > 1) {
        throw new Error('Risk confidence must be between 0 and 1');
    }

    return true;
}

/**
 * Performance testing utilities
 */

export class PerformanceTestGenerator {
    static generateLoadTestContracts(count = 10) {
        const generator = new ContractTemplateGenerator();
        const contracts = [];

        for (let i = 0; i < count; i++) {
            const contract = generator.generateContract({
                numClauses: 3 + (i % 8), // Varying complexity
                includeHeader: true,
                includeFooter: true
            });

            contracts.push({
                ...contract,
                id: `load-test-${i + 1}`,
                filename: `load-test-contract-${i + 1}.txt`
            });
        }

        return contracts;
    }

    static generateStressTestContract(targetSize = 50000) {
        const generator = new ContractTemplateGenerator();
        let contract = generator.generateContract({ numClauses: 20 });

        // Expand contract to target size
        while (contract.text.length < targetSize) {
            const additionalClause = generator.generateClause('payment_terms');
            contract.text += `\n\nADDITIONAL CLAUSE: ${additionalClause}`;
        }

        return contract;
    }

    static generateConcurrencyTestBatch(batchSize = 5) {
        const generator = new ContractTemplateGenerator();
        const batch = [];

        for (let i = 0; i < batchSize; i++) {
            batch.push({
                id: `concurrent-${i + 1}`,
                contract: generator.generateContract(),
                expectedProcessingTime: 5000 + Math.random() * 10000 // 5-15 seconds
            });
        }

        return batch;
    }
}