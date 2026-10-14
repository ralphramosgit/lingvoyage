# backend/scripts/build_lambda.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)          # run from backend/
Remove-Item -Recurse -Force build, lambda.zip -ErrorAction SilentlyContinue

py -3.13 -m pip install -r requirements.txt `
  --platform manylinux2014_x86_64 --implementation cp --python-version 3.13 `
  --only-binary=:all: --target build --upgrade

Copy-Item -Recurse app build\app
Get-ChildItem build -Recurse -Directory -Filter __pycache__ | Remove-Item -Recurse -Force

# Python's zip tool writes Linux-friendly paths (Windows' Compress-Archive can break imports on Lambda)
py -3.13 -c "import shutil; shutil.make_archive('lambda', 'zip', 'build')"
Write-Host "Created backend\lambda.zip"
