// content.js - 核心记录逻辑
(function() {
  'use strict';

  // 防止内容脚本被重复注入导致计时翻倍
  if (window.__xHistoryLoaded) {
    return;
  }
  window.__xHistoryLoaded = true;

  // 配置
  const CONFIG = {
    DWELL_THRESHOLD: 1500,        // 1.5 秒，达到才记录
    VIEWPORT_CHECK_INTERVAL: 250, // 250ms 检查一次
    VISIBLE_RATIO: 0.5,           // 至少 50% 可见才算
    GAP_MAX_MS: 1500,             // 两次 tick 间隔超过此值视为暂停（休眠/节流/切窗），该段时间不计入
    SAVE_INTERVAL_MS: 5000        // 每 5 秒向数据库上报一次增量
  };

  // 状态管理
  const state = {
    isPageFocused: !document.hidden && document.hasFocus(),
    trackedTweets: new Map(), // tweetId -> tracking data
    lastActiveTick: 0,        // 上一次有效 tick 的时间戳，用于检测间隔
    db: null
  };

  // 初始化数据库
  async function initDB() {
    // 在 content script 中使用 chrome.storage 而非直接访问 IndexedDB
    // 实际存储通过消息传递给 background script
    return true;
  }

  // 提取推文 ID
  function extractTweetId(element) {
    // X.com 的推文结构：查找包含推文链接的元素
    const link = element.querySelector('a[href*="/status/"]');
    if (!link) return null;

    const match = link.href.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  // 提取作者
  function extractAuthor(element) {
    // 方法1: 查找作者链接 (多种模式)
    let authorLink = element.querySelector('a[href^="/"][role="link"]');

    // 方法2: 如果方法1失败，尝试查找包含用户名的链接
    if (!authorLink) {
      const links = element.querySelectorAll('a[href^="/"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        // 排除 /status/, /photo/, /i/ 等特殊路径
        if (href && !href.includes('/status/') && !href.includes('/photo/') &&
            !href.includes('/i/') && href.length > 2 && href.match(/^\/[^\/]+$/)) {
          authorLink = link;
          break;
        }
      }
    }

    if (authorLink) {
      const href = authorLink.getAttribute('href');
      const match = href.match(/^\/([^\/\?]+)/);
      if (match && match[1]) {
        return `@${match[1]}`;
      }
    }

    // 方法3: 尝试从 span 中提取 @username
    const spans = element.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent;
      if (text && text.startsWith('@') && text.length > 1 && !text.includes(' ')) {
        return text;
      }
    }

    return null;
  }

  // 提取推文文本
  function extractText(element) {
    // 查找推文正文
    const textElement = element.querySelector('[data-testid="tweetText"]');
    if (textElement) {
      return textElement.innerText.substring(0, 200); // 限制长度
    }
    return '';
  }

  // 构建推文 URL
  function buildTweetUrl(tweetId, author) {
    if (!tweetId || !author) return '';
    const username = author.replace('@', '');
    return `https://x.com/${username}/status/${tweetId}`;
  }

  // 检查元素是否在视口中
  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    const vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
    const horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);

    // 检查可见比例
    const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
    const visibleRatio = visibleHeight / rect.height;

    return vertInView && horInView && visibleRatio >= CONFIG.VISIBLE_RATIO;
  }

  // 查找所有推文元素
  function findTweetElements() {
    // X.com 使用 article 标签包裹每条推文
    const allTweets = document.querySelectorAll('article[data-testid="tweet"]');

    // 过滤掉回复评论，只保留时间线上的主推文
    const filteredTweets = Array.from(allTweets).filter(element => {
      // 检查是否在回复区域（reply section）
      // 回复通常在 [data-testid="cellInnerDiv"] 下，且父级有特定结构

      // 方法1: 检查是否有 "回复" 相关的父级标识
      const isReply = element.closest('[aria-label*="Timeline: Conversation"]');
      if (isReply) return false;

      // 方法2: 检查URL - 如果在详情页(/status/)，只记录主推文
      const currentUrl = window.location.pathname;
      if (currentUrl.includes('/status/')) {
        // 在详情页，检查这是不是主推文
        const tweetId = extractTweetId(element);
        const urlMatch = currentUrl.match(/\/status\/(\d+)/);
        const mainTweetId = urlMatch ? urlMatch[1] : null;

        // 只保留主推文，过滤掉下面的回复
        if (tweetId !== mainTweetId) return false;
      }

      return true;
    });

    return filteredTweets;
  }

  // 处理可见推文
  function processVisibleTweets() {
    if (!state.isPageFocused) {
      state.lastActiveTick = 0; // 失焦时清空，恢复后第一 tick 不累加
      return;
    }

    const now = Date.now();

    // 计算本 tick 应累加的时间：基于与上一次有效 tick 的真实间隔
    let tickDelta = 0;
    if (state.lastActiveTick > 0) {
      const gap = now - state.lastActiveTick;
      // 间隔正常（≈检查周期）才累加；过大说明休眠/节流/切窗，本段不计入
      if (gap > 0 && gap <= CONFIG.GAP_MAX_MS) {
        tickDelta = gap;
      }
    }
    state.lastActiveTick = now;

    const tweetElements = findTweetElements();
    const currentlyVisible = new Set();

    tweetElements.forEach(element => {
      const tweetId = extractTweetId(element);
      if (!tweetId) return;

      if (isInViewport(element)) {
        currentlyVisible.add(tweetId);

        if (!state.trackedTweets.has(tweetId)) {
          // 新推文首次进入视口
          const author = extractAuthor(element);
          const text = extractText(element);
          const url = buildTweetUrl(tweetId, author);

          state.trackedTweets.set(tweetId, {
            tweetId,
            author,
            text,
            url,
            firstSeenAt: now,
            totalDwell: 0,        // 本地累计停留（含未上报）
            savedDwell: 0,        // 已上报到数据库的停留
            inViewport: true,
            pendingNewView: true, // 等待首次达阈值时计一次 view
            lastSaveTime: 0
          });
        } else {
          const tracked = state.trackedTweets.get(tweetId);

          // 检测「重新进入视口」：算作新的一次浏览
          if (!tracked.inViewport) {
            tracked.inViewport = true;
            tracked.pendingNewView = true;
          }

          // 累加本 tick 的时间增量（已做暂停检测，安全）
          if (tracked.inViewport && tickDelta > 0) {
            tracked.totalDwell += tickDelta;
          }

          // 达到阈值后，首次保存或每 5 秒上报一次增量
          if (tracked.totalDwell >= CONFIG.DWELL_THRESHOLD) {
            const timeSinceLastSave = now - tracked.lastSaveTime;
            if (tracked.lastSaveTime === 0 || timeSinceLastSave >= CONFIG.SAVE_INTERVAL_MS) {
              saveTweetRecord(tracked);
              tracked.lastSaveTime = now;
            }
          }
        }
      }
    });

    // 处理离开视口的推文
    state.trackedTweets.forEach((tracked, tweetId) => {
      if (!currentlyVisible.has(tweetId) && tracked.inViewport) {
        // 推文刚离开视口：结算未上报的停留时间
        tracked.inViewport = false;
        if (tracked.totalDwell >= CONFIG.DWELL_THRESHOLD) {
          saveTweetRecord(tracked);
          tracked.lastSaveTime = Date.now();
        }
      }
    });
  }

  // 保存推文记录（发送增量，避免数据库重复累加）
  function saveTweetRecord(tracked) {
    // 计算自上次上报以来的增量停留时间
    const deltaDwell = tracked.totalDwell - tracked.savedDwell;
    if (deltaDwell <= 0 && !tracked.pendingNewView) return;

    const data = {
      tweetId: tracked.tweetId,
      author: tracked.author,
      text: tracked.text,
      url: tracked.url,
      firstSeenAt: tracked.firstSeenAt,
      lastSeenAt: Date.now(),
      dwellMs: deltaDwell > 0 ? deltaDwell : 0, // 仅上报增量
      isNewView: tracked.pendingNewView === true, // 是否计一次新浏览
      opened: false
    };

    // 标记已上报的停留时间和浏览计数
    tracked.savedDwell = tracked.totalDwell;
    tracked.pendingNewView = false;

    // 发送到 background script 保存
    chrome.runtime.sendMessage({
      type: 'SAVE_TWEET',
      data: data
    });
  }

  // 检测详情页打开
  function detectDetailPage() {
    const url = window.location.href;
    const match = url.match(/\/status\/(\d+)/);

    if (match) {
      const tweetId = match[1];
      // 标记为已打开
      chrome.runtime.sendMessage({
        type: 'MARK_OPENED',
        tweetId: tweetId
      });
    }
  }

  // 焦点恢复：清空 tick 锚点，恢复后的第一个 tick 不累加暂停期间的时间
  function handleFocusGained() {
    state.isPageFocused = true;
    state.lastActiveTick = 0;
  }

  function handleFocusLost() {
    // 失焦前先结算一次，把已累计但未上报的时间保存掉
    state.trackedTweets.forEach(tracked => {
      if (tracked.inViewport && tracked.totalDwell >= CONFIG.DWELL_THRESHOLD) {
        saveTweetRecord(tracked);
        tracked.lastSaveTime = Date.now();
      }
    });
    state.isPageFocused = false;
    state.lastActiveTick = 0;
  }

  // 监听标签页可见性变化
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      handleFocusLost();
    } else if (document.hasFocus()) {
      handleFocusGained();
    }
  });

  // 监听窗口焦点变化（切换到别的应用窗口时 visibilitychange 不触发）
  window.addEventListener('focus', handleFocusGained);
  window.addEventListener('blur', handleFocusLost);

  // 启动定时检查
  let checkInterval;
  function startTracking() {
    checkInterval = setInterval(processVisibleTweets, CONFIG.VIEWPORT_CHECK_INTERVAL);
  }

  function stopTracking() {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
  }

  // 初始化
  async function init() {
    console.log('[X History] Content script loaded');
    await initDB();
    detectDetailPage();
    startTracking();

    // 监听 URL 变化（SPA 应用）
    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        detectDetailPage();
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 清理
  window.addEventListener('beforeunload', () => {
    stopTracking();
  });

})();
