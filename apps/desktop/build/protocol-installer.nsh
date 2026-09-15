!define LDB_PROTOCOL_KEY "Software\Classes\${LDB_PROTOCOL_SCHEME}"
!define LDB_PROTOCOL_COMMAND '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

; The top-level electron-builder protocols option does not register NSIS handlers.
; Check the merged view so a per-user install cannot shadow another app's handler.
!macro checkLdbProtocolOwner
  System::Call 'advapi32::RegOpenKeyExW(p 0x80000000, w "${LDB_PROTOCOL_SCHEME}", i 0, i 0x20019, *p .r1) i .r0'
  ${If} $0 == 0
    System::Call 'advapi32::RegCloseKey(p r1)'
    ReadRegStr $0 HKCR "${LDB_PROTOCOL_SCHEME}\shell\open\command" ""
    ${If} $0 != '${LDB_PROTOCOL_COMMAND}'
      MessageBox MB_OK|MB_ICONSTOP "The ${LDB_PROTOCOL_SCHEME} protocol belongs to another application. Installation stopped." /SD IDOK
      SetErrorLevel 1
      Abort
    ${EndIf}
  ${ElseIf} $0 != 2
    MessageBox MB_OK|MB_ICONSTOP "The ${LDB_PROTOCOL_SCHEME} protocol registration could not be checked. Installation stopped." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
!macroend

!macro customInit
  !insertmacro checkLdbProtocolOwner
!macroend

!macro customInstall
  !insertmacro checkLdbProtocolOwner
  ClearErrors
  WriteRegStr HKCU "${LDB_PROTOCOL_KEY}" "" "URL:${LDB_PROTOCOL_DESCRIPTION}"
  WriteRegStr HKCU "${LDB_PROTOCOL_KEY}" "URL Protocol" ""
  WriteRegStr HKCU "${LDB_PROTOCOL_KEY}\shell\open\command" "" '${LDB_PROTOCOL_COMMAND}'
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "The ${LDB_PROTOCOL_SCHEME} protocol could not be registered. Installation failed." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
!macroend

!macro customUnInstall
  ReadRegStr $0 HKCU "${LDB_PROTOCOL_KEY}\shell\open\command" ""
  ${If} $0 == '${LDB_PROTOCOL_COMMAND}'
    DeleteRegKey HKCU "${LDB_PROTOCOL_KEY}"
  ${EndIf}
!macroend
