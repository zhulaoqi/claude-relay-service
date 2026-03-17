const axios = require('axios')
const redis = require('../models/redis')
const logger = require('../utils/logger')
const apiKeyService = require('./apiKeyService')
const bitableConfigService = require('./bitableConfigService')

const TOKEN_CACHE_KEY = 'bitable:feishu_token'
const TOKEN_TTL_SECONDS = 7000 // < 2h Feishu token lifetime
const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis'
const NOTIFY_TIMEOUT_MS = 10000

/**
 * Get a valid Feishu tenant access token, using Redis cache when available.
 */
async function getFeishuToken() {
  const cached = await redis.getClient().get(TOKEN_CACHE_KEY)
  if (cached) {
    return cached
  }

  const config = await bitableConfigService.getConfig()
  const response = await axios.post(
    `${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`,
    {
      app_id: config.feishuAppId,
      app_secret: config.feishuAppSecret
    },
    { timeout: NOTIFY_TIMEOUT_MS }
  )

  const { data } = response
  if (data.code !== 0) {
    throw new Error(`Feishu token error: code=${data.code} msg=${data.msg}`)
  }

  const token = data.tenant_access_token
  await redis.getClient().set(TOKEN_CACHE_KEY, token, 'EX', TOKEN_TTL_SECONDS)
  return token
}

/**
 * Build a Feishu interactive card message payload.
 * @param {'success'|'failure'} type
 * @param {object} params
 */
function buildCard(type, params) {
  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

  let card
  if (type === 'success') {
    const { name, apiKey, permissions, concurrencyLimit, dailyCostLimit, expiresAt } = params

    const permStr =
      Array.isArray(permissions) && permissions.length > 0 ? permissions.join(', ') : '全部服务'

    card = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '✅ API Key 创建成功' },
        template: 'green'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [
              `**名称：** ${name}`,
              `**API Key：** \`${apiKey}\``,
              `**权限：** ${permStr}`,
              `**并发限制：** ${concurrencyLimit || '不限'}`,
              `**每日费用上限：** ${dailyCostLimit || '不限'}`,
              `**过期时间：** ${expiresAt || '永不过期'}`,
              `**创建时间：** ${time}`,
              '',
              '> ⚠️ Key 仅此一次展示，请妥善保管'
            ].join('\n')
          }
        }
      ]
    }
  } else {
    const { name, error } = params

    card = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '❌ API Key 创建失败' },
        template: 'red'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [`**名称：** ${name}`, `**错误信息：** ${error}`, `**时间：** ${time}`].join(
              '\n'
            )
          }
        }
      ]
    }
  }

  return {
    msg_type: 'interactive',
    content: JSON.stringify(card)
  }
}

/**
 * Send a Feishu message to a recipient by email.
 * NEVER throws — all errors are logged as warnings.
 * @param {string} recipientEmail
 * @param {object} card - result of buildCard()
 */
async function sendFeishuMessage(recipientEmail, card) {
  try {
    const token = await getFeishuToken()
    const response = await axios.post(
      `${FEISHU_API_BASE}/im/v1/messages?receive_id_type=email`,
      { receive_id: recipientEmail, ...card },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: NOTIFY_TIMEOUT_MS
      }
    )

    const { data } = response
    if (data.code !== 0) {
      logger.warn(`bitableService sendFeishuMessage non-zero code: ${data.code} ${data.msg}`, {
        recipientEmail
      })
    }
  } catch (err) {
    logger.warn('bitableService sendFeishuMessage failed', { recipientEmail, error: err.message })
  }
}

/**
 * Write fields back to a Feishu Bitable record.
 * NEVER throws — all errors are logged as warnings.
 * @param {string} appToken
 * @param {string} tableId
 * @param {string} recordId
 * @param {object} fields
 */
async function updateBitableRecord(appToken, tableId, recordId, fields) {
  try {
    const token = await getFeishuToken()
    const response = await axios.patch(
      `${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
      { fields },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: NOTIFY_TIMEOUT_MS
      }
    )

    const { data } = response
    if (data.code !== 0) {
      logger.warn(`bitableService updateBitableRecord non-zero code: ${data.code} ${data.msg}`, {
        appToken,
        tableId,
        recordId
      })
    } else {
      logger.success('bitableService updateBitableRecord row updated', {
        appToken,
        tableId,
        recordId
      })
    }
  } catch (err) {
    logger.warn('bitableService updateBitableRecord failed', {
      error: err.message,
      appToken,
      tableId,
      recordId
    })
  }
}

/**
 * Create an API Key based on a Bitable row and notify recipients via Feishu.
 *
 * @param {object} row
 * @param {string} [row.product]           申请产品 — only 'Claude Code' is processed
 * @param {string} row.recipientEmail      申请人工作邮箱 (required); username part used as key name
 * @param {string} [row.description]
 * @param {Array}  [row.permissions]
 * @param {number} [row.concurrencyLimit]
 * @param {number} [row.dailyCostLimit]
 * @param {string} [row.expiresAt]
 * @param {string} [row.appToken]          Bitable app token for write-back
 * @param {string} [row.tableId]           Bitable table ID for write-back
 * @param {string} [row.recordId]          Bitable record ID for write-back
 * @returns {{ success: boolean, keyId?: string, skipped?: boolean, error?: string }}
 */
async function createApiKeyFromBitableRow(row) {
  const config = await bitableConfigService.getConfig()

  // ① Product filter: only process Claude Code rows
  if (row.product && row.product !== 'Claude Code') {
    logger.info('bitableService createApiKeyFromBitableRow skipped non-Claude-Code product', {
      product: row.product
    })
    return { success: false, skipped: true, reason: `Product '${row.product}' is not supported` }
  }

  // ② Derive name from email username (e.g. abel.wang@eclicktech.com.cn → abel.wang)
  const recipientEmail = row.recipientEmail || config.defaultRecipientEmail || null
  const name = recipientEmail ? recipientEmail.split('@')[0] : row.name || 'unknown'

  // ③ Compute expiresAt: row value takes priority; fall back to config defaultExpirationDays
  let expiresAt = row.expiresAt || null
  if (!expiresAt && config.defaultExpirationDays > 0) {
    const d = new Date()
    d.setDate(d.getDate() + config.defaultExpirationDays)
    expiresAt = d.toISOString()
  }

  const params = {
    name,
    description: row.description ?? '',
    permissions: row.permissions ?? config.defaultPermissions ?? [],
    concurrencyLimit: row.concurrencyLimit ?? config.defaultConcurrencyLimit ?? 0,
    dailyCostLimit: row.dailyCostLimit ?? config.defaultDailyCostLimit ?? 0,
    expiresAt
  }

  let keyData = null
  let creationError = null

  try {
    keyData = await apiKeyService.generateApiKey(params)
    logger.success('bitableService createApiKeyFromBitableRow key created', {
      keyId: keyData.id,
      name: params.name
    })
  } catch (err) {
    creationError = err
    logger.error('bitableService createApiKeyFromBitableRow key creation failed', {
      name: params.name,
      error: err.message
    })
  }

  // ④ Build notification card (shared between both recipients)
  const card =
    keyData !== null
      ? buildCard('success', {
          name: params.name,
          apiKey: keyData.apiKey,
          permissions: params.permissions,
          concurrencyLimit: params.concurrencyLimit,
          dailyCostLimit: params.dailyCostLimit,
          expiresAt
        })
      : buildCard('failure', {
          name: params.name,
          error: creationError ? creationError.message : 'Unknown error'
        })

  // ⑤ Send notification to applicant + admin (deduped, fire-and-forget)
  const shouldNotify = keyData !== null ? config.notifyOnSuccess : config.notifyOnFailure
  const targets = new Set()
  if (shouldNotify && recipientEmail) {
    targets.add(recipientEmail)
  }
  const { adminEmail } = config
  if (adminEmail) {
    targets.add(adminEmail)
  }

  if (targets.size === 0) {
    logger.warn('bitableService createApiKeyFromBitableRow no notification targets', {
      name: params.name
    })
  } else {
    await Promise.all([...targets].map((email) => sendFeishuMessage(email, card)))
  }

  // ⑥ Write back to Bitable on success: mark 开通情况=true, 开通账号信息=apiKey
  if (keyData !== null && row.appToken && row.tableId && row.recordId) {
    await updateBitableRecord(row.appToken, row.tableId, row.recordId, {
      开通情况: true,
      开通账号信息: keyData.apiKey
    })
  }

  if (keyData !== null) {
    return { success: true, keyId: keyData.id }
  }
  return { success: false, error: creationError ? creationError.message : 'Unknown error' }
}

module.exports = {
  getFeishuToken,
  buildCard,
  sendFeishuMessage,
  updateBitableRecord,
  createApiKeyFromBitableRow
}
