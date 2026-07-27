' Get the directory where this script is located
Set objFSO = CreateObject("Scripting.FileSystemObject")
scriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = scriptDir

' Kill previous instances to avoid port conflicts
WshShell.Run "cmd /c ""taskkill /F /IM electron.exe >nul 2>&1 & exit 0""", 0, True

' Compile TypeScript first (hidden, wait for completion)
WshShell.Run "cmd /c ""set PATH=C:\Program Files\nodejs;%PATH% && cd /d """ & scriptDir & """ && npx tsc -p tsconfig.electron.json""", 0, True

' Start the launcher (Vite + Electron) - hidden window
WshShell.Run "cmd /c ""set PATH=C:\Program Files\nodejs;%PATH% && cd /d """ & scriptDir & """ && node launcher.js""", 0, False
