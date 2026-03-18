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
      set: jest.fn()
    }

    const redis = require('../src/models/redis')
    redis.getClient.mockReturnValue(mockRedisClient)

    mockAxios = require('axios')
    mockAxios.post = jest.fn()
    mockAxios.put = jest.fn()

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
    it('creates key, notifies applicant + admin, writes back to bitable', async () => {
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
      mockAxios.put.mockResolvedValueOnce({ data: { code: 0 } }) // bitable write-back

      mockRedisClient.set.mockResolvedValue('OK')

      const row = {
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
      expect(mockAxios.put).toHaveBeenCalledTimes(1)
      expect(mockAxios.put).toHaveBeenCalledWith(
        expect.stringContaining('/bitable/v1/apps/apptoken123/tables/tbl123/records/rec123'),
        expect.objectContaining({ fields: { 开通情况: true, 开通账号信息: 'cr_abc123' } }),
        expect.any(Object)
      )
    })
  })

  describe('createApiKeyFromBitableRow - name derivation', () => {
    it('uses row.name as-is when it is a plain string (not email)', async () => {
      const keyResult = { id: 'k1', name: 'custom-name', apiKey: 'cr_x', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockResolvedValue({ data: { code: 0 } })
      mockRedisClient.set.mockResolvedValue('OK')

      const row = { name: 'custom-name', recipientEmail: 'user@example.com' }
      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(mockApiKeyService.generateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'custom-name' })
      )
    })

    it('parses username from email when name contains @', async () => {
      const keyResult = { id: 'k1', name: 'kinch.zhu', apiKey: 'cr_x', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockResolvedValue({ data: { code: 0 } })
      mockRedisClient.set.mockResolvedValue('OK')

      const row = { name: 'kinch.zhu@eclicktech.com.cn' }
      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(mockApiKeyService.generateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'kinch.zhu' })
      )
    })

    it('uses email from name as recipientEmail when recipientEmail is absent', async () => {
      const keyResult = { id: 'k1', name: 'kinch.zhu', apiKey: 'cr_x', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockResolvedValue({ data: { code: 0 } })
      mockRedisClient.set.mockResolvedValue('OK')

      const row = { name: 'kinch.zhu@eclicktech.com.cn' }
      await service.createApiKeyFromBitableRow(row)

      const msgRecipients = mockAxios.post.mock.calls
        .filter((c) => c[0].includes('/im/v1/messages'))
        .map((c) => c[1].receive_id)
      expect(msgRecipients).toContain('kinch.zhu@eclicktech.com.cn')
    })

    it('prefers explicit recipientEmail over email parsed from name', async () => {
      const keyResult = { id: 'k1', name: 'kinch.zhu', apiKey: 'cr_x', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockResolvedValue({ data: { code: 0 } })
      mockRedisClient.set.mockResolvedValue('OK')

      const row = {
        name: 'kinch.zhu@eclicktech.com.cn',
        recipientEmail: 'override@example.com'
      }
      await service.createApiKeyFromBitableRow(row)

      const msgRecipients = mockAxios.post.mock.calls
        .filter((c) => c[0].includes('/im/v1/messages'))
        .map((c) => c[1].receive_id)
      expect(msgRecipients).toContain('override@example.com')
      expect(msgRecipients).not.toContain('kinch.zhu@eclicktech.com.cn')
    })

    it('derives name from recipientEmail when row.name is absent', async () => {
      const keyResult = { id: 'k1', name: 'user', apiKey: 'cr_x', permissions: [] }
      mockApiKeyService.generateApiKey.mockResolvedValue(keyResult)
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockResolvedValue({ data: { code: 0 } })
      mockRedisClient.set.mockResolvedValue('OK')

      const row = { recipientEmail: 'user@example.com' }
      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(mockApiKeyService.generateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'user' })
      )
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

      mockRedisClient.set.mockResolvedValue('OK')

      const row = {
        recipientEmail: 'user@example.com'
      }

      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Redis write failed')
      // Notification still attempted (applicant + admin)
      expect(mockAxios.post).toHaveBeenCalledTimes(3)
      // No write-back on failure
      expect(mockAxios.put).not.toHaveBeenCalled()
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

      mockRedisClient.set.mockResolvedValue('OK')

      const row = { recipientEmail: 'user@example.com' }
      const result = await service.createApiKeyFromBitableRow(row)

      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-456')

      const logger = require('../src/utils/logger')
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  // ===================== Cursor mailbox tests =====================

  describe('createCursorMailbox - success case', () => {
    it('creates public mailbox, adds member, notifies admin only, and writes back', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } }) // token fetch
        .mockResolvedValueOnce({
          data: {
            code: 0,
            data: { public_mailbox_id: 'pm_123', email: 'cursor-kinch.zhu@example.com' }
          }
        }) // create mailbox
        .mockResolvedValueOnce({ data: { code: 0, data: { member_id: 'm1' } } }) // add member
        .mockResolvedValueOnce({ data: { code: 0 } }) // admin notification only
      mockAxios.put.mockResolvedValueOnce({ data: { code: 0 } }) // bitable write-back

      mockRedisClient.set.mockResolvedValue('OK')

      const row = {
        name: 'kinch.zhu@example.com',
        appToken: 'at1',
        tableId: 'tbl1',
        recordId: 'rec1'
      }
      const result = await service.createCursorMailbox(row)

      expect(result.success).toBe(true)
      expect(result.email).toBe('cursor-kinch.zhu@example.com')

      // Mailbox create call
      const mailboxCall = mockAxios.post.mock.calls.find(
        (c) => c[0].includes('/mail/v1/public_mailboxes') && !c[0].includes('/members')
      )
      expect(mailboxCall).toBeDefined()
      expect(mailboxCall[1].email).toBe('cursor-kinch.zhu@example.com')

      // Member add call
      const memberCall = mockAxios.post.mock.calls.find((c) => c[0].includes('/members'))
      expect(memberCall).toBeDefined()

      // Only admin gets notification (not applicant)
      const msgCalls = mockAxios.post.mock.calls.filter((c) => c[0].includes('/im/v1/messages'))
      expect(msgCalls).toHaveLength(1)
      expect(msgCalls[0][1].receive_id).toBe('admin@example.com')

      // Write-back
      expect(mockAxios.put).toHaveBeenCalledWith(
        expect.stringContaining('/bitable/v1/apps/at1/tables/tbl1/records/rec1'),
        expect.objectContaining({
          fields: expect.objectContaining({
            开通情况: true
          })
        }),
        expect.any(Object)
      )

      // Write-back should contain IMAP and password hint
      const writeBackFields = mockAxios.put.mock.calls[0][1].fields
      expect(writeBackFields['开通账号信息']).toContain('cursor-kinch.zhu@example.com')
      expect(writeBackFields['开通账号信息']).toContain('IMAP')
      expect(writeBackFields['开通账号信息']).toContain('密码')
    })
  })

  describe('createCursorMailbox - mailbox already exists (1234006)', () => {
    it('treats existing mailbox as success and continues', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')

      const alreadyExistsError = new Error('Request failed with status code 400')
      alreadyExistsError.response = { data: { code: 1234006, msg: 'email already taken' } }

      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } }) // token fetch
        .mockRejectedValueOnce(alreadyExistsError) // create mailbox → already exists
        .mockResolvedValueOnce({ data: { code: 0, data: { member_id: 'm1' } } }) // add member
        .mockResolvedValue({ data: { code: 0 } }) // notifications

      mockRedisClient.set.mockResolvedValue('OK')

      const row = { name: 'kinch.zhu@example.com' }
      const result = await service.createCursorMailbox(row)

      expect(result.success).toBe(true)
      expect(result.email).toBe('cursor-kinch.zhu@example.com')
    })
  })

  describe('createCursorMailbox - failure case', () => {
    it('returns error when mailbox creation fails with non-1234006 error', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')

      const apiError = new Error('Feishu create public mailbox error: code=1234026')
      apiError.response = { data: { code: 1234026, msg: 'limit reached' } }

      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockRejectedValueOnce(apiError)
        .mockResolvedValue({ data: { code: 0 } }) // notifications

      mockRedisClient.set.mockResolvedValue('OK')

      const row = { name: 'kinch.zhu@example.com' }
      const result = await service.createCursorMailbox(row)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()

      // No write-back on failure
      expect(mockAxios.put).not.toHaveBeenCalled()
    })
  })

  describe('createCursorMailbox - invalid email', () => {
    it('returns error when name is not a valid email', async () => {
      const row = { name: 'not-an-email' }
      const result = await service.createCursorMailbox(row)

      expect(result.success).toBe(false)
      expect(result.error).toContain('valid email')
    })
  })

  describe('createCursorMailbox - notification card content', () => {
    it('success card contains public mailbox email, IMAP steps and password hint', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockResolvedValueOnce({
          data: { code: 0, data: { public_mailbox_id: 'pm_x', email: 'cursor-user@example.com' } }
        })
        .mockResolvedValueOnce({ data: { code: 0, data: { member_id: 'm1' } } })
        .mockResolvedValue({ data: { code: 0 } })
      mockRedisClient.set.mockResolvedValue('OK')

      const row = { name: 'user@example.com' }
      await service.createCursorMailbox(row)

      const msgCalls = mockAxios.post.mock.calls.filter((c) => c[0].includes('/im/v1/messages'))
      expect(msgCalls).toHaveLength(1)

      const cardContent = msgCalls[0][1].content
      expect(cardContent).toContain('cursor-user@example.com')
      expect(cardContent).toContain('IMAP')
      expect(cardContent).toContain('生成专用密码')
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

      mockRedisClient.set.mockResolvedValue('OK')

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

  // ===================== fetchPendingRecords tests =====================

  describe('extractFieldValue', () => {
    it('handles plain strings', () => {
      expect(service.extractFieldValue('hello')).toBe('hello')
    })

    it('handles null/undefined', () => {
      expect(service.extractFieldValue(null)).toBe('')
      expect(service.extractFieldValue(undefined)).toBe('')
    })

    it('handles text segment arrays (Bitable text fields)', () => {
      const val = [{ type: 'text', text: 'zhangsan@example.com' }]
      expect(service.extractFieldValue(val)).toBe('zhangsan@example.com')
    })

    it('handles person arrays (Bitable person fields)', () => {
      const val = [{ id: 'ou_xxx', name: '张三', en_name: 'Zhang San' }]
      expect(service.extractFieldValue(val)).toBe('张三')
    })

    it('handles multi-segment text', () => {
      const val = [
        { type: 'text', text: 'hello ' },
        { type: 'text', text: 'world' }
      ]
      expect(service.extractFieldValue(val)).toBe('hello , world')
    })

    it('handles numbers and booleans', () => {
      expect(service.extractFieldValue(42)).toBe('42')
      expect(service.extractFieldValue(true)).toBe('true')
    })
  })

  describe('fetchPendingRecords', () => {
    it('returns formatted pending records with nested Feishu field types', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null).mockResolvedValue('tok')
      mockRedisClient.set.mockResolvedValue('OK')

      mockAxios.post
        .mockResolvedValueOnce({ data: { code: 0, tenant_access_token: 'tok' } })
        .mockResolvedValueOnce({
          data: {
            code: 0,
            data: {
              has_more: false,
              items: [
                {
                  record_id: 'rec_1',
                  fields: {
                    申请人: [{ id: 'ou_111', name: '张三', en_name: 'Zhang San' }],
                    申请人工作邮箱: [{ type: 'text', text: 'zhangsan@example.com' }],
                    申请产品: 'Claude Code',
                    开通情况: false,
                    开通账号信息: ''
                  }
                },
                {
                  record_id: 'rec_2',
                  fields: {
                    申请人: [{ id: 'ou_222', name: '李四' }],
                    申请人工作邮箱: [{ type: 'text', text: 'lisi@example.com' }],
                    申请产品: 'Cursor',
                    开通情况: false,
                    开通账号信息: ''
                  }
                }
              ]
            }
          }
        })

      const records = await service.fetchPendingRecords('appT', 'tblT')

      expect(records).toHaveLength(2)
      expect(records[0]).toEqual({
        recordId: 'rec_1',
        applicant: '张三',
        email: 'zhangsan@example.com',
        product: 'Claude Code',
        activated: false,
        accountInfo: ''
      })
      expect(records[1]).toEqual({
        recordId: 'rec_2',
        applicant: '李四',
        email: 'lisi@example.com',
        product: 'Cursor',
        activated: false,
        accountInfo: ''
      })
    })

    it('handles pagination with has_more', async () => {
      mockRedisClient.get.mockResolvedValue('tok')

      mockAxios.post
        .mockResolvedValueOnce({
          data: {
            code: 0,
            data: {
              has_more: true,
              page_token: 'pt_page2',
              items: [
                {
                  record_id: 'rec_a',
                  fields: { 申请人: 'A', 申请人工作邮箱: 'a@x.com', 申请产品: 'Claude Code' }
                }
              ]
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            code: 0,
            data: {
              has_more: false,
              items: [
                {
                  record_id: 'rec_b',
                  fields: { 申请人: 'B', 申请人工作邮箱: 'b@x.com', 申请产品: 'Cursor' }
                }
              ]
            }
          }
        })

      const records = await service.fetchPendingRecords('appT', 'tblT')

      expect(records).toHaveLength(2)
      expect(records[0].recordId).toBe('rec_a')
      expect(records[1].recordId).toBe('rec_b')

      const secondCall = mockAxios.post.mock.calls[1]
      expect(secondCall[1].page_token).toBe('pt_page2')
    })

    it('throws on non-zero Feishu response code', async () => {
      mockRedisClient.get.mockResolvedValue('tok')
      mockAxios.post.mockResolvedValueOnce({
        data: { code: 91402, msg: 'NOTEXIST' }
      })

      await expect(service.fetchPendingRecords('bad', 'bad')).rejects.toThrow('Feishu search')
    })
  })
})
