/**
 * TodoList API 接口测试脚本
 * 
 * 使用方法：
 *   node scripts/test-api.js
 * 
 * 确保开发服务器正在运行（npm run dev）
 */

const http = require('http')

const BASE_URL = process.env.API_URL || 'http://localhost:3000'
const urlObj = new URL(BASE_URL)

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(type, message) {
  const icons = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    test: `${colors.cyan}▶${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`
  }
  console.log(`${icons[type] || '•'} ${message}`)
}

function logSection(title) {
  console.log(`\n${colors.yellow}━━━ ${title} ━━━${colors.reset}\n`)
}

/**
 * 发送 HTTP 请求
 */
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data)
          resolve({ status: res.statusCode, data: jsonData })
        } catch (e) {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (body) {
      req.write(JSON.stringify(body))
    }
    
    req.end()
  })
}

/**
 * 断言函数
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

// 存储测试过程中创建的任务 ID
let createdTaskId = null
let createdSubtaskId = null

/**
 * 测试用例
 */
const tests = [
  // ==================== GET /api/tasks ====================
  {
    name: 'GET /api/tasks - 获取所有任务',
    run: async () => {
      const { status, data } = await request('GET', '/api/tasks')
      
      assert(status === 200, `期望状态码 200，实际 ${status}`)
      assert(data.success === true, '期望 success 为 true')
      assert(Array.isArray(data.data), '期望 data 是数组')
      
      return `返回 ${data.data.length} 条任务`
    }
  },

  // ==================== POST /api/tasks ====================
  {
    name: 'POST /api/tasks - 创建新任务',
    run: async () => {
      const { status, data } = await request('POST', '/api/tasks', {
        title: '测试任务 ' + Date.now(),
        description: '这是一个测试任务',
        priority: 'high'
      })
      
      assert(status === 201, `期望状态码 201，实际 ${status}`)
      assert(data.success === true, '期望 success 为 true')
      assert(data.data.id, '期望返回任务 ID')
      assert(data.data.status === 'pending', '期望默认状态为 pending')
      assert(data.data.priority === 'high', '期望优先级为 high')
      
      createdTaskId = data.data.id
      return `创建任务 ID: ${createdTaskId}`
    }
  },

  {
    name: 'POST /api/tasks - 创建任务（缺少 title）',
    run: async () => {
      const { status, data } = await request('POST', '/api/tasks', {
        description: '没有标题的任务'
      })
      
      assert(status === 400, `期望状态码 400，实际 ${status}`)
      assert(data.success === false, '期望 success 为 false')
      assert(data.error, '期望有错误信息')
      
      return `正确返回错误: ${data.error}`
    }
  },

  {
    name: 'POST /api/tasks - 创建任务（无效的 status）',
    run: async () => {
      const { status, data } = await request('POST', '/api/tasks', {
        title: '测试任务',
        status: 'invalid_status'
      })
      
      assert(status === 400, `期望状态码 400，实际 ${status}`)
      assert(data.success === false, '期望 success 为 false')
      
      return `正确返回错误: ${data.error}`
    }
  },

  {
    name: 'POST /api/tasks - 创建子任务',
    run: async () => {
      if (!createdTaskId) {
        return '跳过：没有父任务 ID'
      }
      
      const { status, data } = await request('POST', '/api/tasks', {
        title: '子任务 ' + Date.now(),
        parent_id: createdTaskId
      })
      
      assert(status === 201, `期望状态码 201，实际 ${status}`)
      assert(data.data.parent_id === createdTaskId, '期望 parent_id 正确')
      
      createdSubtaskId = data.data.id
      return `创建子任务 ID: ${createdSubtaskId}, 父任务: ${createdTaskId}`
    }
  },

  // ==================== GET /api/tasks/[id] ====================
  {
    name: 'GET /api/tasks/:id - 获取单个任务（包含子任务）',
    run: async () => {
      if (!createdTaskId) {
        return '跳过：没有任务 ID'
      }
      
      const { status, data } = await request('GET', `/api/tasks/${createdTaskId}`)
      
      assert(status === 200, `期望状态码 200，实际 ${status}`)
      assert(data.success === true, '期望 success 为 true')
      assert(data.data.id === createdTaskId, '期望返回正确的任务')
      assert(Array.isArray(data.data.subtasks), '期望包含 subtasks 数组')
      
      return `任务: ${data.data.title}, 子任务数: ${data.data.subtasks.length}`
    }
  },

  {
    name: 'GET /api/tasks/:id - 获取不存在的任务',
    run: async () => {
      const { status, data } = await request('GET', '/api/tasks/999999999')
      
      assert(status === 404, `期望状态码 404，实际 ${status}`)
      assert(data.success === false, '期望 success 为 false')
      
      return `正确返回 404`
    }
  },

  {
    name: 'GET /api/tasks/:id - 无效的 ID 格式',
    run: async () => {
      const { status, data } = await request('GET', '/api/tasks/abc')
      
      assert(status === 400, `期望状态码 400，实际 ${status}`)
      assert(data.success === false, '期望 success 为 false')
      
      return `正确返回错误: ${data.error}`
    }
  },

  // ==================== PATCH /api/tasks/[id] ====================
  {
    name: 'PATCH /api/tasks/:id - 更新任务状态',
    run: async () => {
      if (!createdTaskId) {
        return '跳过：没有任务 ID'
      }
      
      const { status, data } = await request('PATCH', `/api/tasks/${createdTaskId}`, {
        status: 'completed'
      })
      
      assert(status === 200, `期望状态码 200，实际 ${status}`)
      assert(data.success === true, '期望 success 为 true')
      assert(data.data.status === 'completed', '期望状态已更新为 completed')
      
      return `状态已更新为: ${data.data.status}`
    }
  },

  {
    name: 'PATCH /api/tasks/:id - 更新任务标题',
    run: async () => {
      if (!createdTaskId) {
        return '跳过：没有任务 ID'
      }
      
      const newTitle = '更新后的标题 ' + Date.now()
      const { status, data } = await request('PATCH', `/api/tasks/${createdTaskId}`, {
        title: newTitle
      })
      
      assert(status === 200, `期望状态码 200，实际 ${status}`)
      assert(data.data.title === newTitle, '期望标题已更新')
      
      return `标题已更新为: ${data.data.title}`
    }
  },

  {
    name: 'PATCH /api/tasks/:id - 空更新请求',
    run: async () => {
      if (!createdTaskId) {
        return '跳过：没有任务 ID'
      }
      
      const { status, data } = await request('PATCH', `/api/tasks/${createdTaskId}`, {})
      
      assert(status === 400, `期望状态码 400，实际 ${status}`)
      assert(data.success === false, '期望 success 为 false')
      
      return `正确返回错误: ${data.error}`
    }
  },

  // ==================== GET /api/tasks?status=xxx ====================
  {
    name: 'GET /api/tasks?status=completed - 筛选已完成任务',
    run: async () => {
      const { status, data } = await request('GET', '/api/tasks?status=completed')
      
      assert(status === 200, `期望状态码 200，实际 ${status}`)
      assert(data.success === true, '期望 success 为 true')
      
      // 检查所有返回的任务都是 completed
      const allCompleted = data.data.every(task => task.status === 'completed')
      assert(allCompleted, '期望所有任务状态都是 completed')
      
      return `返回 ${data.data.length} 条已完成任务`
    }
  },

  {
    name: 'GET /api/tasks?parent_id=null - 只获取顶级任务',
    run: async () => {
      const { status, data } = await request('GET', '/api/tasks?parent_id=null')
      
      assert(status === 200, `期望状态码 200，实际 ${status}`)
      
      // 检查所有返回的任务都是顶级任务
      const allTopLevel = data.data.every(task => task.parent_id === null)
      assert(allTopLevel, '期望所有任务都是顶级任务')
      
      return `返回 ${data.data.length} 条顶级任务`
    }
  },

  // ==================== POST /api/tasks/breakdown ====================
  {
    name: 'POST /api/tasks/breakdown - AI 拆解任务（通过 taskId）',
    run: async () => {
      if (!createdTaskId) {
        return '跳过：没有任务 ID'
      }
      
      const { status, data } = await request('POST', '/api/tasks/breakdown', {
        taskId: createdTaskId
      })
      
      // 如果缺少 API Key，跳过测试
      if (status === 500 && data.error && (data.error.includes('DEEPSEEK_API_KEY') || data.error.includes('not configured'))) {
        return '跳过：未配置 DEEPSEEK_API_KEY'
      }
      
      assert(status === 201, `期望状态码 201，实际 ${status}`)
      assert(data.success === true, '期望 success 为 true')
      assert(Array.isArray(data.data), '期望返回 data 数组')
      assert(data.data.length >= 3, `期望至少有 3 个子任务，实际 ${data.data.length}`)
      assert(data.data.length <= 5, `期望最多 5 个子任务，实际 ${data.data.length}`)
      
      // 更新 createdSubtaskId 为 AI 生成的第一个子任务
      if (data.data.length > 0) {
        createdSubtaskId = data.data[0].id
      }
      
      return `AI 拆解成功，生成 ${data.data.length} 个子任务`
    }
  },

  {
    name: 'POST /api/tasks/breakdown - 直接传入 taskTitle',
    run: async () => {
      const { status, data } = await request('POST', '/api/tasks/breakdown', {
        taskTitle: '学习 TypeScript'
      })
      
      // 如果缺少 API Key，跳过测试
      if (status === 500 && data.error && (data.error.includes('DEEPSEEK_API_KEY') || data.error.includes('not configured'))) {
        return '跳过：未配置 DEEPSEEK_API_KEY'
      }
      
      assert(status === 201, `期望状态码 201，实际 ${status}`)
      assert(data.success === true, '期望 success 为 true')
      assert(Array.isArray(data.data), '期望返回 data 数组')
      assert(data.data.length >= 3, `期望至少有 3 个子任务，实际 ${data.data.length}`)
      
      return `AI 拆解成功，生成 ${data.data.length} 个子任务`
    }
  },

  {
    name: 'POST /api/tasks/breakdown - 缺少参数',
    run: async () => {
      const { status, data } = await request('POST', '/api/tasks/breakdown', {})
      
      assert(status === 400, `期望状态码 400，实际 ${status}`)
      assert(data.success === false, '期望 success 为 false')
      
      return `正确返回错误: ${data.error}`
    }
  },

  // ==================== DELETE /api/tasks/[id] ====================
  {
    name: 'DELETE /api/tasks/:id - 删除子任务',
    run: async () => {
      if (!createdSubtaskId) {
        return '跳过：没有子任务 ID'
      }
      
      const { status, data } = await request('DELETE', `/api/tasks/${createdSubtaskId}`)
      
      assert(status === 200, `期望状态码 200，实际 ${status}`)
      assert(data.success === true, '期望 success 为 true')
      assert(data.data.message === '任务已删除', '期望返回删除成功消息')
      
      return `已删除子任务 ID: ${createdSubtaskId}`
    }
  },

  {
    name: 'DELETE /api/tasks/:id - 删除主任务',
    run: async () => {
      if (!createdTaskId) {
        return '跳过：没有任务 ID'
      }
      
      const { status, data } = await request('DELETE', `/api/tasks/${createdTaskId}`)
      
      assert(status === 200, `期望状态码 200，实际 ${status}`)
      assert(data.success === true, '期望 success 为 true')
      
      return `已删除任务 ID: ${createdTaskId}`
    }
  },

  {
    name: 'DELETE /api/tasks/:id - 删除不存在的任务',
    run: async () => {
      const { status, data } = await request('DELETE', '/api/tasks/999999999')
      
      assert(status === 404, `期望状态码 404，实际 ${status}`)
      assert(data.success === false, '期望 success 为 false')
      
      return `正确返回 404`
    }
  }
]

/**
 * 运行所有测试
 */
async function runTests() {
  console.log(`
${colors.cyan}╔══════════════════════════════════════════╗
║     TodoList API 接口测试                ║
║     Base URL: ${BASE_URL.padEnd(25)}║
╚══════════════════════════════════════════╝${colors.reset}
`)

  let passed = 0
  let failed = 0
  const failures = []

  logSection('开始测试')

  for (const test of tests) {
    log('test', test.name)
    
    try {
      const result = await test.run()
      log('success', `${colors.green}通过${colors.reset} - ${result}`)
      passed++
    } catch (error) {
      log('error', `${colors.red}失败${colors.reset} - ${error.message}`)
      failures.push({ name: test.name, error: error.message })
      failed++
    }
  }

  // 测试结果汇总
  logSection('测试结果')
  
  console.log(`${colors.green}通过: ${passed}${colors.reset}`)
  console.log(`${colors.red}失败: ${failed}${colors.reset}`)
  console.log(`总计: ${passed + failed}`)

  if (failures.length > 0) {
    logSection('失败详情')
    failures.forEach(f => {
      log('error', `${f.name}`)
      console.log(`   ${colors.red}${f.error}${colors.reset}`)
    })
  }

  console.log('')
  
  // 返回退出码
  process.exit(failed > 0 ? 1 : 0)
}

// 运行测试
runTests().catch(error => {
  log('error', `测试运行失败: ${error.message}`)
  process.exit(1)
})
