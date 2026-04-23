# SOAR Pro - مرجع سريع / Quick Reference

## 🚀 البدء السريع / Quick Start

```bash
# 1. نسخ ملف البيئة / Copy environment file
cp .env.template .env

# 2. تحرير الإعدادات / Edit settings
nano .env

# 3. بدء التشغيل / Start services
docker-compose up -d

# 4. التحقق من الحالة / Check status
docker-compose ps
```

## 🌐 الوصول / Access Points

| الخدمة / Service | الرابط / URL | المستخدم / Username | كلمة المرور / Password |
|---|---|---|---|
| **واجهة الويب / Web UI** | http://localhost:3000 | admin | Admin123! |
| **API Gateway** | http://localhost:8000 | - | - |
| **API Docs** | http://localhost:8000/docs | - | - |
| **MinIO Console** | http://localhost:9001 | minioadmin | (from .env) |

## 📝 أوامر مفيدة / Useful Commands

### إدارة الخدمات / Service Management

```bash
# بدء جميع الخدمات / Start all services
docker-compose up -d

# إيقاف جميع الخدمات / Stop all services
docker-compose down

# إعادة تشغيل خدمة معينة / Restart specific service
docker-compose restart alert-ingestor

# عرض حالة الخدمات / View services status
docker-compose ps

# عرض السجلات / View logs
docker-compose logs -f alert-ingestor
```

### اختبار التنبيهات / Testing Alerts

```bash
# إنشاء تنبيه تجريبي / Create test alert
curl -X POST http://localhost:8001/api/v1/test/alert

# عرض الإحصائيات / View statistics
curl http://localhost:8001/api/v1/stats

# إرسال تنبيه مخصص / Send custom alert
curl -X POST http://localhost:8001/api/v1/alerts/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source": "test",
    "severity": "high",
    "title": "Test Security Alert",
    "description": "Testing SOAR ingestion",
    "affected_assets": [
      {"type": "host", "identifier": "server-01", "criticality": 8}
    ],
    "indicators": {
      "ips": ["192.0.2.100"],
      "domains": ["malicious.example.com"]
    }
  }'
```

### قواعد البيانات / Database

```bash
# الاتصال بـ PostgreSQL / Connect to PostgreSQL
docker-compose exec postgres psql -U soar_user -d soar_db

# عرض المستخدمين / List users
SELECT username, email, is_superuser FROM users;

# عرض التنبيهات / List alerts
SELECT id, title, severity, status, received_at FROM alerts ORDER BY received_at DESC LIMIT 10;

# عرض الحوادث / List incidents
SELECT incident_number, title, severity, status FROM incidents;

# الخروج / Exit
\q
```

### النسخ الاحتياطي / Backup

```bash
# نسخ احتياطي للقاعدة / Backup database
docker-compose exec postgres pg_dump -U soar_user soar_db > backup_$(date +%Y%m%d).sql

# استعادة من نسخة احتياطية / Restore from backup
cat backup.sql | docker-compose exec -T postgres psql -U soar_user -d soar_db
```

## 🔧 الإعدادات المهمة / Important Settings

### ملف .env / Environment File

```bash
# قواعد البيانات / Databases
POSTGRES_PASSWORD=ChangeMe_SecurePassword123!
ELASTICSEARCH_PASSWORD=ChangeMe_ElasticPassword123!
REDIS_PASSWORD=ChangeMe_RedisPassword123!

# JWT التوثيق / JWT Authentication
JWT_SECRET_KEY=$(openssl rand -hex 32)

# تكامل Sophos / Sophos Integration
SOPHOS_CLIENT_ID=your_client_id
SOPHOS_CLIENT_SECRET=your_client_secret

# البريد الإلكتروني / Email
SMTP_HOST=smtp.gmail.com
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## 🩺 الفحص الصحي / Health Checks

```bash
# فحص API Gateway
curl http://localhost:8000/health

# فحص Alert Ingestor
curl http://localhost:8001/health

# فحص PostgreSQL
docker-compose exec postgres pg_isready -U soar_user

# فحص Redis
docker-compose exec redis redis-cli PING

# فحص Elasticsearch
curl http://localhost:9200/_cluster/health
```

## 🐛 استكشاف الأخطاء / Troubleshooting

### المنفذ مستخدم / Port Already In Use

```bash
# Linux/macOS
sudo lsof -i :8000

# Windows
netstat -ano | findstr :8000

# الحل: توقيف العملية أو تغيير المنفذ في docker-compose.yml
```

### نفاد الذاكرة / Out of Memory

```bash
# زيادة حد الذاكرة في Docker Desktop
# Settings > Resources > Memory > 32GB+

# أو تشغيل خدمات أقل
docker-compose up -d postgres elasticsearch redis alert-ingestor
```

### الخدمة لا تعمل / Service Not Starting

```bash
# عرض السجلات / View logs
docker-compose logs alert-ingestor

# إعادة إنشاء الحاوية / Recreate container
docker-compose up -d --force-recreate alert-ingestor

# حذف وإعادة البناء / Remove and rebuild
docker-compose down
docker-compose up -d --build
```

## 📊 المراقبة / Monitoring

### موارد النظام / System Resources

```bash
# استخدام الذاكرة والمعالج / Memory & CPU usage
docker stats

# مساحة القرص / Disk usage
df -h

# استخدام Docker / Docker usage
docker system df
```

### إحصائيات الخدمة / Service Statistics

```bash
# إحصائيات التنبيهات / Alert statistics
curl http://localhost:8001/api/v1/stats | python3 -m json.tool

# عدد السجلات / Record counts
docker-compose exec postgres psql -U soar_user -d soar_db -c "
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM alerts) as total_alerts,
    (SELECT COUNT(*) FROM incidents) as total_incidents,
    (SELECT COUNT(*) FROM evidence) as total_evidence;
"
```

## 🔐 الأمان / Security

### تغيير كلمات المرور / Change Passwords

```bash
# تغيير كلمة مرور المشرف / Change admin password
# TODO: Use web UI after implementation

# توليد مفتاح JWT جديد / Generate new JWT secret
openssl rand -hex 32

# توليد كلمة مرور آمنة / Generate secure password
openssl rand -base64 32
```

### المراجعة الأمنية / Security Audit

```bash
# عرض سجلات التدقيق / View audit logs
docker-compose exec postgres psql -U soar_user -d soar_db -c "
SELECT timestamp, username, action, resource 
FROM audit_logs 
ORDER BY timestamp DESC 
LIMIT 20;
"

# عرض سلسلة الحراسة / View chain of custody
docker-compose exec postgres psql -U soar_user -d soar_db -c "
SELECT evidence_id, timestamp, action, actor_name, integrity_verified
FROM chain_of_custody
ORDER BY timestamp DESC
LIMIT 10;
"
```

## 📚 الوثائق / Documentation

| الملف / File | الوصف / Description |
|---|---|
| [README.md](file:///c:/Users/Moaz%20Al-Hazi/Documents/SOAR%20pro%20project/README.md) | الوثائق الرئيسية / Main documentation |
| [DEPLOYMENT.md](file:///c:/Users/Moaz%20Al-Hazi/Documents/SOAR%20pro%20project/DEPLOYMENT.md) | دليل النشر / Deployment guide |
| [implementation_plan.md](file:///C:/Users/Moaz%20Al-Hazi/.gemini/antigravity/brain/f9af2ba6-249b-4a7e-8951-aba6856089f9/implementation_plan.md) | خطة التنفيذ / Implementation plan |
| [walkthrough.md](file:///C:/Users/Moaz%20Al-Hazi/.gemini/antigravity/brain/f9af2ba6-249b-4a7e-8951-aba6856089f9/walkthrough.md) | شرح المشروع / Project walkthrough |

## 🆘 الدعم / Support

### الموارد / Resources

- **الوثائق الكاملة / Full Docs:** [docs/](docs/)
- **المشاكل / Issues:** GitHub Issues
- **البريد / Email:** support@your-org.com

### الأسئلة الشائعة / FAQ

**Q: كيف أضيف مستخدم جديد؟ / How to add a new user?**
A: سيتم عبر واجهة الويب في المرحلة التالية / Will be via web UI in next phase

**Q: كيف أتكامل مع أنظمة أخرى؟ / How to integrate with other systems?**
A: استخدم `/api/v1/alerts/ingest` endpoint / Use the `/api/v1/alerts/ingest` endpoint

**Q: أين تخزن الأدلة؟ / Where is evidence stored?**
A: في MinIO/S3 مع تشفير AES-256 / In MinIO/S3 with AES-256 encryption

---

## 📌 ملاحظات مهمة / Important Notes

> ⚠️ **للإنتاج / For Production:**
> - غير جميع كلمات المرور الافتراضية / Change all default passwords
> - فعل HTTPS / Enable HTTPS
> - راجع إعدادات الأمان / Review security settings
> - أنشئ نسخ احتياطية منتظمة / Setup regular backups

> 💡 **للتطوير / For Development:**
> - استخدم بيئة معزولة / Use isolated environment
> - راجع السجلات بانتظام / Monitor logs regularly
> - اختبر قبل النشر / Test before deployment

---

<div align="center" dir="rtl">

**منصة SOAR Pro للأمن السيبراني**

Made with ❤️ for the security community

Version 1.0.0 - Phase 1

</div>
