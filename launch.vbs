Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Lenovo\task-assistant"

' Compile TypeScript first (hidden, wait for completion)
WshShell.Run "cmd /c ""set PATH=C:\Program Files\nodejs;%PATH% && cd /d C:\Users\Lenovo\task-assistant && npx tsc -p tsconfig.electron.json""", 0, True

' Start the launcher (Vite + Electron) - hidden window
WshShell.Run "cmd /c ""set PATH=C:\Program Files\nodejs;%PATH% && cd /d C:\Users\Lenovo\task-assistant && node launcher.js""", 0, False
