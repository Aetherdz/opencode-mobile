import { useCallback } from 'react';
import { frStrings } from '@/lib/i18n.fr';
import { useSettings, type Locale } from '@/state/settings';

type Entry = { en: string; ar: string };

const strings: Record<string, Entry> = {
  appName: { en: 'OpenCode Mobile', ar: 'OpenCode موبايل' },
  'common.back': { en: 'Back', ar: 'رجوع' },
  'common.close': { en: 'Close', ar: 'إغلاق' },
  'common.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'common.save': { en: 'Save', ar: 'حفظ' },
  'common.delete': { en: 'Delete', ar: 'حذف' },
  'common.retry': { en: 'Retry', ar: 'إعادة المحاولة' },
  'common.loading': { en: 'Loading', ar: 'جار التحميل' },
  'common.error': { en: 'Something went wrong', ar: 'حدث خطأ' },
  'common.copy': { en: 'Copy', ar: 'نسخ' },
  'common.copied': { en: 'Copied', ar: 'تم النسخ' },
  'common.search': { en: 'Search', ar: 'بحث' },
  'common.ok': { en: 'OK', ar: 'حسناً' },
  'common.openSettings': { en: 'Open settings', ar: 'فتح الإعدادات' },

  'connect.title': { en: 'Connect to your bridge', ar: 'اتصل بالجسر' },
  'connect.subtitle': {
    en: "Use the address and token from your bridge's .env file.",
    ar: 'استخدم العنوان والرمز من ملف .env الخاص بالجسر.',
  },
  'connect.url': { en: 'Bridge address', ar: 'عنوان الجسر' },
  'connect.urlPlaceholder': {
    en: 'http://100.x.y.z:8787',
    ar: 'http://100.x.y.z:8787',
  },
  'connect.urlHint': {
    en: 'A Tailscale address is recommended.',
    ar: 'يُنصح باستخدام عنوان Tailscale.',
  },
  'connect.token': { en: 'Access token', ar: 'رمز الوصول' },
  'connect.tokenPlaceholder': {
    en: '32+ characters',
    ar: '٣٢ حرفاً أو أكثر',
  },
  'connect.tokenHint': {
    en: 'At least {min} characters. Stored only in the device secure store.',
    ar: '{min} حرفاً على الأقل. يبقى في مخزن الجهاز الآمن فقط.',
  },
  'connect.paste': { en: 'Paste', ar: 'لصق' },
  'connect.pasteEmpty': { en: 'The clipboard is empty.', ar: 'الحافظة فارغة.' },
  'connect.scanQr': { en: 'Scan QR code', ar: 'مسح رمز QR' },
  'connect.scanHint': { en: 'Scan a QR code containing the bridge URL and access token.', ar: 'امسح رمز QR الذي يحتوي على رابط الجسر ورمز الوصول.' },
  'connect.cameraPermission': { en: 'Camera access is needed to scan a connection QR code.', ar: 'يلزم السماح بالكاميرا لمسح رمز اتصال QR.' },
  'connect.invalidQr': { en: 'This QR code is not a valid OpenCode Mobile connection.', ar: 'رمز QR هذا ليس إعداد اتصال صالحًا لـ OpenCode Mobile.' },
  'connect.urlInvalid': {
    en: 'Start with http:// or https://.',
    ar: 'ابدأ بـ http:// أو https://.',
  },
  'connect.tokenTooShort': {
    en: 'Use at least {min} characters.',
    ar: 'استخدم {min} حرفاً على الأقل.',
  },
  'connect.httpWarning': {
    en: 'Plain HTTP is not encrypted. Use HTTPS outside a private network.',
    ar: 'HTTP غير مشفر. استخدم HTTPS خارج الشبكة الخاصة.',
  },
  'connect.statusIdle': { en: 'Not connected', ar: 'غير متصل' },
  'connect.statusReady': { en: 'Ready to connect', ar: 'جاهز للاتصال' },
  'connect.stageReaching': { en: 'Reaching the server', ar: 'جار الوصول إلى الخادم' },
  'connect.stageChecking': { en: 'Checking the token', ar: 'جار التحقق من الرمز' },
  'connect.stageReady': { en: 'Ready', ar: 'جاهز' },
  'connect.connect': { en: 'Connect', ar: 'اتصال' },
  'connect.connecting': { en: 'Connecting', ar: 'جار الاتصال' },
  'connect.success': { en: 'Connected', ar: 'تم الاتصال' },
  'connect.fail': {
    en: 'Could not connect. Check the address, token, and network.',
    ar: 'تعذر الاتصال. تحقق من العنوان والرمز والشبكة.',
  },
  'connect.errorUnreachable': {
    en: 'Server unreachable. Check the address and the network.',
    ar: 'تعذر الوصول إلى الخادم. تحقق من العنوان والشبكة.',
  },
  'connect.errorSecureUnreachable': {
    en: 'Could not reach the server. If this is HTTPS, check the certificate.',
    ar: 'تعذر الوصول إلى الخادم. إذا كان العنوان HTTPS فتحقق من الشهادة.',
  },
  'connect.errorTimeout': {
    en: 'The server did not answer in time.',
    ar: 'لم يستجب الخادم في الوقت المحدد.',
  },
  'connect.errorToken': {
    en: 'Wrong token. Check the access token.',
    ar: 'الرمز غير صحيح. تحقق من رمز الوصول.',
  },
  'connect.errorNotBridge': {
    en: 'Unexpected response. This address does not look like an OpenCode Bridge.',
    ar: 'استجابة غير متوقعة. هذا العنوان لا يبدو جسر OpenCode.',
  },
  'connect.errorTls': {
    en: 'TLS or certificate problem. Check the HTTPS certificate.',
    ar: 'مشكلة في TLS أو الشهادة. تحقق من شهادة HTTPS.',
  },
  'connect.errorServer': {
    en: 'The Bridge returned an unexpected error. Try again.',
    ar: 'أعاد الجسر خطأ غير متوقع. حاول مجدداً.',
  },
  'connect.loopback': {
    en: '127.0.0.1 points to the phone itself. Use the server Tailscale address or tunnel URL.',
    ar: 'العنوان 127.0.0.1 يشير إلى الهاتف نفسه. استخدم عنوان Tailscale للخادم أو رابط النفق.',
  },
  'connect.security': {
    en: 'Anyone with this token can control the agent. Keep it private.',
    ar: 'كل من يملك هذا الرمز يتحكم بالوكيل. احتفظ به خاصاً.',
  },
  'connect.showToken': { en: 'Show token', ar: 'إظهار الرمز' },
  'connect.hideToken': { en: 'Hide token', ar: 'إخفاء الرمز' },
  'connect.brandTagline': {
    en: 'Your agent, in your pocket',
    ar: 'وكيلك في جيبك',
  },

  'sessions.title': { en: 'Sessions', ar: 'الجلسات' },
  'sessions.recent': { en: 'Recent', ar: 'الأخيرة' },
  'home.greeting': { en: 'Good morning', ar: 'صباح الخير' },
  'home.greetingAfternoon': { en: 'Good afternoon', ar: 'طاب يومك' },
  'home.greetingEvening': { en: 'Good evening', ar: 'مساء الخير' },
  'home.subtitle': {
    en: 'Pick up where you left off, or start a new session.',
    ar: 'تابع من حيث توقفت أو ابدأ جلسة جديدة.',
  },
  'home.placeholder': {
    en: 'Start a new session…',
    ar: 'ابدأ جلسة جديدة…',
  },
  'home.menu': { en: 'Open navigation', ar: 'فتح قائمة التنقل' },
  'home.newChat': { en: 'New session', ar: 'جلسة جديدة' },
  'home.theme': { en: 'Toggle light and dark theme', ar: 'تبديل المظهر الفاتح والداكن' },
  'home.search': { en: 'Search sessions', ar: 'ابحث في الجلسات' },
  'chat.addTitle': { en: 'Add to chat', ar: 'إضافة إلى المحادثة' },
  'sessions.today': { en: 'Today', ar: 'اليوم' },
  'sessions.yesterday': { en: 'Yesterday', ar: 'أمس' },
  'sessions.earlier': { en: 'Earlier', ar: 'سابقاً' },
  'sessions.search': { en: 'Search sessions', ar: 'ابحث في الجلسات' },
  'sessions.clearSearch': { en: 'Clear search', ar: 'مسح البحث' },
  'sessions.empty': { en: 'No sessions yet', ar: 'لا توجد جلسات بعد' },
  'sessions.emptyHint': {
    en: 'Start a session in a work directory you trust.',
    ar: 'ابدأ جلسة في مجلد عمل تثق به.',
  },
  'sessions.new': { en: 'New session', ar: 'جلسة جديدة' },
  'sessions.settings': { en: 'Settings', ar: 'الإعدادات' },
  'sessions.loadError': { en: 'Could not load sessions', ar: 'تعذر تحميل الجلسات' },
  'sessions.untitled': { en: 'Untitled session', ar: 'جلسة بلا عنوان' },
  'sessions.sourceApp': { en: 'App', ar: 'التطبيق' },
  'sessions.sourceTelegram': { en: 'Telegram', ar: 'تيليجرام' },
  'sessions.sourceBoth': { en: 'App + Telegram', ar: 'التطبيق وتيليجرام' },
  'sessions.sourceUnknown': { en: 'Unknown source', ar: 'مصدر غير معروف' },
  'sessions.running': { en: 'Working', ar: 'تعمل' },
  'sessions.idle': { en: 'Idle', ar: 'جاهزة' },
  'sessions.error': { en: 'Error', ar: 'خطأ' },
  'sessions.approval': { en: 'Needs approval', ar: 'تنتظر موافقة' },
  'sessions.waitingInput': { en: 'Waiting for you', ar: 'تنتظر ردك' },
  'sessions.busyFrom': { en: 'Running from {source}', ar: 'تعمل من {source}' },
  'sessions.lastActive': { en: 'Updated {time}', ar: 'آخر تحديث {time}' },
  'sessions.rename': { en: 'Rename', ar: 'إعادة تسمية' },
  'sessions.renameTitle': { en: 'Session title', ar: 'عنوان الجلسة' },
  'sessions.delete': { en: 'Delete session', ar: 'حذف الجلسة' },
  'sessions.deleteBody': {
    en: 'Delete this session from the bridge? This cannot be undone.',
    ar: 'حذف هذه الجلسة من الجسر؟ لا يمكن التراجع.',
  },
  'sessions.actions': { en: 'Session actions', ar: 'إجراءات الجلسة' },

  'chat.placeholder': { en: 'Ask the agent…', ar: 'اسأل الوكيل…' },
  'chat.send': { en: 'Send', ar: 'إرسال' },
  'chat.stop': { en: 'Stop', ar: 'إيقاف' },
  'chat.attach': { en: 'Attach', ar: 'إرفاق' },
  'chat.removeAttachment': { en: 'Remove attachment', ar: 'إزالة المرفق' },
  'chat.viewImage': { en: 'View image', ar: 'عرض الصورة' },
  'chat.imagePreview': { en: 'Image preview', ar: 'معاينة الصورة' },
  'chat.closeImage': { en: 'Close image', ar: 'إغلاق الصورة' },
  'chat.reconnectNow': { en: 'Reconnect now', ar: 'إعادة الاتصال الآن' },
  'chat.photo': { en: 'Photo library', ar: 'مكتبة الصور' },
  'chat.camera': { en: 'Camera', ar: 'الكاميرا' },
  'chat.document': { en: 'Document or code', ar: 'مستند أو كود' },
  'chat.uploading': { en: 'Uploading', ar: 'جار الرفع' },
  'chat.uploadingPercent': { en: 'Uploading {percent}%', ar: 'جار الرفع {percent}%' },
  'chat.uploadFailed': { en: 'Upload failed', ar: 'فشل الرفع' },
  'chat.uploadRetry': { en: 'Retry upload', ar: 'إعادة الرفع' },
  'chat.fileTypeBlocked': {
    en: '{ext} files are not allowed.',
    ar: 'ملفات {ext} غير مسموحة.',
  },
  'chat.totalTooLarge': {
    en: 'Attachments exceed the {size} MB message limit.',
    ar: 'المرفقات تتجاوز حد {size} ميجابايت للرسالة.',
  },
  'chat.photoPermission': {
    en: 'Allow photo access in system settings to attach images.',
    ar: 'اسمح بالوصول إلى الصور من إعدادات النظام لإرفاق الصور.',
  },
  'chat.cameraPermission': {
    en: 'Allow camera access in system settings to take a photo.',
    ar: 'اسمح بالوصول إلى الكاميرا من إعدادات النظام لالتقاط صورة.',
  },
  'chat.copyMessage': { en: 'Copy message', ar: 'نسخ الرسالة' },
  'chat.agentWorking': { en: 'Working', ar: 'يعمل' },
  'chat.stepsRunning': { en: '{count} steps running', ar: '{count} خطوات قيد التنفيذ' },
  'chat.stepsDone': { en: 'Done', ar: 'تم' },
  'chat.stepRunning': { en: 'Running', ar: 'قيد التنفيذ' },
  'chat.stepFailed': { en: 'Failed', ar: 'فشل' },
  'chat.stepDone': { en: 'Done', ar: 'تم' },
  'chat.viewChanges': { en: 'View changes', ar: 'عرض التغييرات' },
  'chat.tooManyFiles': {
    en: 'At most {count} attachments per message.',
    ar: 'الحد الأقصى {count} مرفقات لكل رسالة.',
  },
  'chat.fileTooLarge': {
    en: 'File exceeds the {size} MB limit.',
    ar: 'الملف يتجاوز حد {size} ميجابايت.',
  },
  'chat.reasoning': { en: 'Reasoning', ar: 'الاستدلال' },
  'chat.tools': { en: 'Tools', ar: 'الأدوات' },
  'chat.thinking': { en: 'Working', ar: 'يعمل' },
  'chat.latest': { en: 'Latest', ar: 'الأحدث' },
  'chat.loadOlder': { en: 'Load older messages', ar: 'تحميل رسائل أقدم' },
  'chat.diff': { en: 'Changes', ar: 'التغييرات' },
  'chat.noChanges': { en: 'No file changes', ar: 'لا تغييرات في الملفات' },
  'chat.reconnect': { en: 'Reconnecting', ar: 'جار إعادة الاتصال' },
  'chat.offline': { en: 'Offline', ar: 'غير متصل' },
  'chat.connecting': { en: 'Connecting', ar: 'جار الاتصال' },
  'chat.startTitle': { en: 'Start with a task', ar: 'ابدأ بمهمة' },
  'chat.startReview': { en: 'Review the latest changes', ar: 'راجع آخر التغييرات' },
  'chat.startTests': { en: 'Run the test suite', ar: 'شغّل الاختبارات' },
  'chat.startExplain': { en: 'Explain this project', ar: 'اشرح هذا المشروع' },
  'chat.empty': {
    en: 'Send the first message to this session.',
    ar: 'أرسل أول رسالة إلى هذه الجلسة.',
  },
  'chat.interrupted': { en: 'Response interrupted', ar: 'توقف الرد' },
  'chat.retry': { en: 'Retry', ar: 'إعادة' },
  'chat.agentError': { en: 'Agent error', ar: 'خطأ الوكيل' },
  'chat.errorDetails': { en: 'Details', ar: 'التفاصيل' },
  'chat.hideErrorDetails': { en: 'Hide details', ar: 'إخفاء التفاصيل' },
  'chat.copyErrorDetails': { en: 'Copy details', ar: 'نسخ التفاصيل' },
  'chat.retryLast': { en: 'Retry last message', ar: 'إعادة آخر رسالة' },
  'chat.retrying': { en: 'Retrying', ar: 'جار إعادة المحاولة' },
  'chat.assistant': { en: 'Agent', ar: 'الوكيل' },
  'chat.you': { en: 'You', ar: 'أنت' },
  'chat.delivered': { en: 'Delivered', ar: 'تم التسليم' },
  'chat.sending': { en: 'Sending', ar: 'جار الإرسال' },
  'chat.busy': {
    en: 'The session is busy. Queue or steer this message.',
    ar: 'الجلسة مشغولة. ضع الرسالة في الانتظار أو وجّهها.',
  },
  'chat.queue': { en: 'Queue', ar: 'انتظار' },
  'chat.steer': { en: 'Steer', ar: 'توجيه' },

  'approval.title': { en: 'Approval needed', ar: 'مطلوب موافقة' },
  'approval.readOnly': { en: 'Read-only', ar: 'قراءة فقط' },
  'approval.writes': { en: 'Writes files', ar: 'يكتب ملفات' },
  'approval.command': { en: 'Runs a command', ar: 'ينفذ أمراً' },
  'approval.network': { en: 'Network access', ar: 'وصول للشبكة' },
  'approval.destructive': { en: 'Destructive', ar: 'إجراء خطير' },
  'approval.once': { en: 'Approve once', ar: 'موافقة مرة واحدة' },
  'approval.always': { en: 'Always allow this session', ar: 'السماح دائماً لهذه الجلسة' },
  'approval.deny': { en: 'Deny', ar: 'رفض' },
  'approval.confirmDeny': { en: 'Confirm deny', ar: 'تأكيد الرفض' },
  'approval.confirmReject': {
    en: 'The agent will continue without this permission.',
    ar: 'سيكمل الوكيل دون هذا الإذن.',
  },
  'approval.sessionOnly': { en: 'This session only', ar: 'هذه الجلسة فقط' },
  'approval.expired': { en: 'Request expired', ar: 'انتهت صلاحية الطلب' },
  'approval.confirmDestructive': {
    en: 'This action can change or delete files. Approve again to continue.',
    ar: 'قد يغيّر هذا الإجراء ملفات أو يحذفها. وافق مرة أخرى للمتابعة.',
  },
  'approval.resources': { en: 'Scope', ar: 'النطاق' },
  'approval.approveAnyway': { en: 'Approve anyway', ar: 'الموافقة رغم ذلك' },

  'questions.title': { en: 'Question', ar: 'سؤال' },
  'questions.banner': {
    en: 'The agent is waiting for your answer',
    ar: 'الوكيل ينتظر إجابتك',
  },
  'questions.progress': { en: '{current} of {total}', ar: '{current} من {total}' },
  'questions.custom': { en: 'Other', ar: 'إجابة أخرى' },
  'questions.customPlaceholder': { en: 'Type your answer', ar: 'اكتب إجابتك' },
  'questions.next': { en: 'Next', ar: 'التالي' },
  'questions.back': { en: 'Back', ar: 'السابق' },
  'questions.submit': { en: 'Send answer', ar: 'إرسال الإجابة' },
  'questions.skip': { en: 'Skip questions', ar: 'تخطي الأسئلة' },
  'questions.skipTitle': { en: 'Skip the questions?', ar: 'تخطي الأسئلة؟' },
  'questions.skipBody': {
    en: 'The agent will continue without your answers.',
    ar: 'سيكمل الوكيل دون إجاباتك.',
  },
  'questions.required': {
    en: 'Choose an answer to continue.',
    ar: 'اختر إجابة للمتابعة.',
  },
  'questions.customRequired': {
    en: 'Type an answer or choose an option.',
    ar: 'اكتب إجابة أو اختر خياراً.',
  },
  'questions.sendError': {
    en: 'Could not send the answer. Try again.',
    ar: 'تعذر إرسال الإجابة. حاول مرة أخرى.',
  },
  'questions.multipleHint': {
    en: 'Select one or more options.',
    ar: 'اختر خياراً أو أكثر.',
  },

  'new.title': { en: 'New session', ar: 'جلسة جديدة' },
  'new.workdir': { en: 'Work directory', ar: 'مجلد العمل' },
  'new.workdirHint': {
    en: 'Only directories inside ALLOWED_WORKDIRS are accepted.',
    ar: 'تُقبل فقط المجلدات داخل ALLOWED_WORKDIRS.',
  },
  'new.sessionTitle': { en: 'Session title', ar: 'عنوان الجلسة' },
  'new.titlePlaceholder': { en: 'Optional', ar: 'اختياري' },
  'new.create': { en: 'Create session', ar: 'إنشاء الجلسة' },
  'new.creating': { en: 'Creating', ar: 'جار الإنشاء' },
  'new.choose': { en: 'Choose a directory', ar: 'اختر مجلداً' },
  'new.custom': { en: 'Or enter a subdirectory', ar: 'أو أدخل مجلداً فرعياً' },
  'new.noWorkdirs': {
    en: 'No work directories are configured on the bridge.',
    ar: 'لا توجد مجلدات عمل مهيأة على الجسر.',
  },
  'new.failed': { en: 'Could not create the session', ar: 'تعذر إنشاء الجلسة' },

  'settings.title': { en: 'Settings', ar: 'الإعدادات' },
  'settings.appearance': { en: 'Appearance', ar: 'المظهر' },
  'settings.dark': { en: 'Dark', ar: 'داكن' },
  'settings.light': { en: 'Light', ar: 'فاتح' },
  'settings.system': { en: 'System', ar: 'النظام' },
  'settings.language': { en: 'Language', ar: 'اللغة' },
  'settings.arabic': { en: 'Arabic', ar: 'العربية' },
  'settings.english': { en: 'English', ar: 'الإنجليزية' },
  'settings.french': { en: 'French', ar: 'الفرنسية' },
  'settings.haptics': { en: 'Haptics', ar: 'الاهتزاز' },
  'settings.hapticsBody': {
    en: 'Subtle feedback for send, approve, and completion.',
    ar: 'تنبيه خفيف عند الإرسال والموافقة والانتهاء.',
  },
  'settings.behavior': { en: 'Behavior', ar: 'السلوك' },
  'settings.notifications': { en: 'Notifications', ar: 'الإشعارات' },
  'settings.notificationsBody': {
    en: 'Push when a run finishes while the app is closed.',
    ar: 'إشعار عند انتهاء المهمة والتطبيق مغلق.',
  },
  'settings.notificationsHint': {
    en: 'Get a push when the agent finishes or needs approval.',
    ar: 'احصل على تنبيه عندما ينتهي الوكيل أو يحتاج موافقة.',
  },
  'settings.enableNotifications': { en: 'Enable notifications', ar: 'تفعيل الإشعارات' },
  'settings.notificationsBlocked': {
    en: 'Notifications are blocked in system settings.',
    ar: 'الإشعارات محظورة من إعدادات النظام.',
  },
  'settings.notificationsUnavailable': {
    en: 'Push requires a development build or a physical device.',
    ar: 'الإشعارات تتطلب نسخة تطوير أو جهازاً حقيقياً.',
  },
  'settings.connection': { en: 'Connection', ar: 'الاتصال' },
  'settings.url': { en: 'Bridge URL', ar: 'عنوان الجسر' },
  'settings.token': { en: 'Token', ar: 'الرمز' },
  'settings.tokenStored': { en: 'Stored securely', ar: 'محفوظ بأمان' },
  'settings.tokenBody': {
    en: 'Held in the device keychain and sent only to your bridge.',
    ar: 'محفوظ في سلسلة مفاتيح الجهاز ويُرسل إلى جسرك فقط.',
  },
  'settings.bridge': { en: 'Bridge', ar: 'الجسر' },
  'settings.disconnect': { en: 'Disconnect', ar: 'قطع الاتصال' },
  'settings.disconnectBody': {
    en: 'The token is removed from this device. Sessions on the bridge are untouched.',
    ar: 'تتم إزالة الرمز من هذا الجهاز. الجلسات على الجسر لا تتأثر.',
  },
  'settings.pushDenied': {
    en: 'Allow notifications in system settings, then try again.',
    ar: 'اسمح بالإشعارات من إعدادات النظام ثم حاول مجدداً.',
  },
  'settings.pushSimulator': {
    en: 'Push notifications require a physical device.',
    ar: 'الإشعارات تحتاج إلى جهاز حقيقي.',
  },
  'settings.pushNoProject': {
    en: 'This build has no Expo project ID, so push is unavailable.',
    ar: 'هذا الإصدار بلا معرف مشروع Expo، لذا الإشعارات غير متاحة.',
  },
  'settings.pushFailed': { en: 'Could not enable notifications.', ar: 'تعذر تفعيل الإشعارات.' },
  'settings.rtlRestart': {
    en: 'Reopen the app to apply the Arabic layout direction.',
    ar: 'أعد فتح التطبيق لتطبيق اتجاه الواجهة العربية.',
  },
  'settings.ltrRestart': {
    en: 'Reopen the app to apply the left-to-right layout direction.',
    ar: 'أعد فتح التطبيق لتطبيق اتجاه الواجهة من اليسار إلى اليمين.',
  },
  'settings.securityNote': {
    en: 'Chat only. Commands run on your machine through OpenCode and require approval when configured.',
    ar: 'محادثة فقط. تعمل الأوامر على جهازك عبر OpenCode وتتطلب موافقة عند تفعيلها.',
  },
  'settings.disconnectConfirm': {
    en: 'Remove the bridge URL and token from this device?',
    ar: 'إزالة عنوان الجسر والرمز من هذا الجهاز؟',
  },
  'settings.about': { en: 'About', ar: 'حول' },
  'settings.version': { en: 'Version', ar: 'الإصدار' },
  'settings.privacy': {
    en: 'The token is kept in the device secure store and sent only to your bridge.',
    ar: 'يبقى الرمز في مخزن الجهاز الآمن ويُرسل إلى جسرك فقط.',
  },
  'settings.restartHint': {
    en: 'Reopen the app if the layout direction does not update.',
    ar: 'أعد فتح التطبيق إذا لم يتحدث اتجاه الواجهة.',
  },

  'time.now': { en: 'now', ar: 'الآن' },
  'time.minutesShort': { en: '{count}m', ar: '{count} د' },
  'time.hoursShort': { en: '{count}h', ar: '{count} س' },
  'time.daysShort': { en: '{count}d', ar: '{count} ي' },
  'time.today': { en: 'Today', ar: 'اليوم' },
  'time.yesterday': { en: 'Yesterday', ar: 'أمس' },

  'diff.title': { en: 'Changes', ar: 'التغييرات' },
  'diff.added': { en: 'Added', ar: 'مضاف' },
  'diff.deleted': { en: 'Deleted', ar: 'محذوف' },
  'diff.modified': { en: 'Modified', ar: 'معدل' },
  'diff.wrap': { en: 'Wrap lines', ar: 'التفاف الأسطر' },
  'diff.copyPath': { en: 'Copy path', ar: 'نسخ المسار' },
  'diff.empty': { en: 'No changes in this turn.', ar: 'لا تغييرات في هذا الدور.' },
  'diff.files': { en: '{count} files', ar: '{count} ملفات' },
  'diff.oneFile': { en: '1 file', ar: 'ملف واحد' },
  'diff.loadError': {
    en: 'Could not load changes.',
    ar: 'تعذر تحميل التغييرات.',
  },
  'diff.preview': {
    en: 'Showing the first {limit} of {total} lines.',
    ar: 'يتم عرض أول {limit} سطر من أصل {total} سطراً.',
  },
  'code.showAll': { en: 'Show all {count} lines', ar: 'عرض كل الأسطر ({count})' },
  'code.collapse': { en: 'Collapse', ar: 'طي' },
};

export interface I18n {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const loc: Locale = locale === 'ar' || locale === 'fr' ? locale : 'en';
  const entry = strings[key];
  let value = entry
    ? loc === 'fr'
      ? (frStrings[key] ?? entry.en)
      : entry[loc]
    : (frStrings[key] ?? key);
  if (!value) value = entry?.en ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
}

export function useI18n(): I18n {
  const locale = useSettings((state) => state.locale);
  const isRTL = locale === 'ar';
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => translate(locale, key, vars),
    [locale],
  );
  return { locale, dir: isRTL ? 'rtl' : 'ltr', isRTL, t };
}
