const fs = require('fs');
const path = require('path');

// دالة لجلب جميع ملفات المشروع داخل مجلد src
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (/\.(jsx|tsx|js|ts)$/.test(file)) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const allFiles = getAllFiles('src');

allFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. تحويل دالة StatusBar أينما وجدت لتُرجع null مباشرة فلا تظهر بأي شكل
  content = content.replace(
    /export\s+(function|const)\s+StatusBar[\s\S]*?\{[\s\S]*?\}/g,
    'export function StatusBar() { return null; }'
  );

  // 2. حذف أي عنصر يحتوي على الوقت الوهمي 9:41 أو أشكال البطارية/الشبكة
  content = content.replace(/<div[^>]*>[^<]*9:41[^<]*<\/div>/g, '');
  content = content.replace(/<span[^>]*>[^<]*9:41[^<]*<\/span>/g, '');
  content = content.replace(/9:41/g, '');

  // 3. حذف استدعاءات <StatusBar /> من جميع الواجهات
  content = content.replace(/<StatusBar\s*\/?>/g, '');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ تم تنظيف: ${filePath}`);
  }
});

console.log('✓ تم حذف الشريط الوهمي نهائياً من كافة شاشات ومكونات التطبيق');
