// generate-icons.js - 生成简单的纯色图标
// 使用方法：node generate-icons.js

const fs = require('fs');
const path = require('path');

// 创建一个简单的 PNG 数据（最小化的 PNG）
function createSimplePNG(size) {
  // 这是一个最小化的蓝色 PNG（实际项目中应使用专业工具）
  // 由于无法在纯 Node 中生成真实的 PNG，这里提供 base64 占位符

  const canvas = `
  提示：此脚本需要安装 canvas 库才能生成真实的 PNG 图标。

  请运行：
  npm install canvas

  然后取消注释下面的代码：

  // const { createCanvas } = require('canvas');
  // const canvas = createCanvas(size, size);
  // const ctx = canvas.getContext('2d');
  // ctx.fillStyle = '#007aff';
  // ctx.fillRect(0, 0, size, size);
  // ctx.fillStyle = 'white';
  // ctx.font = size * 0.6 + 'px Arial';
  // ctx.textAlign = 'center';
  // ctx.textBaseline = 'middle';
  // ctx.fillText('X', size / 2, size / 2);
  // return canvas.toBuffer('image/png');
  `;

  console.log(canvas);
  return null;
}

console.log('图标生成脚本');
console.log('请参考 icons/README.md 中的说明生成图标');
console.log('');
console.log('推荐方法：');
console.log('1. 使用在线 SVG 转 PNG 工具');
console.log('2. 或安装 canvas 库后使用此脚本');

// 如果已安装 canvas，取消注释以下代码：
/*
try {
  const { createCanvas } = require('canvas');

  [16, 48, 128].forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // 背景
    ctx.fillStyle = '#007aff';
    ctx.fillRect(0, 0, size, size);

    // 文字
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📖', size / 2, size / 2);

    // 保存
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(__dirname, `icon${size}.png`), buffer);
    console.log(`已生成 icon${size}.png`);
  });

  console.log('所有图标已生成！');
} catch (error) {
  console.error('生成失败:', error.message);
  console.log('请先运行: npm install canvas');
}
*/