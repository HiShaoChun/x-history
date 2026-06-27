// viewer.js - 查看页面逻辑
(async function() {
  'use strict';

  const db = new TweetDatabase();
  await db.init();

  const contentEl = document.getElementById('content');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  // 格式化时间
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // 格式化日期
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[date.getDay()];
    return `${year}-${month}-${day} 周${weekday}`;
  }

  // 按天和小时分组
  function groupTweets(tweets) {
    const groups = {};

    tweets.forEach(tweet => {
      const date = new Date(tweet.firstSeenAt);
      const dayKey = formatDate(tweet.firstSeenAt);
      const hour = date.getHours();

      if (!groups[dayKey]) {
        groups[dayKey] = {};
      }

      if (!groups[dayKey][hour]) {
        groups[dayKey][hour] = [];
      }

      groups[dayKey][hour].push(tweet);
    });

    return groups;
  }

  // 渲染推文列表
  function renderTweets(tweets) {
    if (tweets.length === 0) {
      contentEl.innerHTML = '<div class="empty-state">暂无浏览记录</div>';
      return;
    }

    const groups = groupTweets(tweets);
    let html = '';

    // 按日期降序排序
    const sortedDays = Object.keys(groups).sort().reverse();

    sortedDays.forEach(dayKey => {
      html += `<div class="day-section">`;
      html += `<div class="day-header">${dayKey}</div>`;

      const hours = groups[dayKey];
      // 按小时降序排序
      const sortedHours = Object.keys(hours).sort((a, b) => b - a);

      sortedHours.forEach(hour => {
        const hourTweets = hours[hour];
        // 按时间升序排序
        hourTweets.sort((a, b) => a.firstSeenAt - b.firstSeenAt);

        html += `<div class="hour-block">`;
        html += `<div class="hour-header">${String(hour).padStart(2, '0')}:00 · ${hourTweets.length} 条</div>`;

        hourTweets.forEach(tweet => {
          const dwellSeconds = Math.round(tweet.dwellMs / 1000);
          html += `
            <div class="tweet-item">
              <div class="tweet-meta">
                <span class="tweet-time">${formatTime(tweet.firstSeenAt)}</span>
                <span class="tweet-author">${tweet.author || '未知'}</span>
                ${tweet.opened ? '<span class="tweet-opened">↗已点开</span>' : ''}
                <span>停留 ${dwellSeconds}s</span>
              </div>
              <div class="tweet-text">${tweet.text || '(无文本)'}</div>
              <a href="${tweet.url}" target="_blank" class="tweet-link">查看原推</a>
            </div>
          `;
        });

        html += `</div>`; // hour-block
      });

      html += `</div>`; // day-section
    });

    contentEl.innerHTML = html;
  }

  // 加载数据
  async function loadData() {
    try {
      contentEl.innerHTML = '<div class="loading">加载中...</div>';
      const tweets = await db.getAllTweets();
      renderTweets(tweets);
    } catch (error) {
      console.error('加载失败:', error);
      contentEl.innerHTML = '<div class="empty-state">加载失败</div>';
    }
  }

  // 清除所有数据
  async function clearAllData() {
    if (!confirm('确定要清除所有浏览记录吗？此操作不可恢复！')) {
      return;
    }

    try {
      await db.clearAll();
      alert('已清除所有数据');
      loadData();
    } catch (error) {
      console.error('清除失败:', error);
      alert('清除失败: ' + error.message);
    }
  }

  // 事件监听
  const statsBtn = document.getElementById('statsBtn');
  statsBtn.addEventListener('click', () => {
    window.open('stats.html', '_blank');
  });

  refreshBtn.addEventListener('click', loadData);
  clearAllBtn.addEventListener('click', clearAllData);

  // 初始加载
  loadData();

})();