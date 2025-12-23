import { handler } from './functions/process.js'

async function debugCurrentIssue() {
    try {
        console.log('🔍 Debugging current analysis issue...')
        
        // Test with a simple contract
        const testRequest = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                action: 'analyze',
                documentText: `SIMPLE CONTRACT

This is a service agreement between Company A and Company B.

1. SERVICES
Company B will provide consulting services to Company A.

2. PAYMENT
Company A will pay $5000 per month.

3. TERM
This agreement lasts for 6 months.`,
                documentType: 'Service Agreement',
                filename: 'test-contract.txt'
            },
            query: {}
        }
        
        console.log('📄 Testing simple contract analysis...')
        const result = await handler(testRequest)
        
        console.log('📊 Response Status:', result.statusCode)
        
        if (result.statusCode === 200) {
            const responseData = JSON.parse(result.body)
            console.log('✅ Analysis Response:')
            console.log('🤖 Model used:', responseData.model)
            console.log('🎯 Using real AI:', responseData.usingRealAI)
            console.log('📈 Confidence:', responseData.confidence)
            
            if (responseData.analysis) {
                console.log('\n📋 Analysis Details:')
                console.log('- Document Type:', responseData.analysis.summary?.documentType)
                console.log('- Total Clauses:', responseData.analysis.summary?.totalClausesIdentified)
                console.log('- Clauses Array Length:', responseData.analysis.clauses?.length)
                console.log('- Risks Array Length:', responseData.analysis.risks?.length)
                console.log('- Key Terms Array Length:', responseData.analysis.keyTerms?.length)
                
                if (responseData.analysis.clauses && responseData.analysis.clauses.length > 0) {
                    console.log('\n🔍 First Clause:')
                    console.log(JSON.stringify(responseData.analysis.clauses[0], null, 2))
                } else {
                    console.log('\n❌ No clauses found in analysis')
                    console.log('Full analysis object:')
                    console.log(JSON.stringify(responseData.analysis, null, 2))
                }
            }
            
            if (responseData.errorDetails) {
                console.log('\n⚠️ Error Details:', responseData.errorDetails)
            }
        } else {
            console.error('❌ Request failed:', result.body)
        }
        
    } catch (error) {
        console.error('❌ Debug test failed:', error.message)
    }
}

debugCurrentIssue()