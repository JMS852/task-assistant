import sys
import json
import os
import uuid
import threading
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

# Prevent surrogate encoding errors when writing to pipe stdout
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from collector.uia_listener import start_listener, stop_listener, is_running
from engine.recognizer import recognize_task, heuristic_check
from engine.extractor import extract_task_info


def _recognize_message(msg: dict, from_history: bool = False) -> dict | None:
    """Run recognition + extraction on a single message. Returns task dict or None."""
    content = msg.get('content', '')
    result = recognize_task({
        'id': str(uuid.uuid4()),
        'content': content,
        'context': [],
    })

    if not (result.get('is_task') and result.get('confidence', 0) > 0.15):
        return None

    extracted = extract_task_info(content)
    task = {
        'id': str(uuid.uuid4()),
        'title': extracted.get('title', content[:50]),
        'description': extracted.get('description', content),
        'priority': extracted.get('priority', 'medium'),
        'deadline': extracted.get('deadline'),
        'source': msg.get('source', 'wechat'),
        'sender': msg.get('sender', ''),
        'group_name': msg.get('group_name'),
        'confidence': result.get('confidence', 0.5),
        'context_missing': 0,
        'captured_at': msg.get('captured_at', datetime.now().isoformat()),
    }
    if from_history:
        task['from_history'] = True
    return task


def process_captured_message(msg: dict):
    """Process a captured message through the recognition pipeline and output new tasks."""
    try:
        content = msg.get('content', '')
        # Always forward the raw captured message to the frontend for visibility
        raw_event = {
            'sender': msg.get('sender', ''),
            'content': content,
            'source': msg.get('source', 'wechat'),
            'captured_at': msg.get('captured_at', datetime.now().isoformat()),
        }
        safe_print({'event': 'message_captured', 'data': raw_event})

        # Quick heuristic diagnostic (always printed so we can see what's happening)
        h_is_task, h_conf, h_matched = heuristic_check(content)

        # Run recognition + extraction
        task = _recognize_message(msg)

        # Output recognition result for diagnostics
        safe_print({
            'event': 'recognition_result',
            'data': {
                'content': content[:80],
                'is_task': task is not None,
                'confidence': task['confidence'] if task else 0,
                'rationale': 'heuristic' if task else 'no match',
                'heuristic_score': round(h_conf, 3),
                'heuristic_matches': h_matched[:5],
            }
        })

        if task:
            safe_print({'event': 'new_task', 'data': task})
    except Exception as e:
        safe_print({'event': 'error', 'data': str(e)})


def safe_json(obj) -> str:
    """JSON dump with surrogate protection for pipe I/O."""
    text = json.dumps(obj, ensure_ascii=False)
    return text.encode('utf-8', errors='replace').decode('utf-8')


def safe_print(obj):
    print(safe_json(obj), flush=True)


def _run_history_scan(max_days: int = 7):
    """Background thread: scan chat history and feed results into recognition pipeline."""
    safe_print({'event': 'history_scan_started', 'data': {'max_days': max_days}})

    # Diagnostic: import each sub-module individually to find hang point
    safe_print({'event': 'history_scan_log', 'data': 'importing uia_listener...'})
    try:
        from collector import uia_listener as _ul
    except Exception as _e:
        safe_print({'event': 'history_scan_log', 'data': f'ERROR: import uia_listener failed: {_e}'})
        safe_print({'event': 'history_scan_complete', 'data': {'total_messages': 0, 'tasks_found': 0, 'windows_scanned': 0, 'errors': [str(_e)]}})
        return

    safe_print({'event': 'history_scan_log', 'data': 'importing chat_history_scanner...'})
    try:
        from collector.chat_history_scanner import scan_all_chats
    except Exception as import_err:
        import traceback as _tb
        safe_print({'event': 'history_scan_log', 'data': f'ERROR: Failed to import chat_history_scanner: {import_err}\n{_tb.format_exc()[-800:]}'})
        safe_print({'event': 'history_scan_complete', 'data': {
            'windows_scanned': 0, 'total_messages': 0, 'tasks_found': 0,
            'errors': [f'Import error: {import_err}'],
        }})
        return

    safe_print({'event': 'history_scan_log', 'data': 'import done, starting scan...'})

    def on_progress(stage, info):
        safe_print({'event': 'history_scan_progress', 'data': {'stage': stage, **info}})

    try:
        # Run scan_all_chats with a 120s timeout via ThreadPoolExecutor
        # to guard against hangs inside SetForegroundWindow / clipboard / UIA
        from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
        safe_print({'event': 'history_scan_progress', 'data': {'stage': 'scanning', 'phase': 'starting'}})
        with ThreadPoolExecutor(max_workers=1) as _executor:
            _future = _executor.submit(scan_all_chats, max_days=max_days, progress_callback=on_progress)
            try:
                result = _future.result(timeout=120.0)
            except FutureTimeout:
                safe_print({'event': 'error', 'data': 'scan_all_chats timed out after 120s'})
                safe_print({'event': 'history_scan_complete', 'data': {
                    'windows_scanned': 0, 'total_messages': 0, 'tasks_found': 0,
                    'errors': ['Timeout: scan_all_chats took longer than 120s'],
                }})
                return
        stats = result['stats']
        messages = result['messages']

        safe_print({'event': 'history_scan_collected', 'data': {
            'windows_scanned': stats['windows_scanned'],
            'total_messages': stats['total_messages'],
            'errors': stats['errors'],
        }})

        # Feed each message through the recognition pipeline
        task_count = 0
        for i, msg in enumerate(messages):
            # Progress update every 10 messages
            if i % 10 == 0:
                safe_print({'event': 'history_scan_progress', 'data': {
                    'stage': 'processing',
                    'processed': i,
                    'total': len(messages),
                    'tasks_found': task_count,
                }})

            try:
                task = _recognize_message(msg, from_history=True)
                if task:
                    safe_print({'event': 'new_task', 'data': task})
                    task_count += 1
            except Exception as e:
                safe_print({'event': 'history_scan_log', 'data': f'ERROR: History msg recognition error: {e}'})

        safe_print({'event': 'history_scan_complete', 'data': {
            'windows_scanned': stats['windows_scanned'],
            'total_messages': stats['total_messages'],
            'tasks_found': task_count,
            'errors': stats['errors'],
        }})
    except Exception as e:
        import traceback
        safe_print({'event': 'history_scan_log', 'data': f'ERROR: History scan failed: {e}\n{traceback.format_exc()[-500:]}'})


def main():
    # Emit ready signal for Electron bridge handshake
    safe_print({'status': 'ready'})

    for line in sys.stdin:
        try:
            cmd = json.loads(line.strip())
            action = cmd.get('action')
            if action == 'ping':
                safe_print({'status': 'ok'})
            elif action == 'start_collector':
                if is_running():
                    safe_print({'status': 'collector_already_running'})
                else:
                    def handle_message(msg):
                        process_captured_message(msg)
                    start_listener(callback=handle_message)
                    safe_print({'status': 'collector_started'})
            elif action == 'stop_collector':
                stop_listener()
                safe_print({'status': 'collector_stopped'})
            elif action == 'test_pipeline':
                # Full pipeline test: takes raw text, runs recognition+extraction
                msg = {
                    'sender': cmd.get('sender', '测试用户'),
                    'content': cmd.get('content', ''),
                    'source': cmd.get('source', 'manual'),
                    'captured_at': datetime.now().isoformat(),
                }
                process_captured_message(msg)
            elif action == 'process_message':
                from engine.recognizer import recognize_task
                result = recognize_task(cmd['data'])
                safe_print(result)
            elif action == 'execute_task':
                from smart.orchestrator import execute
                import traceback
                try:
                    result = execute(cmd['data'])
                    safe_print({'event': 'task_executed', 'data': result, '_requestId': cmd.get('_requestId')})
                except Exception as e:
                    tb = traceback.format_exc()
                    safe_print({'event': 'error', 'data': f'{e}\n\n{tb[-1000:]}', '_requestId': cmd.get('_requestId')})
            elif action == 'configure_provider':
                from smart.ai_router import configure_provider
                data = cmd['data']
                result = configure_provider(
                    provider=data['provider'],
                    api_key=data.get('api_key', ''),
                    endpoint=data.get('endpoint', ''),
                    enabled=data.get('enabled', True),
                )
                safe_print(result)
            elif action == 'scan_history':
                safe_print({'event': 'log', 'data': f'Received scan_history action, max_days={cmd.get("max_days", 7)}'})
                threading.Thread(
                    target=_run_history_scan,
                    args=(cmd.get('max_days', 7),),
                    daemon=True,
                ).start()
            else:
                safe_print({'event': 'error', 'data': f'Unknown action: {action}'})
        except Exception as e:
            safe_print({'event': 'error', 'data': str(e), '_requestId': cmd.get('_requestId') if 'cmd' in dir() else None})


if __name__ == '__main__':
    main()
