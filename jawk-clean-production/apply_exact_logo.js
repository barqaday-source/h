const fs = require('fs');
const path = require('path');

// 1. إنشاء ملف logo_exact.svg بتفاصيل متجهة عالية الدقة ومطابقة لتصميم الشعار الأصلي
const svgContent = `<svg viewBox="0 0 340 300" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#1e3836" />
      <stop offset="50%" stopColor="#2dd4bf" />
      <stop offset="100%" stopColor="#eab308" />
    </linearGradient>
  </defs>

  <!-- الأقواس الخارجية المتدرجة -->
  <path d="M 65 145 A 110 110 0 0 1 250 45" stroke="url(#arcGradient)" stroke-width="7" stroke-linecap="round" />
  <path d="M 230 250 A 110 110 0 0 1 65 210" stroke="url(#arcGradient)" stroke-width="7" stroke-linecap="round" />

  <!-- خط كلمة "جوّك" الفني المتصل والشعار المفرغ -->
  <g fill="#1e3836" class="dark:fill-emerald-400">
    <!-- رسم الكلمة المتصل والهمزة -->
    <path d="M 270 148 C 260 120, 220 115, 195 140 C 175 158, 180 188, 200 195 C 225 205, 250 175, 235 155 C 220 135, 170 148, 145 178 C 128 200, 140 225, 165 225 C 190 225, 195 198, 178 185 C 160 170, 120 188, 98 170 C 78 154, 72 115, 45 150 C 28 175, 50 202, 82 202 C 118 202, 138 162, 110 142 C 92 128, 65 150, 88 160 Z" />
    <path d="M 80 138 C 68 126, 75 113, 88 120 C 100 128, 92 146, 80 138 Z" />
  </g>

  <!-- أيقونة الكرة الفسفورية في الأسفل -->
  <g transform="translate(240, 175)">
    <circle cx="26" cy="26" r="26" fill="#a3e635" />
    <polygon points="26,13 35,20 32,31 20,31 17,20" fill="#4d7c0f" />
    <line x1="26" y1="13" x2="26" y2="4" stroke="#4d7c0f" stroke-width="2.5" />
    <line x1="35" y1="20" x2="44" y2="17" stroke="#4d7c0f" stroke-width="2.5" />
    <line x1="32" y1="31" x2="39" y2="40" stroke="#4d7c0f" stroke-width="2.5" />
    <line x1="20" y1="31" x2="13" y2="40" stroke="#4d7c0f" stroke-width="2.5" />
    <line x1="17" y1="20" x2="8" y2="17" stroke="#4d7c0f" stroke-width="2.5" />
  </g>
</svg>`;

fs.writeFileSync('src/components/logo_exact.svg', svgContent, 'utf8');
console.log('✓ تم إنشاء ملف src/components/logo_exact.svg');

// 2. إنشاء مكوّن Logo.jsx المبني على المكوّن المخصص
const logoComponentCode = `import React from "react";
import logoUrl from "./logo_exact.svg";

export default function Logo({
  width = 236,
  height = "auto",
  alt = "شعار جوّك",
  className = "",
  style,
  ...props
}) {
  const imageStyle = {
    display: "block",
    width,
    height,
    objectFit: "contain",
    ...style,
  };

  return (
    <img
      {...props}
      src={logoUrl}
      width={typeof width === "number" ? width : undefined}
      height={typeof height === "number" ? height : undefined}
      alt={alt}
      className={className}
      style={imageStyle}
    />
  );
}

export { logoUrl };
`;

fs.writeFileSync('src/components/Logo.jsx', logoComponentCode, 'utf8');
console.log('✓ تم إنشاء مكون src/components/Logo.jsx');

// 3. تحديث ui-kit ليصّدِر مكوّن Logo المخصص مباشرة
let uiKitPath = 'src/components/ui-kit.jsx';
if (!fs.existsSync(uiKitPath)) uiKitPath = 'src/components/ui-kit/index.jsx';

if (fs.existsSync(uiKitPath)) {
  let content = fs.readFileSync(uiKitPath, 'utf8');

  // استبدال دالة Logo القديمة باستيراد المكون الجديد
  content = content.replace(/export function Logo[\s\S]*?\n\}/, 'export { default as Logo } from "./Logo";');
  fs.writeFileSync(uiKitPath, content, 'utf8');
  console.log('✓ تم ربط المكون الجديد داخل ui-kit');
}
