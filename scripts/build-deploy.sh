#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Building Shared TypeScript Package ==="
npm --prefix packages/shared run build

echo "=== 2. Building React Web App ==="
npm --prefix apps/web run build

echo "=== 3. Copying Web Dist to ASP.NET wwwroot ==="
rm -rf backend/src/NoteBook.Api/wwwroot/*
cp -r apps/web/dist/* backend/src/NoteBook.Api/wwwroot/

if command -v dotnet >/dev/null 2>&1; then
  echo "=== 4. Publishing ASP.NET Core API for MonsterASP ==="
  rm -rf publish-anycpu/
  dotnet publish backend/src/NoteBook.Api/NoteBook.Api.csproj -c Release -o publish-anycpu/
  rm -rf publish/
  cp -r publish-anycpu/ publish/
else
  echo "=== 4. Updating wwwroot in existing publish package (dotnet CLI not found) ==="
  if [ ! -d "publish-anycpu" ]; then
    cp -r publish publish-anycpu
  fi
  rm -rf publish-anycpu/wwwroot/*
  cp -r apps/web/dist/* publish-anycpu/wwwroot/
  rm -rf publish/wwwroot/*
  cp -r apps/web/dist/* publish/wwwroot/
fi

echo "=== Build Complete! Package ready in publish-anycpu/ and publish/ ==="

if [[ "${1:-}" == "--deploy" ]]; then
  echo "=== 5. Deploying to MonsterASP via SFTP ==="
  python3 scripts/deploy-sftp.py
fi
