# دليل التشغيل والإطلاق (Runbook & Release Gate) - فندق الأمين

---

## 1. قائمة التحقق قبل الإطلاق (Release Gate Checklist)

يجب التأكد من استيفاء جميع الشروط التالية قبل الموافقة على دمج الكود ونشره إلى بيئة الإنتاج:

- [x] **اكتمال وتوافق جميع الميزات**: تم استكمال جميع الميزات من F0 إلى F14 واجتياز كافة الاختبارات الآلية (17 ملف اختبار، 225+ اختبار بنجاح 100%).
- [x] **عقد الـ API والمخطط (OpenAPI Spec)**:
  - التحقق من خلو الملف `openapi/staff-management-api.yaml` من أخطاء الـ Linting (`npm run lint:yaml`).
  - تشغيل `validateResponses` في جميع اختبارات التكامل.
- [x] **سيناريو دورة العمل الكاملة (E2E Test)**:
  - اجتياز اختبار دورة حياة الحجز والإقامة والتنظيف والصيانة وتسليم الوردية ببيانات عربية سليمة بالكامل (`tests/e2e.test.js`).
- [x] **اختبارات التزامن ومنع تضارب العمليات (Concurrency Suite)**:
  - اجتياز اختبارات حجز نفس الغرفة، والدفع المزدوج الزائد، والتسكين المتزامن، والتسليم المتزامن للوردية (`tests/concurrency.test.js`).
- [x] **تحصين الأمان (Security Hardening)**:
  - اختبار Helmet و HSTS (سنة كاملة) ومنع تتبع الـ Proxy.
  - إخفاء `X-Powered-By`.
  - تقييد CORS بدقة وحظر Origins المجهولة.
  - Rate Limiter عام (300 طلب/دقيقة) بالإضافة لمحدد تسجيل الدخول.
  - عدم تسريب `password_hash` أو المفاتيح المشفرة أو `stack trace` في أي استجابة خطأ.
- [x] **توليد التقرير المالي للوردية (Shift PDF Report)**:
  - التحقق من توليد ملف الـ PDF وحفظه واسترجاعه بصيغة ثنائية صحيحة.
- [x] **فحص الثغرات والاعتماديات (Security Audit & Gitleaks)**:
  - فحص `npm audit --audit-level=high` بدون أي ثغرات حرجة في الإنتاج.
  - فحص خلو الكود من أي أسرار أو مفاتيح سرية في Git (`gitleaks`).

---

## 2. إدارة البيئات والمفاتيح (Environment Variables)

### بيئة الإنتاج (Production) مقابل التجربة (Staging)
> **تنبيه هام:** لا تستخدم أبدًا نفس المفاتيح في بيئة الـ Staging والـ Production!

| المتغير | بيئة التجربة (Staging) | بيئة الإنتاج (Production) | الغرض |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `staging` | `production` | نمط تشغيل خادم Node.js |
| `PORT` | `3000` | `3000` (أو المنفذ المخصص) | منفذ الاستماع |
| `MONGODB_URI` | `mongodb+srv://.../hotel_staging` | `mongodb+srv://.../hotel_prod` | رابط قاعدة بيانات Atlas المخصصة |
| `JWT_SECRET` | مفتاح عشوائي خاص بـ Staging | مفتاح عشوائي 64+ بايت للإنتاج | توقيع رموز وصول JWT |
| `ID_ENC_KEY` | مفتاح 32 بايت Hex خاص بـ Staging | مفتاح 32 بايت Hex مشفر للإنتاج | تشفير الأرقام القومية AES-256-GCM |
| `ID_HMAC_KEY` | مفتاح 32 بايت Hex خاص بـ Staging | مفتاح 32 بايت Hex للإنتاج | تجزئة الأرقام القومية للبحث السريع HMAC-SHA256 |
| `ALLOWED_ORIGINS` | `https://staging.alamin-hotel.com` | `https://app.alamin-hotel.com` | النطاقات المصرح لها بالتفاعل عبر CORS |
| `COOKIE_SECURE` | `true` (HTTPS) | `true` (إلزامي عبر HTTPS) | تأمين ملف تعريف ارتباط Refresh Token |

---

## 3. النسخ الاحتياطي والاسترجاع (Database Backups & Disaster Recovery)

### أ. سياسة النسخ الاحتياطي
- تفعيل النسخ الاحتياطي التلقائي (Continuous Cloud Backup) على MongoDB Atlas مع Point-In-Time Restore (PITR) لمدة 7 أيام.
- أخذ لقطة يومية (Daily Snapshot) والاحتفاظ بها لمدة 30 يومًا.

### ب. خطة الاسترجاع السريع (Restore Procedure)
1. إنشاء Cluster تجريبي موازٍ أو استرجاع نقطة زمنية محددة من لوحة تحكم Atlas.
2. التحقق من تطابق أعداد المستندات وفهارس المجموعات:
   ```bash
   node scripts/indexes.js
   ```
3. التحقق من سلامة المبالغ المخزنة بالذاكرة (`paid_cache`) ومطابقتها لمجموع الدفعات الفعلية:
   ```bash
   node scripts/check-paid-cache.js
   ```

---

## 4. العمليات الطارئة والصيانة (Emergency Runbook)

### أ. فك قفل حساب الموظف (Account Lockout Reset)
إذا تم قفل حساب موظف بسبب تجاوز محاولات كلمة المرور الخاطئة:
```bash
node scripts/admin.js reset-password --username "ahmed_rec" --by "Admin Name" --reason "رفع القفل بعد التحقق من الهوية"
```

### ب. تصحيح دفعة مالية خاطئة (Payment Reversal)
إذا سُجلت دفعة نقدية أو إلكترونية بقيمة غير صحيحة:
```bash
node scripts/admin.js reverse-payment --payment-id "<PAYMENT_ID>" --by "Manager Name" --reason "تصحيح خطأ مدخل"
```

### ج. إعادة فتح وردية تم إغلاقها بالخطأ (Reopen Shift)
إذا تم تسليم الوردية وإغلاقها قبل استكمال العمليات:
```bash
node scripts/admin.js reopen-shift --shift-id "<SHIFT_ID>" --by "Manager Name" --reason "استكمال تسويات اليومية"
```
