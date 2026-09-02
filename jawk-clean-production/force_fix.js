const fs = require('fs');

// 1. إصلاح مكونات ui-kit (تعطيل الشريط الوهمي كلياً + الشعار الشفاف بالنقطة البيضاء)
let uiKitPath = 'src/components/ui-kit.jsx';
if (!fs.existsSync(uiKitPath)) uiKitPath = 'src/components/ui-kit/index.jsx';

if (fs.existsSync(uiKitPath)) {
  let content = fs.readFileSync(uiKitPath, 'utf8');

  // تعطيل StatusBar نهائياً ليختفي من كل الشاشات فوراً
  content = content.replace(
    /export function StatusBar[\s\S]*?\n\}/,
    'export function StatusBar() { return null; }'
  );

  // تحديث الشعار ليصبح شفافاً بالنقطة البيضاء
  const newLogo = `export function Logo({ size = "text-2xl", className = "" }) {
  return (
    <div className={\`font-black tracking-tight flex items-center select-none \${size} \${className}\`}>
      <span className="relative inline-block text-emerald-400 font-extrabold">
        جوّك
        <span className="absolute right-[2px] -bottom-[1px] w-2.5 h-2.5 rounded-full bg-white border border-gray-200 shadow-sm"></span>
      </span>
    </div>
  );
}`;

  content = content.replace(/export function Logo[\s\S]*?\n\}/, newLogo);
  fs.writeFileSync(uiKitPath, content, 'utf8');
  console.log('✅ تم تعديل ui-kit (تعطيل الشريط الوهمي وتحديث الشعار)');
}

// 2. إعادة هيكلة مسافات البحث والخيارات والخريطة في الصفحة الرئيسية
const homePath = 'src/routes/home.jsx';
if (fs.existsSync(homePath)) {
  let content = fs.readFileSync(homePath, 'utf8');

  // حذف أعيان StatusBar المتبقية
  content = content.replace(/<StatusBar\s*\/?>/g, '');

  // التأكد من إعطاء أزرار التصفية والبحث مساحة وزد إندكس ممتاز
  content = content.replace(/className="[^"]*overflow-x-auto[^"]*"/g, 'className="relative z-20 flex items-center gap-3 overflow-x-auto py-2 my-2 no-scrollbar"');
  
  fs.writeFileSync(homePath, content, 'utf8');
  console.log('✅ تم تعديل مسافات الصفحة الرئيسية');
}
