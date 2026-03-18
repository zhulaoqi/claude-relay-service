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
                      启用后飞书自动化 HTTP 请求才会被处理
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
                  <button
                    class="rounded-lg bg-[var(--primary-color)] px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                    @click="generateSecret"
                  >
                    <i class="fas fa-sync-alt mr-1" />生成
                  </button>
                  <button
                    class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    @click="copySecret"
                  >
                    <i class="fas fa-copy mr-1" />复制
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)]"
                  >
                    <i class="fas fa-table text-sm text-white" />
                  </div>
                  <div>
                    <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      多维表格 AppToken
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      从多维表格 URL 获取，用于读取历史数据和自动回写
                    </div>
                  </div>
                </div>
              </td>
              <td class="py-4">
                <input
                  v-model="form.bitableAppToken"
                  class="form-input max-w-md"
                  placeholder="如 GpZXbxxxxxxx"
                  type="text"
                />
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="flex items-start gap-3">
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)]"
                  >
                    <i class="fas fa-list text-sm text-white" />
                  </div>
                  <div>
                    <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      多维表格 TableId
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      从多维表格 URL 的 table= 参数获取
                    </div>
                  </div>
                </div>
              </td>
              <td class="py-4">
                <input
                  v-model="form.bitableTableId"
                  class="form-input max-w-md"
                  placeholder="如 tblXXXXXXXX"
                  type="text"
                />
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
                  <button
                    class="rounded-lg bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                    @click="showSecret = !showSecret"
                  >
                    <i :class="showSecret ? 'fas fa-eye-slash' : 'fas fa-eye'" />
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">管理员邮箱</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  每次创建 Key 时同步通知该邮箱（固定接收方）
                </div>
              </td>
              <td class="py-4">
                <input
                  v-model="form.adminEmail"
                  class="form-input max-w-md"
                  placeholder="admin@company.com"
                />
              </td>
            </tr>
            <tr>
              <td class="py-4 pr-6 align-top">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  默认收件人邮箱
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  表格未填 recipientEmail 时的兜底收件人
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
                  <span class="text-sm text-gray-600 dark:text-gray-300">创建成功时通知申请人</span>
                </div>
                <div class="flex items-center gap-3">
                  <el-switch v-model="form.notifyOnFailure" />
                  <span class="text-sm text-gray-600 dark:text-gray-300">创建失败时通知申请人</span>
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
                    class="btn btn-primary px-4 py-2 text-sm"
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
      <div class="glass-strong space-y-6 rounded-xl p-5">
        <!-- 步骤 1：创建飞书应用（通知 + 回写需要） -->
        <div>
          <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <span
              class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-xs text-white"
              >1</span
            >
            创建飞书应用（用于消息通知和表格回写）
          </h4>
          <div
            class="rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/30 dark:bg-blue-900/10"
          >
            <p class="mb-2 text-xs text-blue-700 dark:text-blue-300">
              <i class="fas fa-info-circle mr-1" />
              如果不需要飞书消息通知和表格回写，可跳过此步骤，直接从步骤 2 开始。
            </p>
          </div>
          <ol
            class="mt-3 list-inside space-y-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400"
          >
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">a.</span>
              进入
              <a
                class="text-blue-600 underline dark:text-blue-400"
                href="https://open.feishu.cn/app"
                target="_blank"
                >飞书开放平台</a
              >
              → 创建企业自建应用 → 记录
              <span class="font-mono text-gray-700 dark:text-gray-200">App ID</span> 和
              <span class="font-mono text-gray-700 dark:text-gray-200">App Secret</span>
              填入本页「通知设置」Tab
            </li>
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">b.</span>
              左侧菜单「添加应用能力」→ 开启
              <strong class="text-gray-700 dark:text-gray-200">机器人</strong> 能力
            </li>
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">c.</span>
              「权限管理」中开启以下权限并发布应用版本：
            </li>
          </ol>
          <div class="ml-5 mt-2 space-y-1">
            <div
              class="inline-flex items-center gap-2 rounded bg-gray-100 px-2.5 py-1 text-xs dark:bg-gray-800"
            >
              <span class="font-mono text-gray-700 dark:text-gray-200">im:message:send_as_bot</span>
              <span class="text-gray-400">— 以机器人身份发送消息</span>
            </div>
            <div
              class="inline-flex items-center gap-2 rounded bg-gray-100 px-2.5 py-1 text-xs dark:bg-gray-800"
            >
              <span class="font-mono text-gray-700 dark:text-gray-200">bitable:record</span>
              <span class="text-gray-400">— 读写多维表格记录（回写用）</span>
            </div>
          </div>
        </div>

        <!-- 步骤 2：准备多维表格 -->
        <div>
          <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <span
              class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-xs text-white"
              >2</span
            >
            准备多维表格
          </h4>
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            下表展示了 HTTP Body
            中各字段与多维表格列的对应关系。已有列直接复用，标注「可选新增列」的按需添加：
          </p>
          <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full text-xs">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                    HTTP 字段名
                  </th>
                  <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                    对应表格列
                  </th>
                  <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                    必填
                  </th>
                  <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                    说明
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr v-for="field in tableFields" :key="field.name">
                  <td class="px-4 py-2 font-mono text-[var(--primary-color)]">{{ field.name }}</td>
                  <td class="px-4 py-2 text-gray-600 dark:text-gray-300">{{ field.colName }}</td>
                  <td class="px-4 py-2">
                    <span
                      v-if="field.required"
                      class="rounded-full bg-red-100 px-2 py-0.5 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      >必填</span
                    >
                    <span v-else class="text-gray-400">可选</span>
                  </td>
                  <td class="px-4 py-2 text-gray-500 dark:text-gray-400">{{ field.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-3 space-y-1 text-xs text-gray-400 dark:text-gray-500">
            <p>
              <i class="fas fa-lightbulb mr-1 text-yellow-500" />
              「序号」「申请日期」「职务」「申请人部门」等列为表格管理用，无需传入 HTTP 请求
            </p>
            <p>
              <i class="fas fa-lightbulb mr-1 text-yellow-500" />
              回写功能需要表格中有「<strong class="text-gray-600 dark:text-gray-300"
                >开通情况</strong
              >」（复选框类型）和「<strong class="text-gray-600 dark:text-gray-300"
                >开通账号信息</strong
              >」（文本类型）两列
            </p>
          </div>
        </div>

        <!-- 步骤 3：创建自动化流程 -->
        <div>
          <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <span
              class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-xs text-white"
              >3</span
            >
            创建多维表格自动化流程
          </h4>
          <ol
            class="list-inside space-y-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400"
          >
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">a.</span>
              打开多维表格，点击右上角
              <strong class="text-gray-700 dark:text-gray-200">「自动化」</strong> 按钮 →
              <strong class="text-gray-700 dark:text-gray-200">「+ 创建自动化流程」</strong>
            </li>
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">b.</span>
              <strong class="text-gray-700 dark:text-gray-200">触发条件</strong>：选择
              <strong class="text-gray-700 dark:text-gray-200"
                >「当满足以下条件的记录被添加到数据表时」</strong
              >，可设置筛选条件（如 name 字段不为空），避免空行误触发
            </li>
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">c.</span>
              <strong class="text-gray-700 dark:text-gray-200">执行操作</strong>：选择
              <strong class="text-gray-700 dark:text-gray-200">「发送 HTTP 请求」</strong>
            </li>
          </ol>
        </div>

        <!-- 步骤 4：HTTP 请求配置 -->
        <div>
          <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <span
              class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-xs text-white"
              >4</span
            >
            配置 HTTP 请求参数
          </h4>
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            在「发送 HTTP 请求」操作中，按以下方式填写各项参数：
          </p>
          <div class="space-y-3 rounded-lg bg-gray-50 p-4 text-xs dark:bg-gray-900">
            <!-- 请求方法 -->
            <div class="flex items-start gap-3">
              <span
                class="mt-0.5 shrink-0 rounded bg-green-100 px-2 py-0.5 font-mono font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400"
                >POST</span
              >
              <div>
                <div class="font-medium text-gray-700 dark:text-gray-200">请求方法</div>
                <div class="text-gray-400">选择 POST</div>
              </div>
            </div>
            <!-- URL -->
            <div>
              <div class="mb-1 font-medium text-gray-700 dark:text-gray-200">请求 URL</div>
              <div
                class="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
              >
                <span class="break-all font-mono text-blue-600 dark:text-blue-400">{{
                  webhookUrl
                }}</span>
                <button
                  class="shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                  title="复制 URL"
                  @click="copyWebhookUrl"
                >
                  <i class="fas fa-copy" />
                </button>
              </div>
            </div>
            <!-- Headers -->
            <div>
              <div class="mb-1 font-medium text-gray-700 dark:text-gray-200">请求头（Headers）</div>
              <div
                class="space-y-1 rounded border border-gray-200 bg-white p-3 font-mono dark:border-gray-700 dark:bg-gray-800"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-purple-600 dark:text-purple-400">Content-Type</span>
                    <span class="mx-1 text-gray-400">:</span>
                    <span class="text-gray-700 dark:text-gray-300">application/json</span>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-purple-600 dark:text-purple-400">X-Webhook-Secret</span>
                    <span class="mx-1 text-gray-400">:</span>
                    <span class="text-gray-700 dark:text-gray-300">{{ maskedSecret }}</span>
                  </div>
                  <button
                    class="shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                    title="复制密钥"
                    @click="copySecret"
                  >
                    <i class="fas fa-copy" />
                  </button>
                </div>
              </div>
              <p class="mt-1 text-gray-400 dark:text-gray-500">
                <i class="fas fa-exclamation-triangle mr-1 text-yellow-500" />
                请先在「接入控制」Tab 生成并保存 Webhook 密钥
              </p>
            </div>
            <!-- Body -->
            <div>
              <div class="mb-1 font-medium text-gray-700 dark:text-gray-200">
                请求体（Body） —
                <span class="font-normal text-gray-500 dark:text-gray-400"
                  >选择 raw / JSON 格式</span
                >
              </div>
              <!-- 最简配置 -->
              <div class="mb-2">
                <div class="mb-1 flex items-center gap-2">
                  <span
                    class="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    >最简配置</span
                  >
                  <span class="text-xs text-gray-400">只传邮箱，其余使用默认值</span>
                </div>
                <div
                  class="rounded border border-green-200 bg-white p-3 dark:border-green-900/40 dark:bg-gray-800"
                >
                  <pre class="whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300">{{
                    bodyExampleMinimal
                  }}</pre>
                </div>
              </div>
              <!-- 完整配置 -->
              <div>
                <div class="mb-1 flex items-center gap-2">
                  <span
                    class="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                    >完整配置</span
                  >
                  <span class="text-xs text-gray-400">自定义权限、回写等字段</span>
                </div>
                <div
                  class="rounded border border-blue-200 bg-white p-3 dark:border-blue-900/40 dark:bg-gray-800"
                >
                  <pre class="whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300">{{
                    bodyExampleFull
                  }}</pre>
                </div>
              </div>
              <!-- 自动解析说明 -->
              <div
                class="mt-3 rounded-lg border border-green-100 bg-green-50/50 p-3 dark:border-green-900/30 dark:bg-green-900/10"
              >
                <p class="mb-1.5 text-xs font-medium text-green-800 dark:text-green-200">
                  <i class="fas fa-bolt mr-1" />
                  智能解析逻辑：
                </p>
                <ul class="space-y-1 text-xs leading-relaxed text-green-700 dark:text-green-300">
                  <li>
                    <i class="fas fa-check mr-1.5 text-green-500" />
                    <span class="font-semibold">product = Claude Code（或为空）</span
                    >：从邮箱提取用户名作为 Key 名称，创建 API Key 并通知
                  </li>
                  <li>
                    <i class="fas fa-check mr-1.5 text-green-500" />
                    <span class="font-semibold">product = Cursor</span>：自动创建飞书公共邮箱（如
                    <span class="font-mono">cursor-kinch.zhu@domain.com</span
                    >），添加申请人为成员，并提醒管理员开启 IMAP
                  </li>
                  <li>
                    <i class="fas fa-check mr-1.5 text-green-500" />
                    <span class="font-mono">name</span>
                    传入邮箱时，自动将该邮箱用于飞书消息通知的收件人
                  </li>
                  <li>
                    <i class="fas fa-check mr-1.5 text-green-500" />
                    未传入的字段自动使用「默认配置」Tab 中的值（权限、并发、费用限制等）
                  </li>
                </ul>
              </div>
              <!-- 引用字段操作说明 -->
              <div
                class="mt-2 rounded-lg border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10"
              >
                <p class="mb-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                  <i class="fas fa-magic mr-1" />
                  如何引用表格字段值：
                </p>
                <ol
                  class="list-inside space-y-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300"
                >
                  <li>
                    在飞书自动化的请求体编辑器中，将光标定位到 JSON 值的引号之间（如
                    <span class="font-mono">"name": "<strong>这里</strong>"</span>）
                  </li>
                  <li>
                    点击输入框右侧的
                    <strong>「+」</strong> 按钮，或直接输入
                    <strong>「/」</strong>
                  </li>
                  <li>从弹出的下拉列表中选择表格列（如选择「申请人工作邮箱」列）</li>
                  <li>运行时，变量会自动替换为当前行记录的实际值</li>
                </ol>
                <p class="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <i class="fas fa-info-circle mr-1" />
                  Body 示例中用
                  <span class="font-mono font-semibold">{{ fieldRefExample }}</span>
                  表示引用表格列，实际在编辑器中会显示为蓝色标签
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤 5：回写说明 -->
        <div>
          <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <span
              class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-xs text-white"
              >5</span
            >
            自动回写多维表格（可选）
          </h4>
          <p class="mb-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            若请求体中传入了
            <span class="font-mono font-semibold text-gray-700 dark:text-gray-200">appToken</span
            >、<span class="font-mono font-semibold text-gray-700 dark:text-gray-200">tableId</span
            >、<span class="font-mono font-semibold text-gray-700 dark:text-gray-200"
              >recordId</span
            >
            三个参数，创建成功后系统会自动将结果回写到对应记录行：
          </p>
          <div class="ml-1 space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <div class="flex items-start gap-2">
              <i class="fas fa-check-circle mt-0.5 text-green-500" />
              <span
                >将
                <span class="font-mono font-semibold text-gray-700 dark:text-gray-200"
                  >开通情况</span
                >
                字段设为
                <span class="font-semibold text-green-600">true</span></span
              >
            </div>
            <div class="flex items-start gap-2">
              <i class="fas fa-check-circle mt-0.5 text-green-500" />
              <span
                ><strong>Claude Code</strong>：将
                <span class="font-mono font-semibold text-gray-700 dark:text-gray-200"
                  >开通账号信息</span
                >
                字段填入生成的 API Key</span
              >
            </div>
            <div class="flex items-start gap-2">
              <i class="fas fa-check-circle mt-0.5 text-green-500" />
              <span
                ><strong>Cursor</strong>：将
                <span class="font-mono font-semibold text-gray-700 dark:text-gray-200"
                  >开通账号信息</span
                >
                字段填入公共邮箱地址 + IMAP 开启提醒</span
              >
            </div>
          </div>
          <div
            class="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <p class="mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
              如何获取这三个参数：
            </p>
            <ul class="space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <li>
                <span class="font-mono text-gray-700 dark:text-gray-200">appToken</span> — 多维表格
                URL 中
                <span class="font-mono text-gray-600 dark:text-gray-300"
                  >feishu.cn/base/<strong class="text-[var(--primary-color)]">GpZXbxxxxxxx</strong
                  >?table=...</span
                >
                的加粗部分
              </li>
              <li>
                <span class="font-mono text-gray-700 dark:text-gray-200">tableId</span> — 多维表格
                URL 中
                <span class="font-mono text-gray-600 dark:text-gray-300"
                  >...?table=<strong class="text-[var(--primary-color)]">tblXXXXXXXX</strong
                  >&view=...</span
                >
                的加粗部分
              </li>
              <li>
                <span class="font-mono text-gray-700 dark:text-gray-200">recordId</span> —
                在自动化请求体编辑器中，点击
                <strong class="text-gray-700 dark:text-gray-200">「+」</strong>
                → 选择系统字段
                <strong class="text-gray-700 dark:text-gray-200">「记录ID」</strong>
                作为动态变量
              </li>
            </ul>
          </div>
          <div
            class="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 p-2.5 dark:border-blue-900/30 dark:bg-blue-900/10"
          >
            <p class="text-xs text-blue-700 dark:text-blue-300">
              <i class="fas fa-shield-alt mr-1" />
              回写功能需要飞书应用拥有该多维表格的
              <strong>编辑权限</strong
              >。请在飞书多维表格的「...」→「更多」→「添加协作者」中将应用机器人添加为编辑者。
            </p>
          </div>
        </div>

        <!-- 步骤 6：保存并测试 -->
        <div>
          <h4 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <span
              class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-xs text-white"
              >6</span
            >
            保存并测试
          </h4>
          <ol
            class="list-inside space-y-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400"
          >
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">a.</span>
              点击自动化流程右上角的
              <strong class="text-gray-700 dark:text-gray-200">「保存并启用」</strong>
            </li>
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">b.</span>
              在多维表格中新增一行测试数据，观察自动化是否成功触发
            </li>
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">c.</span>
              点击「自动化」→「管理」→「运行日志」查看执行结果和错误详情
            </li>
            <li>
              <span class="mr-1 font-medium text-gray-600 dark:text-gray-300">d.</span>
              若配置了飞书通知，可在「通知设置」Tab 使用连通性测试验证消息发送是否正常
            </li>
          </ol>
        </div>
      </div>
    </div>

    <!-- Tab: 待开通列表 -->
    <div v-if="activeTab === 'pending'" class="space-y-4">
      <div class="glass-strong rounded-xl p-5">
        <!-- Header bar -->
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">未开通人员列表</h3>
            <span
              v-if="bitableStore.pendingRecords.length > 0"
              class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              共 {{ pendingStats.total }} 条
            </span>
            <span
              v-if="pendingStats.claudeCode > 0"
              class="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            >
              Claude Code: {{ pendingStats.claudeCode }}
            </span>
            <span
              v-if="pendingStats.cursor > 0"
              class="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
            >
              Cursor: {{ pendingStats.cursor }}
            </span>
          </div>
          <button
            class="rounded-lg bg-[var(--primary-color)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            :disabled="bitableStore.loadingPending"
            @click="loadPendingRecords"
          >
            <i
              class="fas fa-sync-alt mr-1"
              :class="{ 'animate-spin': bitableStore.loadingPending }"
            />
            {{ bitableStore.loadingPending ? '加载中...' : '刷新列表' }}
          </button>
        </div>

        <!-- Empty state: not configured -->
        <div
          v-if="!form.bitableAppToken || !form.bitableTableId"
          class="flex flex-col items-center justify-center py-12 text-center"
        >
          <i class="fas fa-cog mb-3 text-3xl text-gray-300 dark:text-gray-600" />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            请先在「接入控制」Tab 中配置多维表格
            <strong>AppToken</strong> 和 <strong>TableId</strong>，然后保存
          </p>
        </div>

        <!-- Empty state: no records -->
        <div
          v-else-if="
            !bitableStore.loadingPending &&
            bitableStore.pendingRecords.length === 0 &&
            form.bitableAppToken
          "
          class="flex flex-col items-center justify-center py-12 text-center"
        >
          <i class="fas fa-check-circle mb-3 text-3xl text-green-400" />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            所有申请均已开通，或尚未加载数据（点击「刷新列表」）
          </p>
        </div>

        <!-- Loading skeleton -->
        <div v-else-if="bitableStore.loadingPending" class="space-y-3">
          <div
            v-for="i in 5"
            :key="i"
            class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700"
          />
        </div>

        <!-- Table -->
        <div
          v-else-if="bitableStore.pendingRecords.length > 0"
          class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800">
                <th
                  class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  #
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  申请人
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  工作邮箱
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  申请产品
                </th>
                <th
                  class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr
                v-for="(record, idx) in bitableStore.pendingRecords"
                :key="record.recordId"
                :class="{
                  'bg-green-50/50 dark:bg-green-900/10': activatedIds.has(record.recordId)
                }"
              >
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ idx + 1 }}</td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-200">
                  {{ record.applicant || '—' }}
                </td>
                <td class="px-4 py-3">
                  <span class="font-mono text-xs text-gray-600 dark:text-gray-300">
                    {{ record.email || '—' }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="
                      record.product && record.product.toLowerCase() === 'cursor'
                        ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    "
                  >
                    {{ record.product || 'Claude Code' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-center">
                  <button
                    v-if="!activatedIds.has(record.recordId)"
                    class="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                    :disabled="activatingIds.has(record.recordId) || !record.email"
                    @click="handleActivate(record)"
                  >
                    <i
                      class="fas mr-1"
                      :class="
                        activatingIds.has(record.recordId) ? 'fa-spinner animate-spin' : 'fa-bolt'
                      "
                    />
                    {{ activatingIds.has(record.recordId) ? '开通中...' : '一键开通' }}
                  </button>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
                  >
                    <i class="fas fa-check-circle" /> 已开通
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Footer actions (not shown on guide/pending tabs) -->
    <div
      v-if="activeTab !== 'guide' && activeTab !== 'pending'"
      class="flex justify-end gap-3 pt-2"
    >
      <button
        class="rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        @click="resetForm"
      >
        取消
      </button>
      <button
        class="btn btn-primary px-5 py-2 text-sm"
        :disabled="bitableStore.saving"
        @click="handleSave"
      >
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
  { key: 'guide', label: '接入说明', icon: 'fas fa-book' },
  { key: 'pending', label: '待开通列表', icon: 'fas fa-users-cog' }
]

const tableFields = [
  {
    name: 'name',
    colName: '申请人工作邮箱',
    required: true,
    desc: '传入邮箱，系统自动解析用户名作为 Key 名称，并用邮箱发送通知'
  },
  {
    name: 'product',
    colName: '申请产品',
    required: false,
    desc: 'Claude Code 或 Cursor，空=Claude Code。Cursor 会创建飞书公共邮箱'
  },
  {
    name: 'description',
    colName: 'AI 用途',
    required: false,
    desc: 'API Key 备注说明（仅 Claude Code 生效）'
  },
  {
    name: 'permissions',
    colName: '服务权限',
    required: false,
    desc: 'claude / gemini / openai，空=使用默认配置（仅 Claude Code 生效）'
  },
  {
    name: 'concurrencyLimit',
    colName: 'AI 限制',
    required: false,
    desc: '并发数，不填=使用默认配置（仅 Claude Code 生效）'
  },
  {
    name: 'dailyCostLimit',
    colName: '—',
    required: false,
    desc: '每日费用上限（美元），不填=使用默认配置（仅 Claude Code 生效）'
  },
  {
    name: 'expiresAt',
    colName: '—',
    required: false,
    desc: '过期日期，不填=使用默认配置（仅 Claude Code 生效）'
  },
  {
    name: 'appToken',
    colName: '— 固定值',
    required: false,
    desc: '从多维表格 URL 获取，用于回写'
  },
  {
    name: 'tableId',
    colName: '— 固定值',
    required: false,
    desc: '从多维表格 URL 获取，用于回写'
  },
  {
    name: 'recordId',
    colName: '— 动态变量',
    required: false,
    desc: '引用自动化系统变量「记录ID」，用于回写'
  }
]

const form = reactive({
  enabled: false,
  webhookSecret: '',
  feishuAppId: '',
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

const activatingIds = ref(new Set())
const activatedIds = ref(new Set())

const webhookUrl = computed(() => `${window.location.origin}/webhook/bitable/apikey-create`)

const maskedSecret = computed(() => {
  const s = form.webhookSecret
  if (!s) return '（未配置）'
  return s.length > 8 ? `${s.slice(0, 4)}${'*'.repeat(s.length - 8)}${s.slice(-4)}` : '********'
})

const fieldRefExample = computed(() => '\u007B\u007B申请人\u007D\u007D')

const bodyExampleMinimal = computed(() =>
  JSON.stringify(
    {
      name: '{{申请人工作邮箱}}',
      product: '{{申请产品}}'
    },
    null,
    2
  )
)

const bodyExampleFull = computed(() =>
  JSON.stringify(
    {
      name: '{{申请人工作邮箱}}',
      product: '{{申请产品}}',
      description: '{{AI 用途}}',
      permissions: '{{服务权限}}',
      appToken: 'GpZXbxxxxxxx',
      tableId: 'tblXXXXXXXX',
      recordId: '{{记录ID}}'
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
    bitableAppToken: c.bitableAppToken || '',
    bitableTableId: c.bitableTableId || '',
    notifyOnSuccess: c.notifyOnSuccess,
    notifyOnFailure: c.notifyOnFailure,
    adminEmail: c.adminEmail || 'ricardo.zhang@eclicktech.com.cn',
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
  showToast('已生成新密钥，请保存后复制到飞书自动化配置', 'success')
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

async function loadPendingRecords() {
  activatingIds.value.clear()
  activatedIds.value.clear()
  const res = await bitableStore.fetchPendingRecords()
  if (res?.error) {
    showToast(res.error, 'error')
  }
}

const pendingStats = computed(() => {
  const records = bitableStore.pendingRecords
  const claudeCode = records.filter(
    (r) => !r.product || r.product.toLowerCase().includes('claude')
  ).length
  const cursor = records.filter((r) => r.product && r.product.toLowerCase() === 'cursor').length
  return { total: records.length, claudeCode, cursor }
})

async function handleActivate(record) {
  if (activatingIds.value.has(record.recordId) || activatedIds.value.has(record.recordId)) return
  activatingIds.value.add(record.recordId)
  try {
    const res = await bitableStore.activateRecord(record.recordId, record.email, record.product)
    if (res?.success) {
      activatedIds.value.add(record.recordId)
      showToast(`${record.email} 开通成功`, 'success')
    } else {
      showToast(res?.error || '开通失败', 'error')
    }
  } catch {
    showToast('开通请求失败', 'error')
  } finally {
    activatingIds.value.delete(record.recordId)
  }
}
</script>
