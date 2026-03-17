jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
  security: jest.fn(),
  debug: jest.fn()
}))

jest.mock('../src/models/redis', () => ({ getClient: jest.fn() }))
jest.mock('../src/services/apiKeyService', () => ({
  generateApiKey: jest.fn()
}))

jest.mock('../src/services/bitableConfigService', () => ({
  getConfig: jest.fn(),
  saveConfig: jest.fn()
}))
jest.mock('axios')

describe('bitableService', () => {
  let service
  let mockRedisClient
  let mockAxios
  let mockApiKeyService
  let mockBitableConfigService

  const defaultConfig = {
    feishuAppId: 'cli_test123',
    feishuAppSecret: 'test_secret',
    defaultRecipientEmail: 'default@example.com',
    defaultPermissions: [],
    defaultConcurrencyLimit: 5,
    defaultDailyCostLimit: 10,
    defaultExpirationDays: 30,
    notifyOnSuccess: true,
    notifyOnFailure: true
  }

  beforeEach(() => {
    jest.resetModules()

    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn()
    }

    const redis = require('../src/models/redis')
    redis.getClient.mockReturnValue(mockRedisClient)

    mockAxios = require('axios')
    mockAxios.post = jest.fn()

    mockApiKeyService = require('../src/services/apiKeyService')
    mockApiKeyService.generateApiKey = jest.fn()

    mockBitableConfigService = require('../src/services/bitableConfigService')
    mockBitableConfigService.getConfig = jest.fn().mockResolvedValue(defaultConfig)

    service = require('../src/services/bitableService')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createApiKeyFromBitableRow - success case', () => {
    it('creates key, sends success notification, returns { success: true, keyId }', async () => {
      const keyResult = {
        id: 'key-uuid-123',
        name: 'Test Key',
        apiKey: 'cr_abc123',
        permissions: [],
        concurrencyLimit: '5',
        dailyCostLimit: '10',
        expiresAt: '2026-04-16T00:00:00.000Z'
      }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)

      // Token not cached → fetch from Feishu
      mockRedisClient.get.mockResolvedValue(null)
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'token_abc' } }) // token endpoint
        .mockResolvedValueOnce({ data: { code: 0 } }) // message endpoint

      mockRedisClient.setEx.mockResolvedValue('OK')

      const row = {
        name: 'Test Key',
        description: 'A test key',
        recipientEmail: 'user@example.com'
      }

      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-uuid-123')
      expect(mockApiKeyService.generateApiKey).toHaveBeenCalledTimes(1)
      // Should have called axios.post twice: token + message
      expect(mockAxios.post).toHaveBeenCalledTimes(2)
    })
  })

  describe('createApiKeyFromBitableRow - failure case', () => {
    it('sends failure notification and returns { success: false, error } when key creation fails', async () => {
      const creationError = new Error('Redis write failed')
      mockApiKeyService.generateApiKey.mockRejectedValue(creationError)

      mockRedisClient.get.mockResolvedValue(null)
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'token_abc' } })
        .mockResolvedValueOnce({ data: { code: 0 } })

      mockRedisClient.setEx.mockResolvedValue('OK')

      const row = {
        name: 'Fail Key',
        recipientEmail: 'user@example.com'
      }

      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Redis write failed')
      // Should still have attempted notification
      expect(mockAxios.post).toHaveBeenCalledTimes(2)
    })
  })

  describe('getFeishuToken - cache hit', () => {
    it('returns cached token without making HTTP request', async () => {
      mockRedisClient.get.mockResolvedValue('cached_token_xyz')

      // We call createApiKeyFromBitableRow so the token path is exercised
      const keyResult = { id: 'k1', name: 'K', apiKey: 'cr_x', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)
      // Second axios.post is the message send (no token fetch)
      mockAxios.post.mockResolvedValueOnce({ data: { code: 0 } })

      const row = { name: 'K', recipientEmail: 'x@x.com' }
      await service.createApiKeyFromBitableRow(row)

      // axios.post should only be called once (message), NOT for token
      expect(mockAxios.post).toHaveBeenCalledTimes(1)
      const callUrl = mockAxios.post.mock.calls[0][0]
      expect(callUrl).toContain('/im/v1/messages')
    })
  })

  describe('notification failure does not affect return value', () => {
    it('returns { success: true, keyId } even when message send fails', async () => {
      const keyResult = { id: 'key-456', name: 'K', apiKey: 'cr_y', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)

      mockRedisClient.get.mockResolvedValue(null)
      // Token fetch succeeds
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        // Message send fails with network error
        .mockRejectedValueOnce(new Error('Network timeout'))

      mockRedisClient.setEx.mockResolvedValue('OK')

      const row = { name: 'K', recipientEmail: 'user@example.com' }
      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-456')

      const logger = require('../src/utils/logger')
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('missing recipientEmail', () => {
    it('skips notification and still returns correct result', async () => {
      // Override config to have no defaultRecipientEmail
      mockBitableConfigService.getConfig.mockResolvedValue({
        ...defaultConfig,
        defaultRecipientEmail: ''
      })

      const keyResult = { id: 'key-789', name: 'No Email Key', apiKey: 'cr_z', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)

      const row = { name: 'No Email Key' } // no recipientEmail

      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-789')
      // No HTTP calls should have been made
      expect(mockAxios.post).not.toHaveBeenCalled()

      const logger = require('../src/utils/logger')
      expect(logger.warn).toHaveBeenCalled()
    })
  })
})
