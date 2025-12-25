import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function Home() {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [breakingDown, setBreakingDown] = useState(new Set())

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks')
      const result = await res.json()
      if (result.success) {
        setTasks(result.data || [])
      }
    } catch (error) {
      console.error('获取任务失败:', error)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  // 添加任务
  const addTask = async (e) => {
    e.preventDefault()
    if (!newTask.trim()) return

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTask.trim(), status: 'pending' })
      })
      const result = await res.json()
      if (result.success && result.data) {
        setTasks([result.data, ...tasks])
        setNewTask('')
      } else {
        alert(result.error || '添加任务失败')
      }
    } catch (error) {
      console.error('添加任务失败:', error)
      alert('添加任务失败，请重试')
    }
  }

  // 切换任务状态
  const toggleTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      const result = await res.json()
      if (result.success) {
        const updateTaskAndSubtasks = (taskList) => {
          return taskList.map(t => {
            if (t.id === task.id) {
              return { ...t, status: newStatus }
            }
            if (t.parent_id === task.id && newStatus === 'completed') {
              return { ...t, status: 'completed' }
            }
            return t
          })
        }
        setTasks(updateTaskAndSubtasks(tasks))
      }
    } catch (error) {
      console.error('更新任务失败:', error)
      alert('更新任务失败，请重试')
    }
  }

  // AI 拆解任务
  const breakdownTask = async (task) => {
    if (breakingDown.has(task.id)) return

    const newBreakingDown = new Set(breakingDown)
    newBreakingDown.add(task.id)
    setBreakingDown(newBreakingDown)

    try {
      console.log('开始拆解任务:', task.id, task.title)
      const res = await fetch('/api/tasks/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id })
      })
      
      console.log('拆解API响应状态:', res.status)
      const result = await res.json()
      console.log('拆解API响应数据:', result)

      if (result.success && result.data && Array.isArray(result.data)) {
        const newSubtasks = result.data
        console.log('成功拆解，子任务数量:', newSubtasks.length)
        // 重新获取所有任务以更新列表
        await fetchTasks()
        alert(`成功拆解为 ${newSubtasks.length} 个子任务！`)
      } else {
        const errorMsg = result.error || '拆解任务失败，请重试'
        console.error('拆解失败:', errorMsg)
        alert(errorMsg)
      }
    } catch (error) {
      console.error('拆解任务异常:', error)
      alert(`拆解任务失败: ${error.message || '请检查网络连接'}`)
    } finally {
      const finalSet = new Set(breakingDown)
      finalSet.delete(task.id)
      setBreakingDown(finalSet)
    }
  }

  // 删除任务
  const deleteTask = async (id) => {
    if (!confirm('确定要删除这个任务吗？删除父任务会同时删除所有子任务。')) {
      return
    }

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (result.success) {
        const filterTasks = (taskList) => {
          return taskList.filter(t => {
            if (t.id === id) return false
            if (t.parent_id === id) return false
            return true
          })
        }
        setTasks(filterTasks(tasks))
      } else {
        alert(result.error || '删除任务失败')
      }
    } catch (error) {
      console.error('删除任务失败:', error)
      alert('删除任务失败，请重试')
    }
  }

  // 组织任务层级结构
  const organizeTasks = (taskList) => {
    const taskMap = new Map()
    const rootTasks = []

    taskList.forEach(task => {
      taskMap.set(task.id, { ...task, children: [] })
    })

    taskList.forEach(task => {
      const taskNode = taskMap.get(task.id)
      if (task.parent_id && taskMap.has(task.parent_id)) {
        taskMap.get(task.parent_id).children.push(taskNode)
      } else {
        rootTasks.push(taskNode)
      }
    })

    return rootTasks
  }

  // 渲染单个任务（递归渲染子任务）
  const renderTask = (task, level = 0) => {
    const isBreakingDown = breakingDown.has(task.id)
    const hasChildren = task.children && task.children.length > 0

    return (
      <div key={task.id} className="task-item-wrapper" style={{ marginLeft: `${level * 24}px` }}>
        <div className={`task-item ${task.status === 'completed' ? 'completed' : ''}`}>
          <div className="task-row">
            <label className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={task.status === 'completed'}
                onChange={() => toggleTask(task)}
                className="checkbox-input"
              />
              <span className="checkbox-custom">
                {task.status === 'completed' && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </span>
            </label>

            <span className={`task-text ${task.status === 'completed' ? 'completed-text' : ''}`}>
              {task.title}
            </span>

            <div className="task-buttons" style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexShrink: 0 }}>
              <button
                onClick={() => breakdownTask(task)}
                disabled={isBreakingDown || task.status === 'completed'}
                className="btn-action btn-breakdown"
                style={{
                  appearance: 'none',
                  margin: 0,
                  padding: '6px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 500,
                  background: 'white',
                  color: '#333',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isBreakingDown ? '拆解中...' : '拆解'}
              </button>
              <button
                onClick={() => deleteTask(task.id)}
                className="btn-action btn-delete"
                style={{
                  appearance: 'none',
                  margin: 0,
                  padding: '6px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 500,
                  background: 'white',
                  color: '#333',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>

        {hasChildren && (
          <div className="subtasks-container">
            {task.children.map(child => renderTask(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const organizedTasks = organizeTasks(tasks)

  return (
    <>
      <Head>
        <title>待办事项</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div className="app-container">
        <div className="app-card">
          {/* 顶部区域 - 紫色渐变 */}
          <div className="header-section">
            <h1 className="app-title">待办事项</h1>
            <form onSubmit={addTask} className="input-form">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="添加新任务..."
                className="task-input"
              />
              <button type="submit" className="btn-add">
                添加
              </button>
            </form>
          </div>

          {/* 任务列表区域 - 白色背景 */}
          <div className="tasks-section">
            {loading ? (
              <div className="empty-state">加载中...</div>
            ) : organizedTasks.length === 0 ? (
              <div className="empty-state">还没有任务，添加一个吧～</div>
            ) : (
              <div className="task-list">
                {organizedTasks.map(task => renderTask(task))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f5f1e8;
          min-height: 100vh;
          color: #5a4a3a;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>

      <style jsx global>{`
        .app-container {
          min-height: 100vh;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }

        .app-card {
          width: 100%;
          max-width: 700px;
          background: #faf8f3;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        /* 顶部区域 */
        .header-section {
          padding: 40px 32px;
          background: transparent;
        }

        .app-title {
          font-size: 32px;
          font-weight: 600;
          color: #5a4a3a;
          margin-bottom: 28px;
          text-align: center;
        }

        .input-form {
          display: flex;
          gap: 12px;
        }

        .task-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px dashed #c4b5a0;
          border-radius: 8px;
          font-size: 15px;
          background: white;
          color: #5a4a3a;
          outline: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .task-input::placeholder {
          color: #9a8a7a;
        }

        .task-input:focus {
          border-style: solid;
          border-color: #8b7355;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .btn-add {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          background: #d4c4b0;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .btn-add:hover {
          background: #c4b5a0;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .btn-add:active {
          transform: translateY(0);
        }

        /* 任务列表区域 */
        .tasks-section {
          padding: 24px 32px;
          min-height: 200px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #999;
          font-size: 15px;
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .task-item-wrapper {
          margin-bottom: 0;
        }

        .task-item {
          background: white !important;
          border: 1px solid #d4c4b0 !important;
          border-radius: 8px !important;
          padding: 14px 16px !important;
          transition: all 0.2s ease !important;
          display: block !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
        }

        .task-item:hover {
          border-color: #c4b5a0 !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08) !important;
        }

        .task-item.completed {
          background: #f5f1e8 !important;
          opacity: 0.7 !important;
        }

        .task-row {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          width: 100% !important;
          margin: 4px 0 !important;
          padding: 8px 12px !important;
          background: #faf8f3 !important;
          border-radius: 6px !important;
        }

        /* 复选框样式 - 方形复选框 */
        .checkbox-wrapper {
          position: relative;
          cursor: pointer;
          flex-shrink: 0;
        }

        .checkbox-input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
        }

        .checkbox-custom {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border: 2px solid #8b7355;
          border-radius: 2px;
          background: white;
          transition: all 0.2s;
        }

        .checkbox-wrapper:hover .checkbox-custom {
          border-color: #6b5d45;
          background: #faf8f3;
        }

        .checkbox-input:checked + .checkbox-custom {
          background: #8b7355;
          border-color: #8b7355;
        }

        .checkbox-input:checked + .checkbox-custom svg {
          color: white;
          stroke-width: 2.5;
        }

        /* 任务文本 */
        .task-text {
          flex: 1 !important;
          font-size: 15px !important;
          color: #5a4a3a !important;
          line-height: 1.6 !important;
        }

        .task-text.completed-text {
          text-decoration: line-through !important;
          color: #9a8a7a !important;
        }

        /* 操作按钮 - 带边框的白色背景风格 */
        .task-buttons {
          display: flex !important;
          gap: 8px !important;
          margin-left: auto !important;
          flex-shrink: 0 !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          padding: 0 !important;
        }

        .btn-action {
          /* 重置浏览器默认样式 */
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          margin: 0 !important;
          padding: 6px 14px !important;
          border: 1px solid #c4b5a0 !important;
          border-radius: 4px !important;
          font-family: inherit !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          font-variant: normal !important;
          font-stretch: normal !important;
          letter-spacing: normal !important;
          word-spacing: normal !important;
          line-height: normal !important;
          text-transform: none !important;
          text-indent: 0 !important;
          text-shadow: none !important;
          text-align: center !important;
          background: white !important;
          background-color: white !important;
          color: #6b5d45 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-height: 28px !important;
          box-sizing: border-box !important;
          outline: none !important;
        }

        .btn-action::-moz-focus-inner {
          border: 0;
          padding: 0;
        }

        .btn-action:hover:not(:disabled) {
          background: #faf8f3 !important;
          background-color: #faf8f3 !important;
          border-color: #8b7355 !important;
        }

        .btn-action:active:not(:disabled) {
          background: #f5f1e8 !important;
          background-color: #f5f1e8 !important;
          transform: scale(0.98);
        }

        .btn-action:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(139, 115, 85, 0.2);
        }

        .btn-breakdown {
          color: #6b5d45 !important;
        }

        .btn-breakdown:hover:not(:disabled) {
          border-color: #6b5d45 !important;
          color: #5a4a3a !important;
        }

        .btn-breakdown:disabled {
          background: #faf8f3 !important;
          background-color: #faf8f3 !important;
          color: #9a8a7a !important;
          border-color: #d4c4b0 !important;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-delete {
          color: #c97a6a !important;
        }

        .btn-delete:hover {
          border-color: #c97a6a !important;
          color: #b86959 !important;
        }

        /* 子任务容器 */
        .subtasks-container {
          margin-top: 8px;
          padding-left: 20px;
          border-left: 2px solid #e5e7eb;
        }

        /* 响应式设计 */
        @media (max-width: 640px) {
          .app-container {
            padding: 20px 12px;
          }

          .header-section {
            padding: 32px 24px;
          }

          .app-title {
            font-size: 28px;
            margin-bottom: 24px;
          }

          .input-form {
            flex-direction: column;
          }

          .btn-add {
            width: 100%;
          }

          .tasks-section {
            padding: 20px 24px;
          }

          .task-item {
            padding: 14px;
          }

          .task-buttons {
            flex-wrap: wrap;
          }

          .btn-action {
            flex: 1;
            min-width: 80px;
          }
        }
      `}</style>
    </>
  )
}
