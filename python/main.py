import sys
import json
import os

sys.path.insert(0, os.path.dirname(__file__))

from db.schema import init_db


def main():
    init_db()
    print("[Python] Backend initialized", flush=True)

    for line in sys.stdin:
        try:
            cmd = json.loads(line.strip())
            action = cmd.get('action')
            if action == 'ping':
                print(json.dumps({'status': 'ok'}), flush=True)
            elif action == 'start_collector':
                from collector.uia_listener import start_listener
                start_listener()
                print(json.dumps({'status': 'collector_started'}), flush=True)
            elif action == 'process_message':
                from engine.recognizer import recognize_task
                result = recognize_task(cmd['data'])
                print(json.dumps(result), flush=True)
            elif action == 'execute_task':
                from smart.orchestrator import execute
                result = execute(cmd['data'])
                print(json.dumps(result), flush=True)
            else:
                print(json.dumps({'error': f'Unknown action: {action}'}), flush=True)
        except Exception as e:
            print(json.dumps({'error': str(e)}), flush=True)


if __name__ == '__main__':
    main()
