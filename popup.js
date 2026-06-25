// popup.js - 弹窗逻辑
(async function() {
  'use strict';

  const statsEl = document.getElementById('stats');
  const recentListEl = document.getElementById('recentList');
  const viewHistoryBtn = document.getElementById('viewHistoryBtn');

  // 格式化时间
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    // 超过7天显示具体日期
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  }

  // 获取统计信息和推文列表
  async function loadData() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ALL_TWEETS'
      });

      if (response.success === false || !response) {
        statsEl.innerHTML = '<div class="loading">加载中...</div>';
        recentListEl.innerHTML = '<div class="empty">暂无数据</div>';
        return;
      }

      const tweets = response;

      // 显示统计信息
      displayStats(tweets);

      // 显示最近推文列表
      displayRecentTweets(tweets);

    } catch (error) {
      console.error('加载失败:', error);
      statsEl.innerHTML = '<div class="stat-item"><span class="stat-label">加载失败</span></div>';
      recentListEl.innerHTML = '<div class="empty">加载失败</div>';
    }
  }

  // 显示统计信息
  function displayStats(tweets) {
    const totalCount = tweets.length;
    const openedCount = tweets.filter(t => t.opened).length;
    const totalDwellMs = tweets.reduce((sum, t) => sum + (t.dwellMs || 0), 0);
    const totalMinutes = Math.round(totalDwellMs / 60000);

    statsEl.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">总记录数</span>
        <span class="stat-value">${totalCount}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已点开</span>
        <span class="stat-value">${openedCount}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">总停留时间</span>
        <span class="stat-value">${totalMinutes} 分钟</span>
      </div>
    `;
  }

  // 显示最近推文列表（按时间倒序）
  function displayRecentTweets(tweets) {
    if (tweets.length === 0) {
      recentListEl.innerHTML = '<div class="empty">暂无浏览记录</div>';
      return;
    }

    // 按 lastSeenAt 降序排序，取最近 4 条
    const recent = tweets
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, 4);

    let html = '';
    recent.forEach(tweet => {
      const dwellSec = Math.round(tweet.dwellMs / 1000);
      const timeStr = formatTime(tweet.lastSeenAt);
      const author = tweet.author || '未知';
      const text = tweet.text || '(无文本)';

      html += `
        <div class="tweet-item" onclick="window.open('${tweet.url}', '_blank')">
          <div class="tweet-header">
            <span class="tweet-time">${timeStr}</span>
            <span class="tweet-author">${author}</span>
            ${tweet.opened ? '<span class="tweet-opened">↗已点开</span>' : ''}
            <span class="tweet-dwell">停留 ${dwellSec}s</span>
          </div>
          <div class="tweet-text">${text}</div>
        </div>
      `;
    });

    recentListEl.innerHTML = html;
  }

  // 打开完整历史页面
  viewHistoryBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('viewer.html')
    });
  });

  // 初始加载
  loadData();

})();