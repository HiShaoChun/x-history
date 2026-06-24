# 🐛 Bug 修复：过滤评论回复

## 问题描述
扩展会将推文详情页下方的评论回复也记录为独立推文。

## 修复内容
更新了 `content.js` 中的 `findTweetElements()` 函数，添加了以下过滤逻辑：

1. **过滤对话时间线中的回复**
   - 检查父级元素是否包含 `Timeline: Conversation` 标识

2. **在详情页只记录主推文**
   - 检测当前 URL 是否为详情页（包含 `/status/`）
   - 提取 URL 中的推文 ID
   - 只保留与 URL ID 匹配的主推文，过滤掉下方的回复

## 如何应用修复

### 步骤 1：重新加载扩展
1. 打开 `chrome://extensions/`
2. 找到 "X History Recorder"
3. 点击 🔄 **刷新** 按钮（或点击"重新加载"）

### 步骤 2：清除旧数据（可选）
如果已经记录了很多评论数据，建议清除：

**方法 A：使用扩展功能**
1. 点击扩展图标
2. 点击"查看完整历史"
3. 点击"清除所有数据"按钮

**方法 B：使用开发者工具**
1. 访问 x.com
2. 按 F12 → Application → IndexedDB → XHistoryDB
3. 右键 XHistoryDB → Delete database

### 步骤 3：测试修复
1. 访问 https://x.com
2. **测试场景 1：时间线浏览**
   - 在时间线上滚动
   - 每条推文停留 2-3 秒
   - ✅ 应该正常记录

3. **测试场景 2：详情页**
   - 点击进入某条推文的详情页
   - 向下滚动查看回复评论
   - ✅ 只应该记录主推文（标记为"已点开"）
   - ✅ 下方的回复评论不应该被记录

### 步骤 4：验证
使用 [debug-check.html](debug-check.html) 或开发者工具检查：
- 记录的推文应该都是你主动浏览的
- 不应该包含你没有特别关注的回复评论

## 技术细节

### 修改前
```javascript
function findTweetElements() {
  return document.querySelectorAll('article[data-testid="tweet"]');
}
```

### 修改后
```javascript
function findTweetElements() {
  const allTweets = document.querySelectorAll('article[data-testid="tweet"]');
  
  const filteredTweets = Array.from(allTweets).filter(element => {
    // 过滤回复区域
    const isReply = element.closest('[aria-label*="Timeline: Conversation"]');
    if (isReply) return false;
    
    // 在详情页只保留主推文
    const currentUrl = window.location.pathname;
    if (currentUrl.includes('/status/')) {
      const tweetId = extractTweetId(element);
      const urlMatch = currentUrl.match(/\/status\/(\d+)/);
      const mainTweetId = urlMatch ? urlMatch[1] : null;
      
      if (tweetId !== mainTweetId) return false;
    }
    
    return true;
  });
  
  return filteredTweets;
}
```

## 注意事项

1. **引用转发（Quote Tweet）**
   - 引用转发中的被引用推文不会被记录
   - 只记录你实际浏览的引用转发本身

2. **转发（Retweet）**
   - 时间线上的转发会正常记录
   - 记录的是转发后的推文

3. **线程（Thread）**
   - 一个线程的多条推文会被分别记录
   - 每条都算独立的推文

## 如果还有问题

如果修复后仍然有问题，请检查：
1. 扩展是否已重新加载
2. x.com 页面是否已刷新
3. Console 是否有错误信息

可以在 Console 中运行以下代码查看当前识别到多少推文：
```javascript
document.querySelectorAll('article[data-testid="tweet"]').length
```

---

**修复版本：** 1.0.1  
**修复日期：** 2026-06-23