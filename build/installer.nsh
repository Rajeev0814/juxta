; Custom NSIS hooks (electron-builder calls these macros) that register Juxta's
; Explorer context-menu verbs under HKCU (per-user, no admin needed).
; Two-step compare: "Select Left" on one item, then "Compare with Selected" on
; another. Registered for both files (*) and folders (Directory).

!macro customInstall
  WriteRegStr HKCU "Software\Classes\*\shell\JuxtaSelectLeft" "" "Juxta: Select Left"
  WriteRegStr HKCU "Software\Classes\*\shell\JuxtaSelectLeft" "Icon" "$INSTDIR\Juxta.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\JuxtaSelectLeft\command" "" '"$INSTDIR\Juxta.exe" --juxta-select "%1"'
  WriteRegStr HKCU "Software\Classes\*\shell\JuxtaCompareWith" "" "Juxta: Compare with Selected"
  WriteRegStr HKCU "Software\Classes\*\shell\JuxtaCompareWith" "Icon" "$INSTDIR\Juxta.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\JuxtaCompareWith\command" "" '"$INSTDIR\Juxta.exe" --juxta-compare "%1"'

  WriteRegStr HKCU "Software\Classes\Directory\shell\JuxtaSelectLeft" "" "Juxta: Select Left"
  WriteRegStr HKCU "Software\Classes\Directory\shell\JuxtaSelectLeft" "Icon" "$INSTDIR\Juxta.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\JuxtaSelectLeft\command" "" '"$INSTDIR\Juxta.exe" --juxta-select "%1"'
  WriteRegStr HKCU "Software\Classes\Directory\shell\JuxtaCompareWith" "" "Juxta: Compare with Selected"
  WriteRegStr HKCU "Software\Classes\Directory\shell\JuxtaCompareWith" "Icon" "$INSTDIR\Juxta.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\JuxtaCompareWith\command" "" '"$INSTDIR\Juxta.exe" --juxta-compare "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\*\shell\JuxtaSelectLeft"
  DeleteRegKey HKCU "Software\Classes\*\shell\JuxtaCompareWith"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\JuxtaSelectLeft"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\JuxtaCompareWith"
!macroend
