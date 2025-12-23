/**
 * DeepSeek R1 Setup Guide - Step by Step
 */

import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import dotenv from 'dotenv';

dotenv.config();

const AWS_CONFIG = {
    region: process.env.VITE_AWS_REGION,
    credentials: {
        accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY
    }
};

console.log('\n🚀 DeepSeek R1 Setup Guide\n');
console.log('Current Region:', process.env.VITE_AWS_REGION);
console.log('='.repeat(60));

async function checkDeepSeekAvailability() {
    try {
        console.log('\n🔍 Step 1: Checking DeepSeek availability...');
        
        const bedrockClient = new BedrockClient(AWS_CONFIG);
        const command = new ListFoundationModelsCommand({});
        const response = await bedrockClient.send(command);
        
        // Look for DeepSeek models
        const deepseekModels = response.modelSummaries.filter(model => 
            model.modelId.toLowerCase().includes('deepseek') ||
            model.modelName?.toLowerCase().includes('deepseek')
        );
        
        console.log(`\n📊 Total models available: ${response.modelSummaries.length}`);
        
        if (deepseekModels.length > 0) {
            console.log(`✅ Found ${deepseekModels.length} DeepSeek model(s):`);
            deepseekModels.forEach(model => {
                console.log(`   • ${model.modelId}`);
                console.log(`     Provider: ${model.providerName}`);
                console.log(`     Inference Types: ${model.inferenceTypesSupported?.join(', ') || 'Not specified'}`);
            });
            return true;
        } else {
            console.log('❌ No DeepSeek models found in us-east-1');
            
            // Check some other models to see what's available
            console.log('\n📋 Available model providers:');
            const providers = [...new Set(response.modelSummaries.map(m => m.providerName))];
            providers.forEach(provider => {
                const count = response.modelSummaries.filter(m => m.providerName === provider).length;
                console.log(`   • ${provider}: ${count} models`);
            });
            
            return false;
        }
        
    } catch (error) {
        console.log(`❌ Error checking models: ${error.message}`);
        return false;
    }
}

function provideManualSetupSteps() {
    console.log('\n📋 MANUAL SETUP STEPS FOR DEEPSEEK R1:');
    console.log('='.repeat(50));
    
    console.log('\n🔧 STEP 1: AWS Console Setup');
    console.log('   1. Open AWS Bedrock Console: https://console.aws.amazon.com/bedrock/');
    console.log('   2. Make sure you\'re in the correct region (us-east-1)');
    console.log('   3. Click "Model access" in the left sidebar');
    
    console.log('\n🎯 STEP 2: Request DeepSeek Access');
    console.log('   1. Look for "DeepSeek" in the model list');
    console.log('   2. If not visible, try switching regions (us-west-2, eu-west-1)');
    console.log('   3. Click "Request model access" for DeepSeek R1');
    console.log('   4. Fill out the access request form');
    console.log('   5. Wait for approval (1-3 business days)');
    
    console.log('\n💰 STEP 3: Provisioned Throughput (Required for DeepSeek)');
    console.log('   1. Go to "Provisioned throughput" section');
    console.log('   2. Click "Create provisioned throughput"');
    console.log('   3. Select DeepSeek R1 model');
    console.log('   4. Choose minimum capacity units');
    console.log('   5. Select commitment term (1 month minimum)');
    console.log('   6. Review pricing (typically $2,000-5,000+ per month)');
    console.log('   7. Create and wait for provisioning (can take hours)');
    
    console.log('\n🎯 STEP 4: Create Inference Profile');
    console.log('   1. Go to "Inference profiles" section');
    console.log('   2. Click "Create inference profile"');
    console.log('   3. Select your provisioned DeepSeek throughput');
    console.log('   4. Configure profile name and settings');
    console.log('   5. Copy the generated profile ARN');
    
    console.log('\n💻 STEP 5: Update Your Application');
    console.log('   Replace your .env model with the profile ARN:');
    console.log('   VITE_BEDROCK_MODEL=arn:aws:bedrock:us-east-1:123456789012:inference-profile/your-profile-id');
}

function provideAlternatives() {
    console.log('\n🔄 ALTERNATIVES TO CONSIDER:');
    console.log('='.repeat(40));
    
    console.log('\n1. 🎯 Wait for Claude (Recommended)');
    console.log('   • Payment validation will complete soon');
    console.log('   • Premium analysis capabilities');
    console.log('   • Much lower cost than DeepSeek provisioning');
    
    console.log('\n2. ✅ Continue with Titan (Working Now)');
    console.log('   • Already providing excellent results');
    console.log('   • Professional-grade contract analysis');
    console.log('   • Cost-effective and reliable');
    
    console.log('\n3. 🔍 Try Other Models');
    console.log('   • Meta Llama models');
    console.log('   • Cohere Command models');
    console.log('   • AI21 Jurassic models');
    
    console.log('\n💡 COST COMPARISON:');
    console.log('   • Titan: ~$10-50/month for typical usage');
    console.log('   • Claude: ~$20-100/month for typical usage');
    console.log('   • DeepSeek R1: $2,000-10,000+/month minimum');
}

async function runSetupGuide() {
    console.log('Analyzing DeepSeek R1 setup requirements...\n');
    
    const deepseekAvailable = await checkDeepSeekAvailability();
    
    if (deepseekAvailable) {
        console.log('\n✅ DeepSeek models are available in your region!');
        console.log('   You can proceed with the manual setup steps below.');
    } else {
        console.log('\n❌ DeepSeek models not found in your current region.');
        console.log('   You may need to:');
        console.log('   1. Switch to a different AWS region');
        console.log('   2. Request special access from AWS');
        console.log('   3. Wait for DeepSeek to become available');
    }
    
    provideManualSetupSteps();
    provideAlternatives();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n🎯 MY RECOMMENDATION:');
    console.log('   Given the complexity and cost of DeepSeek R1 setup,');
    console.log('   I recommend continuing with Titan while waiting for Claude.');
    console.log('   Your current setup is working excellently!');
    
    console.log('\n💰 COST REALITY CHECK:');
    console.log('   DeepSeek R1 minimum cost: $2,000+ per month');
    console.log('   Your current Titan cost: ~$10-50 per month');
    console.log('   That\'s 40-200x more expensive!');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('   1. Continue using Titan for now (it\'s working great!)');
    console.log('   2. Wait for Claude payment validation');
    console.log('   3. Consider DeepSeek only for enterprise-scale usage');
    
    console.log('\n' + '='.repeat(60) + '\n');
}

runSetupGuide().catch(console.error);