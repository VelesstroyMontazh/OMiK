Attribute VB_Name = "ZatratyPoBiletam"
' =============================================================================
' OMiK_VSM — «Затраты по билетам» (Excel 2016, русская версия)
'
' Полный цикл как на вкладке «Загрузить и обработать»:
'   1) Сбор Excel из папки (или активная книга)
'   2) Загрузка файлов на сервер (опционально)
'   3) Загрузка в реестр (raw_import)
'   4) Обработать и отобразить (дедупликация + База + processed)
'
' Требования:
'   - Запущен excel-service: http://127.0.0.1:3031  (START.bat или start-excel-service.cmd)
'   - Файлы на диске доступны процессу Python (обычно тот же ПК)
'
' Установка: Файл → Параметры → Центр управления безопасностью → Параметры макросов
'            → «Доверять доступ к объектной модели VBA» (при запросе HTTP).
'            Alt+F11 → Файл → Импорт файла → выбрать этот .bas
' =============================================================================

Option Explicit

' --- Настройки (можно менять перед запуском) ---
Private Const API_BASE As String = "http://127.0.0.1:3031"
Private Const WEB_APP As String = "http://127.0.0.1:3000"
Private Const FUZZY_FIO_PERCENT As Long = 86
Private Const USE_UPLOAD_FIRST As Boolean = False   ' True — копировать в upload через /api/upload
Private Const OPEN_BROWSER_AFTER As Boolean = True

' Реестр: "vsm" = ВелесстройМонтаж, "sk" = Стройконстракшен
Private Const DEFAULT_REGISTRY As String = "vsm"

' =============================================================================
' ТОЧКИ ВХОДА (назначьте кнопкам на листе)
' =============================================================================

' Полный цикл: папка → реестр → обработка → открыть веб-интерфейс
Public Sub ZatratyBilety_ObrabotatI_Otobrazit()
    Dim reg As String
    Dim folder As String
    Dim paths As Collection
    Dim serverPaths As Collection
    Dim i As Long
    Dim msg As String
    
    On Error GoTo ErrHandler
    
    reg = PromptRegistry()
    If reg = "" Then Exit Sub
    
    folder = PromptFolder()
    If folder = "" Then Exit Sub
    
    Set paths = CollectExcelFiles(folder)
    If paths.Count = 0 Then
        MsgBox "В папке нет файлов .xlsx / .xlsm / .xls:" & vbCrLf & folder, vbExclamation, "Затраты по билетам"
        Exit Sub
    End If
    
    If Not ApiHealthOk() Then
        MsgBox "Сервер excel-service не отвечает на " & API_BASE & vbCrLf & _
               "Запустите START.bat или .zscripts\start-excel-service.cmd", vbCritical
        Exit Sub
    End If
    
    Application.StatusBar = "Затраты по билетам: подготовка " & paths.Count & " файл(ов)..."
    Set serverPaths = New Collection
    
    For i = 1 To paths.Count
        Application.StatusBar = "Файл " & i & " / " & paths.Count & ": " & CStr(paths(i))
        If USE_UPLOAD_FIRST Then
            serverPaths.Add ApiUploadFile(CStr(paths(i)))
        Else
            serverPaths.Add CStr(paths(i))
        End If
        DoEvents
    Next i
    
    Application.StatusBar = "Загрузка в реестр «" & RegistryLabel(reg) & "»..."
    msg = ApiLoadFiles(serverPaths, reg, False)
    
    Application.StatusBar = "Обработка и отображение..."
    msg = msg & vbCrLf & ApiProcess(reg, FUZZY_FIO_PERCENT)
    
    Application.StatusBar = False
    MsgBox msg, vbInformation, "Затраты по билетам — готово"
    
    If OPEN_BROWSER_AFTER Then
        Shell "cmd /c start """" """ & WEB_APP & """", vbHide
    End If
    Exit Sub

ErrHandler:
    Application.StatusBar = False
    MsgBox "Ошибка: " & Err.Description, vbCritical, "Затраты по билетам"
End Sub

' Только активная книга (сохраните перед запуском)
Public Sub ZatratyBilety_ObrabotatAktivnuyuKnigu()
    Dim reg As String
    Dim p As String
    Dim paths As Collection
    Dim msg As String
    
    On Error GoTo ErrHandler
    
    If ActiveWorkbook Is Nothing Then
        MsgBox "Нет открытой книги.", vbExclamation
        Exit Sub
    End If
    
    reg = PromptRegistry()
    If reg = "" Then Exit Sub
    
    If ActiveWorkbook.Path = "" Then
        MsgBox "Сначала сохраните книгу на диск.", vbExclamation
        Exit Sub
    End If
    
    If Not ApiHealthOk() Then
        MsgBox "Сервер не отвечает: " & API_BASE, vbCritical
        Exit Sub
    End If
    
    p = ActiveWorkbook.FullName
    Set paths = New Collection
    If USE_UPLOAD_FIRST Then
        paths.Add ApiUploadFile(p)
    Else
        paths.Add p
    End If
    
    msg = ApiLoadFiles(paths, reg, False)
    msg = msg & vbCrLf & ApiProcess(reg, FUZZY_FIO_PERCENT)
    MsgBox msg, vbInformation
    If OPEN_BROWSER_AFTER Then Shell "cmd /c start """" """ & WEB_APP & """", vbHide
    Exit Sub
ErrHandler:
    MsgBox Err.Description, vbCritical
End Sub

' Только загрузка в реестр (без обработки)
Public Sub ZatratyBilety_ZagruzitVReestr()
    Dim reg As String
    Dim folder As String
    Dim paths As Collection
    
    reg = PromptRegistry()
    If reg = "" Then Exit Sub
    folder = PromptFolder()
    If folder = "" Then Exit Sub
    
    Set paths = CollectExcelFiles(folder)
    If paths.Count = 0 Then Exit Sub
    If Not ApiHealthOk() Then Exit Sub
    
    MsgBox ApiLoadFiles(paths, reg, False), vbInformation
End Sub

' Только «Обработать и отобразить» (сырые данные уже в реестре)
Public Sub ZatratyBilety_TolkoObrabotka()
    Dim reg As String
    reg = PromptRegistry()
    If reg = "" Then Exit Sub
    If Not ApiHealthOk() Then Exit Sub
    MsgBox ApiProcess(reg, FUZZY_FIO_PERCENT), vbInformation
End Sub

' Повторить дедупликацию и обогащение из Базы
Public Sub ZatratyBilety_PovtoritDedupIBazu()
    Dim reg As String
    reg = PromptRegistry()
    If reg = "" Then Exit Sub
    If Not ApiHealthOk() Then Exit Sub
    MsgBox ApiDedupeEnrich(reg, False, FUZZY_FIO_PERCENT, True), vbInformation
End Sub

' Fuzzy по ФИО (без повторной дедупликации)
Public Sub ZatratyBilety_FuzzyPoFIO()
    Dim reg As String
    reg = PromptRegistry()
    If reg = "" Then Exit Sub
    If Not ApiHealthOk() Then Exit Sub
    MsgBox ApiDedupeEnrich(reg, True, FUZZY_FIO_PERCENT, False), vbInformation
End Sub

' =============================================================================
' API
' =============================================================================

Private Function ApiHealthOk() As Boolean
    On Error Resume Next
    Dim r As String
    r = HttpGet(API_BASE & "/api/health")
    ApiHealthOk = (InStr(1, r, """status""", vbTextCompare) > 0 Or InStr(1, r, "ok", vbTextCompare) > 0)
    On Error GoTo 0
End Function

Private Function ApiLoadFiles(paths As Collection, registry As String, append As Boolean) As String
    Dim body As String
    Dim i As Long
    Dim arr As String
    
    arr = ""
    For i = 1 To paths.Count
        If arr <> "" Then arr = arr & ","
        arr = arr & """" & JsonEscape(CStr(paths(i))) & """"
    Next i
    
    body = "{""file_paths"":[" & arr & "],""registry"":""" & registry & """,""append"":" & LCase$(CStr(append)) & "}"
    ApiLoadFiles = ParseApiResult(HttpPostJson(API_BASE & "/api/tickets-costs/load", body))
End Function

Private Function ApiProcess(registry As String, fuzzyPct As Long) As String
    Dim body As String
    body = "{""registry"":""" & registry & """,""fuzzy_fio_cutoff"":" & CStr(fuzzyPct) & "}"
    ApiProcess = ParseApiResult(HttpPostJson(API_BASE & "/api/tickets-costs/process", body))
End Function

Private Function ApiDedupeEnrich(registry As String, fuzzy As Boolean, fuzzyPct As Long, runDedupe As Boolean) As String
    Dim body As String
    body = "{""registry"":""" & registry & """,""fuzzy"":" & LCase$(CStr(fuzzy)) & _
           ",""fuzzy_fio_cutoff"":" & CStr(fuzzyPct) & ",""run_dedupe"":" & LCase$(CStr(runDedupe)) & "}"
    ApiDedupeEnrich = ParseApiResult(HttpPostJson(API_BASE & "/api/tickets-costs/dedupe-enrich", body))
End Function

Private Function ApiUploadFile(fullPath As String) As String
    Dim resp As String
    Dim fp As String
    
    resp = HttpPostMultipart(API_BASE & "/api/upload", fullPath, "file")
    fp = JsonGetValue(resp, "file_path")
    If fp = "" Then fp = JsonGetValue(resp, "stored_filename")
    If fp = "" Then Err.Raise vbObjectError + 1, , "Нет file_path в ответе upload: " & Left$(resp, 200)
    ApiUploadFile = fp
End Function

Private Function ParseApiResult(json As String) As String
    Dim errMsg As String
    errMsg = JsonGetValue(json, "error")
    If errMsg <> "" Then Err.Raise vbObjectError + 2, , errMsg
    If JsonGetValue(json, "detail") <> "" Then Err.Raise vbObjectError + 3, , JsonGetValue(json, "detail")
    
    ParseApiResult = "Успех."
    If JsonGetValue(json, "processed_rows") <> "" Then
        ParseApiResult = ParseApiResult & " Строк processed: " & JsonGetValue(json, "processed_rows") & "."
    End If
    If JsonGetValue(json, "raw_rows") <> "" Then
        ParseApiResult = ParseApiResult & " Сырых строк: " & JsonGetValue(json, "raw_rows") & "."
    End If
    If JsonGetValue(json, "files_loaded") <> "" Then
        ParseApiResult = ParseApiResult & " Файлов: " & JsonGetValue(json, "files_loaded") & "."
    End If
End Function

' =============================================================================
' HTTP (WinHttp + ADODB для UTF-8)
' =============================================================================

Private Function HttpGet(url As String) As String
    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "GET", url, False
    http.SetTimeouts 5000, 60000, 300000, 300000
    http.Send
    If http.Status >= 400 Then Err.Raise vbObjectError + 10, , "HTTP " & http.Status & ": " & http.ResponseText
    HttpGet = http.ResponseText
End Function

Private Function HttpPostJson(url As String, jsonBody As String) As String
    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "POST", url, False
    http.SetTimeouts 5000, 120000, 900000, 900000
    http.SetRequestHeader "Content-Type", "application/json; charset=utf-8"
    http.Send Utf8Bytes(jsonBody)
    If http.Status >= 400 Then Err.Raise vbObjectError + 11, , "HTTP " & http.Status & ": " & Left$(http.ResponseText, 500)
    HttpPostJson = http.ResponseText
End Function

Private Function HttpPostMultipart(url As String, filePath As String, fieldName As String) As String
    Dim http As Object
    Dim boundary As String
    Dim body() As Byte
    Dim fileBytes() As Byte
    Dim fn As String
    Dim preamble As String
    Dim epilogue As String
    Dim stream As Object
    
    boundary = "----VBA" & Format$(Timer * 1000, "0")
    fn = Mid$(filePath, InStrRev(filePath, "\") + 1)
    
    fileBytes = ReadFileBytes(filePath)
    
    preamble = "--" & boundary & vbCrLf & _
        "Content-Disposition: form-data; name=""" & fieldName & """; filename=""" & fn & """" & vbCrLf & _
        "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" & vbCrLf & vbCrLf
    
    epilogue = vbCrLf & "--" & boundary & "--" & vbCrLf
    
    body = ConcatBytes(ToUtf8(preamble), fileBytes, ToUtf8(epilogue))
    
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "POST", url, False
    http.SetTimeouts 5000, 120000, 900000, 900000
    http.SetRequestHeader "Content-Type", "multipart/form-data; boundary=" & boundary
    http.Send body
    If http.Status >= 400 Then Err.Raise vbObjectError + 12, , "HTTP " & http.Status & ": " & Left$(http.ResponseText, 500)
    HttpPostMultipart = http.ResponseText
End Function

Private Function Utf8Bytes(text As String) As Variant
    Dim stm As Object
    Set stm = CreateObject("ADODB.Stream")
    stm.Type = 2
    stm.Charset = "utf-8"
    stm.Open
    stm.WriteText text
    stm.Position = 0
    stm.Type = 1
    Utf8Bytes = stm.Read
    stm.Close
End Function

Private Function ToUtf8(text As String) As Byte()
    Dim v As Variant
    Dim i As Long
    v = Utf8Bytes(text)
    ReDim ToUtf8(0 To UBound(v))
    For i = LBound(v) To UBound(v)
        ToUtf8(i) = v(i)
    Next i
End Function

Private Function ReadFileBytes(path As String) As Byte()
    Dim stm As Object
    Set stm = CreateObject("ADODB.Stream")
    stm.Type = 1
    stm.Open
    stm.LoadFromFile path
    ReadFileBytes = stm.Read
    stm.Close
End Function

Private Function ConcatBytes(ParamArray parts() As Variant) As Byte()
    Dim total As Long
    Dim i As Long
    Dim j As Long
    Dim b() As Byte
    Dim p() As Byte
    Dim off As Long
    
    total = 0
    For i = LBound(parts) To UBound(parts)
        p = parts(i)
        total = total + UBound(p) + 1
    Next i
    ReDim b(0 To total - 1)
    off = 0
    For i = LBound(parts) To UBound(parts)
        p = parts(i)
        For j = LBound(p) To UBound(p)
            b(off) = p(j)
            off = off + 1
        Next j
    Next i
    ConcatBytes = b
End Function

' =============================================================================
' Вспомогательные
' =============================================================================

Private Function CollectExcelFiles(folder As String) As Collection
    Dim f As String
    Dim col As New Collection
    Dim ext As String
    
    If Right$(folder, 1) <> "\" Then folder = folder & "\"
    f = Dir(folder & "*.*")
    Do While f <> ""
        If f <> "." And f <> ".." Then
            ext = LCase$(Mid$(f, InStrRev(f, ".")))
            If ext = ".xlsx" Or ext = ".xlsm" Or ext = ".xls" Then
                col.Add folder & f
            End If
        End If
        f = Dir
    Loop
    Set CollectExcelFiles = col
End Function

Private Function PromptRegistry() As String
    Dim s As String
    s = InputBox( _
        "Реестр:" & vbCrLf & _
        "  vsm — ВелесстройМонтаж" & vbCrLf & _
        "  sk  — Стройконстракшен" & vbCrLf & vbCrLf & _
        "Введите vsm или sk:", _
        "Затраты по билетам", DEFAULT_REGISTRY)
    s = LCase$(Trim$(s))
    If s = "vsm" Or s = "sk" Then
        PromptRegistry = s
    ElseIf s = "" Then
        PromptRegistry = ""
    Else
        MsgBox "Нужно vsm или sk.", vbExclamation
        PromptRegistry = ""
    End If
End Function

Private Function PromptFolder() As String
    Dim fd As FileDialog
    Dim def As String
    
    On Error Resume Next
    If Not ActiveWorkbook Is Nothing Then
        If ActiveWorkbook.Path <> "" Then def = ActiveWorkbook.Path
    End If
    On Error GoTo 0
    
    Set fd = Application.FileDialog(msoFileDialogFolderPicker)
    With fd
        .Title = "Папка с Excel-файлами билетов"
        If def <> "" Then .InitialFileName = def
        If .Show = -1 Then
            PromptFolder = .SelectedItems(1)
        Else
            PromptFolder = ""
        End If
    End With
End Function

Private Function RegistryLabel(reg As String) As String
    Select Case reg
        Case "sk": RegistryLabel = "Стройконстракшен"
        Case Else: RegistryLabel = "ВелесстройМонтаж"
    End Select
End Function

Private Function JsonEscape(s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    JsonEscape = s
End Function

Private Function JsonGetValue(json As String, key As String) As String
    Dim p As Long
    Dim q As Long
    Dim pat As String
    
    pat = """" & key & """:"
    p = InStr(1, json, pat, vbTextCompare)
    If p = 0 Then Exit Function
    p = p + Len(pat)
    Do While p <= Len(json) And Mid$(json, p, 1) = " "
        p = p + 1
    Loop
    If Mid$(json, p, 1) = """" Then
        p = p + 1
        q = p
        Do While q <= Len(json)
            If Mid$(json, q, 1) = """" And Mid$(json, q - 1, 1) <> "\" Then Exit Do
            q = q + 1
        Loop
        JsonGetValue = Replace(Mid$(json, p, q - p), "\""", """")
    Else
        q = p
        Do While q <= Len(json)
            If InStr("0123456789-,", Mid$(json, q, 1)) = 0 Then Exit Do
            q = q + 1
        Loop
        JsonGetValue = Trim$(Mid$(json, p, q - p))
        If Right$(JsonGetValue, 1) = "," Then JsonGetValue = Left$(JsonGetValue, Len(JsonGetValue) - 1)
    End If
End Function
