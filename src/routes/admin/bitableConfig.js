const express = require('express')
const axios = require('axios')
const bitableConfigService = require('../../services/bitableConfigService')
const bitableService = require('../../services/bitableService')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')

const router = express.Router()

// GET /bitable-config — return config, masking feishuAppSecret
router.get('/bitable-config', authenticateAdmin, async (req, res) => {
  try {
    const config = await bitableConfigService.getConfig()
    return res.json({
      success: true,
      data: {
        ...config,
        feishuAppSecretConfigured: !!config.feishuAppSecret,
        feishuAppSecret: undefined
      }
    })
  } catch (error) {
    logger.error('bitableConfig GET error', error)
    return res.status(500).json({ error: 'Failed to get bitable config', message: error.message })
  }
})

// PUT /bitable-config — save config updates
router.put('/bitable-config', authenticateAdmin, async (req, res) => {
  try {
    const {
      enabled,
      webhookSecret,
      feishuAppId,
      feishuAppSecret,
      bitableAppToken,
      bitableTableId,
      notifyOnSuccess,
      notifyOnFailure,
      adminEmail,
      defaultRecipientEmail,
      defaultPermissions,
      defaultConcurrencyLimit,
      defaultDailyCostLimit,
      defaultExpirationDays
    } = req.body

    const updates = {}
    if (enabled !== undefined) {
      updates.enabled = enabled
    }
    if (typeof webhookSecret === 'string') {
      updates.webhookSecret = webhookSecret
    }
    if (feishuAppId !== undefined) {
      updates.feishuAppId = feishuAppId
    }
    if (typeof feishuAppSecret === 'string' && feishuAppSecret !== '') {
      updates.feishuAppSecret = feishuAppSecret
    }
    if (bitableAppToken !== undefined) {
      updates.bitableAppToken = bitableAppToken
    }
    if (bitableTableId !== undefined) {
      updates.bitableTableId = bitableTableId
    }
    if (notifyOnSuccess !== undefined) {
      updates.notifyOnSuccess = notifyOnSuccess
    }
    if (notifyOnFailure !== undefined) {
      updates.notifyOnFailure = notifyOnFailure
    }
    if (adminEmail !== undefined) {
      updates.adminEmail = adminEmail
    }
    if (defaultRecipientEmail !== undefined) {
      updates.defaultRecipientEmail = defaultRecipientEmail
    }
    if (defaultPermissions !== undefined) {
      updates.defaultPermissions = defaultPermissions
    }
    if (defaultConcurrencyLimit !== undefined) {
      updates.defaultConcurrencyLimit = defaultConcurrencyLimit
    }
    if (defaultDailyCostLimit !== undefined) {
      updates.defaultDailyCostLimit = defaultDailyCostLimit
    }
    if (defaultExpirationDays !== undefined) {
      updates.defaultExpirationDays = defaultExpirationDays
    }

    await bitableConfigService.saveConfig(updates)

    return res.json({ success: true, message: '配置已保存' })
  } catch (error) {
    logger.error('bitableConfig PUT error', error)
    return res.status(500).json({ error: 'Failed to save bitable config', message: error.message })
  }
})

// POST /bitable-config/test — send a test Feishu message
router.post('/bitable-config/test', authenticateAdmin, async (req, res) => {
  try {
    const { testEmail } = req.body

    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      return res.status(400).json({ error: '请提供有效的邮箱地址' })
    }

    const config = await bitableConfigService.getConfig()
    if (!config.feishuAppId || !config.feishuAppSecret) {
      return res.status(400).json({ error: '请先配置飞书 App ID 和 App Secret' })
    }

    const token = await bitableService.getFeishuToken()
    const card = bitableService.buildCard('success', {
      name: '测试Key（连通性测试）',
      apiKey: 'cr_test_xxxxxxxxxx',
      permissions: [],
      expiresAt: null
    })

    await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=email',
      { receive_id: testEmail, ...card },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    return res.json({ success: true, message: `测试消息已发送至 ${testEmail}` })
  } catch (error) {
    logger.error('bitableConfig POST /test error', error)
    return res.status(500).json({ error: error.message })
  }
})

// GET /bitable-config/pending-records — fetch unchecked records from Bitable
router.get('/bitable-config/pending-records', authenticateAdmin, async (req, res) => {
  try {
    const config = await bitableConfigService.getConfig()
    if (!config.bitableAppToken || !config.bitableTableId) {
      return res.status(400).json({ error: '请先在「接入控制」中配置多维表格 appToken 和 tableId' })
    }
    if (!config.feishuAppId || !config.feishuAppSecret) {
      return res.status(400).json({ error: '请先配置飞书 App ID 和 App Secret' })
    }

    const records = await bitableService.fetchPendingRecords(
      config.bitableAppToken,
      config.bitableTableId
    )
    return res.json({ success: true, data: records })
  } catch (error) {
    logger.error('bitableConfig GET /pending-records error', error)
    return res.status(500).json({ error: error.message })
  }
})

// POST /bitable-config/activate — activate a single pending record
router.post('/bitable-config/activate', authenticateAdmin, async (req, res) => {
  try {
    const { recordId, email, product } = req.body
    if (!recordId || !email) {
      return res.status(400).json({ error: 'recordId and email are required' })
    }

    const config = await bitableConfigService.getConfig()
    if (!config.bitableAppToken || !config.bitableTableId) {
      return res.status(400).json({ error: '请先在「接入控制」中配置多维表格 appToken 和 tableId' })
    }

    const isCursor = typeof product === 'string' && product.trim().toLowerCase() === 'cursor'

    const row = {
      name: email,
      appToken: config.bitableAppToken,
      tableId: config.bitableTableId,
      recordId
    }

    let result
    if (isCursor) {
      result = await bitableService.createCursorMailbox(row)
    } else {
      result = await bitableService.createApiKeyFromBitableRow(row)
    }

    return res.json(result)
  } catch (error) {
    logger.error('bitableConfig POST /activate error', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
