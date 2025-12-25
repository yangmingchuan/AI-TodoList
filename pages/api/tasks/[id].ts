import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../lib/supabase'
import type { 
  Task, 
  UpdateTaskRequest, 
  ApiResponse,
  TaskStatus,
  TaskPriority
} from '../../../types/task'

/**
 * 发送成功响应
 */
function successResponse<T>(res: NextApiResponse<ApiResponse<T>>, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    error: null
  })
}

/**
 * 发送错误响应
 */
function errorResponse(res: NextApiResponse<ApiResponse<null>>, message: string, status = 400) {
  return res.status(status).json({
    success: false,
    data: null,
    error: message
  })
}

/**
 * 验证 ID 格式
 */
function validateId(id: string | string[] | undefined): number | null {
  if (!id || Array.isArray(id)) return null
  const numId = parseInt(id)
  if (isNaN(numId) || numId <= 0) return null
  return numId
}

/**
 * 验证更新请求数据
 */
function validateUpdateRequest(body: UpdateTaskRequest): { 
  errors: string[]
  updateData: Partial<Task>
} {
  const errors: string[] = []
  const updateData: Partial<Task> = {}
  
  // title 验证
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      errors.push('title 必须是字符串')
    } else if (body.title.trim().length === 0) {
      errors.push('title 不能为空')
    } else if (body.title.length > 200) {
      errors.push('title 长度不能超过 200 字符')
    } else {
      updateData.title = body.title.trim()
    }
  }
  
  // description 验证
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      errors.push('description 必须是字符串或 null')
    } else if (body.description && body.description.length > 1000) {
      errors.push('description 长度不能超过 1000 字符')
    } else {
      updateData.description = body.description?.trim() || null
    }
  }
  
  // status 枚举验证
  if (body.status !== undefined) {
    const validStatuses: TaskStatus[] = ['pending', 'completed']
    if (!validStatuses.includes(body.status)) {
      errors.push(`status 必须是 ${validStatuses.join(' 或 ')}`)
    } else {
      updateData.status = body.status
    }
  }

  // priority 枚举验证
  if (body.priority !== undefined) {
    const validPriorities: TaskPriority[] = ['low', 'medium', 'high']
    if (!validPriorities.includes(body.priority)) {
      errors.push(`priority 必须是 ${validPriorities.join('、')}`)
    } else {
      updateData.priority = body.priority
    }
  }
  
  // parent_id 验证
  if (body.parent_id !== undefined) {
    if (body.parent_id !== null && (typeof body.parent_id !== 'number' || !Number.isInteger(body.parent_id))) {
      errors.push('parent_id 必须是整数或 null')
    } else {
      updateData.parent_id = body.parent_id
    }
  }
  
  return { errors, updateData }
}

/**
 * GET    /api/tasks/[id] - 获取单个任务（包含子任务）
 * PATCH  /api/tasks/[id] - 更新任务状态
 * DELETE /api/tasks/[id] - 删除任务
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Task | { message: string; deleted: Task } | null>>
) {
  try {
    const { id } = req.query

    // 验证 ID
    const taskId = validateId(id)
    if (!taskId) {
      return errorResponse(res, '无效的任务 ID，必须是正整数')
    }

    // ==================== GET ====================
    if (req.method === 'GET') {
      const { data: task, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return errorResponse(res, '任务不存在', 404)
        }
        console.error('获取任务失败:', error)
        return errorResponse(res, '获取任务失败: ' + error.message, 500)
      }

      // 获取子任务
      const { data: subtasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_id', taskId)
        .order('created_at', { ascending: true })

      const taskWithSubtasks: Task = {
        ...(task as Task),
        subtasks: (subtasks as Task[]) || []
      }

      return successResponse(res, taskWithSubtasks)
    }

    // ==================== PATCH ====================
    if (req.method === 'PATCH') {
      const body = req.body as UpdateTaskRequest
      const { errors, updateData } = validateUpdateRequest(body)

      if (errors.length > 0) {
        return errorResponse(res, errors.join('; '))
      }

      if (Object.keys(updateData).length === 0) {
        return errorResponse(res, '没有提供任何要更新的字段')
      }

      // 防止任务成为自己的子任务
      if (updateData.parent_id === taskId) {
        return errorResponse(res, '任务不能成为自己的子任务')
      }

      // 验证父任务是否存在
      if (updateData.parent_id) {
        const { data: parentTask, error: parentError } = await supabase
          .from('tasks')
          .select('id, parent_id')
          .eq('id', updateData.parent_id)
          .single()
        
        if (parentError || !parentTask) {
          return errorResponse(res, '父任务不存在')
        }

        // 防止循环引用
        if ((parentTask as Task).parent_id === taskId) {
          return errorResponse(res, '不能创建循环的父子关系')
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()

      if (error) {
        console.error('更新任务失败:', error)
        return errorResponse(res, '更新任务失败: ' + error.message, 500)
      }

      if (!data || data.length === 0) {
        return errorResponse(res, '任务不存在', 404)
      }

      return successResponse(res, (data as Task[])[0])
    }

    // ==================== DELETE ====================
    if (req.method === 'DELETE') {
      // 先检查任务是否存在
      const { data: existingTask, error: checkError } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('id', taskId)
        .single()

      if (checkError || !existingTask) {
        return errorResponse(res, '任务不存在', 404)
      }

      // 执行删除
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) {
        console.error('删除任务失败:', error)
        return errorResponse(res, '删除任务失败: ' + error.message, 500)
      }

      return successResponse(res, {
        message: '任务已删除',
        deleted: existingTask as Task
      })
    }

    // ==================== 不支持的方法 ====================
    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
    return errorResponse(res, `不支持的请求方法: ${req.method}`, 405)

  } catch (err) {
    console.error('服务器错误:', err)
    return errorResponse(res, '服务器内部错误', 500)
  }
}




