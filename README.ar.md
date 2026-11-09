<div align="center">

# OpenCode Mobile

### *وكيلك البرمجي. جهازك الشخصي. في جيبك.*

عميل غير رسمي فائق السلاسة (120fps) للهواتف والويب لوكيل البرمجة [OpenCode](https://github.com/anomalyco/opencode) بمصادقة مشفرة للرموز، وبث حي لفروقات الكود، وصفر تتبع.

[الموقع الرسمي](https://aetherdz.github.io/opencode-mobile/) · [دليل التثبيت](https://aetherdz.github.io/opencode-mobile/#install) · [التوثيق التقني](docs/) · [الهندسة المعمارية](docs/architecture.md) · [نموذج الأمان](docs/security.md) · [الإصدارات](https://github.com/Aetherdz/opencode-mobile/releases) · [English (الإنجليزية)](README.md)

<br/>

[![الإصدار](https://img.shields.io/badge/release-v1.0.0--beta.10-0EA5E9?style=flat-square&logo=github&labelColor=0F172A)](https://github.com/Aetherdz/opencode-mobile/releases)
[![حالة البناء](https://img.shields.io/badge/build-passing-10B981?style=flat-square&logo=githubactions&logoColor=white&labelColor=0F172A)](https://github.com/Aetherdz/opencode-mobile/actions)
[![TypeScript](https://img.shields.io/badge/typescript-%5E5.8-3178C6?style=flat-square&logo=typescript&logoColor=white&labelColor=0F172A)](https://www.typescriptlang.org/)
[![Expo SDK 58](https://img.shields.io/badge/expo-SDK%2058-000000?style=flat-square&logo=expo&labelColor=0F172A)](https://expo.dev/)
[![Fastify](https://img.shields.io/badge/bridge-Fastify%205-000000?style=flat-square&logo=fastify&labelColor=0F172A)](https://fastify.dev/)
[![صفر تتبع](https://img.shields.io/badge/telemetry-zero%20tracking-success?style=flat-square&logo=shield&labelColor=0F172A)](#%EF%B8%8F-الهندسة-المعمارية)
[![الترخيص: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square&labelColor=0F172A)](LICENSE)

<br/>

<p align="center">
  <img src="docs/images/hero.png" alt="شعار OpenCode Mobile" width="860" />
</p>

</div>

---

## ⚡ التثبيت بأمر واحد ورمز الطرفية QR

ثبّت الجسر وأداة الطرفية على جهازك:

```bash
# لينكس وماك (Linux & macOS)
curl -fsSL https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.sh | bash

# الاقتران الفوري بالهاتف
opencode-mobile
```

*(ويندوز PowerShell: `irm https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.ps1 | iex`)*

<p align="center">
  <img src="docs/images/tui-banner-ar.svg" width="840" alt="رمز اقتران الطرفية السريع" />
</p>

---

## 📱 معرض واجهات التطبيق

### مسار العمل الرئيسي

| 1. اقتران فوري | 2. مساحات العمل | 3. محادثة حية | 4. منتقي النماذج | 5. الموافقات |
| :---: | :---: | :---: | :---: | :---: |
| <img src="docs/images/connect.png" width="175" alt="شاشة الاقتران الفوري عبر QR" /> | <img src="docs/images/sessions.png" width="175" alt="بطاقات الجلسات المرتفعة" /> | <img src="docs/images/chat.png" width="175" alt="المحادثة الحية وفروقات الكود" /> | <img src="docs/images/model-picker.png" width="175" alt="منتقي النماذج الشامل" /> | <img src="docs/images/question.png" width="175" alt="أسئلة وموافقات الوكيل" /> |
| **اقتران فوري بلمسة**<br/>اكتشاف تلقائي للبيانات | **جلسات مرتفعة**<br/>تفاعل نابضي مرن | **بث حي وفروقات الكود**<br/>استجابة سريعة عبر WS | **منتقي النماذج الشامل**<br/>DeepSeek، Claude، Gemini | **موافقات مدمجة**<br/>تأكيد آمن للصلاحيات |

### السمات والتنقل وتعدد اللغات

| 1. درج تنقل سلس | 2. محادثة فاتحة | 3. جلسات فاتحة | 4. عربية أصيلة (RTL) | 5. واجهة فرنسية |
| :---: | :---: | :---: | :---: | :---: |
| <img src="docs/images/navigation-en.png" width="175" alt="درج التنقل السلس" /> | <img src="docs/images/chat-light.png" width="175" alt="محادثة بالنمط الفاتح" /> | <img src="docs/images/sessions-light.png" width="175" alt="جلسات بالنمط الفاتح" /> | <img src="docs/images/sessions-ar.png" width="175" alt="واجهة عربية كاملة RTL" /> | <img src="docs/images/sessions-fr.png" width="175" alt="واجهة فرنسية" /> |
| **درج تنقل راقٍ**<br/>حركة 120fps سلسة | **سمة فاتحة دافئة**<br/>تباين ورقي مريح | **فواصل تحريرية**<br/>حدود فائقة الدقة | **دعم كامل للعربية**<br/>اتجاه أصيل RTL وخطوط نقية | **واجهة متعددة اللغات**<br/>عربية، إنجليزية، فرنسية، إسبانية |

---

## 🏗️ الهندسة المعمارية

```mermaid
flowchart TD
  subgraph Client["1. عملاء الهاتف والويب"]
    App["تطبيق الهواتف (Android / iOS)<br/>• حركة نابضية 120fps • مفاتيح مشفرة"]
    Web["عميل الويب (تطبيق PWA)"]
  end

  subgraph Network["2. طبقة النقل المشفرة"]
    Mesh["شبكة Tailscale الخاصة / واي فاي محلي (تشفير WireGuard)"]
    Tunnel["نفق Cloudflare المؤقت الاختياري"]
  end

  subgraph Bridge["3. خادم الجسر Fastify (127.0.0.1:8787)"]
    Auth["بوابة التوثيق Bearer (زمن ثابت Timing-Safe)"]
    Sandbox["عزل مساحات العمل (ALLOWED_WORKDIRS)"]
    Events["مركز البث المباشر (SSE → WebSocket)"]
  end

  subgraph Host["4. نواة محطة العمل"]
    OpenCode["خدمة OpenCode المحلية"]
    Models["النماذج المدعومة (DeepSeek / Claude 3.7 / Gemini 4 Argon / Ollama)"]
  end

  App & Web --> Mesh & Tunnel
  Mesh & Tunnel --> Auth
  Auth --> Sandbox --> Events
  Events --> OpenCode --> Models
```

---

## 📦 التنزيل المباشر (`v1.0.0-beta.10`)

| الحزمة | المتطلبات والهدف | ملف الحزمة | بصمة التحقق |
| :--- | :--- | :--- | :--- |
| **تطبيق أندرويد APK** | Android 7.0+ (arm64-v8a) | [opencode-mobile-1.0.0-beta.10.apk](https://github.com/Aetherdz/opencode-mobile/releases/download/v1.0.0-beta.10/opencode-mobile-1.0.0-beta.10.apk) | [بصمة SHA-256](https://github.com/Aetherdz/opencode-mobile/releases/download/v1.0.0-beta.10/opencode-mobile-1.0.0-beta.10.apk.sha256) |
| **حزمة الويب PWA** | المتصفحات الحديثة | [opencode-mobile-web-1.0.0-beta.10.zip](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) |
| **خادم الجسر** | Node.js >=22.13 | [opencode-mobile-bridge-1.0.0-beta.10.tar.gz](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile/releases/tag/v1.0.0-beta.10) |
| **مثبّت الطرفية** | Linux، macOS، Windows | [opencode-mobile-dist](https://github.com/Aetherdz/opencode-mobile-dist) | [SHA256SUMS](https://github.com/Aetherdz/opencode-mobile-dist) |

---

## 🛠️ أهم الأوامر والإعدادات

| الأمر | الوظيفة |
| :--- | :--- |
| `opencode-mobile` | تشغيل الجسر، وعرض رمز QR للاقتران، وفتح النفق |
| `opencode-mobile status` | التحقق من صحة اتصال الجسر وخدمة OpenCode المحلية |
| `opencode-mobile doctor` | تشخيص الشبكة والصلاحيات وحالة ربط المنافذ |
| `opencode-mobile down` | إنهاء خدمة الجسر الخلفية والأنفاق النشطة بأمان |
| `npm run mobile:share` | إنشاء رابط اقتران آمن ورمز QR مباشرة من الكود المصدري |

### أهم متغيرات البيئة (`bridge/.env`)
- `AUTH_TOKEN`: رمز Bearer سري عالي العشوائية مكون من 32+ حرفاً (`openssl rand -hex 32`).
- `HOST` / `PORT`: عنوان الارتباط المحلي (`127.0.0.1`) ومنفذ الاستماع (`8787`).
- `ALLOWED_WORKDIRS`: النطاق المسموح به للجلسات على القرص (افتراضياً: `~/projects`).
- `CORS_ORIGINS`: النطاقات المصرح بها لعميل الويب (مثل `http://localhost:8081`).

---

## 📜 الترخيص والمجتمع

مرخص تحت مظلة [ترخيص MIT](LICENSE). يُعد OpenCode Mobile مشروعاً مجتمعياً مستقلاً مفتوح المصدر وليس تابعاً أو معتمداً من قِبل OpenCode.
