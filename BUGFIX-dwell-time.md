# 🐛 Bug 修复：停留时间计算错误

## 版本 1.0.2 (2026-06-23)

### 问题描述

用户报告了两个相关的停留时间计算 bug：

1. **每条推文都显示"停留 2s"**
   - 所有推文的停留时间都被锁定在阈值（1.5秒≈2秒）
   - 即使长时间停留也不会增加

2. **总停留时间严重偏小**
   - 48条记录只显示 1 分钟总停留时间
   - 计算：48 × 1.5s ≈ 72s ≈ 1 分钟
   - 与实际浏览时间不符

### 根本原因

原代码逻辑缺陷：

```javascript
// ❌ 错误的逻辑
if (tracked.totalDwell >= CONFIG.DWELL_THRESHOLD && !tracked.saved) {
  saveTweetRecord(tracked);
  tracked.saved = true;  // 设置标记后就不再更新了！
}
```

**问题：**
1. 达到 1.5 秒阈值后保存一次
2. 设置 `saved = true` 
3. **之后即使继续观看，也不会再更新数据库**
4. 停留时间永远停留在第一次保存时的 1.5 秒

### 修复方案

#### 修复 1：持续更新机制

```javascript
// ✅ 正确的逻辑
if (tracked.totalDwell >= CONFIG.DWELL_THRESHOLD) {
  const timeSinceLastSave = now - (tracked.lastSaveTime || 0);

  // 首次保存或距离上次保存超过5秒，则更新数据库
  if (!tracked.saved || timeSinceLastSave >= 5000) {
    saveTweetRecord(tracked);
    tracked.saved = true;
    tracked.lastSaveTime = now;  // 记录保存时间
  }
}
```

**改进：**
- 首次达到 1.5 秒阈值时保存
- 之后每 5 秒更新一次数据库
- 持续累加停留时间

#### 修复 2：离开视口时最后保存

```javascript
// 推文离开视口时
if (!currentlyVisible.has(tweetId)) {
  // 如果达到阈值，做最后一次保存
  if (tracked.totalDwell >= CONFIG.DWELL_THRESHOLD && tracked.saved) {
    saveTweetRecord(tracked);
  }
  // 重置计时状态
  tracked.startTime = null;
  tracked.lastUpdate = now;
}
```

**改进：**
- 推文滚出视口时，做最后一次保存
- 确保所有累计时间都被记录

### 预期效果

#### 修复前
- 推文 A 停留 10 秒 → 记录 2s ❌
- 推文 B 停留 5 秒 → 记录 2s ❌
- 推文 C 停留 20 秒 → 记录 2s ❌
- **总计：6s** ❌

#### 修复后
- 推文 A 停留 10 秒 → 记录 10s ✅
- 推文 B 停留 5 秒 → 记录 5s ✅
- 推文 C 停留 20 秒 → 记录 20s ✅
- **总计：35s** ✅

### 更新步骤

#### 1️⃣ 重新加载扩展
```
1. 打开 chrome://extensions/
2. 找到 "X History Recorder"
3. 点击 🔄 刷新按钮
```

#### 2️⃣ 清除旧数据（强烈建议）

由于旧数据的停留时间都是错误的（都是 ~1.5s），建议清除后重新记录：

**方法 A：使用扩展功能**
```
1. 点击扩展图标
2. 点击"查看完整历史"
3. 点击"清除所有数据"
```

**方法 B：开发者工具**
```
1. 访问 x.com
2. F12 → Application → IndexedDB
3. 右键 XHistoryDB → Delete database
```

#### 3️⃣ 测试修复

1. **刷新 x.com 页面**（F5）
2. **测试长时间停留**：
   - 在某条推文上停留 10 秒
   - 然后滚动离开
   - 点击扩展图标查看
   - 应该显示"停留 10s"左右 ✅

3. **测试多次浏览**：
   - 浏览 5 条推文，每条停留 5-10 秒
   - 查看总停留时间
   - 应该是 25-50 秒，而不是 ~7 秒 ✅

### 技术细节

#### 更新频率控制

为什么选择 5 秒更新一次？

- **太频繁（如每次都更新）**：
  - 每 100ms 写一次数据库
  - 性能影响大
  - 不必要

- **太少（如只保存一次）**：
  - 停留时间不准确
  - 就是当前的 bug

- **5 秒间隔**：
  - 平衡性能和准确性
  - 即使浏览器崩溃，最多丢失 5 秒数据
  - 对数据库压力小

#### 数据库去重逻辑

由于使用 `db.saveTweet()` 的去重机制：

```javascript
if (existing) {
  record = {
    ...existing,
    lastSeenAt: tweetData.lastSeenAt,
    dwellMs: existing.dwellMs + tweetData.dwellMs,  // 累加
    viewCount: existing.viewCount + 1,
    opened: existing.opened || tweetData.opened
  };
}
```

每次调用 `saveTweetRecord()` 都会：
- 更新 `lastSeenAt`
- **累加** `dwellMs`（而不是覆盖）
- 增加 `viewCount`

### 验证清单

修复后请验证：

- [ ] 浏览一条推文停留 10 秒，记录应该显示 ~10s
- [ ] 浏览多条推文，总停留时间应该合理
- [ ] 不应该所有推文都是 2s
- [ ] 弹窗中的"总停留时间"应该准确反映真实浏览时间

### 已知限制

1. **5 秒更新间隔**
   - 推文滚出视口前如果<5秒，可能略有误差
   - 但离开视口时会做最后保存，误差很小

2. **浏览器崩溃**
   - 如果浏览器突然关闭
   - 最后一次保存到崩溃之间的时间（<5秒）可能丢失

3. **快速滚动**
   - 如果极快滚动（每条<1.5秒）
   - 不会记录（这是预期行为）

---

**修复版本：** 1.0.2  
**修复日期：** 2026-06-23  
**修复内容：** 停留时间持续累加 + 离开视口时最终保存