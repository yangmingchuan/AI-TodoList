-- =============================================
-- TodoList 数据库表结构
-- =============================================

-- 创建 tasks 表
CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  parent_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引，加速查询
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- 添加注释
COMMENT ON TABLE tasks IS '待办事项任务表';
COMMENT ON COLUMN tasks.id IS '主键';
COMMENT ON COLUMN tasks.title IS '任务标题';
COMMENT ON COLUMN tasks.description IS '任务描述（可选）';
COMMENT ON COLUMN tasks.status IS '状态：pending 或 completed';
COMMENT ON COLUMN tasks.priority IS '优先级：low、medium 或 high';
COMMENT ON COLUMN tasks.parent_id IS '父任务ID，用于关联AI拆解的子任务';
COMMENT ON COLUMN tasks.created_at IS '创建时间';

-- 启用 RLS（行级安全）
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 创建公开访问策略（开发阶段，生产环境请根据需要调整）
CREATE POLICY "允许所有操作" ON tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);















