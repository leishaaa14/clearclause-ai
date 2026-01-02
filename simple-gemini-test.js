import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'

dotenv.config()

async function simpleTest() {
    try {
        console.log('Testing with API key:', process.env.VITE_GOOGLE_AI_API_KEY?.substring(0, 10) + '...')
        
        const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_AI_API_KEY)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

        const prompt = "Hello, please respond with 'Hello World'"
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()
        
        console.log('✅ Success! Response:', text)
        
    } catch (error) {
        console.error('❌ Error:', error.message)
        
        if (error.message.includes('API key')) {
            console.log('💡 Check your API key in Google AI Studio')
        } else if (error.message.includes('404')) {
            console.log('💡 Try using model "gemini-1.5-flash" instead')
        }
    }
}

simpleTest()