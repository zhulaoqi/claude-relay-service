<template>
  <div class="space-y-4 p-1 sm:p-2">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">飞书多维表格接入</h2>
      <span
        class="rounded-full px-3 py-1 text-xs font-medium"
        :class="
          bitableStore.config.enabled
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
        "
      >
        {{ bitableStore.config.enabled ? '已启用' : '未启用' }}
      </span>
    </div>

    <!-- Tab Nav -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="-mb-px flex space-x-6">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="[
            'flex items-center gap-1.5 border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
            activeTab === tab.key
              ? 'border-[var(--primary-color)] text-[var(--primary-color)]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          ]"
          @click="activeTab = tab.key"
        >
          <i class="text-xs" :class="tab.icon" />
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab: 接入控制 -->
    <div v-if="activeTab === 'access'" class="space-y-4">
      <div class="glass-strong rounded-xl p-5">
        <table class="w-full">
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr>
              <td class="w-48 py-4 pr-6 align-top">
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)]"
                  >
                    <i class="fas fa-power-off text-sm text-white" />
                  </div>
                  <div>
                    <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      功能开关
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      启用后飞书推送才会被处理
                    </div>
                  </div>
                </div>
              </td>
              <td class="py-4"><el-switch v-model="form.enabled" /></td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)]"
                  >
                    <i class="fas fa-lock text-sm text-white" />
                  </div>
                  <div>
                    <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Webhook 密钥
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      填入飞书自动化 HTTP 请求 Header：X-Webhook-Secret
                    </div>
                  </div>
                </div>
              </td>
              <td class="py-4">
                <div class="flex max-w-md items-center gap-2">
                  <input
                    v-model="form.webhookSecret"
                    class="form-input flex-1"
                    placeholder="点击「生成」自动生成随机密钥"
                    type="text"
                  />
                  <button class="btn btn-primary shrink-0 text-sm" @click="generateSecret">
                    <i class="fas fa-sync-alt mr-1" />生成
                  </button>
                  <button class="btn shrink-0 text-sm" @click="copySecret">
                    <i class="fas fa-copy mr-1" />复制
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: 默认配置 -->
    <div v-if="activeTab === 'defaults'" class="space-y-4">
      <div class="glass-strong rounded-xl p-5">
        <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
          当飞书表格对应字段为空时使用以下默认值
        </p>
        <table class="w-full">
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr>
              <td class="w-44 py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">默认权限</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">空 = 全部服务</div>
              </td>
              <td class="py-4">
                <el-select
                  v-model="form.defaultPermissions"
                  class="max-w-xs"
                  multiple
                  placeholder="空=全部"
                >
                  <el-option label="claude" value="claude" />
                  <el-option label="gemini" value="gemini" />
                  <el-option label="openai" value="openai" />
                </el-select>
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  默认并发限制
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">0 = 不限</div>
              </td>
              <td class="py-4">
                <el-input-number v-model="form.defaultConcurrencyLimit" class="max-w-xs" :min="0" />
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  默认每日限额
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">美元，0 = 不限</div>
              </td>
              <td class="py-4">
                <el-input-number
                  v-model="form.defaultDailyCostLimit"
                  class="max-w-xs"
                  :min="0"
                  :precision="2"
                  :step="0.5"
                />
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  默认有效天数
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">0 = 永久</div>
              </td>
              <td class="py-4">
                <el-input-number v-model="form.defaultExpirationDays" class="max-w-xs" :min="0" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: 通知设置 -->
    <div v-if="activeTab === 'notify'" class="space-y-4">
      <div class="glass-strong rounded-xl p-5">
        <table class="w-full">
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr>
              <td class="w-44 py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">App ID</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">飞书开放平台应用标识</div>
              </td>
              <td class="py-4">
                <input
                  v-model="form.feishuAppId"
                  class="form-input max-w-md"
                  placeholder="cli_xxxxxxxxxx"
                />
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">App Secret</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {{
                    bitableStore.config.feishuAppSecretConfigured
                      ? '已配置（不显示明文）'
                      : '未配置'
                  }}
                </div>
              </td>
              <td class="py-4">
                <div class="flex max-w-md items-center gap-2">
                  <input
                    v-model="newAppSecret"
                    class="form-input flex-1"
                    :placeholder="
                      bitableStore.config.feishuAppSecretConfigured
                        ? '留空保留现有密钥'
                        : '请输入 App Secret'
                    "
                    :type="showSecret ? 'text' : 'password'"
                  />
                  <button class="btn shrink-0" @click="showSecret = !showSecret">
                    <i :class="showSecret ? 'fas fa-eye-slash' : 'fas fa-eye'" />
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  默认收件人邮箱
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  表格未填 recipientEmail 时使用
                </div>
              </td>
              <td class="py-4">
                <input
                  v-model="form.defaultRecipientEmail"
                  class="form-input max-w-md"
                  placeholder="admin@company.com"
                />
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">通知规则</div>
              </td>
              <td class="space-y-2 py-4">
                <div class="flex items-center gap-3">
                  <el-switch v-model="form.notifyOnSuccess" />
                  <span class="text-sm text-gray-600 dark:text-gray-300">创建成功时通知</span>
                </div>
                <div class="flex items-center gap-3">
                  <el-switch v-model="form.notifyOnFailure" />
                  <span class="text-sm text-gray-600 dark:text-gray-300">创建失败时通知</span>
                </div>
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">连通性测试</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">发一条测试消息验证配置</div>
              </td>
              <td class="py-4">
                <div class="flex max-w-md items-center gap-2">
                  <input
                    v-model="testEmail"
                    class="form-input flex-1"
                    placeholder="输入接收测试消息的飞书邮箱"
                  />
                  <button
                    class="btn btn-primary shrink-0 text-sm"
                    :disabled="bitableStore.testing"
                    @click="handleTest"
                  >
                    <i class="fas fa-paper-plane mr-1" />
                    {{ bitableStore.testing ? '发送中...' : '测试' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: 接入说明 -->
    <div v-if="activeTab === 'guide'" class="space-y-4">
      <div class="glass-strong space-y-5 rounded-xl p-5">
        <div>
          <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <span
              class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-xs text-white"
              >1</span
            >
            飞书多维表格添加以下字段
          </h4>
          <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full text-xs">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                    字段名
                  </th>
                  <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                    类型
                  </th>
                  <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                    说明
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr v-for="field in tableFields" :key="field.name">
                  <td class="px-4 py-2 font-mono text-[var(--primary-color)]">{{ field.name }}</td>
                  <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ field.type }}</td>
                  <td class="px-4 py-2 text-gray-500 dark:text-gray-400">{{ field.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <span
              class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-xs text-white"
              >2</span
            >
            创建自动化流程
          </h4>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            多维表格 → 自动化 → 新建 → 触发条件选「添加记录时」，并勾选「name
            字段不为空」，执行操作选「发送 HTTP 请求」。
          </p>
        </div>
        <div>
          <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <span
              class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-xs text-white"
              >3</span
            >
            HTTP 请求配置
          </h4>
          <div class="space-y-2 rounded-lg bg-gray-50 p-4 font-mono text-xs dark:bg-gray-900">
            <div>
              <span class="text-gray-500">方法：</span
              ><span class="text-green-600 dark:text-green-400">POST</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-500">URL：</span>
              <span class="break-all text-blue-600 dark:text-blue-400">{{ webhookUrl }}</span>
              <button class="text-gray-400 hover:text-gray-600" @click="copyWebhookUrl">
                <i class="fas fa-copy text-xs" />
              </button>
            </div>
            <div>
              <span class="text-gray-500">Headers：</span>
              <div class="ml-4 mt-1 space-y-1">
                <div>
                  <span class="text-purple-600 dark:text-purple-400">Content-Type</span>:
                  application/json
                </div>
                <div class="flex items-center gap-2">
                  <span
                    ><span class="text-purple-600 dark:text-purple-400">X-Webhook-Secret</span>:
                    {{ maskedSecret }}</span
                  >
                  <button class="text-gray-400 hover:text-gray-600" @click="copySecret">
                    <i class="fas fa-copy text-xs" />
                  </button>
                </div>
              </div>
            </div>
            <div>
              <span class="text-gray-500">Body（JSON，引用表格字段）：</span>
              <pre class="mt-1 text-xs text-gray-700 dark:text-gray-300">{{ bodyExample }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer actions (not shown on guide tab) -->
    <div v-if="activeTab !== 'guide'" class="flex justify-end gap-3 pt-2">
      <button class="btn text-sm" @click="resetForm">取消</button>
      <button class="btn btn-primary text-sm" :disabled="bitableStore.saving" @click="handleSave">
        <i class="fas fa-save mr-1" />
        {{ bitableStore.saving ? '保存中...' : '保 存' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useBitableStore } from '@/stores/bitable'
import { showToast } from '@/utils/tools'

const bitableStore = useBitableStore()
const activeTab = ref('access')
const showSecret = ref(false)
const newAppSecret = ref('')
const testEmail = ref('')

const tabs = [
  { key: 'access', label: '接入控制', icon: 'fas fa-shield-alt' },
  { key: 'defaults', label: '默认配置', icon: 'fas fa-sliders-h' },
  { key: 'notify', label: '通知设置', icon: 'fas fa-bell' },
  { key: 'guide', label: '接入说明', icon: 'fas fa-book' }
]

const tableFields = [
  { name: 'name', type: '文本', desc: 'Key 名称，必填' },
  { name: 'description', type: '文本', desc: '备注（可选）' },
  { name: 'permissions', type: '多选', desc: 'claude/gemini/openai，空=全部' },
  { name: 'concurrencyLimit', type: '数字', desc: '并发限制，0=不限（可选）' },
  { name: 'dailyCostLimit', type: '数字', desc: '每日费用上限美元，0=不限（可选）' },
  { name: 'expiresAt', type: '日期', desc: '过期时间，空=永久（可选）' },
  { name: 'recipientEmail', type: '文本', desc: '通知收件人飞书邮箱（可选，空用默认）' }
]

const form = reactive({
  enabled: false,
  webhookSecret: '',
  feishuAppId: '',
  notifyOnSuccess: true,
  notifyOnFailure: true,
  defaultRecipientEmail: '',
  defaultPermissions: [],
  defaultConcurrencyLimit: 0,
  defaultDailyCostLimit: 0,
  defaultExpirationDays: 0
})

const webhookUrl = computed(() => `${window.location.origin}/webhook/bitable/apikey-create`)
const maskedSecret = computed(() => {
  const s = form.webhookSecret
  if (!s) return '（未配置）'
  return s.length > 8 ? `${s.slice(0, 4)}${'•'.repeat(s.length - 8)}${s.slice(-4)}` : '••••••••'
})
const bodyExample = computed(() =>
  JSON.stringify(
    {
      name: '{{name字段}}',
      description: '{{description字段}}',
      permissions: '{{permissions字段}}',
      concurrencyLimit: '{{concurrencyLimit字段}}',
      dailyCostLimit: '{{dailyCostLimit字段}}',
      expiresAt: '{{expiresAt字段}}',
      recipientEmail: '{{recipientEmail字段}}'
    },
    null,
    2
  )
)

onMounted(async () => {
  await bitableStore.fetchConfig()
  syncFormFromStore()
})

function syncFormFromStore() {
  const c = bitableStore.config
  Object.assign(form, {
    enabled: c.enabled,
    webhookSecret: c.webhookSecret || '',
    feishuAppId: c.feishuAppId || '',
    notifyOnSuccess: c.notifyOnSuccess,
    notifyOnFailure: c.notifyOnFailure,
    defaultRecipientEmail: c.defaultRecipientEmail || '',
    defaultPermissions: c.defaultPermissions || [],
    defaultConcurrencyLimit: c.defaultConcurrencyLimit || 0,
    defaultDailyCostLimit: c.defaultDailyCostLimit || 0,
    defaultExpirationDays: c.defaultExpirationDays || 0
  })
}

function resetForm() {
  syncFormFromStore()
  newAppSecret.value = ''
  showToast('已重置为保存的配置', 'info')
}

function generateSecret() {
  form.webhookSecret = bitableStore.generateWebhookSecret()
  showToast('已生成新密钥，保存后复制到飞书自动化配置', 'success')
}

async function copySecret() {
  if (!form.webhookSecret) return showToast('请先配置或生成密钥', 'warning')
  await navigator.clipboard.writeText(form.webhookSecret)
  showToast('密钥已复制', 'success')
}

async function copyWebhookUrl() {
  await navigator.clipboard.writeText(webhookUrl.value)
  showToast('Webhook URL 已复制', 'success')
}

async function handleSave() {
  const res = await bitableStore.saveConfig(form, newAppSecret.value || undefined)
  if (res?.success !== false) {
    newAppSecret.value = ''
    showToast('配置已保存', 'success')
  } else {
    showToast(res?.message || '保存失败', 'error')
  }
}

async function handleTest() {
  if (!testEmail.value) return showToast('请输入测试邮箱', 'warning')
  const res = await bitableStore.testConnection(testEmail.value)
  if (res?.success) {
    showToast(res.message || '测试消息已发送', 'success')
  } else {
    showToast(res?.error || '测试失败，请检查配置', 'error')
  }
}
</script>
