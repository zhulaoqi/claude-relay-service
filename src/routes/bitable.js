const express = require('express')
const bitableConfigService = require('../services/bitableConfigService')
const bitableService = require('../services/bitableService')
const logger = require('../utils/logger')

const router = express.Router()

// Dedup: prevent Feishu automation from creating duplicate keys within a short window
const recentRequests = new Map()
const DEDUP_WINDOW_MS = 10_000

function isDuplicate(key) {
  const now = Date.now()
  for (const [k, ts] of recentRequests) {
    if (now - ts > DEDUP_WINDOW_MS) {
      recentRequests.delete(k)
    } else {
      break
    }
  }
  if (recentRequests.has(key)) {
    return true
  }
  recentRequests.set(key, now)
  return false
}

// POST /apikey-create — receive Feishu Bitable automation HTTP request
router.post('/apikey-create', async (req, res) => {
  let config
  try {
    config = await bitableConfigService.getConfig()
  } catch (err) {
    logger.error('bitableRoutes /apikey-create getConfig error', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (!config.enabled || !config.webhookSecret) {
    return res.status(503).json({ error: 'Bitable webhook not configured or disabled' })
  }

  const incomingSecret = req.headers['x-webhook-secret']
  if (!incomingSecret || incomingSecret !== config.webhookSecret) {
    logger.security('bitableRoutes /apikey-create secret mismatch', { ip: req.ip })
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const {
    name,
    product,
    description,
    permissions,
    concurrencyLimit,
    dailyCostLimit,
    expiresAt,
    recipientEmail,
    appToken,
    tableId,
    recordId
  } = req.body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }

  const cleanName = name.trim()

  if (isDuplicate(cleanName)) {
    logger.warn('bitableRoutes /apikey-create duplicate request ignored', {
      name: cleanName,
      ip: req.ip
    })
    return res.json({ success: true, deduplicated: true })
  }

  const isCursor = typeof product === 'string' && product.trim().toLowerCase() === 'cursor'

  logger.info('bitableRoutes /apikey-create received', {
    name: cleanName,
    product: isCursor ? 'Cursor' : 'Claude Code',
    ip: req.ip
  })

  let result
  if (isCursor) {
    result = await bitableService.createCursorMailbox({
      name: cleanName,
      recipientEmail,
      appToken,
      tableId,
      recordId
    })
  } else {
    result = await bitableService.createApiKeyFromBitableRow({
      name: cleanName,
      description,
      permissions,
      concurrencyLimit,
      dailyCostLimit,
      expiresAt,
      recipientEmail,
      appToken,
      tableId,
      recordId
    })
  }

  return res.json(result)
})

router._resetDedup = () => recentRequests.clear()

module.exports = router
