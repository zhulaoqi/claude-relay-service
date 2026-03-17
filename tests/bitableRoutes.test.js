// Top-level mocks — must be before any require
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
  createApiKeyFromBitableRow: jest.fn(),
  sendFeishuMessage: jest.fn()
}))

jest.mock('axios', () => ({
  post: jest.fn()
}))

const request = require('supertest')
const express = require('express')

const bitableConfigService = require('../src/services/bitableConfigService')
const bitableService = require('../src/services/bitableService')
const _axios = require('axios')
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
})

// ===================== Admin routes =====================

describe('Admin bitable config routes', () => {
  // Test 1: GET returns config with feishuAppSecretConfigured flag, no feishuAppSecret
  it('GET /admin/bitable-config returns feishuAppSecretConfigured and hides feishuAppSecret', async () => {
    bitableConfigService.getConfig.mockResolvedValue({
      enabled: true,
      webhookSecret: 'mysecret',
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
    // webhookSecret is returned (admin needs to see it)
    expect(res.body.data.webhookSecret).toBe('mysecret')
    expect(res.body.data.enabled).toBe(true)
  })

  // Test 2: PUT saves config, empty feishuAppSecret is not passed to saveConfig
  it('PUT /admin/bitable-config saves config and does not pass empty feishuAppSecret', async () => {
    bitableConfigService.saveConfig.mockResolvedValue({})

    const res = await request(app).put('/admin/bitable-config').send({
      enabled: true,
      feishuAppId: 'cli_456',
      feishuAppSecret: '' // empty → should NOT be passed to saveConfig
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toBe('配置已保存')

    expect(bitableConfigService.saveConfig).toHaveBeenCalledTimes(1)
    const callArg = bitableConfigService.saveConfig.mock.calls[0][0]
    expect(callArg).not.toHaveProperty('feishuAppSecret')
    expect(callArg.feishuAppId).toBe('cli_456')
    expect(callArg.enabled).toBe(true)
  })

  // Test 3: POST /test with missing testEmail returns 400
  it('POST /admin/bitable-config/test with missing testEmail returns 400', async () => {
    const res = await request(app).post('/admin/bitable-config/test').send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })
})

// ===================== Public webhook route =====================

describe('Public bitable webhook route', () => {
  // Test 4: Wrong X-Webhook-Secret → 401
  it('POST /bitable/apikey-create with wrong secret returns 401', async () => {
    bitableConfigService.getConfig.mockResolvedValue({
      enabled: true,
      webhookSecret: 'correct-secret'
    })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('X-Webhook-Secret', 'wrong-secret')
      .send({ name: 'Test Key' })

    expect(res.status).toBe(401)
    expect(logger.security).toHaveBeenCalledTimes(1)
  })

  // Test 5: Missing name → 400
  it('POST /bitable/apikey-create with missing name returns 400', async () => {
    bitableConfigService.getConfig.mockResolvedValue({
      enabled: true,
      webhookSecret: 'correct-secret'
    })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('X-Webhook-Secret', 'correct-secret')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/name/)
  })

  // Test 6: Feature disabled → 503
  it('POST /bitable/apikey-create when disabled returns 503', async () => {
    bitableConfigService.getConfig.mockResolvedValue({
      enabled: false,
      webhookSecret: 'correct-secret'
    })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('X-Webhook-Secret', 'correct-secret')
      .send({ name: 'Test Key' })

    expect(res.status).toBe(503)
  })

  // Test 7: Success → 200 { success: true }
  it('POST /bitable/apikey-create success returns 200 with success: true', async () => {
    bitableConfigService.getConfig.mockResolvedValue({
      enabled: true,
      webhookSecret: 'correct-secret'
    })
    bitableService.createApiKeyFromBitableRow.mockResolvedValue({
      success: true,
      keyId: 'key_abc123'
    })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('X-Webhook-Secret', 'correct-secret')
      .send({ name: 'My Test Key' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.keyId).toBe('key_abc123')
  })

  // Test 8: Business failure → 200 { success: false } (not 4xx/5xx)
  it('POST /bitable/apikey-create on business failure still returns 200 with success: false', async () => {
    bitableConfigService.getConfig.mockResolvedValue({
      enabled: true,
      webhookSecret: 'correct-secret'
    })
    bitableService.createApiKeyFromBitableRow.mockResolvedValue({
      success: false,
      error: 'Duplicate name'
    })

    const res = await request(app)
      .post('/bitable/apikey-create')
      .set('X-Webhook-Secret', 'correct-secret')
      .send({ name: 'My Test Key' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('Duplicate name')
  })
})
