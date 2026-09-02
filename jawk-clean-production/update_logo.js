const fs = require('fs');

// 1. إنشاء مكون الشعار الموحد SVG شفاف للتطبيق بالكامل
const logoComponentCode = `import React from 'react';

export function Logo({ size = "h-10", className = "" }) {
  return (
    <div className={\`inline-flex items-center justify-center select-none \${className}\`}>
      <svg 
        viewBox="0 0 320 280" 
        className={\`w-auto \${size} drop-shadow-sm transition-transform duration-200 hover:scale-105\`}\
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a3a" />
            <stop offset="50%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        <!-- القوس الخارجي العلوي والسفلي مع التدرج -->
        <path 
          d="M 60 140 A 110 110 0 0 1 245 45" 
          stroke="url(#arcGrad)" 
          strokeWidth="6" 
          strokeLinecap="round" 
        />
        <path 
          d="M 220 230 A 110 110 0 0 1 70 215" 
          stroke="url(#arcGrad)" 
          strokeWidth="6" 
          strokeLinecap="round" 
        />

        <!-- كلمة جوك المصممة بالخط الدائري الشفاف -->
        <g fill="currentColor" className="text-emerald-900 dark:text-emerald-400">
          <!-- حرف الجيم -->
          <path d="M 235 125 C 215 105, 175 105, 155 130 C 140 150, 145 185, 165 200 C 185 210, 205 195, 200 170 C 190 145, 230 135, 245 150 C 255 160, 245 180, 230 185 Z" />
          <!-- الواو والهمزة/الكاف -->
          <path d="M 145 110 C 110 110, 100 160, 125 185 C 145 205, 170 180, 160 150 C 150 120, 115 130, 110 160 Z" />
          <path d="M 95 145 C 70 135, 50 160, 60 185 C 75 220, 120 215, 125 190 C 100 190, 80 175, 95 145 Z" />
          <!-- الهمزة العلوي والسفلي -->
          <path d="M 85 135 C 75 125, 80 115, 90 120 C 100 125, 95 140, 85 135 Z" />
        </g>

        <!-- أيقونة الكرة الزاهية أسفل الشعار -->
        <g transform="translate(225, 170)">
          <circle cx="20" cy="20" r="22" fill="#a3e635" />
          <circle cx="20" cy="20" r="16" fill="none" stroke="#65a30d" strokeWidth="2.5" strokeDasharray="4 2" />
          <path d="M 15 20 L 20 15 L 25 20 L 23 26 L 17 26 Z" fill="#4d7c0f" />
        </g>
      </svg>
    </div>
  );
}
`;

// 2. تحديث مكون Logo في ui-kit
let uiKitPath = 'src/components/ui-kit.jsx';
if (!fs.existsSync(uiKitPath)) uiKitPath = 'src/components/ui-kit/index.jsx';

if (fs.existsSync(uiKitPath)) {
  let content = fs.readFileSync(uiKitPath, 'utf8');
  content = content.replace(/export function Logo[\s\S]*?\n\}/, logoComponentCode.trim());
  fs.writeFileSync(uiKitPath, content, 'utf8');
  console.log('✓ تم تحديث مكون Logo الموحد بنجاح');
}

// 3. توحيد الاستخدام في شاشة الترحيب والـ Splash والـ Header والـ Auth
const screens = [
  'src/routes/index.jsx',
  'src/routes/auth.jsx',
  'src/routes/onboarding.jsx',
  'src/routes/home.jsx'
];

screens.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // التأكد من استيراد واستخدام Logo بشكل شفاف ونظيف
    if (!content.includes('Logo') && content.includes('ui-kit')) {
      content = content.replace('from "../components/ui-kit"', 'Logo, $&');
    }
    fs.writeFileSync(filePath, content, 'utf8');
  }
});

console.log('✓ تم تطبيق الشعار الجديد بدون خلفية على كافة الشاشات');
