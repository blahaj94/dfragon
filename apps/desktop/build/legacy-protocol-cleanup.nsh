!define DFRAGON_LEGACY_PROTOCOL_KEY "Software\Classes\${DFRAGON_LEGACY_PROTOCOL_SCHEME}"
!define DFRAGON_LEGACY_PROTOCOL_COMMAND '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

; Remove only this executable's legacy per-user handler, preserving other apps' keys.
!macro cleanupDfragonLegacyProtocol
  ReadRegStr $0 HKCU "${DFRAGON_LEGACY_PROTOCOL_KEY}\shell\open\command" ""
  ${If} $0 == '${DFRAGON_LEGACY_PROTOCOL_COMMAND}'
    DeleteRegKey HKCU "${DFRAGON_LEGACY_PROTOCOL_KEY}"
  ${EndIf}
!macroend

!macro customInstall
  !insertmacro cleanupDfragonLegacyProtocol
!macroend

!macro customUnInstall
  !insertmacro cleanupDfragonLegacyProtocol
!macroend
