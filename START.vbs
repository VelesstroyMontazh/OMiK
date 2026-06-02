' Launcher: keeps console open (use if START.bat flashes and closes)
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd.exe /k call """ & dir & "\START.bat"" run", 1, False
