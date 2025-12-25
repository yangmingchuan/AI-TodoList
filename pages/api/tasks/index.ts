import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../lib/supabase'
import type { 
  Task, 
  CreateTaskRequest, 
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
 * 验证创建任务的请求数据
 */
function validateCreateRequest(body: CreateTaskRequest): string[] {
  const errors: string[] = []
  
  // title 必填验证
  if (!body.title || typeof body.title !== 'string') {
    errors.push('title 是必填字段且必须是字符串')
  } else if (body.title.trim().length === 0) {
    errors.push('title 不能为空')
  } else if (body.title.length > 200) {
    errors.push('title 长度不能超过 200 字符')
  }
  
  // description 验证
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push('description 必须是字符串')
    } else if (body.description.length > 1000) {
      errors.push('description 长度不能超过 1000 字符')
    }
  }
  
  // status 枚举验证
  if (body.status !== undefined) {
    const validStatuses: TaskStatus[] = ['pending', 'completed']
    if (!validStatuses.includes(body.status)) {
      errors.push(`status 必须是 ${validStatuses.join(' 或 ')}`)
    }
  }

  // priority 枚举验证
  if (body.priority !== undefined) {
    const validPriorities: TaskPriority[] = ['low', 'medium', 'high']
    if (!validPriorities.includes(body.priority)) {
      errors.push(`priority 必须是 ${validPriorities.join('、')}`)
    }
  }
  
  // parent_id 验证
  if (body.parent_id !== undefined && body.parent_id !== null) {
    if (typeof body.parent_id !== 'number' || !Number.isInteger(body.parent_id)) {
      errors.push('parent_id 必须是整数')
    }
  }
  
  return errors
}

/**
 * GET  /api/tasks - 获取所有任务（按创建时间倒序）
 * POST /api/tasks - 创建新任务
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Task | Task[] | null>>
) {
  try {
    // ==================== GET ====================
    if (req.method === 'GET') {
      const { status, priority, parent_id } = req.query
      
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
      
      // 按状态筛选
      if (status && ['pending', 'completed'].includes(status as string)) {
        query = query.eq('status', status)
      }

      // 按优先级筛选
      if (priority && ['low', 'medium', 'high'].includes(priority as string)) {
        query = query.eq('priority', priority)
      }
      
      // 按父任务筛选
      if (parent_id !== undefined) {
        if (parent_id === 'null') {
          query = query.is('parent_id', null)
        } else {
          query = query.eq('parent_id', parseInt(parent_id as string))
        }
      }

      const { data, error } = await query

      if (error) {
        console.error('获取任务失败:', error)
        return errorResponse(res, '获取任务失败: ' + error.message, 500)
      }
      
      return successResponse(res, data as Task[])
    }

    // ==================== POST ====================
    if (req.method === 'POST') {
      const body = req.body as CreateTaskRequest

      // 类型检查
      const errors = validateCreateRequest(body)
      if (errors.length > 0) {
        return errorResponse(res, errors.join('; '))
      }

      // 验证父任务是否存在
      if (body.parent_id) {
        const { data: parentTask, error: parentError } = await supabase
          .from('tasks')
          .select('id')
          .eq('id', body.parent_id)
          .single()
        
        if (parentError || !parentTask) {
          return errorResponse(res, '父任务不存在')
        }
      }

      // 创建任务
      const insertData = {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        status: body.status || 'pending',
        priority: body.priority || 'medium',
        parent_id: body.parent_id || null
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert([insertData])
        .select()

      if (error) {
        console.error('创建任务失败:', error)
        return errorResponse(res, '创建任务失败: ' + error.message, 500)
      }

      return successResponse(res, (data as Task[])[0], 201)
    }

    // ==================== 不支持的方法 ====================
    res.setHeader('Allow', ['GET', 'POST'])
    return errorResponse(res, `不支持的请求方法: ${req.method}`, 405)
    
  } catch (err) {
    console.error('服务器错误:', err)
    return errorResponse(res, '服务器内部错误', 500)
  }
}




