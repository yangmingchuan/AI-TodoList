import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { supabase } from '../../../lib/supabase'
import { DEEPSEEK_API_KEY, DEEPSEEK_API_BASE_URL } from '../../../lib/config'
import type { Task, ApiResponse } from '../../../types/task'

// Node.js 16 兼容性：添加 FormData polyfill
if (typeof global.FormData === 'undefined') {
  // @ts-ignore
  global.FormData = require('form-data')
}

/**
 * POST /api/tasks/breakdown - 使用 DeepSeek AI 拆解任务
 * 将一个大任务拆解成 3-5 个可执行的小步骤
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Task[]>>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      success: false,
      data: null,
      error: `Method ${req.method} not allowed`
    })
  }

  try {
    const { taskId, taskTitle } = req.body

    // 验证参数 - 支持两种方式：taskId 或 taskTitle
    let finalTaskId: number | null = null
    let finalTaskTitle: string
    let originalTask: Task | null = null

    if (taskId) {
      // 方式1: 通过 taskId 获取任务
      const numId = typeof taskId === 'string' ? parseInt(taskId) : taskId
      if (isNaN(numId) || numId <= 0) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'taskId must be a positive number'
        })
      }

      // 验证任务是否存在
      const { data: existingTask, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', numId)
        .single()

      if (fetchError || !existingTask) {
        return res.status(404).json({
          success: false,
          data: null,
          error: 'Task not found'
        })
      }

      finalTaskId = numId
      finalTaskTitle = existingTask.title
      originalTask = existingTask as Task
    } else if (taskTitle) {
      // 方式2: 直接使用 taskTitle
      if (typeof taskTitle !== 'string' || taskTitle.trim().length === 0) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'taskTitle is required and must be a non-empty string'
        })
      }
      finalTaskTitle = taskTitle.trim()
    } else {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Either taskId or taskTitle is required'
      })
    }

    // 验证 DeepSeek API Key
    if (!DEEPSEEK_API_KEY) {
      return res.status(500).json({
        success: false,
        data: null,
        error: 'DeepSeek API Key is not configured'
      })
    }

    // 初始化 OpenAI 客户端（使用 DeepSeek API）
    const openai = new OpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_API_BASE_URL,
    })

    // 构建提示词，让 AI 拆解任务
    const prompt = `请将以下任务拆解成 3-5 个具体可执行的小步骤。要求：
1. 每个步骤应该是具体、可操作的
2. 步骤之间要有逻辑顺序
3. 返回格式为 JSON 数组，每个元素是一个步骤的标题
4. 只返回 JSON 数组，不要其他文字说明

任务：${finalTaskTitle}

请返回 JSON 格式的数组，例如：["步骤1", "步骤2", "步骤3"]`

    // 调用 DeepSeek API
    let completion
    try {
      console.log('调用 DeepSeek API，任务:', finalTaskTitle)
      completion = await openai.chat.completions.create({
        model: 'deepseek-chat',  // DeepSeek 的模型名称
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,  // 控制输出的随机性
        max_tokens: 500,   // 最大 token 数
      })
      console.log('DeepSeek API 调用成功')
    } catch (apiError: any) {
      console.error('DeepSeek API 调用失败:', apiError)
      return res.status(500).json({
        success: false,
        data: null,
        error: `AI API 调用失败: ${apiError.message || '未知错误'}。请检查 DEEPSEEK_API_KEY 是否正确配置。`
      })
    }

    // 获取 AI 返回的内容
    const aiResponse = completion.choices[0]?.message?.content
    console.log('AI 返回内容:', aiResponse?.substring(0, 200))
    if (!aiResponse) {
      return res.status(500).json({
        success: false,
        data: null,
        error: 'AI did not return a valid response'
      })
    }

    // 解析 AI 返回的 JSON
    let subtasks: string[] = []
    try {
      // 清理响应内容：移除 markdown 代码块标记
      let cleanedResponse = aiResponse.trim()
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '')
      cleanedResponse = cleanedResponse.replace(/^```\s*/i, '')
      cleanedResponse = cleanedResponse.replace(/\s*```$/i, '')
      cleanedResponse = cleanedResponse.trim()

      // 尝试直接解析 JSON
      const parsed = JSON.parse(cleanedResponse)
      if (Array.isArray(parsed)) {
        subtasks = parsed
      } else {
        // 如果不是数组，尝试从文本中提取数组
        const arrayMatch = cleanedResponse.match(/\[[\s\S]*?\]/)
        if (arrayMatch) {
          subtasks = JSON.parse(arrayMatch[0])
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', aiResponse, parseError)
      
      // 如果 JSON 解析失败，尝试从文本中提取数组
      try {
        const arrayMatch = aiResponse.match(/\[[\s\S]*?\]/)
        if (arrayMatch) {
          const arrayStr = arrayMatch[0]
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim()
          subtasks = JSON.parse(arrayStr)
        }
      } catch (secondParseError) {
        console.error('Failed to parse array from response:', secondParseError)
        
        // 最后尝试：从文本中按行提取步骤
        const lines = aiResponse
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && line.length > 0)
          .filter(line => !line.match(/^(```|步骤|Step|Task|JSON)/i))  // 过滤掉标题和代码块标记
        
        subtasks = lines
          .map(line => {
            // 移除 JSON 数组中的引号、逗号等
            line = line.replace(/^["'\[,\s]+|["'\]\s,]+$/g, '')
            // 移除编号、符号等
            line = line.replace(/^[\d\-•\*\.]\s*/, '')
            return line.trim()
          })
          .filter(line => line.length > 3 && !line.match(/^[\[\],]+$/))  // 过滤太短的行和纯符号
          .slice(0, 5)  // 最多取 5 个
      }
    }

    // 清理子任务标题：移除多余的引号、逗号等
    subtasks = subtasks.map(task => {
      return task
        .replace(/^["'\[,\s]+|["'\]\s,]+$/g, '')  // 移除首尾的引号、逗号、方括号
        .replace(/\\"/g, '"')  // 处理转义的引号
        .trim()
    }).filter(task => task.length > 0)

    // 验证拆解结果
    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      console.error('Invalid subtasks:', subtasks, 'Original response:', aiResponse)
      return res.status(400).json({
        success: false,
        data: null,
        error: 'AI did not return valid subtasks. Please try again.'
      })
    }

    // 确保子任务数量在 3-5 个之间
    if (subtasks.length < 3) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `AI only returned ${subtasks.length} subtasks, expected 3-5`
      })
    }

    // 限制最多 5 个子任务
    const finalSubtasks = subtasks.slice(0, 5)

    // 批量创建子任务（适配我们的表结构）
    const taskDataList = finalSubtasks.map((subtask: string) => ({
      title: subtask.trim(),
      description: `由 AI 从「${finalTaskTitle}」拆解生成`,
      status: 'pending' as const,
      priority: 'medium' as const,
      parent_id: finalTaskId  // 设置父任务 ID（如果提供了 taskId）
    }))

    // 插入所有子任务到数据库
    const { data: createdTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(taskDataList)
      .select()

    if (insertError) {
      console.error('Supabase error:', insertError)
      return res.status(500).json({
        success: false,
        data: null,
        error: insertError.message || 'Failed to create subtasks'
      })
    }

    // 返回创建的子任务
    return res.status(201).json({
      success: true,
      data: (createdTasks as Task[]) || [],
      error: null
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    })
  }
}
