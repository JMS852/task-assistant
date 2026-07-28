# AI Restructuring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove broken Smart Execute feature, extract to separate project, and add three working AI features: task enhancement, smart query (ChatPanel), daily briefing.

**Architecture:** Three independent AI features sharing `ai_router.py` as infrastructure. Each has its own Python module, IPC handler, API route, and React component. Smart Execute code moves to a standalone `ai-executor/` project.

**Tech Stack:** Electron 28 + React 18 + Python 3.12 + SQLite (sql.js) + OpenAI-compatible LLM APIs

---

### Task 1: Remove Smart Execute — Python & Electron

**Files:**
- Delete: `python/smart/orchestrator.py`
- Delete: `python/smart/sandbox.py`
- Delete: `python/smart/validator.py`
- Modify: `python/main.py:217-225`
- Modify: `electron/main.ts:149-161`
- Modify: `electron/api/routes/tasks.ts:51-64`

- [ ] **Step 1: Delete Python smart execute modules**

```bash
rm python/smart/orchestrator.py python/smart/sandbox.py python/smart/validator.py
```

- [ ] **Step 2: Remove execute_task action from python/main.py**

In `python/main.py`, delete lines 217-225 (the `execute_task` elif block):
```python
            elif action == 'execute_task':
                from smart.orchestrator import execute
                import traceback
                try:
                    result = execute(cmd['data'])
                    safe_print({'event': 'task_executed', 'data': result, '_requestId': cmd.get('_requestId')})
                except Exception as e:
                    tb = traceback.format_exc()
                    safe_print({'event': 'error', 'data': f'{e}\n\n{tb[-1000:]}', '_requestId': cmd.get('_requestId')})
```

- [ ] **Step 3: Remove execute-task IPC handler from electron/main.ts**

In `electron/main.ts`, delete lines 149-161:
```typescript
ipcMain.handle('execute-task', async (_e, taskId, level) => {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return { error: 'Task not found' };
  try {
    const result = await sendToPythonAndWait({ action: 'execute_task', data: { ...task, level } });
    return result;
  } catch (err) {
    console.error('[Main] execute-task failed:', err);
    return { error: String(err) };
  }
});
```

- [ ] **Step 4: Remove /execute route from electron/api/routes/tasks.ts**

In `electron/api/routes/tasks.ts`, delete lines 51-64 (the entire `/execute` route).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: remove smart execute from Python and Electron layers"
```

---

### Task 2: Remove Smart Execute — Frontend

**Files:**
- Delete: `src/components/SmartExecute.tsx`
- Delete: `src/components/SmartExecute.css`
- Modify: `src/App.tsx:6,17,104-110,116`
- Modify: `src/components/TaskDetail.tsx:9,18,118-121`
- Modify: `src/hooks/useApi.ts:14-32,97`
- Modify: `src/global.d.ts:8`
- Modify: `src/i18n/zh.ts:53,57-77`
- Modify: `src/i18n/en.ts:55,59-72`

- [ ] **Step 6: Delete SmartExecute component**

```bash
rm src/components/SmartExecute.tsx src/components/SmartExecute.css
```

- [ ] **Step 7: Update App.tsx — remove SmartExecute**

Remove line 6: `import { SmartExecute } from './components/SmartExecute';`
Remove line 17: `const [executingTask, setExecutingTask] = useState<Task | null>(null);`
Replace lines 104-110 (the `executingTask ?` block) — the entire ternary becomes:

```tsx
{showHistoryScan ? (
  <HistoryScan onClose={() => setShowHistoryScan(false)} />
) : selectedTask ? (
  <TaskDetail
    key={selectedTask.id}
    task={selectedTask}
    onComplete={(id) => { completeTask(id); setSelectedTask(null); }}
  />
) : (
  <div className="empty-state">
    <div className="empty-state-icon">📋</div>
    <h3>{t.app.emptyTitle}</h3>
    <p>{t.app.emptyDesc}<br />{t.app.emptyHint}</p>
  </div>
)}
```

Also update `app.emptyHint` in zh.ts: `emptyHint: '或使用 AI 助手帮你分析和查询任务',`

- [ ] **Step 8: Update TaskDetail.tsx — replace execute button with enhance button**

Remove `onExecute` from Props interface (line 9). Remove `onExecute` from function params (line 18). Replace the execute button (lines 117-121) with a placeholder `onEnhance`:

```tsx
interface Props {
  task: Task;
  onComplete: (id: string) => void;
  onEnhance: (task: Task) => void;
}

// ... in the component, replace the actions div:
<div className="td-actions">
  <button className="td-btn-execute" onClick={() => onEnhance(task)}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    AI 分析
  </button>
  <button className="td-btn-complete" onClick={() => onComplete(task.id)}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
    {t.taskDetail.markComplete}
  </button>
</div>
```

- [ ] **Step 9: Update useApi.ts — remove executeTask**

Remove the `executeTask` function (lines 14-32). Remove `executeTask` from the return object (line 97).

- [ ] **Step 10: Update global.d.ts**

Remove line 8: `executeTask: (taskId: string, level: string) => Promise<...>;`

- [ ] **Step 11: Update i18n — remove smartExecute section**

In `src/i18n/zh.ts`: Remove `smartExecute` key from `taskDetail` (line 53). Remove entire `smartExecute` object (lines 57-77).

In `src/i18n/en.ts`: Same removals.

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "feat: remove smart execute from frontend"
```

---

### Task 3: Create ai-executor Project

**Files:**
- Create: `../ai-executor/main.py`
- Create: `../ai-executor/adapters/__init__.py`
- Create: `../ai-executor/adapters/base.py`
- Create: `../ai-executor/adapters/deepseek.py`
- Create: `../ai-executor/adapters/qianwen.py`
- Create: `../ai-executor/adapters/doubao.py`
- Create: `../ai-executor/adapters/hunyuan.py`
- Create: `../ai-executor/ai_router.py`
- Create: `../ai-executor/orchestrator.py`
- Create: `../ai-executor/sandbox.py`
- Create: `../ai-executor/validator.py`
- Create: `../ai-executor/README.md`

- [ ] **Step 13: Create ai-executor directory and copy adapters**

```bash
mkdir -p ../ai-executor/adapters
cp python/smart/adapters/__init__.py ../ai-executor/adapters/
cp python/smart/adapters/base.py ../ai-executor/adapters/
cp python/smart/adapters/deepseek.py ../ai-executor/adapters/
cp python/smart/adapters/qianwen.py ../ai-executor/adapters/
cp python/smart/adapters/doubao.py ../ai-executor/adapters/
cp python/smart/adapters/hunyuan.py ../ai-executor/adapters/
cp python/smart/ai_router.py ../ai-executor/
```

- [ ] **Step 14: Copy the three smart execute modules**

```bash
# These were already deleted from task-assistant — need to restore from git
git show HEAD~1:python/smart/orchestrator.py > ../ai-executor/orchestrator.py
git show HEAD~1:python/smart/sandbox.py > ../ai-executor/sandbox.py
git show HEAD~1:python/smart/validator.py > ../ai-executor/validator.py
```

- [ ] **Step 15: Create ai-executor/main.py entry point**

A standalone stdin/stdout JSON protocol entry point identical to task-assistant's pattern:

```python
import sys
import json
import os
sys.path.insert(0, os.path.dirname(__file__))

def safe_print(obj):
    text = json.dumps(obj, ensure_ascii=False)
    print(text.encode('utf-8', errors='replace').decode('utf-8'), flush=True)

def main():
    safe_print({'status': 'ready'})
    for line in sys.stdin:
        try:
            cmd = json.loads(line.strip())
            action = cmd.get('action')
            if action == 'ping':
                safe_print({'status': 'ok'})
            elif action == 'execute_task':
                from orchestrator import execute
                result = execute(cmd['data'])
                safe_print({'event': 'task_executed', 'data': result, '_requestId': cmd.get('_requestId')})
            elif action == 'configure_provider':
                from ai_router import configure_provider
                data = cmd['data']
                result = configure_provider(
                    provider=data['provider'],
                    api_key=data.get('api_key', ''),
                    endpoint=data.get('endpoint', ''),
                    enabled=data.get('enabled', True),
                )
                safe_print(result)
            else:
                safe_print({'event': 'error', 'data': f'Unknown action: {action}'})
        except Exception as e:
            safe_print({'event': 'error', 'data': str(e)})

if __name__ == '__main__':
    main()
```

- [ ] **Step 16: Create ai-executor/README.md**

```markdown
# AI Executor

Extracted from [task-assistant](https://github.com/JMS852/task-assistant).

Multi-AI parallel execution engine for general task automation. Takes a task description, orchestrates multiple LLMs, validates results, and generates output files.

## Providers

DeepSeek, Qwen (Tongyi), Doubao, Hunyuan — configured via stdin JSON protocol.

## Usage

```bash
echo '{"action":"execute_task","data":{"title":"...","description":"..."}}' | python main.py
```

## Status

Experimental. Extracted from task-assistant for independent development.
```

- [ ] **Step 17: Commit**

```bash
cd ../ai-executor && git init && git add -A && git commit -m "initial: extract smart execute from task-assistant"
```

---

### Task 4: Build Task Enhancement (`python/engine/enhancer.py`)

**Files:**
- Create: `python/engine/enhancer.py`
- Modify: `python/main.py` (add enhance action)
- Modify: `electron/main.ts` (add enhance-task IPC)
- Modify: `electron/api/routes/tasks.ts` (add POST /tasks/:id/enhance)
- Create: `src/components/TaskEnhancement.tsx`
- Create: `src/components/TaskEnhancement.css`
- Modify: `src/components/TaskDetail.tsx` (integrate enhancement)
- Modify: `src/hooks/useApi.ts` (add enhanceTask)
- Modify: `src/global.d.ts` (add enhanceTask type)
- Modify: `src/App.tsx` (wire enhance handler)
- Modify: `src/i18n/zh.ts` (add enhancement strings)
- Modify: `src/i18n/en.ts` (add enhancement strings)

- [ ] **Step 18: Create python/engine/enhancer.py**

```python
"""AI task enhancement — enriches a new task with context, subtasks, and suggestions."""
import json
from smart.ai_router import call_ai


def enhance_task(task: dict, all_tasks: list[dict]) -> dict:
    """Analyze a task and return enhancement suggestions.

    Args:
        task: The task to enhance (id, title, description, sender, group_name, priority, deadline)
        all_tasks: All existing tasks for context (id, title, priority, status, sender)

    Returns:
        dict with background, subtasks, priority_suggestion, related_task_ids, suggested_deadline
    """
    existing_summary = json.dumps(
        [{'id': t.get('id'), 'title': t.get('title'), 'priority': t.get('priority'),
          'status': t.get('status'), 'sender': t.get('sender')}
         for t in all_tasks if t.get('id') != task.get('id')],
        ensure_ascii=False
    )[:3000]

    prompt = f"""你是一个任务管理助手。分析以下任务并给出建议。

任务标题：{task.get('title', '')}
任务描述：{task.get('description', '')}
发送者：{task.get('sender', '')}
群组：{task.get('group_name', '')}
优先级：{task.get('priority', 'medium')}
截止日期：{task.get('deadline', '无')}

已有任务列表（供参考）：
{existing_summary or '（无其他任务）'}

请返回 JSON（不要 markdown 代码块）：
{{
  "background": "这条任务可能的背景和上下文（1-2句中文）",
  "subtasks": ["子步骤1", "子步骤2", "..."] ,
  "priority_suggestion": "high/medium/low",
  "priority_reason": "为什么建议这个优先级（1句话）",
  "related_task_ids": ["关联的已有任务ID，没有则为空数组"],
  "suggested_deadline": "建议的截止日期 YYYY-MM-DD 或 null",
  "notes": "其他需要注意的事项（1句话，没有则为空字符串）"
}}"""

    try:
        result = call_ai(prompt, provider='deepseek', temperature=0.3)
        # Parse AI response — handle markdown code fences
        text = result if isinstance(result, str) else result.get('content', '')
        # Try to extract JSON from markdown
        if '```' in text:
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                text = text[start:end+1]
        return json.loads(text)
    except Exception as e:
        print(f'[Enhancer] AI call failed: {e}', flush=True)
        return {
            'background': '',
            'subtasks': [],
            'priority_suggestion': task.get('priority', 'medium'),
            'priority_reason': '',
            'related_task_ids': [],
            'suggested_deadline': None,
            'notes': '',
            'error': str(e),
        }
```

- [ ] **Step 19: Add enhance action to python/main.py**

In `python/main.py`, add a new elif block in the main loop (before the `else` clause at line 243):

```python
            elif action == 'enhance_task':
                from engine.enhancer import enhance_task
                data = cmd['data']
                result = enhance_task(
                    task=data.get('task', {}),
                    all_tasks=data.get('all_tasks', []),
                )
                safe_print({'event': 'task_enhanced', 'data': result, '_requestId': cmd.get('_requestId')})
```

- [ ] **Step 20: Add enhance-task IPC handler to electron/main.ts**

Add after the `get-settings` handler:

```typescript
ipcMain.handle('enhance-task', async (_e, taskId: string) => {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return { error: 'Task not found' };
  const allTasks = queryAll('SELECT id, title, priority, status, sender FROM tasks');
  try {
    const result = await sendToPythonAndWait({
      action: 'enhance_task',
      data: { task, all_tasks: allTasks },
    }, 30000);
    return result;
  } catch (err) {
    console.error('[Main] enhance-task failed:', err);
    return { error: String(err) };
  }
});
```

- [ ] **Step 21: Add enhance route to electron/api/routes/tasks.ts**

```typescript
taskRoutes.post('/tasks/:id/enhance', async (req, res) => {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Not found' });
  const allTasks = queryAll('SELECT id, title, priority, status, sender FROM tasks');
  try {
    const result = await sendToPythonAndWait({
      action: 'enhance_task',
      data: { task, all_tasks: allTasks },
    }, 30000);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});
```

- [ ] **Step 22: Create src/components/TaskEnhancement.tsx**

```tsx
import React, { useState } from 'react';
import './TaskEnhancement.css';

interface EnhancementResult {
  background?: string;
  subtasks?: string[];
  priority_suggestion?: string;
  priority_reason?: string;
  related_task_ids?: string[];
  suggested_deadline?: string | null;
  notes?: string;
  error?: string;
}

interface Props {
  taskTitle: string;
  loading: boolean;
  result: EnhancementResult | null;
  error: string;
  onAdopt: (suggestion: { subtasks?: string[]; priority?: string; deadline?: string }) => void;
  onClose: () => void;
}

export function TaskEnhancement({ taskTitle, loading, result, error, onAdopt, onClose }: Props) {
  const [adopted, setAdopted] = useState(false);

  if (loading) {
    return (
      <div className="te-container">
        <div className="te-card te-loading">
          <div className="te-spinner" />
          <p>AI 正在分析任务…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="te-container">
        <div className="te-card te-error">
          <h4>⚠️ 分析失败</h4>
          <p>{error}</p>
          <button onClick={onClose}>关闭</button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const handleAdopt = () => {
    onAdopt({
      subtasks: result.subtasks,
      priority: result.priority_suggestion,
      deadline: result.suggested_deadline || undefined,
    });
    setAdopted(true);
  };

  return (
    <div className="te-container">
      <div className="te-card">
        <div className="te-header">
          <h3>✨ AI 分析结果</h3>
          <button className="te-close" onClick={onClose}>✕</button>
        </div>

        {result.background && (
          <div className="te-section">
            <h4>📋 背景</h4>
            <p>{result.background}</p>
          </div>
        )}

        {result.subtasks && result.subtasks.length > 0 && (
          <div className="te-section">
            <h4>📝 建议子任务</h4>
            <ul>
              {result.subtasks.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {result.priority_suggestion && (
          <div className="te-section">
            <h4>🎯 优先级建议</h4>
            <span className={`te-priority te-prio-${result.priority_suggestion}`}>
              {result.priority_suggestion === 'high' ? '紧急' : result.priority_suggestion === 'medium' ? '普通' : '不急'}
            </span>
            {result.priority_reason && <p>{result.priority_reason}</p>}
          </div>
        )}

        {result.notes && (
          <div className="te-section">
            <h4>💡 备注</h4>
            <p>{result.notes}</p>
          </div>
        )}

        <div className="te-actions">
          <button
            className={`te-btn-adopt ${adopted ? 'adopted' : ''}`}
            onClick={handleAdopt}
            disabled={adopted}
          >
            {adopted ? '✓ 已采纳' : '采纳建议'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 23: Create src/components/TaskEnhancement.css**

```css
.te-container { padding: 16px 0; }
.te-card { background: #fff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; }
.te-loading { text-align: center; padding: 48px 24px; }
.te-spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #4f6ef7; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
@keyframes spin { to { transform: rotate(360deg); } }
.te-error { text-align: center; }
.te-error h4 { color: #dc2626; margin: 0 0 8px; }
.te-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.te-header h3 { margin: 0; font-size: 16px; }
.te-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; }
.te-section { margin-bottom: 16px; }
.te-section h4 { font-size: 13px; color: #666; margin: 0 0 8px; }
.te-section p { font-size: 14px; color: #333; margin: 0; line-height: 1.6; }
.te-section ul { margin: 0; padding-left: 20px; }
.te-section li { font-size: 14px; color: #333; padding: 4px 0; }
.te-priority { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.te-prio-high { background: #fef2f2; color: #dc2626; }
.te-prio-medium { background: #fffbeb; color: #d97706; }
.te-prio-low { background: #f0fdf4; color: #16a34a; }
.te-actions { margin-top: 20px; display: flex; gap: 12px; }
.te-btn-adopt { padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; background: #4f6ef7; color: #fff; }
.te-btn-adopt:hover { background: #3b5de7; }
.te-btn-adopt.adopted { background: #16a34a; }
```

- [ ] **Step 24: Update useApi.ts — add enhanceTask**

Add to `useApi()`:
```typescript
const enhanceTask = async (taskId: string): Promise<any> => {
  if (window.electronAPI?.enhanceTask) {
    return window.electronAPI.enhanceTask(taskId);
  }
  const r = await fetch(`${API_BASE}/tasks/${taskId}/enhance`, { method: 'POST' });
  return r.json();
};
```
Add `enhanceTask` to the return object.

- [ ] **Step 25: Update global.d.ts — add enhanceTask**

```typescript
enhanceTask: (taskId: string) => Promise<{ background?: string; subtasks?: string[]; priority_suggestion?: string; priority_reason?: string; related_task_ids?: string[]; suggested_deadline?: string | null; notes?: string; error?: string }>;
```

- [ ] **Step 26: Update App.tsx — wire enhance**

Add state: `const [enhancingTask, setEnhancingTask] = useState<Task | null>(null);`
Add handler: `const handleEnhance = useCallback((task: Task) => { setEnhancingTask(task); }, []);`
Update the `<TaskDetail>` to pass `onEnhance={handleEnhance}`.

Add a new panel state for enhancement view:
```tsx
{enhancingTask && (
  <TaskEnhancementView
    task={enhancingTask}
    onClose={() => { setEnhancingTask(null); refresh(); }}
  />
)}
```

Actually, simpler approach: make the enhancement inline in the TaskDetail panel. Have `TaskDetail` manage its own enhancement state using `useApi().enhanceTask()`.

- [ ] **Step 27: Update TaskDetail.tsx — integrate enhancement inline**

Modify `TaskDetail` to manage enhancement state internally. When user clicks "AI 分析", it calls `enhanceTask` and shows `TaskEnhancement` component inline above the task description.

```tsx
import { TaskEnhancement } from './TaskEnhancement';
import { useApi } from '../hooks/useApi';

// Inside component:
const api = useApi();
const [enhancing, setEnhancing] = useState(false);
const [enhancement, setEnhancement] = useState<any>(null);
const [enhanceError, setEnhanceError] = useState('');

const handleEnhance = async () => {
  setEnhancing(true);
  setEnhanceError('');
  try {
    const res = await api.enhanceTask(task.id);
    if (res?.error) setEnhanceError(res.error);
    else setEnhancement(res);
  } catch (e: any) {
    setEnhanceError(e.message || String(e));
  } finally {
    setEnhancing(false);
  }
};
```

Render the enhancement inline when active.

- [ ] **Step 28: Add i18n strings for enhancement**

In `zh.ts` `taskDetail`:
```typescript
aiAnalyze: 'AI 分析',
analyzing: 'AI 正在分析…',
enhanceFailed: '分析失败',
adoptSuggestions: '采纳建议',
adopted: '已采纳',
enhanceBackground: '背景',
enhanceSubtasks: '建议子任务',
enhancePriority: '优先级建议',
enhanceNotes: '备注',
```

In `en.ts`: equivalent English translations.

- [ ] **Step 29: Commit**

```bash
git add -A && git commit -m "feat: add AI task enhancement module"
```

---

### Task 5: Build Smart Query (`python/smart/query_engine.py` + ChatPanel)

**Files:**
- Create: `python/smart/query_engine.py`
- Modify: `python/main.py` (add query action)
- Modify: `electron/main.ts` (add query IPC)
- Modify: `electron/api/routes/tasks.ts` (add POST /api/query)
- Create: `src/components/ChatPanel.tsx`
- Create: `src/components/ChatPanel.css`
- Modify: `src/App.tsx` (add ChatPanel sidebar)
- Modify: `src/hooks/useApi.ts` (add askQuery)
- Modify: `src/global.d.ts` (add askQuery type)
- Modify: `src/i18n/zh.ts` (add chat strings)
- Modify: `src/i18n/en.ts` (add chat strings)

- [ ] **Step 30: Create python/smart/query_engine.py**

```python
"""Natural language task query engine — converts questions to SQL + AI answers."""
import json
import re
from smart.ai_router import call_ai


def answer_query(question: str, tasks: list[dict]) -> dict:
    """Answer a natural language question about tasks.

    Args:
        question: User's question in natural language
        tasks: All tasks with fields: id, title, description, priority, status, sender,
               group_name, deadline, source, confidence, created_at

    Returns:
        dict with answer (natural language) and matched_task_ids
    """
    # Build a compact task summary for the AI
    task_summaries = []
    for t in tasks:
        ts = {
            'id': t.get('id', '')[:8],
            'title': t.get('title', ''),
            'priority': t.get('priority', 'medium'),
            'status': t.get('status', 'pending'),
            'sender': t.get('sender', ''),
            'group': t.get('group_name', ''),
            'deadline': t.get('deadline', ''),
            'source': t.get('source', ''),
            'confidence': t.get('confidence', 0),
        }
        task_summaries.append(ts)

    prompt = f"""你是一个任务查询助手。用户会用自然语言问关于他们待办事项的问题。
根据以下任务列表回答问题。只回答和任务相关的问题。

任务列表（JSON）：
{json.dumps(task_summaries, ensure_ascii=False)}

用户问题：{question}

请返回一个 JSON 对象：
{{
  "answer": "用中文自然语言回答用户的问题",
  "relevant_task_ids": ["匹配的任务ID列表，用前8位匹配"],
  "suggestion": "如果有建议可以补充在这里，没有则为空字符串"
}}"""

    try:
        result = call_ai(prompt, provider='deepseek', temperature=0.2)
        text = result if isinstance(result, str) else ''
        # Extract JSON from markdown code fences if present
        if '```' in text:
            m = re.search(r'```(?:json)?\s*\n?(.*?)```', text, re.DOTALL)
            if m:
                text = m.group(1).strip()
            else:
                start = text.find('{')
                end = text.rfind('}')
                if start != -1 and end != -1:
                    text = text[start:end+1]
        parsed = json.loads(text)

        # Match full IDs from partial IDs
        full_ids = []
        for tid in parsed.get('relevant_task_ids', []):
            for t in tasks:
                if t.get('id', '').startswith(tid):
                    full_ids.append(t.get('id'))
                    break

        return {
            'answer': parsed.get('answer', '抱歉，无法回答这个问题。'),
            'relevant_task_ids': full_ids,
            'suggestion': parsed.get('suggestion', ''),
        }
    except Exception as e:
        return {
            'answer': f'抱歉，查询出错了：{e}',
            'relevant_task_ids': [],
            'suggestion': '',
        }
```

- [ ] **Step 31: Add query action to python/main.py**

```python
            elif action == 'query':
                from smart.query_engine import answer_query
                data = cmd['data']
                result = answer_query(
                    question=data.get('question', ''),
                    tasks=data.get('tasks', []),
                )
                safe_print({'event': 'query_result', 'data': result, '_requestId': cmd.get('_requestId')})
```

- [ ] **Step 32: Add query IPC handler to electron/main.ts**

```typescript
ipcMain.handle('query-tasks', async (_e, question: string) => {
  const tasks = queryAll('SELECT * FROM tasks');
  try {
    const result = await sendToPythonAndWait({
      action: 'query',
      data: { question, tasks },
    }, 30000);
    return result;
  } catch (err) {
    console.error('[Main] query failed:', err);
    return { error: String(err) };
  }
});
```

- [ ] **Step 33: Add query route to electron/api/routes/tasks.ts**

```typescript
taskRoutes.post('/query', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });
  const tasks = queryAll('SELECT * FROM tasks');
  try {
    const result = await sendToPythonAndWait({
      action: 'query',
      data: { question, tasks },
    }, 30000);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});
```

- [ ] **Step 34: Create src/components/ChatPanel.tsx**

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import './ChatPanel.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  taskIds?: string[];
}

interface Props {
  visible: boolean;
  onToggle: () => void;
  onSelectTask: (id: string) => void;
}

export function ChatPanel({ visible, onToggle, onSelectTask }: Props) {
  const api = useApi();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是任务助手，你可以问我任何关于待办事项的问题。\n\n例如："有哪些高优先级的任务"、"张经理派的活"、"今天到期的"、\"SSL证书的截止时间是什么\"' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await api.askQuery(q);
      const answer = res?.answer || res?.error || '抱歉，查询失败。';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer + (res?.suggestion ? '\n\n💡 ' + res.suggestion : ''),
        taskIds: res?.relevant_task_ids || [],
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `查询失败: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!visible) {
    return (
      <button className="cp-toggle-btn" onClick={onToggle} title="AI 助手">
        💬
      </button>
    );
  }

  return (
    <div className="cp-panel">
      <div className="cp-header">
        <h3>🤖 AI 助手</h3>
        <button className="cp-close" onClick={onToggle}>✕</button>
      </div>
      <div className="cp-messages">
        {messages.map((m, i) => (
          <div key={i} className={`cp-msg cp-msg-${m.role}`}>
            <div className="cp-msg-content">{m.content}</div>
            {m.taskIds && m.taskIds.length > 0 && (
              <div className="cp-msg-tasks">
                {m.taskIds.map(id => (
                  <button key={id} className="cp-task-link" onClick={() => onSelectTask(id)}>
                    查看任务 →
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="cp-msg cp-msg-assistant"><div className="cp-typing">思考中...</div></div>}
        <div ref={endRef} />
      </div>
      <div className="cp-input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="问点什么... (Enter 发送)"
          rows={2}
          disabled={loading}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 35: Create src/components/ChatPanel.css**

```css
.cp-toggle-btn { position: fixed; right: 16px; bottom: 16px; width: 48px; height: 48px; border-radius: 50%; border: none; background: #4f6ef7; color: #fff; font-size: 20px; cursor: pointer; box-shadow: 0 4px 12px rgba(79,110,247,0.3); z-index: 100; }
.cp-toggle-btn:hover { background: #3b5de7; transform: scale(1.05); }
.cp-panel { position: fixed; right: 0; top: 0; bottom: 0; width: 380px; background: #fff; border-left: 1px solid #e5e7eb; display: flex; flex-direction: column; z-index: 200; box-shadow: -4px 0 24px rgba(0,0,0,0.08); }
.cp-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
.cp-header h3 { margin: 0; font-size: 15px; }
.cp-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; }
.cp-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.cp-msg { max-width: 90%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
.cp-msg-user { align-self: flex-end; background: #4f6ef7; color: #fff; border-bottom-right-radius: 4px; }
.cp-msg-assistant { align-self: flex-start; background: #f3f4f6; color: #333; border-bottom-left-radius: 4px; }
.cp-msg-tasks { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
.cp-task-link { padding: 3px 10px; background: #e5e7eb; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; color: #4f6ef7; }
.cp-typing { color: #999; font-style: italic; }
.cp-input-area { padding: 12px 16px; border-top: 1px solid #e5e7eb; }
.cp-input-area textarea { width: 100%; padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; resize: none; outline: none; font-family: inherit; }
.cp-input-area textarea:focus { border-color: #4f6ef7; }
```

- [ ] **Step 36: Update useApi.ts — add askQuery**

```typescript
const askQuery = async (question: string): Promise<any> => {
  if (window.electronAPI?.askQuery) {
    return window.electronAPI.askQuery(question);
  }
  const r = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  return r.json();
};
```
Add `askQuery` to the return object.

- [ ] **Step 37: Update App.tsx — add ChatPanel**

Add import and state:
```tsx
import { ChatPanel } from './components/ChatPanel';
const [chatVisible, setChatVisible] = useState(false);
```

Add ChatPanel at the end of the JSX (outside app-container):
```tsx
<ChatPanel
  visible={chatVisible}
  onToggle={() => setChatVisible(!chatVisible)}
  onSelectTask={(id) => {
    const task = tasks.find(t => t.id === id);
    if (task) setSelectedTask(task);
  }}
/>
```

- [ ] **Step 38: Add i18n strings for chat**

In `zh.ts`:
```typescript
chat: {
  title: 'AI 助手',
  placeholder: '问点什么... (Enter 发送)',
  greeting: '你好！我是任务助手，你可以问我任何关于待办事项的问题。\n\n例如："有哪些高优先级的任务"、"张经理派的活"、"今天到期的"、"SSL证书的截止时间是什么"',
  thinking: '思考中...',
  viewTask: '查看任务 →',
  fail: '查询失败',
},
```

In `en.ts`: equivalent English.

- [ ] **Step 39: Commit**

```bash
git add -A && git commit -m "feat: add AI smart query with ChatPanel"
```

---

### Task 6: Build Daily Briefing (`python/smart/briefer.py`)

**Files:**
- Create: `python/smart/briefer.py`
- Modify: `python/main.py` (add briefing action)
- Modify: `electron/main.ts` (add briefing IPC + scheduler)
- Modify: `electron/api/routes/tasks.ts` (add GET /api/briefing)
- Create: `src/components/DailyBriefing.tsx`
- Create: `src/components/DailyBriefing.css`
- Modify: `src/App.tsx` (add briefing card)
- Modify: `src/hooks/useApi.ts` (add getBriefing)
- Modify: `src/global.d.ts` (add getBriefing type)
- Modify: `src/i18n/zh.ts` (add briefing strings)
- Modify: `src/i18n/en.ts` (add briefing strings)

- [ ] **Step 40: Create python/smart/briefer.py**

```python
"""Daily briefing — generates a morning summary of tasks."""
import json
from datetime import datetime, timedelta
from smart.ai_router import call_ai


def generate_briefing(tasks: list[dict], completed_tasks: list[dict]) -> dict:
    """Generate a daily briefing.

    Args:
        tasks: All pending tasks
        completed_tasks: Recently completed tasks (last 7 days)

    Returns:
        dict with date, top_priorities, recently_completed, expiring_soon, stats, ai_advice
    """
    today = datetime.now().strftime('%Y-%m-%d')
    today_dt = datetime.now()

    # Compute stats locally — no AI needed
    pending = [t for t in tasks if t.get('status') != 'completed']
    high = [t for t in pending if t.get('priority') == 'high']
    due_today = [t for t in pending if t.get('deadline') == today]

    # Tasks expiring within 3 days
    expiring = []
    for t in pending:
        dl = t.get('deadline')
        if dl:
            try:
                d = datetime.strptime(dl, '%Y-%m-%d')
                days_left = (d - today_dt).days
                if 0 <= days_left <= 3:
                    expiring.append({'title': t.get('title'), 'deadline': dl, 'days_left': days_left})
            except ValueError:
                pass

    # Recently completed (last 2 days)
    recent_done = [
        {'title': t.get('title'), 'completed_at': t.get('updated_at', '')}
        for t in completed_tasks
    ][:5]

    # Get AI advice on prioritization
    advice = ''
    if pending:
        summary = json.dumps(
            [{'title': t.get('title'), 'priority': t.get('priority'), 'deadline': t.get('deadline')}
             for t in pending[:20]],
            ensure_ascii=False
        )[:3000]

        prompt = f"""你是任务管理助手。根据以下待办列表，给出今天优先处理哪 3 件事的建议（用中文，简洁）。

待办列表：
{summary}

今天日期：{today}

回答格式：直接给出建议，1-2 句话，不要 JSON。"""

        try:
            advice = call_ai(prompt, provider='deepseek', temperature=0.3)
            if isinstance(advice, dict):
                advice = advice.get('content', '')
        except Exception:
            advice = ''

    return {
        'date': today,
        'top_priorities': [
            {'title': t.get('title'), 'priority': t.get('priority'), 'deadline': t.get('deadline')}
            for t in high[:3]
        ] or [
            {'title': t.get('title'), 'priority': t.get('priority'), 'deadline': t.get('deadline')}
            for t in pending[:3]
        ],
        'recently_completed': recent_done,
        'expiring_soon': expiring[:5],
        'stats': {
            'pending': len(pending),
            'high': len(high),
            'due_today': len(due_today),
            'completed_recently': len(recent_done),
        },
        'ai_advice': advice.strip() if isinstance(advice, str) else str(advice).strip(),
    }
```

- [ ] **Step 41: Add briefing action to python/main.py**

```python
            elif action == 'generate_briefing':
                from smart.briefer import generate_briefing
                data = cmd['data']
                result = generate_briefing(
                    tasks=data.get('tasks', []),
                    completed_tasks=data.get('completed_tasks', []),
                )
                safe_print({'event': 'briefing_result', 'data': result, '_requestId': cmd.get('_requestId')})
```

- [ ] **Step 42: Add briefing IPC handler + scheduler to electron/main.ts**

Add IPC handler:
```typescript
ipcMain.handle('get-briefing', async () => {
  const tasks = queryAll("SELECT * FROM tasks WHERE status != 'completed'");
  const completedTasks = queryAll("SELECT * FROM tasks WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 20");
  try {
    const result = await sendToPythonAndWait({
      action: 'generate_briefing',
      data: { tasks, completed_tasks: completedTasks },
    }, 30000);
    return result;
  } catch (err) {
    console.error('[Main] briefing failed:', err);
    return { error: String(err) };
  }
});
```

Add daily scheduler (after `app.whenReady()`):
```typescript
// Schedule daily briefing notification at 9:00 AM
function scheduleDailyBriefing() {
  const now = new Date();
  const nineAM = new Date(now);
  nineAM.setHours(9, 0, 0, 0);
  if (now > nineAM) nineAM.setDate(nineAM.getDate() + 1);

  const msUntilNine = nineAM.getTime() - now.getTime();
  setTimeout(() => {
    if (mainWindow) {
      mainWindow.webContents.send('trigger-briefing');
    }
    // Re-schedule for next day
    scheduleDailyBriefing();
  }, msUntilNine);
}
scheduleDailyBriefing();
```

- [ ] **Step 43: Add GET /api/briefing route**

In `electron/api/routes/tasks.ts`:
```typescript
taskRoutes.get('/briefing', async (_req, res) => {
  const tasks = queryAll("SELECT * FROM tasks WHERE status != 'completed'");
  const completedTasks = queryAll("SELECT * FROM tasks WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 20");
  try {
    const result = await sendToPythonAndWait({
      action: 'generate_briefing',
      data: { tasks, completed_tasks: completedTasks },
    }, 30000);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});
```

- [ ] **Step 44: Create src/components/DailyBriefing.tsx**

```tsx
import React, { useEffect } from 'react';
import './DailyBriefing.css';

interface BriefingData {
  date?: string;
  top_priorities?: Array<{ title: string; priority: string; deadline: string }>;
  recently_completed?: Array<{ title: string; completed_at: string }>;
  expiring_soon?: Array<{ title: string; deadline: string; days_left: number }>;
  stats?: { pending: number; high: number; due_today: number; completed_recently: number };
  ai_advice?: string;
  error?: string;
}

interface Props {
  data: BriefingData | null;
  loading: boolean;
  onRefresh: () => void;
}

export function DailyBriefing({ data, loading, onRefresh }: Props) {
  if (!data && !loading) return null;

  return (
    <div className="db-card">
      <div className="db-header">
        <h3>📊 今日简报</h3>
        <div className="db-header-right">
          <span className="db-date">{data?.date || ''}</span>
          <button className="db-refresh" onClick={onRefresh} disabled={loading}>
            {loading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="db-loading">正在生成简报...</div>
      )}

      {data && (
        <>
          {data.top_priorities && data.top_priorities.length > 0 && (
            <div className="db-section">
              <h4>📌 优先处理</h4>
              {data.top_priorities.map((t, i) => (
                <div key={i} className="db-item">
                  <span className={`db-prio-dot ${t.priority}`} />
                  <span>{t.title}</span>
                  {t.deadline && <span className="db-deadline">截止 {t.deadline}</span>}
                </div>
              ))}
            </div>
          )}

          {data.expiring_soon && data.expiring_soon.length > 0 && (
            <div className="db-section">
              <h4>⚠️ 即将过期</h4>
              {data.expiring_soon.map((t, i) => (
                <div key={i} className="db-item db-item-warn">
                  <span>{t.title}</span>
                  <span className="db-days-left">剩 {t.days_left} 天</span>
                </div>
              ))}
            </div>
          )}

          {data.recently_completed && data.recently_completed.length > 0 && (
            <div className="db-section">
              <h4>✅ 最近完成</h4>
              {data.recently_completed.map((t, i) => (
                <div key={i} className="db-item db-item-done">
                  <span>{t.title}</span>
                </div>
              ))}
            </div>
          )}

          {data.ai_advice && (
            <div className="db-advice">
              <h4>💡 AI 建议</h4>
              <p>{data.ai_advice}</p>
            </div>
          )}

          <div className="db-stats">
            <div className="db-stat"><strong>{data.stats?.pending || 0}</strong> 待办</div>
            <div className="db-stat high"><strong>{data.stats?.high || 0}</strong> 紧急</div>
            <div className="db-stat today"><strong>{data.stats?.due_today || 0}</strong> 今日到期</div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 45: Create src/components/DailyBriefing.css**

```css
.db-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.db-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.db-header h3 { margin: 0; font-size: 15px; }
.db-header-right { display: flex; align-items: center; gap: 10px; }
.db-date { font-size: 12px; color: #999; }
.db-refresh { background: none; border: none; font-size: 16px; cursor: pointer; }
.db-loading { text-align: center; padding: 24px; color: #999; font-size: 13px; }
.db-section { margin-bottom: 14px; }
.db-section h4 { font-size: 12px; color: #888; margin: 0 0 8px; text-transform: uppercase; }
.db-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; color: #333; }
.db-item-warn { color: #d97706; }
.db-item-done { color: #999; text-decoration: line-through; }
.db-prio-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.db-prio-dot.high { background: #dc2626; }
.db-prio-dot.medium { background: #d97706; }
.db-prio-dot.low { background: #16a34a; }
.db-deadline { font-size: 11px; color: #999; margin-left: auto; }
.db-days-left { font-size: 11px; color: #dc2626; font-weight: 600; margin-left: auto; }
.db-advice { background: #f0f4ff; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
.db-advice h4 { font-size: 12px; margin: 0 0 4px; color: #4f6ef7; }
.db-advice p { font-size: 13px; color: #333; margin: 0; line-height: 1.6; }
.db-stats { display: flex; gap: 12px; }
.db-stat { flex: 1; text-align: center; padding: 10px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #666; }
.db-stat strong { display: block; font-size: 20px; color: #333; }
.db-stat.high strong { color: #dc2626; }
.db-stat.today strong { color: #d97706; }
```

- [ ] **Step 46: Update useApi.ts — add getBriefing**

```typescript
const getBriefing = async (): Promise<any> => {
  if (window.electronAPI?.getBriefing) {
    return window.electronAPI.getBriefing();
  }
  const r = await fetch(`${API_BASE}/briefing`);
  return r.json();
};
```
Add `getBriefing` to the return object.

- [ ] **Step 47: Update App.tsx — add DailyBriefing card**

Add to imports and state:
```tsx
import { DailyBriefing } from './components/DailyBriefing';
const [briefing, setBriefing] = useState<any>(null);
const [briefingLoading, setBriefingLoading] = useState(false);

const refreshBriefing = useCallback(async () => {
  setBriefingLoading(true);
  try {
    const b = await api.getBriefing();
    setBriefing(b);
  } catch (e) {
    console.error('Briefing fetch failed:', e);
  } finally {
    setBriefingLoading(false);
  }
}, [api]);

// Fetch briefing on mount
useEffect(() => { refreshBriefing(); }, []);

// Listen for 9am trigger from Electron
useEffect(() => {
  if (!window.electronAPI?.onTriggerBriefing) return;
  const unsub = window.electronAPI.onTriggerBriefing(() => {
    refreshBriefing();
    // Show desktop notification
    if (window.electronAPI?.showNotification) {
      window.electronAPI.showNotification('每日简报已生成', '点击查看今天的待办摘要');
    }
  });
  return () => { if (unsub) unsub(); };
}, [refreshBriefing]);
```

Add `<DailyBriefing>` card at top of panel-left, before `<TaskList>`.

- [ ] **Step 48: Add i18n strings for briefing**

In `zh.ts`:
```typescript
briefing: {
  title: '今日简报',
  generating: '正在生成简报...',
  topPriority: '优先处理',
  expiringSoon: '即将过期',
  recentlyDone: '最近完成',
  aiAdvice: 'AI 建议',
  statsPending: '待办',
  statsHigh: '紧急',
  statsToday: '今日到期',
  daysLeft: '剩 {n} 天',
  refresh: '刷新',
},
```

In `en.ts`: equivalent English.

- [ ] **Step 49: Commit**

```bash
git add -A && git commit -m "feat: add AI daily briefing with scheduler"
```

---

### Task 7: Final Integration & Cleanup

**Files:**
- Modify: `src/App.tsx` (wire ChatPanel + DailyBriefing + enhancement together)

- [ ] **Step 50: Final integration pass on App.tsx**

Ensure all three features coexist:
- DailyBriefing renders above TaskList in left panel
- ChatPanel toggle button floats at bottom-right
- TaskDetail has inline enhancement via "AI 分析" button
- ChatPanel task link clicks select the task in the detail panel

- [ ] **Step 51: Run TypeScript type check**

```bash
npx tsc -p tsconfig.json --noEmit
```
Fix any type errors.

- [ ] **Step 52: Final commit**

```bash
git add -A && git commit -m "feat: final integration of AI features"
```
