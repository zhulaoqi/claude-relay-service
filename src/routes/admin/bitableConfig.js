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
    if (webhookSecret !== undefined) {
      updates.webhookSecret = webhookSecret
    }
    if (feishuAppId !== undefined) {
      updates.feishuAppId = feishuAppId
    }
    // Only update feishuAppSecret if a non-empty string is provided
    if (typeof feishuAppSecret === 'string' && feishuAppSecret !== '') {
      updates.feishuAppSecret = feishuAppSecret
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

module.exports = router
