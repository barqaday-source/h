const fs = require('fs');
const path = 'src/routes/home.jsx';

if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');

  // 1. إعطاء شريط الأزرار طبقة علوية (z-10) وحماية الحواف من الاختفاء
  content = content.replace(
    /className="flex items-center gap-[^"]*overflow-x-auto[^"]*"/g,
    'className="relative z-10 flex items-center gap-2.5 overflow-x-auto py-2 px-1 no-scrollbar overflow-y-visible"'
  );

  // 2. فصل الخريطة للأسفل وإعطائها طبقة سفلية (z-0) لمنع التداخل
  content = content.replace(
    /className="flex-1 min-h-[^"]*"/g,
    'className="relative z-0 flex-1 min-h-[350px] px-5 mt-4 pb-24"'
  );

  // 3. التأكد من توفير مسافة إضافية بين شريط البحث والأزرار
  content = content.replace(
    /className="px-5 pt-3 pb-2 my-2 shrink-0 space-y-3"/g,
    'className="px-5 pt-3 pb-1 my-1 shrink-0 space-y-4 relative z-10"'
  );

  fs.writeFileSync(path, content, 'utf8');
  console.log('✓ تم فصل الخريطة وإعادة إظهار أزرار التصفية بالكامل');
}
