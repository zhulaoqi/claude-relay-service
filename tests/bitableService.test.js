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
    adminEmail: 'admin@example.com',
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
    mockAxios.patch = jest.fn()

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
    it('derives name from email, creates key, notifies applicant + admin, writes back to bitable', async () => {
      const keyResult = {
        id: 'key-uuid-123',
        name: 'abel.wang',
        apiKey: 'cr_abc123',
        permissions: [],
        concurrencyLimit: '5',
        dailyCostLimit: '10',
        expiresAt: '2026-04-16T00:00:00.000Z'
      }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)

      // First token check → cache miss, then cache populated
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('token_abc')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'token_abc' } }) // token fetch
        .mockResolvedValueOnce({ data: { code: 0 } }) // applicant message
        .mockResolvedValueOnce({ data: { code: 0 } }) // admin message
      mockAxios.patch.mockResolvedValueOnce({ data: { code: 0 } }) // bitable write-back

      mockRedisClient.setEx.mockResolvedValue('OK')

      const row = {
        product: 'Claude Code',
        recipientEmail: 'abel.wang@eclicktech.com.cn',
        description: 'Test key',
        appToken: 'apptoken123',
        tableId: 'tbl123',
        recordId: 'rec123'
      }

      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-uuid-123')

      // Name should be derived from email
      expect(mockApiKeyService.generateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'abel.wang' })
      )

      // token fetch + 2 messages (applicant + admin)
      expect(mockAxios.post).toHaveBeenCalledTimes(3)

      // Bitable write-back via PATCH
      expect(mockAxios.patch).toHaveBeenCalledTimes(1)
      expect(mockAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/bitable/v1/apps/apptoken123/tables/tbl123/records/rec123'),
        expect.objectContaining({ fields: { 开通情况: true, 开通账号信息: 'cr_abc123' } }),
        expect.any(Object)
      )
    })
  })

  describe('createApiKeyFromBitableRow - product filter', () => {
    it('returns skipped:true for non-Claude-Code product without creating a key', async () => {
      const row = {
        product: 'Cursor',
        recipientEmail: 'user@example.com'
      }

      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(false)
      expect(result.skipped).toBe(true)
      expect(result.reason).toMatch(/Cursor/)
      expect(mockApiKeyService.generateApiKey).not.toHaveBeenCalled()
      expect(mockAxios.post).not.toHaveBeenCalled()
    })

    it('processes row when product field is absent (no filter applied)', async () => {
      const keyResult = { id: 'k1', name: 'user', apiKey: 'cr_x', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockResolvedValue({ data: { code: 0 } })
      mockRedisClient.setEx.mockResolvedValue('OK')

      const row = { recipientEmail: 'user@example.com' }
      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(mockApiKeyService.generateApiKey).toHaveBeenCalledTimes(1)
    })
  })

  describe('createApiKeyFromBitableRow - failure case', () => {
    it('sends failure notification and returns { success: false } when key creation fails', async () => {
      const creationError = new Error('Redis write failed')
      mockApiKeyService.generateApiKey.mockRejectedValue(creationError)

      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('token_abc')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'token_abc' } })
        .mockResolvedValue({ data: { code: 0 } })

      mockRedisClient.setEx.mockResolvedValue('OK')

      const row = {
        product: 'Claude Code',
        recipientEmail: 'user@example.com'
      }

      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Redis write failed')
      // Notification still attempted (applicant + admin)
      expect(mockAxios.post).toHaveBeenCalledTimes(3)
      // No write-back on failure
      expect(mockAxios.patch).not.toHaveBeenCalled()
    })
  })

  describe('getFeishuToken - cache hit', () => {
    it('returns cached token without making HTTP request', async () => {
      mockRedisClient.get.mockResolvedValue('cached_token_xyz')

      const keyResult = { id: 'k1', name: 'user', apiKey: 'cr_x', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)
      // Only message sends, no token fetch
      mockAxios.post.mockResolvedValue({ data: { code: 0 } })

      const row = { recipientEmail: 'x@x.com' }
      await service.createApiKeyFromBitableRow(row)

      // All post calls should be to /im/ (messages), not token endpoint
      for (const call of mockAxios.post.mock.calls) {
        expect(call[0]).toContain('/im/v1/messages')
      }
    })
  })

  describe('notification failure does not affect return value', () => {
    it('returns { success: true, keyId } even when message send fails', async () => {
      const keyResult = { id: 'key-456', name: 'user', apiKey: 'cr_y', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)

      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockRejectedValue(new Error('Network timeout'))

      mockRedisClient.setEx.mockResolvedValue('OK')

      const row = { recipientEmail: 'user@example.com' }
      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-456')

      const logger = require('../src/utils/logger')
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('missing recipientEmail', () => {
    it('admin still notified, no applicant notification', async () => {
      mockBitableConfigService.getConfig.mockResolvedValue({
        ...defaultConfig,
        defaultRecipientEmail: '',
        adminEmail: 'admin@example.com'
      })

      const keyResult = { id: 'key-789', name: 'unknown', apiKey: 'cr_z', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockResolvedValueOnce({ data: { code: 0 } }) // admin notification

      mockRedisClient.setEx.mockResolvedValue('OK')

      const row = {} // no recipientEmail
      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-789')
      // Token + 1 admin message only
      expect(mockAxios.post).toHaveBeenCalledTimes(2)
      const msgCall = mockAxios.post.mock.calls[1]
      expect(msgCall[1].receive_id).toBe('admin@example.com')
    })
  })
})
