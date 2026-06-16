@echo off
:: 한글 깨짐 방지를 위해 UTF-8 코드페이지로 설정합니다.
chcp 65001 > nul

:: 관리자 권한 체크 및 자동 승인 요청
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 관리자 권한으로 다시 실행하는 중입니다...
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

echo ===================================================
echo [IT 지원팀] 윈도우 11 공유폴더 접속 오류 해결 도구
echo ===================================================
echo.
echo 윈도우 11에서 11번(스캔팩스) 및 39번(소프트웨어 점검) 서버 접속 실패 시
echo 보안 정책(보안 서명 해제 및 게스트 로그인 허용)을 재설정하여 해결합니다.
echo.
echo ---------------------------------------------------
echo [1단계] SMB 클라이언트 보안 서명 요구 비활성화 (RequireSecuritySignature)
powershell -Command "Set-SmbClientConfiguration -RequireSecuritySignature $false -Force"
echo.
echo [2단계] 보안되지 않은 게스트 로그인 활성화 (EnableInsecureGuestLogons)
powershell -Command "Set-SmbClientConfiguration -EnableInsecureGuestLogons $true -Force"
echo.
echo ---------------------------------------------------
echo.
echo [중요 안내]
echo 변경된 정책을 완전히 반영하기 위해 반드시 PC를 재부팅해 주세요!
echo PC 재부팅 후 다시 11번 또는 39번 공유폴더 경로로 접속을 시도하세요.
echo.
pause
