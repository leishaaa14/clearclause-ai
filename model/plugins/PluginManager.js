// Plugin Manager
// Manages model plugins and handles runtime swapping

import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'plugin-manager.log' })
    ]
});

export class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.activePlugin = null;
        this.defaultPlugin = null;
        this.pluginHistory = [];
    }

    /**
     * Register a plugin
     * @param {string} name - Plugin name
     * @param {ModelPlugin} plugin - Plugin instance
     * @returns {Promise<boolean>} - Success status
     */
    async registerPlugin(name, plugin) {
        try {
            // Validate plugin interface
            if (!this.validatePluginInterface(plugin)) {
                throw new Error(`Plugin ${name} does not implement required interface`);
            }

            // Initialize plugin
            await plugin.initialize();

            // Register plugin
            this.plugins.set(name, plugin);

            // Set as default if first plugin
            if (!this.defaultPlugin) {
                this.defaultPlugin = name;
                this.activePlugin = name;
            }

            logger.info('Plugin registered successfully', {
                name: name,
                capabilities: plugin.getCapabilities(),
                metadata: plugin.getMetadata()
            });

            return true;
        } catch (error) {
            logger.error('Failed to register plugin', {
                name: name,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Unregister a plugin
     * @param {string} name - Plugin name
     * @returns {Promise<boolean>} - Success status
     */
    async unregisterPlugin(name) {
        try {
            const plugin = this.plugins.get(name);
            if (!plugin) {
                throw new Error(`Plugin ${name} not found`);
            }

            // Cleanup plugin
            await plugin.cleanup();

            // Remove from registry
            this.plugins.delete(name);

            // Switch to default if this was active
            if (this.activePlugin === name) {
                await this.switchToDefault();
            }

            // Update default if this was default
            if (this.defaultPlugin === name) {
                this.defaultPlugin = this.plugins.size > 0 ? this.plugins.keys().next().value : null;
            }

            logger.info('Plugin unregistered successfully', { name: name });
            return true;
        } catch (error) {
            logger.error('Failed to unregister plugin', {
                name: name,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Switch to a different plugin
     * @param {string} name - Plugin name to switch to
     * @returns {Promise<boolean>} - Success status
     */
    async switchPlugin(name) {
        try {
            const plugin = this.plugins.get(name);
            if (!plugin) {
                throw new Error(`Plugin ${name} not found`);
            }

            // Record switch in history
            if (this.activePlugin) {
                this.pluginHistory.push({
                    from: this.activePlugin,
                    to: name,
                    timestamp: new Date().toISOString()
                });
            }

            // Switch active plugin
            const previousPlugin = this.activePlugin;
            this.activePlugin = name;

            logger.info('Plugin switched successfully', {
                from: previousPlugin,
                to: name,
                capabilities: plugin.getCapabilities()
            });

            return true;
        } catch (error) {
            logger.error('Failed to switch plugin', {
                name: name,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Switch to default plugin
     * @returns {Promise<boolean>} - Success status
     */
    async switchToDefault() {
        if (!this.defaultPlugin) {
            logger.warn('No default plugin available');
            return false;
        }

        return await this.switchPlugin(this.defaultPlugin);
    }

    /**
     * Get active plugin
     * @returns {ModelPlugin|null} - Active plugin instance
     */
    getActivePlugin() {
        if (!this.activePlugin) {
            return null;
        }
        return this.plugins.get(this.activePlugin);
    }

    /**
     * Get plugin by name
     * @param {string} name - Plugin name
     * @returns {ModelPlugin|null} - Plugin instance
     */
    getPlugin(name) {
        return this.plugins.get(name) || null;
    }

    /**
     * List all registered plugins
     * @returns {Array} - List of plugin metadata
     */
    listPlugins() {
        const pluginList = [];
        for (const [name, plugin] of this.plugins) {
            pluginList.push({
                name: name,
                isActive: name === this.activePlugin,
                isDefault: name === this.defaultPlugin,
                ...plugin.getMetadata()
            });
        }
        return pluginList;
    }

    /**
     * Find plugins by capability
     * @param {string} capability - Required capability
     * @returns {Array} - List of compatible plugins
     */
    findPluginsByCapability(capability) {
        const compatiblePlugins = [];
        for (const [name, plugin] of this.plugins) {
            if (plugin.supportsCapability(capability)) {
                compatiblePlugins.push({
                    name: name,
                    isActive: name === this.activePlugin,
                    ...plugin.getMetadata()
                });
            }
        }
        return compatiblePlugins;
    }

    /**
     * Process contract using active plugin
     * @param {string} text - Contract text
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} - Analysis results
     */
    async processContract(text, options = {}) {
        const activePlugin = this.getActivePlugin();
        if (!activePlugin) {
            throw new Error('No active plugin available');
        }

        try {
            const result = await activePlugin.processContract(text, options);

            // Add plugin metadata to result
            result.metadata = {
                ...result.metadata,
                pluginUsed: this.activePlugin,
                pluginVersion: activePlugin.version
            };

            return result;
        } catch (error) {
            logger.error('Plugin processing failed', {
                plugin: this.activePlugin,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get plugin switch history
     * @returns {Array} - Plugin switch history
     */
    getPluginHistory() {
        return [...this.pluginHistory];
    }

    /**
     * Validate plugin interface
     * @param {Object} plugin - Plugin to validate
     * @returns {boolean} - Validation result
     * @private
     */
    validatePluginInterface(plugin) {
        const requiredMethods = [
            'initialize',
            'processContract',
            'extractClauses',
            'analyzeRisks',
            'getCapabilities',
            'getMetadata',
            'cleanup'
        ];

        return requiredMethods.every(method =>
            typeof plugin[method] === 'function'
        );
    }

    /**
     * Get manager status
     * @returns {Object} - Manager status
     */
    getStatus() {
        return {
            totalPlugins: this.plugins.size,
            activePlugin: this.activePlugin,
            defaultPlugin: this.defaultPlugin,
            pluginSwitches: this.pluginHistory.length,
            availablePlugins: Array.from(this.plugins.keys())
        };
    }

    /**
     * Cleanup all plugins
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            for (const [name, plugin] of this.plugins) {
                await plugin.cleanup();
            }

            this.plugins.clear();
            this.activePlugin = null;
            this.defaultPlugin = null;
            this.pluginHistory = [];

            logger.info('Plugin manager cleanup completed');
        } catch (error) {
            logger.error('Plugin manager cleanup failed', { error: error.message });
        }
    }
}

export default PluginManager;