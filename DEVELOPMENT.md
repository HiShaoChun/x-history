# 开发和维护指南

## 项目架构

```
┌─────────────────┐
│   x.com 页面    │
└────────┬────────┘
         │
         │ DOM 观察
         ↓
┌─────────────────┐      消息传递      ┌──────────────────┐
│  content.js     │ ─────────────────→ │  background.js   │
│  (内容脚本)      │                    │  (服务 Worker)    │
└─────────────────┘                    └────────┬─────────┘
                                                │
                                                │ 数据存储
                                                ↓
                                       ┌──────────────────┐
                                       │   IndexedDB      │
                                       │   (db.js)        │
                                       └──────────────────┘
                                                ↑
                                                │ 数据读取
┌─────────────────┐                            │
│  popup.html/js  │ ───────────────────────────┘
│  (弹窗统计)      │
└─────────────────┘

┌─────────────────┐
│ viewer.html/js  │ ───────────────────────────┘
│  (完整历史)      │
└─────────────────┘
```

## 核心组件

### 1. content.js - 内容脚本

**职责：**
- 监听页面 DOM 变化
- 检测推文在视口内的停留时间
- 提取推文信息（ID、作者、正文）
- 检测详情页打开
- 监听页面焦点状态

**关键函数：**
- `findTweetElements()` - 查找所有推文元素
- `extractTweetId()` - 从 DOM 提取推文 ID
- `extractAuthor()` - 提取作者信息
- `extractText()` - 提取推文正文
- `isInViewport()` - 判断元素是否在视口内
- `processVisibleTweets()` - 主循环，每 100ms 执行一次
- `saveTweetRecord()` - 发送数据到 background

**状态管理：**
```javascript
state = {
  isPageFocused: boolean,          // 页面是否聚焦
  trackedTweets: Map<id, {         // 正在跟踪的推文
    tweetId, author, text, url,
    startTime, totalDwell,          // 计时相关
    lastUpdate, saved               // 状态标记
  }>
}
```

**DOM 选择器（需要维护）：**
- `article[data-testid="tweet"]` - 推文容器
- `a[href*="/status/"]` - 推文链接（提取 ID）
- `[data-testid="tweetText"]` - 推文正文
- `a[href^="/"][href*="@"]` - 作者链接

**如果 X.com 改版：**
1. 打开开发者工具检查新的 DOM 结构
2. 找到对应元素的新选择器
3. 更新上述函数中的选择器
4. 测试提取功能是否正常

### 2. background.js - 后台服务

**职责：**
- 初始化 IndexedDB
- 处理来自 content script 的消息
- 执行数据库操作

**消息类型：**
- `SAVE_TWEET` - 保存推文记录
- `MARK_OPENED` - 标记推文为已打开
- `GET_ALL_TWEETS` - 获取所有记录
- `GET_TWEETS_BY_DATE` - 按日期范围获取
- `CLEAR_BY_DATE` - 清除指定日期范围
- `CLEAR_ALL` - 清除所有数据

### 3. db.js - 数据库层

**Schema:**
```javascript
{
  tweetId: string (主键),
  author: string,
  text: string,
  url: string,
  firstSeenAt: timestamp,
  lastSeenAt: timestamp,
  dwellMs: number,
  viewCount: number,
  opened: boolean
}
```

**索引：**
- `firstSeenAt` - 用于按时间查询
- `lastSeenAt` - 用于按时间查询
- `author` - 预留，可用于按作者筛选

**关键方法：**
- `saveTweet()` - 保存或更新记录（含去重逻辑）
- `getTweetsByDateRange()` - 按时间范围查询
- `clearByDateRange()` - 按时间范围删除
- `clearAll()` - 清空所有数据

## 配置参数

### content.js 配置

```javascript
const CONFIG = {
  DWELL_THRESHOLD: 1500,           // 停留阈值（毫秒）
  VIEWPORT_CHECK_INTERVAL: 100,    // 检查间隔（毫秒）
  VISIBLE_RATIO: 0.5               // 可见比例阈值
};
```

**调整建议：**
- `DWELL_THRESHOLD`: 如果记录太多，增大阈值；如果太少，减小阈值
- `VIEWPORT_CHECK_INTERVAL`: 不建议低于 50ms（性能影响）
- `VISIBLE_RATIO`: 0.5 表示至少 50% 可见，可根据需求调整

## 常见维护场景

### 场景 1：X.com 改版导致抓取失效

**症状：**
- Console 显示找不到推文 ID
- 记录数量为 0

**解决步骤：**
1. 在 x.com 上打开开发者工具
2. 选择一条推文，右键 → 检查元素
3. 找到包含推文的最外层容器
4. 查看其属性，找到唯一标识（如 `data-testid`）
5. 更新 `content.js` 中的 `findTweetElements()` 选择器
6. 同样方法更新其他提取函数的选择器
7. 重新加载扩展并测试

### 场景 2：性能问题

**症状：**
- 页面卡顿
- CPU 占用高

**排查：**
1. 检查 `VIEWPORT_CHECK_INTERVAL` 是否太小
2. 检查 `state.trackedTweets` 大小（可能泄漏）
3. 添加清理逻辑，移除长时间未更新的跟踪项

**优化建议：**
```javascript
// 定期清理 trackedTweets
setInterval(() => {
  const now = Date.now();
  state.trackedTweets.forEach((tracked, id) => {
    // 移除 5 分钟未更新的项
    if (now - tracked.lastUpdate > 300000) {
      state.trackedTweets.delete(id);
    }
  });
}, 60000);  // 每分钟清理一次
```

### 场景 3：数据量过大

**症状：**
- 查看页面加载慢
- IndexedDB 占用空间大

**解决方案：**
1. 添加分页查询
2. 实现自动清理旧数据
3. 压缩存储的正文长度

**实现按月查询：**
```javascript
// 在 viewer.js 中
async function loadMonthData(year, month) {
  const startDate = new Date(year, month - 1, 1).getTime();
  const endDate = new Date(year, month, 1).getTime();
  // 使用 getTweetsByDateRange
}
```

### 场景 4：添加新功能

**示例：添加"按作者筛选"功能**

1. **db.js** - 已有 author 索引，无需修改

2. **background.js** - 添加新消息类型：
```javascript
case 'GET_TWEETS_BY_AUTHOR':
  return await getTweetsByAuthor(message.author);
```

3. **viewer.js** - 添加筛选 UI：
```javascript
// 添加作者下拉菜单
// 调用新接口获取数据
```

## 测试检查清单

- [ ] 在时间线上滚动，记录正常保存
- [ ] 停留时间准确（≥ 1.5 秒才记录）
- [ ] 失焦时暂停计时
- [ ] 点开详情页标记正确
- [ ] 同一推文去重正确
- [ ] 查看页面按天+小时分组正确
- [ ] 时间显示正确（时区）
- [ ] 清除数据功能正常
- [ ] 无内存泄漏（长时间运行）
- [ ] 无 console 错误

## 调试技巧

### 模拟失焦
```javascript
// 在 Console 中手动触发
document.dispatchEvent(new Event('visibilitychange'));
```

### 强制保存
```javascript
// 在 content.js 中添加测试代码
window.testSave = function(tweetId) {
  const tracked = state.trackedTweets.get(tweetId);
  if (tracked) saveTweetRecord(tracked);
};
```

### 查看内部状态
```javascript
// 在 Console 中
// 注意：需要修改 content.js 暴露 state
console.log(window.xHistoryState);
```

## 发布清单

- [ ] 更新版本号（manifest.json）
- [ ] 测试所有核心功能
- [ ] 检查 Console 无错误
- [ ] 更新 README.md
- [ ] 打包成 .zip（不含 .git 等无关文件）
- [ ] 提交到 Chrome Web Store（如需公开发布）

## 已知限制

1. **仅支持 Chrome**（Manifest V3）
2. **依赖 DOM 结构**（X.com 改版需要维护）
3. **无跨设备同步**
4. **无法记录广告推文**（DOM 结构可能不同）
5. **虚拟滚动场景**（节点复用可能导致误判）

## 未来改进方向

- [ ] 添加数据导出功能（JSON / CSV）
- [ ] 支持按作者、关键词筛选
- [ ] 数据统计可视化
- [ ] 自动清理策略（保留最近 N 天）
- [ ] 支持 Firefox（需要适配 Manifest V2）
- [ ] 云同步（需要后端服务）