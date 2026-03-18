jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  success: jest.fn(),
  security: jest.fn(),
  debug: jest.fn()
}))

jest.mock('../src/middleware/auth', () => ({
  authenticateAdmin: (req, res, next) => next()
}))

jest.mock('../src/models/redis', () => ({ getClient: jest.fn() }))

jest.mock('../src/services/bitableConfigService', () => ({
  getConfig: jest.fn(),
  saveConfig: jest.fn()
}))

jest.mock('../src/services/bitableService', () => ({
  getFeishuToken: jest.fn(),
  buildCard: jest.fn(),
  buildCursorCard: jest.fn(),
  sendFeishuMessage: jest.fn(),
  updateBitableRecord: jest.fn(),
  createPublicMailbox: jest.fn(),
  addPublicMailboxMember: jest.fn(),
  createApiKeyFromBitableRow: jest.fn(),
  createCursorMailbox: jest.fn(),
  fetchPendingRecords: jest.fn()
}))

jest.mock('axios', () => ({
  post: jest.fn()
}))

const request = require('supertest')
const express = require('express')

const bitableConfigService = require('../src/services/bitableConfigService')
const bitableService = require('../src/services/bitableService')
const logger = require('../src/utils/logger')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/admin', require('../src/routes/admin/bitableConfig'))
  app.use('/bitable', require('../src/routes/bitable'))
  return app
}

const app = buildApp()

afterEach(() => {
  jest.clearAllMocks()
  require('../src/routes/bitable')._resetDedup()
})

// ===================== Admin routes =====================

describe('Admin bitable config routes', () => {
  it('GET /admin/bitable-config returns webhookSecret and hides feishuAppSecret', async () => {
    bitableConfigService.getConfig.mockResolvedValue({
      enabled: true,
      webhookSecret: 'ws123',
      feishuAppId: 'cli_123',
      feishuAppSecret: 'supersecret',
      notifyOnSuccess: true,
      notifyOnFailure: true,
      defaultRecipientEmail: 'test@example.com',
      defaultPermissions: [],
      defaultConcurrencyLimit: 0,
      defaultDailyCostLimit: 0,
      defaultExpirationDays: 0,
      updatedAt: null
    })

    const res = await request(app).get('/admin/bitable-config')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.feishuAppSecretConfigured).toBe(true)
    expect(res.body.data.feishuAppSecret).toBeUndefined()
    expect(res.body.data.webhookSecret).toBe('ws123')
    expect(res.body.data.enabled).toBe(true)
  })

  it('PUT /admin/bitable-config saves webhookSecret', async () => {
    bitableConfigService.saveConfig.mockResolvedValue({})

    const res = await request(app).put('/admin/bitable-config').send({
      enabled: true,
      webhookSecret: 'new-secret-456'
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toBe('配置已保存')

    const callArg = bitableConfigService.saveConfig.mock.calls[0][0]
    expect(callArg.webhookSecret).toBe('new-secret-456')
  })

  it('PUT /admin/bitable-config does not pass empty feishuAppSecret', async () => {
    bitableConfigService.saveConfig.mockResolvedValue({})

    await request(app).put('/admin/bitable-config').send({
      enabled: true,
      feishuAppId: 'cli_456',
      feishuAppSecret: ''
    })

    const callArg = bitableConfigService.saveConfig.mock.calls[0][0]
    expect(callArg).not.toHaveProperty('feishuAppSecret')
    expect(callArg.feishuAppId).toBe('cli_456')
  })

  it('POST /admin/bitable-config/test with missing testEmail returns 400', async () => {
    const res = await request(app).post('/admin/bitable-config/test').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })
})

// ===================== Public webhook route =====================

describe('Public bitable webhook /apikey-create', () => {
  const validConfig = {
    enabled: true,
    webhookSecret: 'secret123',
    feishuAppId: 'cli_x',
    feishuAppSecret: 'xxx',
    defaultRecipientEmail: 'admin@co.com',
    defaultPermissions: [],
    defaultConcurrencyLimit: 0,
    defaultDailyCostLimit: 0,
    defaultExpirationDays: 0,
    notifyOnSuccess: true,
    notifyOnFailure: true
  }

  it('returns 503 when feature is disabled', async () => {
    bitableConfigService.getConfig.mockResolvedValue({ ...validConfig, enabled: false })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'secret123')
      .send({ name: 'test' })

    expect(res.status).toBe(503)
  })

  it('returns 503 when webhookSecret is not configured', async () => {
    bitableConfigService.getConfig.mockResolvedValue({ ...validConfig, webhookSecret: '' })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', '')
      .send({ name: 'test' })

    expect(res.status).toBe(503)
  })

  it('returns 401 when secret does not match', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'wrong-secret')
      .send({ name: 'test' })

    expect(res.status).toBe(401)
    expect(logger.security).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when name is missing', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'secret123')
      .send({ recipientEmail: 'a@b.com' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'secret123')
      .send({ name: '  ' })

    expect(res.status).toBe(400)
  })

  it('returns 200 with success on successful key creation', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)
    bitableService.createApiKeyFromBitableRow.mockResolvedValue({ success: true, keyId: 'key-1' })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'secret123')
      .send({ name: 'testuser', recipientEmail: 'a@b.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.keyId).toBe('key-1')
    expect(bitableService.createApiKeyFromBitableRow).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'testuser', recipientEmail: 'a@b.com' })
    )
  })

  it('returns 200 even on business failure (avoids Feishu retry)', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)
    bitableService.createApiKeyFromBitableRow.mockResolvedValue({
      success: false,
      error: 'DB error'
    })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'secret123')
      .send({ name: 'testuser', recipientEmail: 'a@b.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('DB error')
  })

  it('passes appToken/tableId/recordId to service for write-back', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)
    bitableService.createApiKeyFromBitableRow.mockResolvedValue({ success: true, keyId: 'key-2' })

    await request(app).post('/bitable/apikey-create').set('x-webhook-secret', 'secret123').send({
      name: 'testuser',
      appToken: 'at123',
      tableId: 'tbl456',
      recordId: 'rec789'
    })

    expect(bitableService.createApiKeyFromBitableRow).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'testuser',
        appToken: 'at123',
        tableId: 'tbl456',
        recordId: 'rec789'
      })
    )
  })

  it('deduplicates rapid identical requests within window', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)
    bitableService.createApiKeyFromBitableRow.mockResolvedValue({ success: true, keyId: 'key-4' })

    const payload = { name: 'dedup-test-user@example.com' }
    const headers = { 'x-webhook-secret': 'secret123' }

    const res1 = await request(app).post('/bitable/apikey-create').set(headers).send(payload)

    const res2 = await request(app).post('/bitable/apikey-create').set(headers).send(payload)

    expect(res1.status).toBe(200)
    expect(res1.body.success).toBe(true)
    expect(res1.body.keyId).toBe('key-4')

    expect(res2.status).toBe(200)
    expect(res2.body.deduplicated).toBe(true)

    expect(bitableService.createApiKeyFromBitableRow).toHaveBeenCalledTimes(1)
  })

  it('dispatches to createCursorMailbox when product is Cursor', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)
    bitableService.createCursorMailbox.mockResolvedValue({
      success: true,
      email: 'cursor-user@example.com'
    })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'secret123')
      .send({ name: 'user@example.com', product: 'Cursor' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.email).toBe('cursor-user@example.com')
    expect(bitableService.createCursorMailbox).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'user@example.com' })
    )
    expect(bitableService.createApiKeyFromBitableRow).not.toHaveBeenCalled()
  })

  it('dispatches to createApiKeyFromBitableRow when product is empty', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)
    bitableService.createApiKeyFromBitableRow.mockResolvedValue({ success: true, keyId: 'key-5' })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'secret123')
      .send({ name: 'user@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(bitableService.createApiKeyFromBitableRow).toHaveBeenCalled()
    expect(bitableService.createCursorMailbox).not.toHaveBeenCalled()
  })

  it('dispatches to createApiKeyFromBitableRow when product is Claude Code', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)
    bitableService.createApiKeyFromBitableRow.mockResolvedValue({ success: true, keyId: 'key-6' })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'secret123')
      .send({ name: 'user@example.com', product: 'Claude Code' })

    expect(res.status).toBe(200)
    expect(bitableService.createApiKeyFromBitableRow).toHaveBeenCalled()
    expect(bitableService.createCursorMailbox).not.toHaveBeenCalled()
  })

  it('product matching is case-insensitive', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)
    bitableService.createCursorMailbox.mockResolvedValue({
      success: true,
      email: 'cursor-user@example.com'
    })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('x-webhook-secret', 'secret123')
      .send({ name: 'user@example.com', product: 'cursor' })

    expect(res.status).toBe(200)
    expect(bitableService.createCursorMailbox).toHaveBeenCalled()
  })

  it('dedup applies to Cursor requests as well', async () => {
    bitableConfigService.getConfig.mockResolvedValue(validConfig)
    bitableService.createCursorMailbox.mockResolvedValue({
      success: true,
      email: 'cursor-dup@example.com'
    })

    const payload = { name: 'dup@example.com', product: 'Cursor' }
    const headers = { 'x-webhook-secret': 'secret123' }

    await request(app).post('/bitable/apikey-create').set(headers).send(payload)
    const res2 = await request(app).post('/bitable/apikey-create').set(headers).send(payload)

    expect(res2.body.deduplicated).toBe(true)
    expect(bitableService.createCursorMailbox).toHaveBeenCalledTimes(1)
  })
})

// ===================== Pending records & activate =====================

describe('Admin pending-records and activate', () => {
  const configWithBitable = {
    enabled: true,
    webhookSecret: 'ws',
    feishuAppId: 'cli_x',
    feishuAppSecret: 'sec',
    bitableAppToken: 'appTok',
    bitableTableId: 'tblTok',
    defaultRecipientEmail: '',
    defaultPermissions: [],
    defaultConcurrencyLimit: 0,
    defaultDailyCostLimit: 0,
    defaultExpirationDays: 0,
    notifyOnSuccess: true,
    notifyOnFailure: true
  }

  it('GET /pending-records returns 400 when appToken/tableId not configured', async () => {
    bitableConfigService.getConfig.mockResolvedValue({
      ...configWithBitable,
      bitableAppToken: '',
      bitableTableId: ''
    })

    const res = await request(app).get('/admin/bitable-config/pending-records')
    expect(res.status).toBe(400)
  })

  it('GET /pending-records returns records on success', async () => {
    bitableConfigService.getConfig.mockResolvedValue(configWithBitable)
    bitableService.fetchPendingRecords.mockResolvedValue([
      { recordId: 'r1', applicant: 'A', email: 'a@x.com', product: 'Claude Code' }
    ])

    const res = await request(app).get('/admin/bitable-config/pending-records')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveLength(1)
    expect(bitableService.fetchPendingRecords).toHaveBeenCalledWith('appTok', 'tblTok')
  })

  it('POST /activate returns 400 when recordId or email missing', async () => {
    bitableConfigService.getConfig.mockResolvedValue(configWithBitable)

    const res = await request(app).post('/admin/bitable-config/activate').send({ recordId: 'r1' })
    expect(res.status).toBe(400)
  })

  it('POST /activate calls createApiKeyFromBitableRow for Claude Code', async () => {
    bitableConfigService.getConfig.mockResolvedValue(configWithBitable)
    bitableService.createApiKeyFromBitableRow.mockResolvedValue({ success: true, keyId: 'k1' })

    const res = await request(app).post('/admin/bitable-config/activate').send({
      recordId: 'r1',
      email: 'user@x.com',
      product: 'Claude Code'
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(bitableService.createApiKeyFromBitableRow).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'user@x.com',
        appToken: 'appTok',
        tableId: 'tblTok',
        recordId: 'r1'
      })
    )
  })

  it('POST /activate calls createCursorMailbox for Cursor', async () => {
    bitableConfigService.getConfig.mockResolvedValue(configWithBitable)
    bitableService.createCursorMailbox.mockResolvedValue({
      success: true,
      email: 'cursor-user@x.com'
    })

    const res = await request(app).post('/admin/bitable-config/activate').send({
      recordId: 'r2',
      email: 'user@x.com',
      product: 'Cursor'
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(bitableService.createCursorMailbox).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'user@x.com',
        appToken: 'appTok',
        tableId: 'tblTok',
        recordId: 'r2'
      })
    )
  })
})
