import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getBitableConfigApi,
  saveBitableConfigApi,
  testBitableConfigApi,
  getPendingRecordsApi,
  activateRecordApi
} from '@/utils/http_apis'

export const useBitableStore = defineStore('bitable', () => {
  const config = ref({
    enabled: false,
    webhookSecret: '',
    feishuAppId: '',
    feishuAppSecretConfigured: false,
    bitableAppToken: '',
    bitableTableId: '',
    notifyOnSuccess: true,
    notifyOnFailure: true,
    adminEmail: 'ricardo.zhang@eclicktech.com.cn',
    defaultRecipientEmail: '',
    defaultPermissions: [],
    defaultConcurrencyLimit: 0,
    defaultDailyCostLimit: 0,
    defaultExpirationDays: 0
  })
  const loading = ref(false)
  const saving = ref(false)
  const testing = ref(false)
  const pendingRecords = ref([])
  const loadingPending = ref(false)

  async function fetchConfig() {
    loading.value = true
    try {
      const res = await getBitableConfigApi()
      if (res.success) {
        Object.assign(config.value, res.data)
      }
    } finally {
      loading.value = false
    }
  }

  // newAppSecret: only pass if user entered a new one (to avoid clearing existing)
  async function saveConfig(formData, newAppSecret) {
    saving.value = true
    try {
      const payload = { ...formData }
      if (newAppSecret) payload.feishuAppSecret = newAppSecret
      const res = await saveBitableConfigApi(payload)
      if (res.success !== false) {
        await fetchConfig()
      }
      return res
    } finally {
      saving.value = false
    }
  }

  async function testConnection(testEmail) {
    testing.value = true
    try {
      return await testBitableConfigApi({ testEmail })
    } finally {
      testing.value = false
    }
  }

  function generateWebhookSecret() {
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  async function fetchPendingRecords() {
    loadingPending.value = true
    try {
      const res = await getPendingRecordsApi()
      if (res.success) {
        pendingRecords.value = res.data || []
      }
      return res
    } finally {
      loadingPending.value = false
    }
  }

  async function activateRecord(recordId, email, product) {
    const res = await activateRecordApi({ recordId, email, product })
    return res
  }

  return {
    config,
    loading,
    saving,
    testing,
    pendingRecords,
    loadingPending,
    fetchConfig,
    saveConfig,
    testConnection,
    generateWebhookSecret,
    fetchPendingRecords,
    activateRecord
  }
})
