@echo off
setlocal
cd /d "%~dp0"
echo MOVAMI - Empresas de Blumenau (CNPJ Receita Federal)
echo.
py -3 -m pip install --user duckdb
if errorlevel 1 (
    echo Falha ao instalar DuckDB. Confira se Python esta instalado.
    pause
    exit /b 1
)
py -3 gerar_base_blumenau.py
echo.
echo Quando gerado, o CSV aparece nesta pasta.
pause
