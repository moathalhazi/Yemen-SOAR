# ملخص مشاكل تسجيل الدخول - SOAR Pro Login Issues Summary
تاريخ: 2026-02-03

---

## المشكلة 1: "Failed to fetch" - فشل الاتصال

### الأعراض
- ظهور رسالة "Failed to fetch" عند محاولة تسجيل الدخول
- الفرونت اند لا يستطيع الاتصال بالباك اند

### الأسباب (تم اكتشاف عدة أسباب متداخلة)

#### السبب 1.1: مكتبة email-validator مفقودة
- **الملف المتأثر**: `services/api-gateway/main.py`
- **الخطأ**: `ImportError: email-validator is not installed`
- **الحل**: تثبيت المكتبة في البيئة الافتراضية:
  ```bash
  venv\Scripts\pip install email-validator
  ```

#### السبب 1.2: إعدادات CORS غير صحيحة
- **الملف المتأثر**: `services/api-gateway/main.py` (line 47-54)
- **المشكلة**: متغير البيئة `CORS_ORIGINS` لم يكن يُقرأ بشكل صحيح
- **الحل**: تم تثبيت قيم CORS مباشرة في الكود:
  ```python
  CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"]
  app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, ...)
  ```

#### السبب 1.3: خطأ في عنوان IP في سجل التدقيق
- **الملف المتأثر**: `services/api-gateway/main.py` (lines 316-338)
- **الخطأ**: `asyncpg.exceptions.DataError: invalid input for query argument $4: 'unknown'`
- **السبب**: عمود `ip_address` من نوع INET لكن تم تمرير "unknown" كنص
- **الحل**: تغيير `"unknown"` إلى `None`:
  ```python
  # قبل
  await conn.execute("INSERT INTO audit_logs (...) VALUES (...)", ..., "unknown", ...)
  # بعد
  await conn.execute("INSERT INTO audit_logs (...) VALUES (...)", ..., None, ...)
  ```

---

## المشكلة 2: "Invalid username or password" - كلمة المرور غير صحيحة

### الأعراض
- تسجيل الدخول يصل للسيرفر لكن يرفض كلمة المرور
- المستخدمين موجودين في قاعدة البيانات

### السبب: عدم توافق مكتبة bcrypt مع passlib

#### التفاصيل
- **الملف المتأثر**: `services/api-gateway/main.py`
- **الخطأ الأصلي**: 
  ```
  ValueError: password cannot be longer than 72 bytes
  ```
- **السبب الجذري**: مكتبة `passlib` تستخدم تنسيق hash مختلف عن مكتبة `bcrypt` الأصلية

### الحل
1. **استبدال passlib بـ bcrypt الأصلية**:
   ```python
   # قبل
   from passlib.context import CryptContext
   pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
   
   def verify_password(plain_password: str, hashed_password: str) -> bool:
       return pwd_context.verify(plain_password, hashed_password)
   
   # بعد
   import bcrypt
   
   def verify_password(plain_password: str, hashed_password: str) -> bool:
       return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
   ```

2. **تحديث كلمات المرور في قاعدة البيانات**:
   - تم إنشاء سكريبت `database/update_passwords.py`
   - تم تشغيله لتحديث hash جميع المستخدمين

---

## الملفات المعدلة

| الملف | التغيير |
|-------|---------|
| `services/api-gateway/main.py` | CORS، bcrypt، IP address |
| `services/api-gateway/run.bat` | إضافة CORS_ORIGINS |
| `frontend/src/lib/api.ts` | تنسيق Form Data للـ login |
| `frontend/.env.local` | إضافة NEXT_PUBLIC_API_URL |
| `database/update_passwords.py` | سكريبت جديد لتحديث كلمات المرور |

---

## بيانات الدخول للاختبار

| اسم المستخدم | كلمة المرور | الدور |
|--------------|-------------|-------|
| admin_user | Admin123! | SOAR Admin |
| l1_analyst | Admin123! | SOC Analyst L1 |
| l2_analyst | Admin123! | SOC Analyst L2 |
| l3_analyst | Admin123! | SOC Analyst L3 |
| auto_eng | Admin123! | Automation Engineer |
| inc_manager | Admin123! | Incident Manager |
| auditor | Admin123! | Security Auditor |

---

## تشغيل المشروع

```bash
# 1. تشغيل Docker containers
docker-compose up -d postgres redis elasticsearch minio

# 2. تشغيل الباك اند
services\api-gateway\run.bat

# 3. تشغيل الفرونت اند
cd frontend && npm run dev
```

**الروابط:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
