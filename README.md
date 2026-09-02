# Jawk — Clean Production Codebase

هذه هي قاعدة الكود الموحدة لتطبيق Jawk. تعتمد النسخة الحالية على React/TanStack Start وVite، وتغطي الويب وAndroid عبر واجهة ويب متجاوبة قابلة للتشغيل داخل متصفح Android أو تثبيتها كتطبيق PWA. لا توجد نسخة Android Native مكررة داخل هذا المجلد.

## التشغيل

انسخ `ENV_FILE_TO_RENAME.txt` إلى `.env` داخل جذر المشروع، ثم عدّل `VITE_CARTO_KEY` و`VITE_DEFAULT_MATCH_ID` عند الحاجة. بعد ذلك شغّل:

```bash
pnpm install
pnpm dev
```

لبناء نسخة الإنتاج:

```bash
pnpm build
pnpm preview
```

## Supabase

يوجد مخطط قاعدة البيانات ووظيفة المطابقة في مجلد `supabase/`. شغّل ملف migration الموحد من SQL Editor في Supabase، ثم انشر `supabase/functions/jawk-matchmaker/index.ts` إن كنت تستخدم التشغيل الخلفي التلقائي. لا تضع `SUPABASE_SERVICE_ROLE_KEY` في `.env` الخاص بالواجهة.

يستدعي زر «ابحث بجمجم» RPC باسم `jamjam_matchmaker`. تعتمد النتائج على اللاعب الذي فعّل الحضور، وسمح بطلبات جمجم، وكان تحديثه حديثاً، مع ترتيب حسب المنطقة والمستوى والمسافة.

## الخريطة

تستخدم الخريطة Leaflet مع CARTO Dark Matter. يجب إبقاء attribution لـ CARTO وOpenStreetMap ظاهراً، واستخدام مفتاح CARTO الخاص بالمشروع ضمن حدود الاستخدام المسموحة.

## Android

يمكن فتح رابط التطبيق من متصفح Android وإضافته إلى الشاشة الرئيسية. ولتحويله إلى APK أو نشره عبر متجر Android، استخدم غلاف Capacitor أو Trusted Web Activity خارج قاعدة الواجهة، مع إبقاء هذا المشروع هو المصدر الوحيد للوظائف والهوية.

## فحص الجودة

```bash
pnpm lint
pnpm build
```

تم استبعاد الاعتماديات والمخرجات المولدة من الحزمة؛ يعاد تثبيتها بواسطة `pnpm install`.
