/**
 * 任务状态枚举
 */
export type TaskStatus = 'pending' | 'completed'

/**
 * 任务优先级枚举
 */
export type TaskPriority = 'low' | 'medium' | 'high'

/**
 * Task 接口 - 数据库任务实体
 */
export interface Task {
  id: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  parent_id: number | null
  created_at: string
  subtasks?: Task[]
}

/**
 * CreateTaskRequest 接口 - 创建任务请求
 */
export interface CreateTaskRequest {
  title: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  parent_id?: number | null
}

/**
 * UpdateTaskRequest 接口 - 更新任务请求
 */
export interface UpdateTaskRequest {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  parent_id?: number | null
}

/**
 * ApiResponse<T> 通用响应类型
 */
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number
  limit?: number
}

/**
 * 任务查询参数
 */
export interface TaskQueryParams extends PaginationParams {
  status?: TaskStatus
  priority?: TaskPriority
  parent_id?: string | null
}




