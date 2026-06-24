# 临时图标说明

由于需要 PNG 格式的图标，请使用以下方法之一生成：

## 方法 1：使用在线工具转换
1. 打开 icon.svg
2. 使用在线 SVG 转 PNG 工具（如 https://cloudconvert.com/svg-to-png）
3. 分别生成 16x16、48x48、128x128 三个尺寸
4. 重命名为 icon16.png、icon48.png、icon128.png

## 方法 2：使用 Canvas 生成
在浏览器控制台运行：

```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
[16, 48, 128].forEach(size => {
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#1d9bf0';
  ctx.fillRect(0, 0, size, size);
  ctx.font = `${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📖', size/2, size/2);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icon${size}.png`;
    a.click();
  });
});
```

## 方法 3：临时使用字母代替
如果只是测试，可以创建简单的纯色图标：
- 16x16、48x48、128x128 的蓝色方块
- 中间写上白色的 "X"