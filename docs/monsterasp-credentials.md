# MonsterASP Deployment & Credentials Reference

## Production Environment
- **Live URL:** [https://mynotebook.runasp.net/](https://mynotebook.runasp.net/)
- **Hosting Provider:** MonsterASP (.NET 8 AnyCPU on IIS with AspNetCoreModuleV2)

---

## 1. MonsterASP Server (SFTP)
- **Host:** `site108609.siteasp.net`
- **Port:** `22`
- **Username:** `site108609`
- **Password:** `6h?A_Ec5g8D#`
- **Remote Root:** `wwwroot`

---

## 2. PostgreSQL Database
- **Host:** `db80713.databaseasp.net`
- **Port:** `5432`
- **Database Name:** `db80713`
- **Username:** `db80713`
- **Password:** `5y!C#2KigH?7`
- **Connection String:**
  ```text
  Host=db80713.databaseasp.net;Port=5432;Database=db80713;Username=db80713;Password=5y!C#2KigH?7;Trust Server Certificate=true;
  ```

---

## 3. How to Build & Deploy

### Full Automated Build & Deploy
```bash
# 1. Build TypeScript shared package, React web app, and .NET Release package
./scripts/build-deploy.sh

# 2. Deploy to MonsterASP via SFTP with automatic zero-downtime / offline handler
python3 scripts/deploy-sftp.py
```

### Manual Build Steps
```bash
# Build shared library
npm --prefix packages/shared run build

# Build web frontend
npm --prefix apps/web run build

# Copy web dist to ASP.NET wwwroot
rm -rf backend/src/NoteBook.Api/wwwroot/*
cp -r apps/web/dist/* backend/src/NoteBook.Api/wwwroot/

# Publish .NET Release
dotnet publish backend/src/NoteBook.Api/NoteBook.Api.csproj -c Release -o publish-anycpu/

# Deploy files via SFTP
python3 scripts/deploy-sftp.py
```
