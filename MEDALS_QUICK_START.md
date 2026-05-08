# 🚀 多款式奖牌 - 快速开始指南

## ✨ 你刚刚升级了什么？

你的 `medal.js` 现在支持为每个评级（S、A、B、C、D、F）加载**自定义 3D 模型**！

**之前：** 所有等级使用相同的程序生成奖牌
**现在：** 每个等级可以有独特的视觉设计 🎨

---

## ⚡ 5 分钟快速设置

### 1️⃣ **创建你的模型**（使用 Blender）

```
Blender → 创建 6 个奖牌设计
  S: LIGHTSPEED (金色、发光)
  A: EXCELLENT (银色)
  B: STRONG (蓝色)
  C: STEADY (灰色)
  D: LIMITED (暗淡)
  F: CRITICAL (破损)

导出每个为 .glb 格式
  File → Export → glTF 2.0 (.glb)
```

### 2️⃣ **将文件放入正确位置**

```
app/
├── medals/                    ✅ 已为你创建
│   ├── medal-s.glb          ← 你的 S 级模型
│   ├── medal-a.glb          ← 你的 A 级模型
│   ├── medal-b.glb
│   ├── medal-c.glb
│   ├── medal-d.glb
│   └── medal-f.glb
└── medal.js                   ✅ 已升级
```

### 3️⃣ **确保 HTML 加载 GLTFLoader**

在 `index.html` 的 `<head>` 中添加（已有 Three.js 之后）：

```html
<script src="https://cdn.jsdelivr.net/npm/three@r128/examples/jsm/loaders/GLTFLoader.js"></script>
```

### 4️⃣ **完成！**

运行速度测试 → 完成 → 应该看到你的 3D 模型 ✨

---

## 🎯 工作原理

```
用户获得评级 (S/A/B/C/D/F)
        ↓
setGrade() 被调用
        ↓
尝试加载对应的 .glb 文件
        ↓
成功 → 显示你的 3D 模型 ✅
失败 → 回退到程序生成的奖牌 ⚙️
```

---

## 📋 检查清单

- [ ] 6 个 .glb 文件在 `app/medals/` 目录中
- [ ] 文件命名正确（`medal-s.glb`, `medal-a.glb` 等）
- [ ] `index.html` 加载了 GLTFLoader
- [ ] 运行一个完整的速度测试
- [ ] 打开浏览器控制台（F12）并查看日志

**预期日志输出：**
```
[medal] Loading model for grade S from: medals/medal-s.glb
[medal] ✓ Successfully loaded model for grade S
[medal] Swapped to external model for grade S
```

---

## 🐛 如果模型没有显示

### 检查 1: 文件存在吗？
```
打开浏览器开发者工具 → 网络标签 → 搜索 "medal-s.glb"
如果显示 404 → 文件路径错误
```

### 检查 2: GLTFLoader 加载了吗？
```
控制台输出 "GLTFLoader not available" 
→ 在 index.html 中加载脚本
```

### 检查 3: 模型太大/太小？
在 `medal.js` 的 `_swapModel()` 中调整：
```javascript
this.body.scale.multiplyScalar(1.2);  // 放大 20%
```

---

## 📊 建模快速参考

### 每个等级的建议

| 等级 | 概念 | 颜色 | 效果 |
|------|------|------|------|
| **S** | 极速 | 金/白 | 高度抛光、发光 |
| **A** | 优秀 | 银 | 精细、光滑 |
| **B** | 强劲 | 蓝 | 坚固、粗糙 |
| **C** | 稳定 | 灰 | 中性、简洁 |
| **D** | 受限 | 暗灰 | 磨损、暗淡 |
| **F** | 危急 | 深灰 | 破损、焦灼 |

### Blender 材质设置（推荐）

```
Principled BSDF:
  Base Color: 等级相关颜色
  Metalness: 0.8-1.0
  Roughness: 0.2-0.5
```

### 导出设置

```
✅ Format: Binary (.glb)
✅ Include Animations
✅ Include Materials
✅ Draco compression (可选，减小 50%)
```

---

## 📁 文件大小目标

| 项目 | 目标 |
|------|------|
| 单个模型 | < 200 KB |
| 所有 6 个模型 | < 2.5 MB |
| 优化技巧 | 使用 Draco 压缩 |

---

## 🔍 调试技巧

### 查看完整日志

打开浏览器控制台：
```
Windows: F12
Mac: Cmd + Option + I
```

应该看到：
```
[medal] Loading model for grade S from: medals/medal-s.glb
[medal] ✓ Successfully loaded model for grade S
[medal] Swapped to external model for grade S
```

### 禁用模型加载（测试）

在 `medal.js` 的 `setGrade()` 中：
```javascript
setGrade(letter, title, serial) {
  this.grade = letter;
  this._drawLabel(letter, title, serial);
  // this._swapModel(letter);  // ← 注释掉测试
}
```

### 测试单个模型

使用 Three.js 的官方 glTF viewer：
https://threejs.org/editor/

上传你的 .glb 文件检查是否正确。

---

## 💡 高级技巧

### 调整模型方向

如果模型面向错误方向，在 `_swapModel()` 中：
```javascript
this.body.rotation.x = Math.PI / 2;  // 旋转 90°
this.body.rotation.y = Math.PI;      // 旋转 180°
```

### 每个等级不同的标签颜色

编辑 `_drawLabel()` 方法：
```javascript
const labelColors = {
  'S': 'rgba(255,215,0,0.96)',    // 金色
  'A': 'rgba(192,192,192,0.96)',  // 银色
  // ...
};
g.fillStyle = labelColors[letter] || 'rgba(255,255,255,0.96)';
```

---

## 📱 测试清单

```
□ 桌面浏览器 (Chrome/Firefox/Safari)
□ 移动浏览器 (iPhone Safari, Android Chrome)
□ 不同网络速度 (快速/3G)
□ 各种屏幕尺寸 (手机/平板/桌面)
□ 所有 6 个评级 (S, A, B, C, D, F)
```

---

## 🚀 部署前确认

```
□ 所有 6 个 .glb 文件已上传到服务器
□ 文件路径正确 (相对于 app/)
□ GLTFLoader 脚本在 HTML 中
□ 在生产环境中测试至少一个完整测试
□ 文件大小 < 2.5 MB
□ 移动设备上测试
□ 浏览器控制台无错误
```

---

## 📚 完整文档

更多详细信息，请查看：
📖 **`MEDALS_SETUP.md`** - 完整的建模和集成指南

---

## ❓ 常见问题

**Q: 我可以不用模型吗？**
A: 可以！如果没有找到 .glb 文件，它会自动回退到程序生成的奖牌。

**Q: 我可以混合使用自定义模型和程序生成的奖牌吗？**
A: 可以！只上传你想自定义的等级的模型，其他的会使用程序生成版本。

**Q: 模型加载失败会发生什么？**
A: 浏览器控制台会显示警告，然后显示程序生成的默认奖牌。不会中断应用。

**Q: 文件太大怎么办？**
A: 使用 Draco 压缩（Blender 导出选项中启用），或简化网格（面数减少 30-50%）。

**Q: 需要专业建模技能吗？**
A: 不需要！简单的几何体（立方体、圆锥体等）就能看起来很好。从基础开始，逐步改进。

---

## 🎨 设计灵感

需要设计灵感？查看：
- Sketchfab: https://sketchfab.com (搜索 "medal")
- Poly Haven: https://polyhaven.com
- Pinterest: 搜索 "3D medal design"

---

## ✅ 成功标志

你会知道一切正常工作，当：
1. ✅ 完成速度测试
2. ✅ 看到结果屏幕
3. ✅ 奖牌显示并可以旋转
4. ✅ 标签（S/A/B/C 等）正确显示
5. ✅ 浏览器控制台显示成功加载日志

---

**就这样！你现在拥有一个支持多款式 3D 奖牌的速度测试应用。** 🎖️✨

有问题？检查 `MEDALS_SETUP.md` 获取深入指导。