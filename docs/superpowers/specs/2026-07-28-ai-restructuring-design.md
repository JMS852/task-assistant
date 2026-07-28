# AI Feature Restructuring — Design Spec

**Date:** 2026-07-28
**Status:** approved

## Overview

Remove the broken "Smart Execute" feature. Add three lightweight AI features that actually help:
task enhancement, smart query (natural language), and daily briefing.
Extract the removed Smart Execute code into a separate project.

## 1. Remove Smart Execute

### Files to delete
- `python/smart/orchestrator.py` — task orchestration engine
- `python/smart/sandbox.py` — Docker/subprocess code execution
- `python/smart/validator.py` — cross-validation (stub)
- `src/components/SmartExecute.tsx` — execute button UI

### Code to remove
- `electron/main.ts`: `execute-task` IPC handler, `sendToPythonAndWait` import (if unused elsewhere)
- `electron/api/routes/tasks.ts`: `POST /api/execute` route
- `src/hooks/useApi.ts`: `executeTask()` function
- `python/main.py`: `execute_task` action handler
- `src/i18n/`: smart-execute related strings

### Infrastructure to keep (reused by new features)
- `python/smart/ai_router.py` — `call_ai()`, `configure_provider()`, `get_available_providers()`
- `python/smart/adapters/` — DeepSeek, Qianwen, Doubao, Hunyuan providers

## 2. Extract as New Project

### New repo: `ai-executor`

```
ai-executor/
├── adapters/          # copied from task-assistant
├── ai_router.py       # copied from task-assistant
├── orchestrator.py    # migrated from task-assistant
├── sandbox.py         # migrated from task-assistant
├── validator.py       # migrated from task-assistant
├── main.py            # new entry point (stdin/stdout JSON protocol)
└── README.md
```

## 3. Task Enhancement (`python/engine/enhancer.py`)

**Trigger:** User clicks "AI 分析" on a task card (semi-auto).

**Function:** `enhance_task(task: dict, all_tasks: list) -> dict`

**AI call:** Single `call_ai()` with a prompt that includes the task + all existing tasks for context.

**Output:**
```json
{
  "background": "这条消息可能的背景是...",
  "subtasks": ["步骤1", "步骤2", ...],
  "priority_suggestion": "建议设为 high，因为...",
  "related_task_ids": ["id1", "id2"],
  "suggested_deadline": "2026-08-01 或 null"
}
```

**Frontend:** `src/components/TaskEnhancement.tsx` — inline card that replaces the "AI 分析" prompt after clicking. User can adopt/ignore each suggestion.

**Database:** New column `ai_enhancement` (JSON) in tasks table to persist results.

## 4. Smart Query (`python/smart/query_engine.py`)

**Trigger:** User types a question in the right-side chat panel.

**Function:** `answer_query(question: str, tasks: list) -> str`

**Mechanism:**
1. AI receives question + task list summary (id, title, priority, sender, deadline, status)
2. AI generates a SQL query OR identifies the filter criteria
3. Execute query against SQLite
4. AI formats results as natural language answer

**Frontend:** `src/components/ChatPanel.tsx` — collapsible right sidebar, chat UI with message bubbles, loading state.

**API:** `POST /api/query` — `{ question: string }` → `{ answer: string, tasks: [...] }`

## 5. Daily Briefing (`python/smart/briefer.py`)

**Trigger:** 
- Scheduled: Electron timer fires at 9:00 AM
- Manual: "Refresh" button on briefing card

**Function:** `generate_briefing(tasks: list, completed_tasks: list) -> dict`

**Output:**
```json
{
  "date": "2026-07-29",
  "top_priorities": [...],
  "recently_completed": [...],
  "expiring_soon": [...],
  "stats": { "pending": 12, "high": 3, "due_today": 1 },
  "ai_advice": "建议今天先处理..."
}
```

**AI call:** Optional — stats are computed locally; AI only generates the advice paragraph.

**Frontend:** `src/components/DailyBriefing.tsx` — card at top of task list, collapsible.

**Delivery:** Electron `Notification` API for desktop push when auto-generated.

## 6. Architecture

```
python/
├── engine/
│   ├── recognizer.py    # unchanged
│   ├── extractor.py     # unchanged
│   └── enhancer.py      # NEW
├── smart/
│   ├── ai_router.py     # unchanged
│   ├── adapters/         # unchanged
│   ├── query_engine.py   # NEW
│   └── briefer.py        # NEW
└── main.py               # modified (new action handlers)

src/components/
├── ChatPanel.tsx          # NEW
├── DailyBriefing.tsx      # NEW
├── TaskEnhancement.tsx    # NEW
└── (SmartExecute.tsx)     # DELETED

electron/
├── main.ts                # modified
└── api/routes/tasks.ts    # modified
```

All three new features share `ai_router.py` as their AI infrastructure layer.
They are independent — each can be used without the others.
No feature automatically mutates tasks; all adopt user confirmation.
