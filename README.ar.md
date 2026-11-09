<div align="center">

# OpenCode Mobile

### *وكيلك البرمجي. جهازك الشخصي. في جيبك.*

عميل غير رسمي فائق السلاسة (120fps) للهواتف والويب لوكيل البرمجة [OpenCode](https://github.com/anomalyco/opencode) بمصادقة مشفرة للرموز، وبث حي لفروقات الكود، وصفر تتبع.

[الموقع الرسمي](https://aetherdz.github.io/opencode-mobile/) · [دليل التثبيت](https://aetherdz.github.io/opencode-mobile/#install) · [التوثيق التقني](docs/) · [الهندسة المعمارية](docs/architecture.md) · [نموذج الأمان](docs/security.md) · [حل المشكلات](docs/troubleshooting.md) · [الإصدارات](https://github.com/Aetherdz/opencode-mobile/releases) · [English (الإنجليزية)](README.md)

<br/>

[![الإصدار](https://img.shields.io/badge/release-v1.0.0--beta.10-0EA5E9?style=flat-square&logo=github&labelColor=0F172A)](https://github.com/Aetherdz/opencode-mobile/releases)
[![حالة البناء](https://img.shields.io/badge/build-passing-10B981?style=flat-square&logo=githubactions&logoColor=white&labelColor=0F172A)](https://github.com/Aetherdz/opencode-mobile/actions)
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.8-3178C6?style=flat-square&logo=typescript&logoColor=white&labelColor=0F172A)](https://www.typescriptlang.org/)
[![Expo SDK 58](https://img.shields.io/badge/expo-SDK%2058-000000?style=flat-square&logo=expo&labelColor=0F172A)](https://expo.dev/)
[![Fastify](https://img.shields.io/badge/bridge-Fastify%205-000000?style=flat-square&logo=fastify&labelColor=0F172A)](https://fastify.dev/)
[![صفر تتبع](https://img.shields.io/badge/telemetry-zero%20tracking-success?style=flat-square&logo=shield&labelColor=0F172A)](#-لماذا-opencode-mobile)
[![الترخيص: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square&labelColor=0F172A)](LICENSE)

</div>

---

## ⚡ البدء السريع بأمر واحد

ثبّت الجسر المؤمّن وأداة الطرفية التفاعلية على جهازك بأمر واحد:

**لينكس وماك (Linux & macOS):**
```bash
curl -fsSL https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.sh | bash
```

**ويندوز (Windows PowerShell):**
```powershell
irm https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.ps1 | iex
```

### 3 خطوات للبدء:
1. **التثبيت**: شغّل أمر التثبيت على الجهاز أو الخادم الذي يشغّل OpenCode.
2. **مسح الرمز (QR)**: شغّل الأمر `opencode-mobile` في الطرفية وامسح الرمز الظاهر عبر كاميرا التطبيق.
3. **البرمجة**: تابع الردود المتدفقة، وافق على صلاحيات الأدوات، وبدّل النماذج بسهولة.

أوامر الفحص وإدارة الخدمة:
```bash
opencode-mobile status   # التحقق من صحة الجسر ووكيل البرمجة
opencode-mobile doctor   # تشخيص الشبكة والصلاحيات والمنافذ
opencode-mobile down     # إيقاف خادم الجسر والأنفاق النشطة بأمان
```

---

## 📦 التنزيل المباشر (`v1.0.0-beta.10`)

| المنصة / الحزمة | المتطلبات والهدف | ملف الحزمة | التحقق الأمني |
| :--- | :--- | :--- | :--- |
| **تطبيق أندرويد APK** | Android 7.0+ (API 24+, arm64) | [opencode-mobile-1.0.0-beta.10.apk](https://github.com/Aetherdz/opencode-mobile/releases/download/v1.0.0-beta.10/opencode-mobile-1.0.0-beta.10.apk) | [بصمة SHA-256](https://github.com/Aetherdz/opencode-mobile/releases/download/v1.0.0-beta.10/opencode-mobile-1.0.0-beta.10.apk.sha256) |
| **حزمة الويب PWA** | المتصفحات الحديثة (Chrome، Safari، Firefox) | [opencode-mobile-web-1.0.0-beta.10.zip](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) |
| **خادم الجسر** | Node.js >=22.13 (Linux، macOS، Windows) | [opencode-mobile-bridge-1.0.0-beta.10.tar.gz](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) |
| **مثبّت الطرفية** | Linux، macOS، Windows | [opencode-mobile-dist](https://github.com/Aetherdz/opencode-mobile-dist) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile-dist) |

---

## 🖥️ المعاينة المرئية

<p align="center">
  <img src="docs/assets/terminal-boot.svg" width="49%" alt="تشخيصات إقلاع الطرفية" />
  <img src="docs/assets/terminal-qr.svg" width="49%" alt="رمز الاقتران السريع في الطرفية" />
</p>

---

## ✨ لماذا OpenCode Mobile؟

- 🚀 **واجهة فائقة السلاسة 120fps مستوحاة من Claude**: فيزياء نابضية أصيلة (`stiffness: 380, damping: 28`)، واستجابة لمسية فورية (`PressableScale`)، مع سمات تحريرية متناسقة.
- 🧠 **منتقي النماذج الشامل**: تنقل فوري وسلس بين DeepSeek (V3/R1)، وClaude 3.7 Sonnet، وGemini 4 Argon، وGPT-4o، ونماذج Ollama المحلية.
- 📱 **اقتران فوري عبر QR**: امسح رمز الطرفية بالكاميرا للاتصال الآمن دون الحاجة لكتابة أي عناوين IP أو رموز سرية يدوياً.
- ⚡ **موافقات حية وفروقات الكود**: بث حي للردود عبر WebSocket/SSE، وفروقات قابلة للطي، وخيارات مدمجة تفاعلية لأسئلة الوكيل.
- 🛡️ **جسر محلي ذاتي الاستضافة بصفر تتبع**: جسر Fastify يرتبط محلياً فقط، ومصادقة بزمن ثابت، ومفاتيح مشفرة في SecureStore، وعزل صارم لمجلدات العمل `ALLOWED_WORKDIRS`.
- 🌍 **دعم كامل لأربع لغات**: دعم أصيل للغة العربية باتجاه كامل من اليمين لليسار (RTL) بجانب الإنجليزية والفرنسية والإسبانية.

---

## 🌐 الوصول الآمن عن بُعد

- **شبكة Tailscale المشفرة (الخيار الموصى به)**: نفق مشفر بتقنية WireGuard من نقطة لنقطة دون فتح أي منافذ عامة:
  ```bash
  tailscale serve --bg http://127.0.0.1:8787
  ```
- **نفق Cloudflare السريع المؤقت**: مشاركة سريعة مؤقتة مشفرة بمصادقة كاملة للرموز:
  ```bash
  opencode-mobile --tunnel quick
  ```

---

## 🛠️ أوامر الطرفية والإعدادات

### أوامر سطر الأوامر

| الأمر | الوظيفة |
| :--- | :--- |
| `opencode-mobile` | تشغيل الجسر، وعرض رمز QR للاقتران، وفتح النفق |
| `opencode-mobile-up` | تشغيل الجسر كخدمة خلفية مستمرة (Daemon) |
| `opencode-mobile-down` | إيقاف خادم الجسر والأنفاق النشطة بأمان |
| `npm run mobile:share` | إنشاء رابط اقتران آمن ورمز QR مباشرة من المصدر |

### أهم متغيرات البيئة (`bridge/.env`)

| المتغير | القيمة الافتراضية | الغرض والاستخدام |
| :--- | :--- | :--- |
| `AUTH_TOKEN` | *(مطلوب)* | رمز Bearer سري عالي العشوائية مكون من 32+ حرفاً |
| `HOST` / `PORT` | `127.0.0.1` / `8787` | عنوان الارتباط المحلي Loopback ومنفذ الاتصال |
| `ALLOWED_WORKDIRS` | `~/projects` | النطاق المسموح به بدقة على القرص لمساحات العمل |
| `CORS_ORIGINS` | *(فارغ)* | النطاقات المصرح لها بالاتصال لعميل الويب |
| `MAX_UPLOAD_MB` | `25` | الحد الأقصى لحجم الملف المرفق الواحد بالميغابايت |
| `RATE_LIMIT_PER_MINUTE` | `180` | الحد الأقصى للطلبات في الدقيقة لحماية الجسر |
| `LOG_LEVEL` | `info` | مستوى سجلات Pino (مع حجب الرموز الحساسة تماماً) |

---

## 💻 التشغيل من المصدر (للمطورين)

```bash
git clone https://github.com/Aetherdz/opencode-mobile.git && cd opencode-mobile
npm run install:bridge && npm run install:app
npm run mobile:share
```

تشغيل حزمة الفحص والاختبارات:
```bash
npm run check             # فحص الأنواع لتطبيق Expo والجسر ومطابقة المعايير (Lint)
npm test                  # تشغيل حزمة الاختبارات الشاملة (107 اختبارات)
```

---

## 📜 الترخيص والتنويه

مرخص تحت مظلة [ترخيص MIT](LICENSE). يُعد OpenCode Mobile مشروعاً مجتمعياً مستقلاً مفتوح المصدر وليس تابعاً أو معتمداً من قِبل الفريق الرسمي لـ OpenCode.
