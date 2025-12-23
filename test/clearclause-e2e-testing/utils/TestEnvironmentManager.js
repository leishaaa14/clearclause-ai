/**
 * Test Environment Configuration Manager
 * 
 * Manages test environment configuration, validation, and setup
 * for different deployment environments (CI, staging, production).
 */

import fs from 'fs/promises';
import path from 'path';
import { TEST_CONFIG, AWS_CONFIG } from '../config/test-config.js';

export class TestEnvironmentManager {
    constructor() {
        this.currentEnvironment = null;
        this.environmentConfigs = {
            ci: {
                name: 'Continuous Integration',
                timeout: 300000, // 5 minutes
                retryAttempts: 2,
                parallelExecution: false,
                verboseLogging: false,
                useRealServices: false,
                maxConcurrentTests: 1,
                resourceLimits: {
                    memory: '512MB',
                    cpu: '1 core'
                }
            },
            staging: {
                name: 'Staging Environment',
                timeout: 600000, // 10 minutes
                retryAttempts: 3,
                parallelExecution: true,
                verboseLogging: true,
                useRealServices: true,
                maxConcurrentTests: 3,
                resourceLimits: {
                    memory: '1GB',
                    cpu: '2 cores'
                }
            },
            production: {
                name: 'Production Environment',
                timeout: 900000, // 15 minutes
                retryAttempts: 1,
                parallelExecution: false,
                verboseLogging: false,
                useRealServices: true,
                maxConcurrentTests: 1,
                resourceLimits: {
                    memory: '2GB',
                    cpu: '4 cores'
                }
            }
        };
    }

    /**
     * Configure environment settings
     */
    async configureEnvironment(environment) {
        console.log(`🔧 Configuring test environment: ${environment}`);

        if (!this.environmentConfigs[environment]) {
            throw new Error(`Unknown environment: ${environment}`);
        }

        const config = this.environmentConfigs[environment];
        this.currentEnvironment = environment;

        // Apply configuration to TEST_CONFIG
        Object.assign(TEST_CONFIG, {
            timeout: config.timeout,
            retryAttempts: config.retryAttempts,
            parallelExecution: config.parallelExecution,
            verboseLogging: config.verboseLogging
        });

        // Validate environment prerequisites
        await this.validateEnvironmentPrerequisites(environment);

        // Save environment configuration
        await this.saveEnvironmentConfiguration(environment, config);

        console.log(`✅ Environment configured: ${config.name}`);
        console.log(`📊 Settings: ${JSON.stringify(config, null, 2)}`);

        return config;
    }

    /**
     * Validate environment prerequisites
     */
    async validateEnvironmentPrerequisites(environment) {
        console.log(`🔍 Validating prerequisites for ${environment} environment...`);

        const validations = [];

        // Check Node.js version
        const nodeVersion = process.version;
        validations.push({
            check: 'Node.js Version',
            status: this.validateNodeVersion(nodeVersion),
            value: nodeVersion
        });

        // Check available memory
        const memoryUsage = process.memoryUsage();
        validations.push({
            check: 'Memory Usage',
            status: memoryUsage.heapUsed < 500 * 1024 * 1024, // Less than 500MB
            value: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
        });

        // Check environment variables
        const requiredEnvVars = this.getRequiredEnvironmentVariables(environment);
        for (const envVar of requiredEnvVars) {
            validations.push({
                check: `Environment Variable: ${envVar}`,
                status: !!process.env[envVar],
                value: process.env[envVar] ? '✓ Set' : '✗ Missing'
            });
        }

        // Check file system permissions
        try {
            const testDir = path.join('test-artifacts', 'permission-test');
            await fs.mkdir(testDir, { recursive: true });
            await fs.writeFile(path.join(testDir, 'test.txt'), 'test');
            await fs.rm(testDir, { recursive: true });
            validations.push({
                check: 'File System Permissions',
                status: true,
                value: '✓ Read/Write'
            });
        } catch (error) {
            validations.push({
                check: 'File System Permissions',
                status: false,
                value: `✗ ${error.message}`
            });
        }

        // Report validation results
        const failedValidations = validations.filter(v => !v.status);
        if (failedValidations.length > 0) {
            console.error('❌ Environment validation failed:');
            failedValidations.forEach(v => {
                console.error(`  - ${v.check}: ${v.value}`);
            });
            throw new Error(`Environment validation failed for ${environment}`);
        }

        console.log('✅ All environment prerequisites validated');
        return validations;
    }

    /**
     * Validate Node.js version
     */
    validateNodeVersion(version) {
        const major = parseInt(version.slice(1).split('.')[0]);
        return major >= 18; // Require Node.js 18+
    }

    /**
     * Get required environment variables for environment
     */
    getRequiredEnvironmentVariables(environment) {
        const baseVars = [];

        if (this.environmentConfigs[environment].useRealServices) {
            baseVars.push(
                'VITE_AWS_ACCESS_KEY_ID',
                'VITE_AWS_SECRET_ACCESS_KEY',
                'VITE_AWS_REGION',
                'VITE_S3_BUCKET'
            );
        }

        return baseVars;
    }

    /**
     * Save environment configuration
     */
    async saveEnvironmentConfiguration(environment, config) {
        const configData = {
            environment,
            config,
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform
        };

        const configPath = path.join('test-artifacts', 'environment-config.json');
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(configData, null, 2));

        console.log(`💾 Environment configuration saved to: ${configPath}`);
        return configPath;
    }

    /**
     * Get current environment status
     */
    async getEnvironmentStatus() {
        if (!this.currentEnvironment) {
            return {
                configured: false,
                environment: null,
                status: 'Not configured'
            };
        }

        const config = this.environmentConfigs[this.currentEnvironment];
        const memoryUsage = process.memoryUsage();

        return {
            configured: true,
            environment: this.currentEnvironment,
            name: config.name,
            status: 'Active',
            configuration: config,
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                memory: {
                    used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                    limit: config.resourceLimits.memory
                },
                uptime: Math.round(process.uptime())
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Switch to different environment
     */
    async switchEnvironment(newEnvironment) {
        console.log(`🔄 Switching from ${this.currentEnvironment} to ${newEnvironment}`);

        if (this.currentEnvironment === newEnvironment) {
            console.log('⏭️  Already in target environment');
            return;
        }

        await this.configureEnvironment(newEnvironment);
        console.log(`✅ Successfully switched to ${newEnvironment} environment`);
    }

    /**
     * Reset environment to defaults
     */
    async resetEnvironment() {
        console.log('🔄 Resetting environment to defaults...');

        this.currentEnvironment = null;

        // Reset TEST_CONFIG to defaults
        Object.assign(TEST_CONFIG, {
            timeout: 30000,
            retryAttempts: 3,
            parallelExecution: false,
            verboseLogging: false
        });

        console.log('✅ Environment reset to defaults');
    }

    /**
     * Validate environment configuration
     */
    validateConfiguration(environment, config) {
        const requiredFields = ['timeout', 'retryAttempts', 'useRealServices'];
        const missingFields = requiredFields.filter(field => config[field] === undefined);

        if (missingFields.length > 0) {
            throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
        }

        if (config.timeout < 10000) {
            throw new Error('Timeout must be at least 10 seconds');
        }

        if (config.retryAttempts < 0 || config.retryAttempts > 10) {
            throw new Error('Retry attempts must be between 0 and 10');
        }

        return true;
    }

    /**
     * Get available environments
     */
    getAvailableEnvironments() {
        return Object.keys(this.environmentConfigs).map(env => ({
            name: env,
            displayName: this.environmentConfigs[env].name,
            config: this.environmentConfigs[env]
        }));
    }

    /**
     * Create custom environment configuration
     */
    async createCustomEnvironment(name, config) {
        console.log(`🔧 Creating custom environment: ${name}`);

        // Validate configuration
        this.validateConfiguration(name, config);

        // Add to available environments
        this.environmentConfigs[name] = {
            name: config.displayName || name,
            ...config
        };

        // Save custom environment
        const customEnvPath = path.join('test-artifacts', `custom-env-${name}.json`);
        await fs.mkdir(path.dirname(customEnvPath), { recursive: true });
        await fs.writeFile(customEnvPath, JSON.stringify(this.environmentConfigs[name], null, 2));

        console.log(`✅ Custom environment '${name}' created and saved`);
        return this.environmentConfigs[name];
    }

    /**
     * Load custom environment configurations
     */
    async loadCustomEnvironments() {
        console.log('📂 Loading custom environment configurations...');

        try {
            const artifactsDir = 'test-artifacts';
            const files = await fs.readdir(artifactsDir);
            const customEnvFiles = files.filter(file => file.startsWith('custom-env-') && file.endsWith('.json'));

            for (const file of customEnvFiles) {
                const envName = file.replace('custom-env-', '').replace('.json', '');
                const filePath = path.join(artifactsDir, file);
                const configData = JSON.parse(await fs.readFile(filePath, 'utf8'));

                this.environmentConfigs[envName] = configData;
                console.log(`📋 Loaded custom environment: ${envName}`);
            }

            console.log(`✅ Loaded ${customEnvFiles.length} custom environments`);

        } catch (error) {
            console.warn('⚠️  Failed to load custom environments:', error.message);
        }
    }

    /**
     * Export environment configuration
     */
    async exportConfiguration(environment, exportPath) {
        if (!this.environmentConfigs[environment]) {
            throw new Error(`Environment '${environment}' not found`);
        }

        const config = this.environmentConfigs[environment];
        const exportData = {
            environment,
            config,
            exportedAt: new Date().toISOString(),
            exportedBy: 'TestEnvironmentManager'
        };

        await fs.mkdir(path.dirname(exportPath), { recursive: true });
        await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

        console.log(`📦 Environment configuration exported to: ${exportPath}`);
        return exportPath;
    }
}

export default TestEnvironmentManager;