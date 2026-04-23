# SOAR Pro - دليل النشر السريع
## Quick Deployment Guide

<div dir="rtl">

## متطلبات النظام

### الحد الأدنى (للتطوير والاختبار):
- **الذاكرة RAM:** 32GB
- **المعالج:** 8 cores
- **التخزين:** 200GB SSD
- **نظام التشغيل:** Linux (Ubuntu 20.04+), Windows 10/11 Pro با WSL2, macOS
- **Docker:** 20.10+
- **Docker Compose:** 2.0+

### الموصى به (للإنتاج):
- **الذاكرة RAM:** 64GB+
- **المعالج:** 16+ cores
- **التخزين:** 500GB+ SSD (NVMe)
- **الشبكة:** 1Gbps+

</div>

---

## Installation Steps

### 1. Prerequisites Check

```bash
# Check Docker
docker --version
# Should show: Docker version 20.10 or higher

# Check Docker Compose
docker-compose --version
# Should show: Docker Compose version 2.0 or higher

# Check system resources
free -h  # Check available RAM
df -h    # Check available disk space
```

### 2. Clone or Download Project

```bash
# If using git
git clone <repository-url>
cd "SOAR pro project"

# Or simply extract the project folder
cd "/path/to/SOAR pro project"
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.template .env

# Edit .env file
nano .env  # or use your preferred editor
```

**Important configurations to update:**

```bash
# Database Passwords (CHANGE THESE!)
POSTGRES_PASSWORD=YourSecurePassword123!
ELASTICSEARCH_PASSWORD=YourElasticPassword123!
REDIS_PASSWORD=YourRedisPassword123!
MINIO_ROOT_PASSWORD=YourMinioPassword123!

# JWT Secret (GENERATE A STRONG RANDOM KEY!)
JWT_SECRET_KEY=$(openssl rand -hex 32)

# Sophos Integration (if available)
SOPHOS_CLIENT_ID=your_sophos_client_id
SOPHOS_CLIENT_SECRET=your_sophos_client_secret
SOPHOS_TENANT_ID=your_tenant_id

# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### 4. Start Services

#### Option A: Using the startup script (Linux/macOS):

```bash
# Make script executable
chmod +x start.sh

# Run the script
./start.sh
```

#### Option B: Using Docker Compose directly:

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

#### Option C: Step-by-step (for development):

```bash
# 1. Start databases first
docker-compose up -d postgres elasticsearch redis minio

# Wait for databases to be healthy (check with docker-compose ps)
sleep 30

# 2. Start backend services
docker-compose up -d alert-ingestor normalization ai-ml playbook-executor

# 3. Start frontend
docker-compose up -d frontend

# 4. Check everything is running
docker-compose ps
```

### 5. Verify Installation

#### Check Service Health:

```bash
# API Gateway
curl http://localhost:8000/health

# Alert Ingestor
curl http://localhost:8001/health

# Expected output:
# {"status":"healthy","service":"...","timestamp":"..."}
```

#### Check Database Connections:

```bash
# PostgreSQL
docker-compose exec postgres psql -U soar_user -d soar_db -c "SELECT COUNT(*) FROM users;"

# Should show at least 1 (default admin user)
```

#### Access Web Interfaces:

- **Main Web UI:** http://localhost:3000
- **API Documentation:** http://localhost:8000/docs
- **MinIO Console:** http://localhost:9001

### 6. First Login

**Default Credentials:**
- Username: `admin`
- Password: `Admin123!`

> ⚠️ **SECURITY:** Change the default password immediately after first login!

### 7. Test Alert Ingestion

```bash
# Create a test alert
curl -X POST http://localhost:8001/api/v1/test/alert

# You should see:
# {"message": "Test alert created", "alert_id": "..."}

# Check alert was created
curl http://localhost:8001/api/v1/stats
```

---

## Configuration

### Sophos Integration Setup

1. **Get Sophos Central API Credentials:**
   - Log in to Sophos Central
   - Go to **Global Settings > API Credentials**
   - Create new API credentials
   - Copy Client ID and Secret

2. **Update .env file:**
   ```bash
   SOPHOS_CLIENT_ID=your_client_id_here
   SOPHOS_CLIENT_SECRET=your_secret_here
   SOPHOS_TENANT_ID=your_tenant_id  # Optional, auto-detected
   ```

3. **Test Sophos Connection:**
   ```bash
   docker-compose exec alert-ingestor python -m connectors.sophos_connector
   ```

### Email Notifications Setup

**For Gmail:**

1. Enable 2FA on your Google account
2. Generate an App Password:
   - Go to Google Account > Security
   - Select "App passwords"
   - Generate password for "Mail"

3. Update .env:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=your-app-password  # 16-character app password
   ```

### Slack Notifications Setup

1. Create Slack Incoming Webhook:
   - Go to https://api.slack.com/apps
   - Create New App
   - Add Incoming Webhooks
   - Copy Webhook URL

2. Update .env:
   ```bash
   SLACK_ENABLED=true
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   SLACK_CHANNEL=#security-alerts
   ```

---

## Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f alert-ingestor

# Last 100 lines
docker-compose logs --tail=100 alert-ingestor
```

### Restart Services

```bash
# Restart specific service
docker-compose restart alert-ingestor

# Restart all services
docker-compose restart
```

### Update Services

```bash
# Pull latest changes (if using git)
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Backup Data

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U soar_user soar_db > backup_$(date +%Y%m%d).sql

# Backup MinIO (evidence)
docker-compose exec minio mc mirror /data /backup

# Or use built-in backup
# (if configured in .env with BACKUP_ENABLED=true)
```

### Clean Up

```bash
# Stop all services
docker-compose down

# Remove volumes (⚠️ DELETES ALL DATA!)
docker-compose down -v

# Clean up Docker system
docker system prune -a
```

---

## Troubleshooting

### Problem: Services won't start

**Solution:**
```bash
# Check Docker is running
docker ps

# Check system resources
free -h
df -h

# View service logs
docker-compose logs alert-ingestor
```

### Problem: Database connection errors

**Solution:**
```bash
# Check if databases are healthy
docker-compose ps

# Restart database
docker-compose restart postgres

# Check database logs
docker-compose logs postgres
```

### Problem: Port already in use

**Error:** `Bind for 0.0.0.0:8000 failed: port is already allocated`

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :8000  # Linux/macOS
netstat -ano | findstr :8000  # Windows

# Either stop that process or change port in docker-compose.yml
```

### Problem: Out of memory

**Solution:**
```bash
# Increase Docker memory limit
# Docker Desktop > Settings > Resources > Memory > 32GB+

# Or reduce number of running services
docker-compose up -d postgres elasticsearch redis alert-ingestor
```

### Problem: Sophos integration not working

**Solution:**
```bash
# Test connectivity
docker-compose exec alert-ingestor python -m connectors.sophos_connector

# Check credentials in .env
# Verify API access in Sophos Central console
```

---

## Next Steps

1. **Configure Additional Integrations**
   - Add more alert sources
   - Configure threat intelligence APIs

2. **Create Playbooks**
   - Navigate to Web UI > Playbooks
   - Create automated response workflows

3. **Set Up Users and Roles**
   - Go to Settings > Users
   - Create user accounts for your team
   - Assign appropriate roles

4. **Configure Compliance Reporting**
   - Settings > Compliance
   - Enable required standards (ISO 27001, NIST, etc.)

5. **Test Incident Response**
   - Create test alerts
   - Verify playbook execution
   - Check evidence collection

---

## Production Deployment

For production deployment, see:
- [Kubernetes Deployment Guide](docs/kubernetes-deployment.md) (Coming soon)
- [Security Hardening Guide](docs/security-hardening.md) (Coming soon)
- [Performance Tuning Guide](docs/performance-tuning.md) (Coming soon)

---

## Support

- **Documentation:** [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/your-org/soar-pro/issues)
- **Email:** support@your-organization.com

---

<div dir="rtl">

## الملاحظات الأمنية

### يجب عليك:
✅ تغيير جميع كلمات المرور الافتراضية
✅ استخدام HTTPS في الإنتاج
✅ تفعيل جدار الحماية
✅ تفعيل النسخ الاحتياطي التلقائي
✅ مراجعة سجلات التدقيق بانتظام

### لا تفعل:
❌ استخدام البيانات الافتراضية في الإنتاج
❌ كشف المنافذ للإنترنت بدون حماية
❌ تجاهل تحديثات الأمان
❌ مشاركة ملف .env في نظام التحكم بالإصدارات

</div>
