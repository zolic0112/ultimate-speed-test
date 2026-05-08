# Multi-Style Medals Setup Guide

Ultimate Speed Test 已升级以支持为不同评级加载多个自定义 3D 模型。本指南将帮助你为每个等级（S, A, B, C, D, F）创建和集成自己的奖牌设计。

## 📋 目录结构

```
app/
├── medals/                    # 新建此目录
│   ├── medal-s.glb          # LIGHTSPEED (≥500 Mbps)
│   ├── medal-a.glb          # EXCELLENT (≥200 Mbps)
│   ├── medal-b.glb          # STRONG (≥80 Mbps)
│   ├── medal-c.glb          # STEADY (≥25 Mbps)
│   ├── medal-d.glb          # LIMITED (≥5 Mbps)
│   └── medal-f.glb          # CRITICAL (<5 Mbps)
├── medal.js                   # 已升级，支持模型加载
├── app-v2.js
├── index.html
└── ... (其他文件)
```

## 🎨 在 Blender 中建模

### 步骤 1: 新建项目
1. 打开 Blender (推荐 4.0+)
2. 新建默认项目（删除默认立方体）
3. 为每个等级创建独特的奖牌设计

### 步骤 2: 建模建议

**基础考虑：**
- **尺度**: 保持在 2×2×2 单位范围内（便于统一缩放）
- **原点**: 将旋转点放在中心 (0,0,0)
- **面向**: 确保"前面"朝向 +Z 方向（相机视角）
- **几何体**: 简化几何体以获得更好的性能
  - 用 S 等级的简单设计 (~5k 面)
  - 用 F 等级的损坏/损伤变体 (~3k 面)

**建议的变体：**

| 等级 | 设计特性 | 参考灵感 |
|------|--------|--------|
| **S** | 完美、发光、未来主义 | 金色/铂金闪耀 |
| **A** | 优雅、高效、精致 | 银色研磨 |
| **B** | 坚固、可靠 | 铜/青铜纹理 |
| **C** | 普通、中立 | 灰色磨砂 |
| **D** | 磨损、暗淡 | 生锈铁 |
| **F** | 破碎、焦灼 | 焦炭/碎片效果 |

### 步骤 3: 材质设置

**推荐材质参数（用于物理渲染）：**

```
基础色 (Base Color): 等级相关的颜色
金属度 (Metalness): 0.8 - 1.0
粗糙度 (Roughness): 0.2 - 0.5
反射 (Reflectivity): 0.5 - 1.0
自发光 (Emission): 可选，用于"S"等级
```

**材质示例 (Principled BSDF)：**
- **S级**: Base Color #FFD700, Metalness 1.0, Roughness 0.15, 轻微自发光
- **F级**: Base Color #333333, Metalness 0.6, Roughness 0.8, 无自发光

### 步骤 4: 导出为 glTF 2.0

1. **选择所有可见对象** (A 选择全部)
2. **导出：** File → Export → glTF 2.0 (.glb/.gltf)
3. **导出设置：**
   ```
   ✓ Include Animations (如果你添加了动画)
   ✓ Include All Bone Influences
   ✓ Format: glTF Binary (.glb) [推荐更小的文件大小]
   
   可选 Draco 压缩（进一步减小 30-50%）:
   ✓ Use Draco Compression
   ```

4. **保存位置：** `app/medals/medal-{grade}.glb`

## 📦 文件要求

### 文件大小预算
```
单个模型: < 500 KB (推荐 < 200 KB)
所有 6 个模型: < 2.5 MB
```

### 优化技巧

**减小文件大小：**
1. **简化网格** (Blender)
   - Modifier → Decimation (~30-50% 面数减少)
   - 删除不可见的内部几何体

2. **纹理优化**
   - 使用 1K 或 2K 纹理（不要 4K）
   - 压缩为 WebP 或优化的 PNG

3. **Draco 压缩**
   - 在 Blender 导出时启用
   - 减少 ~50% 大小，但增加加载时间
   - 权衡取决于网络条件

4. **材质合并**
   - 尽量减少材质数量（≤ 3 个）

## 🔧 集成到应用

### 步骤 1: 创建 medals 目录

```bash
# 在 app/ 目录中
mkdir medals
```

### 步骤 2: 将模型放入

复制你导出的 6 个 `.glb` 文件到 `app/medals/` 目录：
```
app/medals/
├── medal-s.glb
├── medal-a.glb
├── medal-b.glb
├── medal-c.glb
├── medal-d.glb
└── medal-f.glb
```

### 步骤 3: 确保 HTML 加载 GLTFLoader

编辑 `index.html`，在 Three.js 脚本后添加 GLTFLoader：

```html
<script src="https://cdn.jsdelivr.net/npm/three@r128/examples/jsm/loaders/GLTFLoader.js"></script>
```

完整的 `<head>` 部分应该包含：
```html
<script src="https://cdn.jsdelivr.net/npm/three@r128/web/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@r128/examples/jsm/loaders/GLTFLoader.js"></script>
```

### 步骤 4: 验证 medal.js 配置

检查 `medal.js` 中的路径映射（应该已经设置）：

```javascript
this.gradeModels = {
  'S': 'medals/medal-s.glb',
  'A': 'medals/medal-a.glb',
  'B': 'medals/medal-b.glb',
  'C': 'medals/medal-c.glb',
  'D': 'medals/medal-d.glb',
  'F': 'medals/medal-f.glb',
};
```

如果路径不同，编辑此映射。

## 🧪 测试和调试

### 浏览器控制台输出

当测试运行完成并显示结果时，打开浏览器**开发者工具** (F12) 并查看控制台。你应该看到：

```
[medal] Loading model for grade S from: medals/medal-s.glb
[medal] ✓ Successfully loaded model for grade S
[medal] Swapped to external model for grade S
```

### 如果模型未加载

**症状 1: "GLTFLoader not available"**
```
[medal] THREE.GLTFLoader not available. Using procedural model.
```
**解决方案**: 确保在 HTML 中正确加载了 GLTFLoader 脚本（见上面的步骤 3）

**症状 2: "Failed to load model"**
```
[medal] Failed to load model for grade S: 404 Not Found
```
**解决方案**: 
- 检查文件路径是否正确
- 确保文件在 `app/medals/medal-s.glb` 位置
- 检查文件名是否完全匹配
- 检查 Web 服务器是否正确提供文件

**症状 3: 模型加载但看起来错误**
- 检查模型的**缩放**（应该在 2×2×2 范围内）
- 验证原点是否居中
- 在 Blender 中检查法线方向（都应该向外指向）

### 测试检查清单

```
□ medals/ 目录存在且包含 6 个 .glb 文件
□ index.html 加载了 GLTFLoader
□ 浏览器控制台没有 404 或加载错误
□ 完整一个速度测试
□ 奖牌显示时看到 3D 模型（不是程序生成的圆盘）
□ 可以拖动/旋转/缩放奖牌
□ 等级标签正确显示（S/A/B/C/D/F）
```

## 🎯 高级自定义

### 调整模型缩放

如果你的模型看起来太大或太小，编辑 `medal.js` 中的 `_swapModel()` 方法：

```javascript
async _swapModel(grade) {
  const loadedScene = await this._loadModelForGrade(grade);
  
  if (loadedScene) {
    if (this.body) this.scene.remove(this.body);
    
    this.body = loadedScene.clone();
    this.scene.add(this.body);
    
    // 根据需要调整缩放（例如，放大 1.5 倍）
    this.body.scale.multiplyScalar(1.5);  // ← 改这里
    
    if (this.labelCanvas && this.labelTex) {
      this._updateLabelOnModel(this.labelTex);
    }
  } else {
    this._buildMedal();
  }
}
```

### 自定义标签（等级字母）

标签（S/A/B/C 等）是在 `_drawLabel()` 方法中绘制的。你可以自定义：

```javascript
_drawLabel(letter, title, serial) {
  const g = this.labelCanvas.getContext('2d');
  g.clearRect(0, 0, 512, 512);

  // 修改这些字体/颜色/位置
  g.fillStyle = 'rgba(255,255,255,0.96)';  // ← 改颜色
  g.font = 'bold 240px "Space Grotesk", sans-serif';  // ← 改字体/大小
  g.fillText(letter, 256, 256);
  
  // ... (继续自定义)
}
```

### 禁用模型加载（回退到程序生成）

如果你想暂时禁用模型加载（例如进行故障排除），在 `medal.js` 中注释掉：

```javascript
setGrade(letter, title, serial) {
  this.grade = letter;
  this._drawLabel(letter, title, serial);
  // this._swapModel(letter);  // ← 注释掉此行
}
```

## 📚 参考资源

- **Blender 文档**: https://docs.blender.org/
- **glTF 规范**: https://www.khronos.org/gltf/
- **Three.js GLTFLoader**: https://threejs.org/docs/#examples/en/loaders/GLTFLoader
- **Three.js 材质**: https://threejs.org/docs/#api/en/materials/MeshPhysicalMaterial

## ❓ 常见问题

**Q: 我可以使用其他 3D 格式吗（如 .obj, .fbx）？**
A: 不推荐。GLTFLoader 是 Three.js 的标准，拥有最好的支持和性能。如果你有 .obj/.fbx，使用 Blender 导出为 glTF。

**Q: 模型可以有动画吗？**
A: 是的！glTF 支持骨骼动画。启用 Blender 导出选项中的"Include Animations"。然后在 `medal.js` 的 `_loop()` 方法中播放它们。

**Q: 如何为不同品级使用不同的标签（不只是字母）？**
A: 编辑 `app-v2.js` 中的 `gradeFor()` 函数以返回自定义 `title` 值，然后 `setGrade()` 会使用它。

**Q: 部署到生产时文件大小很重要吗？**
A: 非常重要。总共保持在 2-3 MB 以下，使用 Draco 压缩。在缓慢的 3G 网络上测试。

## 🚀 部署清单

```
□ 所有 6 个 .glb 文件已创建和优化
□ 文件已上传到 app/medals/
□ 文件大小验证（< 2.5 MB 总计）
□ index.html 包含 GLTFLoader 脚本
□ medal.js 中的路径正确
□ 在多个浏览器上测试加载
□ 移动设备上测试（iOS Safari、Android Chrome）
□ 生产构建完成
```

## 📝 故障排除快速参考

| 问题 | 症状 | 解决方案 |
|------|------|--------|
| 缺少 GLTFLoader | 控制台: "not available" | 在 index.html 中加载脚本 |
| 404 错误 | 控制台: "404 Not Found" | 检查文件路径/名称 |
| 模型太大/太小 | 视觉上不匹配 | 调整 `scale.multiplyScalar()` |
| 模型旋转错误 | 面向错误的方向 | 在 Blender 中旋转再导出 |
| 加载缓慢 | 加载需要 > 2 秒 | 使用 Draco 压缩或优化网格 |
| 标签在错误的位置 | 文本不可见或剪裁 | 编辑 `_drawLabel()` 坐标 |

---

祝你的奖牌设计好运！有任何问题，检查浏览器控制台，它会告诉你发生了什么。🎖️