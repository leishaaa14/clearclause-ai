/**
 * Check what Gemini models are actually available
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.VITE_GOOGLE_AI_API_KEY;

async function checkAvailableModels() {
    try {
        console.log('🔍 Checking available Gemini models...');
        
        const genAI = new GoogleGenerativeAI(API_KEY);
        
        // Try to list models
        console.log('\n1️⃣ Attempting to list available models...');
        
        // Try different model names that might work
        const modelsToTest = [
            'gemini-pro',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-2.0-flash-exp',
            'models/gemini-pro',
            'models/gemini-1.5-pro',
            'models/gemini-1.5-flash'
        ];
        
        for (const modelName of modelsToTest) {
            try {
                console.log(`\n2️⃣ Testing model: ${modelName}`);
                
                const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 50,
                    }
                });
                
                const result = await model.generateContent({
                    contents: [{
                        parts: [{ text: "Hello" }]
                    }]
                });
                
                const response = await result.response;
                const text = response.text();
                
                console.log(`✅ ${modelName} - WORKS! Response: ${text.substring(0, 50)}...`);
                
            } catch (error) {
                console.log(`❌ ${modelName} - FAILED: ${error.message.substring(0, 100)}...`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking models:', error.message);
    }
}

checkAvailableModels();