/**
 * DeepSeek R1 Setup Helper
 * This script will help you set up DeepSeek R1 with inference profiles
 */

import { BedrockClient, ListFoundationModelsCommand, GetModelInvocationLoggingConfigurationCommand } from '@aws-sdk/client-bedrock';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const AWS_CONFIG = {
    region: process.env.VITE_AWS_REGION,
    credentials: {
        accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY
    }
};

console.log('\n🔧 DeepSeek R1 Setup Helper\n');
console.log('='.repeat(60));

async function checkAvailableModels() {
    try {
        console.log('\n📋 Checking available models in your region...');
        
        const bedrockClient = new BedrockClient(AWS_CONFIG);
        const command = new ListFoundationModelsCommand({});
        const response = await bedrockClient.send(command);
        
        console.log(`\n✅ Found ${response.modelSummaries.length} available models`);
        
        // Look for DeepSeek models
        const deepseekModels = response.modelSummaries.filter(model => 
            model.modelId.toLowerCase().includes('deepseek')
        );
        
        if (deepseekModels.length > 0) {
            console.log('\n🎯 DeepSeek models found:');
            deepseekModels.forEach(model => {
                console.log(`   • ${model.modelId}`);
                console.log(`     Name: ${model.modelName}`);
                console.log(`     Provider: ${model.providerName}`);
                console.log(`     Input Modalities: ${model.inputModalities?.join(', ')}`);
                console.log(`     Output Modalities: ${model.outputModalities?.join(', ')}`);
                console.log(`     Inference Types: ${model.inferenceTypesSupported?.join(', ')}`);
                console.log('');
            });
            
            return deepseekModels;
        } else {
            console.log('\n❌ No DeepSeek models found in your region');
            console.log('   This could mean:');
            console.log('   1. DeepSeek is not available in us-east-1');
            console.log('   2. You need to request access first');
            console.log('   3. The model ID might be different');
            
            return [];
        }
        
    } catch (error) {
        console.log(`❌ Error checking models: ${error.message}`);
        return [];
    }
}

async function tryAlternativeDeepSeekIds() {
    console.log('\n🔍 Trying alternative DeepSeek model IDs...');
    
    const possibleIds = [
        'deepseek.r1-v1:0',
        'deepseek.deepseek-r1-v1:0',
        'deepseek-ai.deepseek-r1-v1:0',
        'deepseek.r1:0',
        'deepseek-r1-v1:0'
    ];
    
    const bedrockClient = new BedrockRuntimeClient(AWS_CONFIG);
    
    for (const modelId of possibleIds) {
        try {
            console.log(`\n   Testing: ${modelId}`);
            
            const params = {
                modelId: modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello'
                        }
                    ],
                    max_tokens: 10
                })
            };
            
            const command = new InvokeModelCommand(params);
            const result = await bedrockClient.send(command);
            
            console.log(`   ✅ SUCCESS: ${modelId} works!`);
            return modelId;
            
        } catch (error) {
            if (error.message.includes('inference profile')) {
                console.log(`   ⚠️  ${modelId}: Needs inference profile (this is our target!)`);
            } else if (error.message.includes('ValidationException')) {
                console.log(`   ❌ ${modelId}: Invalid model ID`);
            } else if (error.message.includes('AccessDeniedException')) {
                console.log(`   🔒 ${modelId}: Access denied - need to request access`);
            } else {
                console.log(`   ❌ ${modelId}: ${error.message.substring(0, 100)}...`);
            }
        }
    }
    
    return null;
}

async function checkInferenceProfiles() {
    try {
        console.log('\n🔍 Checking for existing inference profiles...');
        
        // Note: There's no direct API to list inference profiles in the current SDK
        // We'll need to guide the user to check the console
        
        console.log('   💡 To check inference profiles:');
        console.log('   1. Go to AWS Bedrock Console');
        console.log('   2. Navigate to "Inference profiles"');
        console.log('   3. Look for any existing DeepSeek profiles');
        console.log('   4. If none exist, you\'ll need to create one');
        
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }
}

async function provideSetupInstructions() {
    console.log('\n📋 DeepSeek R1 Setup Instructions:');
    console.log('='.repeat(50));
    
    console.log('\n🔧 STEP 1: Request Model Access');
    console.log('   1. Go to AWS Bedrock Console');
    console.log('   2. Click "Model access" in the left sidebar');
    console.log('   3. Find "DeepSeek R1" in the list');
    console.log('   4. Click "Request model access"');
    console.log('   5. Fill out the form and submit');
    console.log('   6. Wait for approval (can take 1-3 business days)');
    
    console.log('\n💰 STEP 2: Set Up Provisioned Throughput');
    console.log('   1. Go to "Provisioned throughput" in Bedrock Console');
    console.log('   2. Click "Create provisioned throughput"');
    console.log('   3. Select DeepSeek R1 model');
    console.log('   4. Choose capacity (minimum units required)');
    console.log('   5. Set commitment term (1 month minimum)');
    console.log('   6. Review costs (typically $2,000+ per month)');
    console.log('   7. Create and wait for provisioning');
    
    console.log('\n🎯 STEP 3: Create Inference Profile');
    console.log('   1. Go to "Inference profiles" in Bedrock Console');
    console.log('   2. Click "Create inference profile"');
    console.log('   3. Select your provisioned DeepSeek capacity');
    console.log('   4. Configure profile settings');
    console.log('   5. Note the profile ARN for your code');
    
    console.log('\n💻 STEP 4: Update Your Code');
    console.log('   Replace in your .env file:');
    console.log('   VITE_BEDROCK_MODEL=arn:aws:bedrock:us-east-1:YOUR-ACCOUNT:inference-profile/YOUR-PROFILE-ID');
    
    console.log('\n⚠️  IMPORTANT CONSIDERATIONS:');
    console.log('   💰 Cost: $2,000-10,000+ per month minimum');
    console.log('   ⏱️  Setup time: 1-7 days');
    console.log('   🔒 Enterprise-level complexity');
    console.log('   📋 Requires business justification');
}

async function runSetupHelper() {
    console.log('Starting DeepSeek R1 Setup Analysis...\n');
    
    // Check what models are available
    const availableModels = await checkAvailableModels();
    
    // Try alternative model IDs
    const workingId = await tryAlternativeDeepSeekIds();
    
    // Check inference profiles
    await checkInferenceProfiles();
    
    // Provide setup instructions
    await provideSetupInstructions();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY:');
    
    if (workingId) {
        console.log(`✅ Found working model ID: ${workingId}`);
    } else {
        console.log('❌ No working DeepSeek model IDs found');
    }
    
    if (availableModels.length > 0) {
        console.log(`✅ DeepSeek models are available in your region`);
    } else {
        console.log('❌ DeepSeek models not found in your region');
        console.log('   💡 Try switching to us-west-2 region');
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Follow the setup instructions above');
    console.log('2. Budget for $2,000+ monthly costs');
    console.log('3. Wait for AWS approval and provisioning');
    console.log('4. Update your code with the inference profile ARN');
    
    console.log('\n💡 ALTERNATIVE:');
    console.log('Continue using Titan (working perfectly) while setting up DeepSeek');
    
    console.log('\n' + '='.repeat(60) + '\n');
}

runSetupHelper().catch(console.error);