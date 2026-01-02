import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

async function checkAvailableModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_AI_API_KEY)
        
        // List available models
        const models = await genAI.listModels()
        
        console.log('Available Gemini models:')
        models.forEach(model => {
            console.log(`- ${model.name} (${model.displayName})`)
            if (model.supportedGenerationMethods) {
                console.log(`  Supported methods: ${model.supportedGenerationMethods.join(', ')}`)
            }
        })
        
    } catch (error) {
        console.error('Error listing models:', error.message)
    }
}

checkAvailableModels()