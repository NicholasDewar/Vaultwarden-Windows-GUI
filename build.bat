@echo off
chcp 65001
setlocal

echo ========================================
echo  Vaultwarden Manager 构建脚本
echo ========================================
echo.

echo [1/5] 检查 Rust 环境...
rustc --version
cargo --version
if errorlevel 1 (
    echo 错误: 未检测到 Rust，请先安装 https://rustup.rs/
    pause
    exit /b 1
)
echo.

echo [2/5] 检查 Node.js 环境...
node --version
npm --version
if errorlevel 1 (
    echo 错误: 未检测到 Node.js，请先安装 https://nodejs.org/
    pause
    exit /b 1
)
echo.

echo [3/5] 安装前端依赖...
cd /d "%~dp0"
call npm install
if errorlevel 1 (
    echo 错误: npm install 失败
    pause
    exit /b 1
)
echo.

echo [4/5] 构建前端...
call npm run build
if errorlevel 1 (
    echo 错误: 前端构建失败
    pause
    exit /b 1
)
echo.

echo [5/5] 构建 Tauri 应用...
call npm run tauri build
if errorlevel 1 (
    echo 错误: Tauri 构建失败
    pause
    exit /b 1
)
echo.

echo ========================================
echo  构建完成！
echo  输出目录: src-tauri\target\release\vaultwarden-gui.exe
echo ========================================
pause
