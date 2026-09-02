const fs = require('fs');

// 1. تعديل لون النقطة في الشعار لتصبح بيضاء
let logoPath = 'src/components/ui-kit.jsx';
if (!fs.existsSync(logoPath)) logoPath = 'src/components/ui-kit/index.jsx';

if (fs.existsSync(logoPath)) {
  let content = fs.readFileSync(logoPath, 'utf8');
  const whiteDotLogo = `export function Logo({ size = "text-2xl" }) {
  return (
    <div className={\`font-black tracking-tight flex items-center select-none \${size}\`}>
      <span className="relative inline-block text-primary font-extrabold">
        حوّك
        <span className="absolute right-[3px] -bottom-[2px] w-2.5 h-2.5 rounded-full bg-white border border-gray-300 shadow-sm"></span>
      </span>
    </div>
  );
}`;
  content = content.replace(/export function Logo[\s\S]*?\n\}/, whiteDotLogo);
  fs.writeFileSync(logoPath, content, 'utf8');
  console.log('✓ تم تعديل نقطة الشعار للون الأبيض');
}

// 2. إزالة الشريط الوهمي من كل الشاشات
const routeFiles = [
  'src/routes/index.jsx',
  'src/routes/auth.jsx',
  'src/routes/onboarding.jsx',
  'src/routes/home.jsx'
];

routeFiles.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/<StatusBar\s*\/?>/g, '');
    content = content.replace(/import\s*\{\s*StatusBar\s*\}\s*from\s*["\'][^"\']+["\'];?/g, '');
    content = content.replace(/StatusBar,?\s*/g, '');
    fs.writeFileSync(file, content, 'utf8');
  }
});
console.log('✓ تم مسح الشريط الوهمي من جميع الشاشات');

// 3. ضبط مسافات البحث وأزرار التصفية والخريطة
const homePath = 'src/routes/home.jsx';
if (fs.existsSync(homePath)) {
  let content = fs.readFileSync(homePath, 'utf8');

  content = content.replace(
    /className="px-5 space-y-[^"]*shrink-0[^"]*"/g,
    'className="px-5 pt-3 pb-2 my-2 shrink-0 space-y-3"'
  );

  content = content.replace(
    /className="flex items-center gap-[^"]*overflow-x-auto[^"]*"/g,
    'className="flex items-center gap-3 overflow-x-auto py-2 no-scrollbar"'
  );

  content = content.replace(
    /className="flex-1 min-h-[^"]*px-5[^"]*"/g,
    'className="flex-1 min-h-[320px] px-5 mt-3 pb-20"'
  );

  fs.writeFileSync(homePath, content, 'utf8');
  console.log('✓ تم ضبط مسافات الواجهة في الرئيسية');
}
