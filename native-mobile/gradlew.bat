@rem =========================================================================
@rem Smart School Gradle Wrapper bootstrap script for Windows
@rem =========================================================================
@echo off
set DIR=%~dp0

if not exist "%DIR%gradle\wrapper" mkdir "%DIR%gradle\wrapper"

if not exist "%DIR%gradle\wrapper\gradle-wrapper.jar" (
    echo [Antigravity] Bootstrap: gradle-wrapper.jar not found locally.
    echo [Antigravity] Downloading official Gradle wrapper jar...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradle/wrapper/gradle-wrapper.jar', '%DIR%gradle\wrapper\gradle-wrapper.jar')"
    if %ERRORLEVEL% neq 0 (
        echo [Error] Failed to download Gradle wrapper jar. Please check your internet connection.
        exit /b %ERRORLEVEL%
    )
    echo [Antigravity] Successfully bootstrapped gradle-wrapper.jar!
)

java -cp "%DIR%gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain %*
