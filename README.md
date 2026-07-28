# Hermes Cloud Router & Control Panel 🚀

درگاه ابری، کنترل پنل مدیریت و روتر هوشمند هوش مصنوعی برای **Hermes Agent**.

این پروژه واسط زیرساختی بین **Hermes Agent** (اجراشده روی سیستم کاربر) و ارائه‌دهندگان هوش مصنوعی (گوگل Gemini و...) است. پروژه برای استقرار روی **Vercel** طراحی شده و دارای معماری واقعی Production، مدیریت متمرکز کلیدها، چرخش کلیدهای API، بازیابی خودکار از خطاها (Failover) و API سازگار با **OpenAI** می‌باشد.

---

## 🌟 ویژگی‌های اصلی سیستم

1. **سازگاری کامل با OpenAI API**:
   - مسیر دریافت درخواست: `POST /api/v1/chat/completions`
   - دریافت ساختار استاندارد Chat Completion و پاسخ‌دهی استاندارد به Hermes Agent.

2. **سیستم روتر هوشمند و Failover خودکار**:
   - چرخش کلیدها به روش‌های **Round Robin**، **Failover** و **اولویت ثابت**.
   - بازیابی خودکار از خطاهای Rate Limit (429) و سهمیه (Quota Exceeded) با سوئیچ سریع به کلید یا مدل بعدی.
   - دوره استراحت موقت (Cooldown) خودکار برای کلیدهای مسدودشده.

3. **مدیریت چند مدل و زنجیره پشتیبان (Fallback Chain)**:
   - پشتیبانی از مدل‌های گوگل Gemini (مانند `gemini-3.6-flash` و `gemini-3.1-pro-preview`).
   - قابلیت تعیین مدل پیش‌فرض و تعریف زنجیره اولویت جایگزینی.

4. **مدیریت ایجنت‌های تخصصی (Agent Profiles)**:
   - ایجنت‌های پیش‌فرض آماده: **Teacher Agent**، **Trading Agent**، **Content Agent** و **Research Agent**.
   - تزریق پرامپت سیستمی (System Prompt Overlay) اختصاصی برای هر ایجنت.
   - صدور توکن احراز هویت اختصاصی (Bearer Token) برای هر ایجنت.

5. **پنل مدیریت اختصاصی به زبان فارسی**:
   - راست‌چین (RTL) با طراحی مدرن، خوانا و بدون اطلاعات نمادین یا جعلی.
   - داشبورد آمار واقعی درخواست‌ها، نرخ موفقیت، تاخیر شبکه و وضعیت سلامت کلیدها.
   - آزمایشگاه تست زنده روتر (Live API Tester) جهت تست عملکرد سیستم.

---

## ⚙️ راهنمای نصب و اجرای محلی (Local Development)

### پیش‌نیازها:
- Node.js نسخه 18 یا بالاتر
- npm یا yarn

### ۱. دریافت وابستگی‌ها:
```bash
npm install
```

### ۲. تنظیم متغیرهای محیطی (.env):
یک فایل `.env` در ریشه پروژه ایجاد کرده و مقادیر زیر را تنظیم کنید:

```env
# کلید اصلی گوگل جکینی
GEMINI_API_KEY="AIzaSy..."

# مخزن کلیدهای پشتیبان (Multi-key Pool)
GEMINI_KEY_1="AIzaSy..."
GEMINI_KEY_2="AIzaSy..."
GEMINI_KEY_3="AIzaSy..."

# رمز عبور مدیریت کنترل پنل
ADMIN_SECRET="hermes-admin-pass-2026"

# کلید اصلی ایجنت Hermes
HERMES_API_KEY="hermes-agent-secret-token"
```

### ۳. اجرای پروژه در حالت توسعه:
```bash
npm run dev
```

درگاه در آدرس `http://localhost:3000` در دسترس خواهد بود.

---

## ☁️ راهنمای Deploy روی Vercel

این پروژه کاملاً با **Vercel Serverless Functions** سازگار است:

1. پروژه را در **GitHub** ذخیره کرده و Push کنید.
2. وارد کنترل پنل [Vercel](https://vercel.com) شده و ریپازیتوری را وارد کنید.
3. در بخش **Environment Variables** متغیرهای `GEMINI_API_KEY`، `GEMINI_KEY_1` و `ADMIN_SECRET` را اضافه کنید.
4. روی دکمه **Deploy** کلیک کنید. فایل `vercel.json` مسیرهای `/api/*` را به توابع Serverless هدایت می‌کند.

---

## 💻 نحوه اتصال Hermes Agent به این Gateway

### نمونه کد Python (استفاده از کتابخانه OpenAI):

```python
from openai import OpenAI

# تنظیم آدرس Gateway خود
client = OpenAI(
    base_url="https://your-hermes-gateway.vercel.app/api/v1",
    api_key="hermes-tk-teacher-8821" # توکن اختصاصی ایجنت
)

response = client.chat.completions.create(
    model="gemini-3.6-flash",
    messages=[
        {"role": "system", "content": "شما دستیار Hermes هستید."},
        {"role": "user", "content": "پاسخ روتر را به زبان فارسی ثبت کن."}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)
```

### نمونه کد cURL:

```bash
curl -X POST "https://your-hermes-gateway.vercel.app/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer hermes-tk-teacher-8821" \
  -d '{
    "model": "gemini-3.6-flash",
    "messages": [
      {"role": "user", "content": "تست درگاه ابری Hermes"}
    ]
  }'
```

---

## 🛡️ امنیت
- کلیدهای کامل API هیچ‌گاه به مرورگر ارسال نمی‌شوند.
- دسترسی به تغییرات کنترل پنل نیازمند احراز هویت با `ADMIN_SECRET` می‌باشد.

توسعه‌یافته با React، TypeScript، Express، Tailwind CSS و SDK رسمی `@google/genai`.
