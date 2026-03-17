const express = require('express')
const bitableConfigService = require('../services/bitableConfigService')
const bitableService = require('../services/bitableService')
const logger = require('../utils/logger')

const router = express.Router()

// POST /apikey-create — receive Feishu automation push and create API key
router.post('/apikey-create', async (req, res) => {
  try {
    // ① Get config
    const config = await bitableConfigService.getConfig()

    // ② Check feature enabled and webhookSecret configured
    if (!config.enabled || !config.webhookSecret) {
      return res.status(503).json({ error: 'Bitable integration is not enabled' })
    }

    // ③ Validate X-Webhook-Secret header
    const incomingSecret = req.headers['x-webhook-secret']
    if (incomingSecret !== config.webhookSecret) {
      logger.security('bitableRoutes webhook secret mismatch', {
        ip: req.ip,
        path: req.path
      })
      return res.status(401).json({ error: 'Invalid webhook secret' })
    }

    // ④ Validate name field
    const rowData = req.body
    if (!rowData.name || typeof rowData.name !== 'string' || rowData.name.trim() === '') {
      return res.status(400).json({ error: 'name is required' })
    }

    // ⑤ Create API key
    const result = await bitableService.createApiKeyFromBitableRow(rowData)

    // ⑥ Always return 200 (Feishu automation retries on non-200)
    return res.status(200).json(result)
  } catch (error) {
    logger.error('bitableRoutes /apikey-create error', error)
    // Still return 200 to prevent Feishu retries
    return res.status(200).json({ success: false, error: error.message })
  }
})

module.exports = router
