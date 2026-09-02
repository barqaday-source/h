const fs = require('fs');

let uiKitPath = 'src/components/ui-kit.jsx';
if (!fs.existsSync(uiKitPath)) uiKitPath = 'src/components/ui-kit/index.jsx';

if (fs.existsSync(uiKitPath)) {
  let content = fs.readFileSync(uiKitPath, 'utf8');

  // استبدال المكون ليعتمد صورة الشعار الأصلية مباشرة بحجم سلس وبدون خلفية
  const realLogoComponent = `export function Logo({ size = "h-10", className = "" }) {
  return (
    <div className={\`inline-flex items-center justify-center select-none \${className}\`}>
      <img 
        src="/logo.png" 
        alt="جوك" 
        className={\`w-auto \${size} object-contain mix-blend-multiply dark:mix-blend-screen\`}\
        onError={(e) => {
          // نص بديل أنيق ومؤقت في حال عدم وجود صورة logo.png بعد
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextSibling.style.display = 'flex';
        }}
      />
      <span className="hidden text-2xl font-black text-emerald-400 tracking-wide">جوّك</span>
    </div>
  );
}`;

  content = content.replace(/export function Logo[\s\S]*?\n\}/, realLogoComponent);
  fs.writeFileSync(uiKitPath, content, 'utf8');
  console.log('✅ تم تحديث مكون الشعار ليعتمد على صورة PNG شفافة أصلية');
}
