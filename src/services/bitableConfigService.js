const redis = require('../models/redis')
const logger = require('../utils/logger')
const { createEncryptor } = require('../utils/commonHelper')

const REDIS_KEY = 'bitable:config'
const SALT = 'bitable-app-secret'

const encryptor = createEncryptor(SALT)

const DEFAULT_CONFIG = {
  enabled: false,
  webhookSecret: '',
  feishuAppId: '',
  feishuAppSecret: '',
  notifyOnSuccess: true,
  notifyOnFailure: true,
  defaultRecipientEmail: '',
  defaultPermissions: [],
  defaultConcurrencyLimit: 0,
  defaultDailyCostLimit: 0,
  defaultExpirationDays: 0,
  updatedAt: null
}

const getConfig = async () => {
  try {
    const raw = await redis.getClient().get(REDIS_KEY)
    if (!raw) {
      return { ...DEFAULT_CONFIG }
    }
    const stored = JSON.parse(raw)
    if (stored.feishuAppSecret) {
      stored.feishuAppSecret = encryptor.decrypt(stored.feishuAppSecret)
    }
    if (stored.webhookSecret) {
      stored.webhookSecret = encryptor.decrypt(stored.webhookSecret)
    }
    return { ...DEFAULT_CONFIG, ...stored }
  } catch (err) {
    logger.error('bitableConfigService getConfig error', err)
    return { ...DEFAULT_CONFIG }
  }
}

const saveConfig = async (updates) => {
  try {
    const current = await getConfig()
    const merged = { ...current, ...updates, updatedAt: new Date().toISOString() }
    const plainSecret = merged.feishuAppSecret
    if (merged.feishuAppSecret) {
      merged.feishuAppSecret = encryptor.encrypt(merged.feishuAppSecret)
    }
    if (merged.webhookSecret) {
      merged.webhookSecret = encryptor.encrypt(merged.webhookSecret)
    }
    await redis.getClient().set(REDIS_KEY, JSON.stringify(merged))
    logger.success('bitableConfigService saveConfig saved')
    return {
      ...merged,
      feishuAppSecret: plainSecret,
      webhookSecret: updates.webhookSecret ?? current.webhookSecret ?? ''
    }
  } catch (err) {
    logger.error('bitableConfigService saveConfig error', err)
    throw err
  }
}

module.exports = { getConfig, saveConfig }
