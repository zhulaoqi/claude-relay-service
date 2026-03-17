jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
  security: jest.fn(),
  debug: jest.fn()
}))

jest.mock('../src/models/redis', () => ({ getClient: jest.fn() }))

jest.mock('../src/utils/commonHelper', () => ({
  createEncryptor: jest.fn(() => ({
    encrypt: jest.fn((v) => `enc:${v}`),
    decrypt: jest.fn((v) => v.replace('enc:', ''))
  }))
}))

describe('bitableConfigService', () => {
  let service
  let mockRedisClient
  let mockEncrypt
  let mockDecrypt

  beforeEach(() => {
    jest.resetModules()

    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn()
    }

    const redis = require('../src/models/redis')
    redis.getClient.mockReturnValue(mockRedisClient)

    const { createEncryptor } = require('../src/utils/commonHelper')
    const encryptor = createEncryptor('bitable-app-secret')
    mockEncrypt = encryptor.encrypt
    mockDecrypt = encryptor.decrypt

    service = require('../src/services/bitableConfigService')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getConfig', () => {
    it('returns defaults when Redis is empty', async () => {
      mockRedisClient.get.mockResolvedValue(null)

      const config = await service.getConfig()

      expect(config.enabled).toBe(false)
      expect(config.webhookSecret).toBe('')
      expect(config.feishuAppId).toBe('')
      expect(config.feishuAppSecret).toBe('')
      expect(config.notifyOnSuccess).toBe(true)
      expect(config.notifyOnFailure).toBe(true)
      expect(config.defaultRecipientEmail).toBe('')
      expect(config.defaultPermissions).toEqual([])
      expect(config.defaultConcurrencyLimit).toBe(0)
      expect(config.defaultDailyCostLimit).toBe(0)
      expect(config.defaultExpirationDays).toBe(0)
      expect(config.updatedAt).toBeNull()
    })

    it('decrypts feishuAppSecret when reading from Redis', async () => {
      const stored = {
        enabled: true,
        feishuAppId: 'cli_abc123',
        feishuAppSecret: 'enc:mysecret'
      }
      mockRedisClient.get.mockResolvedValue(JSON.stringify(stored))

      const config = await service.getConfig()

      expect(config.feishuAppSecret).toBe('mysecret')
      expect(config.feishuAppId).toBe('cli_abc123')
      expect(config.enabled).toBe(true)
    })

    it('decrypts webhookSecret when reading from Redis', async () => {
      const stored = {
        enabled: true,
        webhookSecret: 'enc:mywebhooksecret'
      }
      mockRedisClient.get.mockResolvedValue(JSON.stringify(stored))

      const config = await service.getConfig()

      expect(config.webhookSecret).toBe('mywebhooksecret')
    })

    it('returns defaults when Redis throws error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'))

      const config = await service.getConfig()

      expect(config.enabled).toBe(false)
      expect(config.feishuAppSecret).toBe('')

      const logger = require('../src/utils/logger')
      expect(logger.error).toHaveBeenCalledWith(
        'bitableConfigService getConfig error',
        expect.any(Error)
      )
    })
  })

  describe('saveConfig', () => {
    it('encrypts feishuAppSecret before storing in Redis', async () => {
      mockRedisClient.get.mockResolvedValue(null)
      mockRedisClient.set.mockResolvedValue('OK')

      const updates = {
        feishuAppId: 'cli_test',
        feishuAppSecret: 'mysecret'
      }

      const result = await service.saveConfig(updates)

      expect(mockRedisClient.set).toHaveBeenCalledTimes(1)
      const storedJson = mockRedisClient.set.mock.calls[0][1]
      const stored = JSON.parse(storedJson)
      expect(stored.feishuAppSecret).toBe('enc:mysecret')

      expect(result.feishuAppSecret).toBe('mysecret')
      expect(result.feishuAppId).toBe('cli_test')
    })

    it('encrypts webhookSecret before storing in Redis', async () => {
      mockRedisClient.get.mockResolvedValue(null)
      mockRedisClient.set.mockResolvedValue('OK')

      const updates = { webhookSecret: 'mywebhooksecret' }

      const result = await service.saveConfig(updates)

      expect(mockRedisClient.set).toHaveBeenCalledTimes(1)
      const storedJson = mockRedisClient.set.mock.calls[0][1]
      const stored = JSON.parse(storedJson)
      expect(stored.webhookSecret).toBe('enc:mywebhooksecret')

      expect(result.webhookSecret).toBe('mywebhooksecret')
    })

    it('does not encrypt empty feishuAppSecret', async () => {
      mockRedisClient.get.mockResolvedValue(null)
      mockRedisClient.set.mockResolvedValue('OK')

      const updates = { feishuAppId: 'cli_test', feishuAppSecret: '' }

      const result = await service.saveConfig(updates)

      const storedJson = mockRedisClient.set.mock.calls[0][1]
      const stored = JSON.parse(storedJson)
      expect(stored.feishuAppSecret).toBe('')
      expect(result.feishuAppSecret).toBe('')
    })

    it('throws and logs error when Redis set fails', async () => {
      mockRedisClient.get.mockResolvedValue(null)
      mockRedisClient.set.mockRejectedValue(new Error('Redis write error'))

      await expect(service.saveConfig({ feishuAppId: 'x' })).rejects.toThrow('Redis write error')

      const logger = require('../src/utils/logger')
      expect(logger.error).toHaveBeenCalledWith(
        'bitableConfigService saveConfig error',
        expect.any(Error)
      )
    })
  })
})
