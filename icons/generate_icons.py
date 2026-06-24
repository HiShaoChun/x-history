#!/usr/bin/env python3
"""
生成简单的 PNG 图标
使用 Python PIL/Pillow 库生成图标
运行: python generate_icons.py
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os

    # 创建图标
    sizes = [16, 48, 128]
    bg_color = (29, 155, 240)  # #1d9bf0
    text_color = (255, 255, 255)  # white

    for size in sizes:
        # 创建图片
        img = Image.new('RGB', (size, size), color=bg_color)
        draw = ImageDraw.Draw(img)

        # 绘制文字
        try:
            # 尝试使用系统字体
            font_size = int(size * 0.6)
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            # 如果找不到字体，使用默认字体
            font = ImageFont.load_default()

        text = "X"
        # 获取文字边界框
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # 居中绘制
        x = (size - text_width) // 2
        y = (size - text_height) // 2
        draw.text((x, y), text, fill=text_color, font=font)

        # 保存
        filename = f'icon{size}.png'
        img.save(filename)
        print(f'Generated {filename}')

    print('\nAll icons generated successfully!')

except ImportError:
    print('Error: Pillow library is required')
    print('Please run: pip install Pillow')
    print('\nOr use online tools to generate icons (see README.md)')