# 🔧 حل مشكلة Docker - Docker Troubleshooting

## المشكلة الحالية

Docker Desktop يعمل لكن هناك خطأ عند تنزيل الصور (Images):
```
500 Internal Server Error for API route
```

هذه مشكلة معروفة في Docker Desktop for Windows.

---

## ✅ الحل السريع (اختر أحد الخيارات)

### الخيار 1: إعادة تشغيل Docker Desktop (الأسرع)

1. انقر بزر الماوس الأيمن على أيقونة Docker 🐳 في شريط المهام
2. اختر **"Restart"** أو **"إعادة التشغيل"**
3. انتظر حتى يصبح Docker جاهزاً (الأيقونة خضراء)
4. جرب مرة أخرى:

```powershell
cd "c:\Users\Moaz Al-Hazi\Documents\SOAR pro project"
docker compose up -d postgres redis
```

### الخيار 2: إعادة تشغيل خدمة WSL

```powershell
# في PowerShell كمسؤول (Run as Administrator)
wsl --shutdown
# انتظر 10 ثواني
# ثم افتح Docker Desktop مرة أخرى
```

### الخيار 3: تنظيف Docker وإعادة المحاولة

```powershell
# تنظيف الموارد
docker system prune -f

# إعادة تشغيل Docker Desktop
# ثم المحاولة مرة أخرى
```

---

## 🎯 الخطوات بعد الحل

### 1. تحقق من أن Docker يعمل:

```powershell
docker run hello-world
```

إذا نجح، ستحصل على رسالة "Hello from Docker!"

### 2. قم بتشغيل SOAR Pro:

#### خطوة بخطوة (موصى به):

```powershell
cd "c:\Users\Moaz Al-Hazi\Documents\SOAR pro project"

# الخطوة 1: قواعد البيانات
docker compose up -d postgres redis minio

# انتظر دقيقة حتى تكتمل
Start-Sleep -Seconds 60

# الخطوة 2: تحقق من الحالة
docker compose ps

# الخطوة 3: شغل Alert Ingestor
docker compose up -d alert-ingestor

# الخطوة 4: اختبار
curl http://localhost:8001/health
```

#### تشغيل كامل (بديل):

```powershell
cd "c:\Users\Moaz Al-Hazi\Documents\SOAR pro project"

# تشغيل جميع الخدمات
docker compose up -d

# مراقبة السجلات
docker compose logs -f
```

---

## 🔍 التحقق من النجاح

عندما يعمل كل شيء بشكل صحيح:

```powershell
# التحقق من الحاويات العاملة
docker compose ps
```

يجب أن ترى:
- ✅ postgres - Up (healthy)
- ✅ redis - Up (healthy)  
- ✅ minio - Up (healthy)
- ✅ alert-ingestor - Up (healthy)

```powershell
# اختبار Alert Ingestor
curl http://localhost:8001/health
```

النتيجة المتوقعة:
```json
{
  "status": "healthy",
  "service": "alert-ingestor",
  "dependencies": {
    "postgres": "healthy",
    "redis": "healthy"
  }
}
```

---

## 🐛 إذا استمرت المشاكل

### تحديث Docker Desktop:

1. افتح Docker Desktop
2. Settings > Software Updates
3. إذا كان هناك تحديث، قم بتثبيته

### إعادة تثبيت Docker Desktop:

1. إلغاء تثبيت Docker Desktop
2. حذف مجلد `C:\ProgramData\Docker`
3. إعادة تثبيت من: https://www.docker.com/products/docker-desktop

### التحقق من WSL 2:

```powershell
# في PowerShell
wsl --list --verbose
```

يجب أن يكون WSL 2 هو الافتراضي.

---

## 📋 ملف تشخيص Docker

إذا احتجت مساعدة إضافية، شغل:

```powershell
docker version
docker info
wsl --status
```

---

## 🎉 بمجرد الحل

أرسل لي **"fixed"** وسأكمل التثبيت والاختبار!

أو نفذ بنفسك الأوامر أعلاه واختبر النظام.

---

## ملاحظة 

هذه مشكلة شائعة في Docker Desktop for Windows، وعادةً ما يحلها إعادة التشغيل البسيطة. النظام نفسه جاهز تماماً! 🚀
