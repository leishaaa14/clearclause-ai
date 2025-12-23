import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

async function findWorkingModel() {
    const commonModels = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-pro',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest',
        'gemini-pro-vision'
    ]
    
    console.log('🔍 Testing common Gemini models...')
    
    for (const modelName of commonModels) {
        try {
            console.log(`\n📝 Testing: ${modelName}`)
            
            const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_AI_API_KEY)
            const model = genAI.getGenerativeModel({ model: modelName })

            const result = await model.generateContent("Hello")
            const response = await result.response
            const text = response.text()
            
            console.log(`✅ SUCCESS! Model "${modelName}" works!`)
            console.log(`📄 Response: ${text.substring(0, 50)}...`)
            
            // Update .env file with working model
            console.log(`\n🎯 Use this in your .env file:`)
            console.log(`VITE_GEMINI_MODEL=${modelName}`)
            
            return modelName
            
        } catch (error) {
            console.log(`❌ Failed: ${error.message.substring(0, 100)}...`)
        }
    }
    
    console.log('\n❌ No working models found. Check your API key permissions.')
}

findWorkingModel()