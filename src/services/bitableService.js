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
    const response = await axios.put(
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
    const detail = err.response?.data || null
    logger.warn('bitableService updateBitableRecord failed', {
      error: err.message,
      status: err.response?.status,
      feishuCode: detail?.code,
      feishuMsg: detail?.msg,
      fields,
      appToken,
      tableId,
      recordId
    })
  }
}

/**
 * Create a Feishu public mailbox via the Mail API.
 * Treats "email already exists" (code 1234006) as success.
 * @param {string} email  - public mailbox address to create
 * @param {string} displayName - display name for the mailbox
 * @returns {{ public_mailbox_id: string, email: string }}
 */
async function createPublicMailbox(email, displayName) {
  const token = await getFeishuToken()
  const response = await axios.post(
    `${FEISHU_API_BASE}/mail/v1/public_mailboxes`,
    { email, name: displayName },
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
    throw new Error(`Feishu create public mailbox error: code=${data.code} msg=${data.msg}`)
  }
  return data.data
}

/**
 * Add a member to a Feishu public mailbox.
 * @param {string} publicMailboxId - public_mailbox_id or email address
 * @param {string} memberEmail - member's email address
 */
async function addPublicMailboxMember(publicMailboxId, memberEmail) {
  const token = await getFeishuToken()
  const response = await axios.post(
    `${FEISHU_API_BASE}/mail/v1/public_mailboxes/${publicMailboxId}/members?user_id_type=user_id`,
    { user_id: memberEmail, type: 'USER' },
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
    throw new Error(`Feishu add mailbox member error: code=${data.code} msg=${data.msg}`)
  }
  return data.data
}

/**
 * Build a Feishu interactive card for Cursor mailbox creation results.
 * @param {'success'|'failure'} type
 * @param {object} params
 */
function buildCursorCard(type, params) {
  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

  let card
  if (type === 'success') {
    const { publicEmail, applicantEmail } = params
    card = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '✅ Cursor 公共邮箱创建成功' },
        template: 'green'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [
              `**申请人：** ${applicantEmail}`,
              `**公共邮箱：** \`${publicEmail}\``,
              `**创建时间：** ${time}`,
              '',
              '> ⚠️ 需管理员在飞书管理后台 → 邮箱 → 公共邮箱 → 邮箱设置中开启 IMAP'
            ].join('\n')
          }
        }
      ]
    }
  } else {
    const { applicantEmail, error } = params
    card = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '❌ Cursor 公共邮箱创建失败' },
        template: 'red'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [
              `**申请人：** ${applicantEmail}`,
              `**错误信息：** ${error}`,
              `**时间：** ${time}`
            ].join('\n')
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
 * Create a Cursor public mailbox for the applicant:
 * 1. Parse applicant email → build public mailbox address (cursor-{user}@{domain})
 * 2. Create public mailbox via Feishu API
 * 3. Add applicant as mailbox member
 * 4. Notify via Feishu message
 * 5. Write back to Bitable
 *
 * @param {object} row
 * @param {string} row.name              申请人邮箱
 * @param {string} [row.recipientEmail]  通知邮箱（默认用 name）
 * @param {string} [row.appToken]
 * @param {string} [row.tableId]
 * @param {string} [row.recordId]
 * @returns {{ success: boolean, email?: string, error?: string }}
 */
async function createCursorMailbox(row) {
  const config = await bitableConfigService.getConfig()

  const applicantEmail = row.name || row.recipientEmail || ''
  if (!applicantEmail.includes('@')) {
    return { success: false, error: 'name must be a valid email for Cursor product' }
  }

  const [username, domain] = applicantEmail.split('@')
  const publicEmail = `cursor-${username}@${domain}`
  const displayName = `Cursor - ${username}`
  const recipientEmail = row.recipientEmail || applicantEmail

  let mailboxData = null
  let creationError = null

  try {
    mailboxData = await createPublicMailbox(publicEmail, displayName)
    logger.success('bitableService createCursorMailbox mailbox created', {
      publicEmail,
      publicMailboxId: mailboxData.public_mailbox_id
    })
  } catch (err) {
    const feishuCode = err.response?.data?.code
    if (feishuCode === 1234006) {
      logger.info(
        'bitableService createCursorMailbox mailbox already exists, treating as success',
        {
          publicEmail
        }
      )
      mailboxData = { public_mailbox_id: publicEmail, email: publicEmail }
    } else {
      creationError = err
      logger.error('bitableService createCursorMailbox mailbox creation failed', {
        publicEmail,
        error: err.message,
        feishuCode,
        feishuMsg: err.response?.data?.msg
      })
    }
  }

  if (mailboxData) {
    try {
      await addPublicMailboxMember(mailboxData.public_mailbox_id, applicantEmail)
      logger.success('bitableService createCursorMailbox member added', {
        publicEmail,
        member: applicantEmail
      })
    } catch (err) {
      logger.warn('bitableService createCursorMailbox add member failed (non-fatal)', {
        publicEmail,
        member: applicantEmail,
        error: err.message
      })
    }
  }

  const card =
    mailboxData !== null
      ? buildCursorCard('success', { publicEmail, applicantEmail })
      : buildCursorCard('failure', {
          applicantEmail,
          error: creationError ? creationError.message : 'Unknown error'
        })

  const shouldNotify = mailboxData !== null ? config.notifyOnSuccess : config.notifyOnFailure
  const targets = new Set()
  if (shouldNotify && recipientEmail) {
    targets.add(recipientEmail)
  }
  if (config.adminEmail) {
    targets.add(config.adminEmail)
  }
  if (targets.size > 0) {
    await Promise.all([...targets].map((email) => sendFeishuMessage(email, card)))
  }

  if (mailboxData !== null && row.appToken && row.tableId && row.recordId) {
    await updateBitableRecord(row.appToken, row.tableId, row.recordId, {
      开通情况: true,
      开通账号信息: `${publicEmail}，需管理员在飞书管理后台开启IMAP`
    })
  }

  if (mailboxData !== null) {
    return { success: true, email: publicEmail }
  }
  return { success: false, error: creationError ? creationError.message : 'Unknown error' }
}

/**
 * Create an API Key based on a Bitable row and notify recipients via Feishu.
 *
 * @param {object} row
 * @param {string} row.name                申请人工作邮箱 or plain name
 * @param {string} [row.recipientEmail]
 * @param {string} [row.description]
 * @param {Array}  [row.permissions]
 * @param {number} [row.concurrencyLimit]
 * @param {number} [row.dailyCostLimit]
 * @param {string} [row.expiresAt]
 * @param {string} [row.appToken]          Bitable app token for write-back
 * @param {string} [row.tableId]           Bitable table ID for write-back
 * @param {string} [row.recordId]          Bitable record ID for write-back
 * @returns {{ success: boolean, keyId?: string, error?: string }}
 */
async function createApiKeyFromBitableRow(row) {
  const config = await bitableConfigService.getConfig()

  // If name looks like an email, extract username part and reuse as recipientEmail
  let rawName = row.name || ''
  let derivedEmail = row.recipientEmail || null
  if (rawName.includes('@')) {
    if (!derivedEmail) {
      derivedEmail = rawName
    }
    rawName = rawName.split('@')[0]
  }

  const recipientEmail = derivedEmail || config.defaultRecipientEmail || null
  const name = rawName || (recipientEmail ? recipientEmail.split('@')[0] : 'unknown')

  // Compute expiresAt: row value takes priority; fall back to config defaultExpirationDays
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

/**
 * Extract a plain string from a Feishu Bitable field value.
 * Handles: plain strings, text segment arrays [{type:"text",text:"..."}],
 * person arrays [{name:"...",id:"..."}], and other nested types.
 */
function extractFieldValue(val) {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          return item.text || item.name || item.email || item.value || JSON.stringify(item)
        }
        return String(item)
      })
      .filter(Boolean)
      .join(', ')
  }
  if (typeof val === 'object') {
    return val.text || val.name || val.value || JSON.stringify(val)
  }
  return String(val)
}

/**
 * Fetch records from Feishu Bitable where 开通情况 is unchecked.
 * @param {string} appToken
 * @param {string} tableId
 * @returns {Array<{recordId: string, applicant: string, email: string, product: string, activated: boolean}>}
 */
async function fetchPendingRecords(appToken, tableId) {
  const token = await getFeishuToken()
  const fieldNames = ['申请人工作邮箱', '申请产品', '申请人', '开通情况', '开通账号信息']

  const allRecords = []
  let pageToken = null

  do {
    const body = {
      field_names: fieldNames,
      filter: {
        conjunction: 'and',
        conditions: [
          {
            field_name: '开通情况',
            operator: 'is',
            value: ['false']
          }
        ]
      },
      page_size: 500
    }
    if (pageToken) {
      body.page_token = pageToken
    }

    const response = await axios.post(
      `${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
      body,
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
      throw new Error(`Feishu search records error: code=${data.code} msg=${data.msg}`)
    }

    const items = data.data?.items || []
    for (const item of items) {
      const fields = item.fields || {}
      allRecords.push({
        recordId: item.record_id,
        applicant: extractFieldValue(fields['申请人']),
        email: extractFieldValue(fields['申请人工作邮箱']),
        product: extractFieldValue(fields['申请产品']),
        activated: !!fields['开通情况'],
        accountInfo: extractFieldValue(fields['开通账号信息'])
      })
    }

    pageToken = data.data?.has_more ? data.data.page_token : null
  } while (pageToken)

  return allRecords
}

module.exports = {
  getFeishuToken,
  buildCard,
  buildCursorCard,
  sendFeishuMessage,
  updateBitableRecord,
  createPublicMailbox,
  addPublicMailboxMember,
  createApiKeyFromBitableRow,
  createCursorMailbox,
  fetchPendingRecords,
  extractFieldValue
}
