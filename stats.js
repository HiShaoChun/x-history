// stats.js - 数据统计可视化
(async function() {
  'use strict';

  const db = new TweetDatabase();
  await db.init();

  // Tab 切换
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      // 切换按钮状态
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 切换内容
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
  });

  // Tooltip
  const tooltip = document.getElementById('tooltip');

  function showTooltip(x, y, content) {
    tooltip.innerHTML = content;
    tooltip.style.left = x + 10 + 'px';
    tooltip.style.top = y + 10 + 'px';
    tooltip.classList.add('show');
  }

  function hideTooltip() {
    tooltip.classList.remove('show');
  }

  // ==================== 1. 24小时活跃雷达图 ====================
  async function renderRadarChart() {
    const tweets = await db.getAllTweets();

    if (tweets.length === 0) {
      return;
    }

    // 统计每小时的浏览量
    const hourlyCount = new Array(24).fill(0);
    tweets.forEach(tweet => {
      const hour = new Date(tweet.firstSeenAt).getHours();
      hourlyCount[hour]++;
    });

    const ctx = document.getElementById('radarChart');

    new Chart(ctx, {
      type: 'radar',
      data: {
        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
        datasets: [{
          label: '浏览量',
          data: hourlyCount,
          backgroundColor: 'rgba(200, 133, 63, 0.2)',
          borderColor: '#C8853F',
          borderWidth: 2,
          pointBackgroundColor: '#C8853F',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#C8853F',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            ticks: {
              stepSize: Math.ceil(Math.max(...hourlyCount) / 5),
              backdropColor: 'transparent',
              color: '#8A8A80',
              font: {
                size: 11
              }
            },
            grid: {
              color: '#E2D9C8'
            },
            pointLabels: {
              color: '#1F2421',
              font: {
                size: 11,
                weight: '600'
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#2A2723',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 13,
              weight: '600'
            },
            bodyFont: {
              size: 12
            }
          }
        }
      }
    });
  }

  // ==================== 2. 作者依赖气泡图 ====================
  async function renderBubbleChart() {
    const tweets = await db.getAllTweets();

    if (tweets.length === 0) {
      return;
    }

    // 按作者统计
    const authorStats = {};
    tweets.forEach(tweet => {
      const author = tweet.author || '未知';
      if (!authorStats[author]) {
        authorStats[author] = {
          count: 0,
          totalDwell: 0,
          opened: 0
        };
      }
      authorStats[author].count++;
      authorStats[author].totalDwell += tweet.dwellMs || 0;
      if (tweet.opened) authorStats[author].opened++;
    });

    // 转换为气泡数据（只取浏览量前20的作者）
    const bubbleData = Object.entries(authorStats)
      .map(([author, stats]) => {
        const openRate = stats.count > 0 ? (stats.opened / stats.count) * 100 : 0;
        const avgDwell = stats.count > 0 ? stats.totalDwell / stats.count : 0;

        return {
          x: openRate, // 横轴：点开率
          y: avgDwell / 1000, // 纵轴：平均停留时间（秒）
          r: Math.sqrt(stats.count) * 3, // 气泡大小：浏览量
          author: author,
          count: stats.count,
          avgDwell: avgDwell
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const ctx = document.getElementById('bubbleChart');

    new Chart(ctx, {
      type: 'bubble',
      data: {
        datasets: [{
          label: '作者',
          data: bubbleData,
          backgroundColor: bubbleData.map((_, i) => {
            // 渐变色：从浅到深
            const opacity = 0.3 + (i / bubbleData.length) * 0.5;
            return `rgba(200, 133, 63, ${opacity})`;
          }),
          borderColor: '#C8853F',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.8,
        scales: {
          x: {
            title: {
              display: true,
              text: '点开率 (%)',
              color: '#1F2421',
              font: {
                size: 13,
                weight: '600'
              }
            },
            ticks: {
              color: '#8A8A80',
              font: {
                size: 11
              }
            },
            grid: {
              color: '#E2D9C8'
            }
          },
          y: {
            title: {
              display: true,
              text: '平均停留时间 (秒)',
              color: '#1F2421',
              font: {
                size: 13,
                weight: '600'
              }
            },
            ticks: {
              color: '#8A8A80',
              font: {
                size: 11
              }
            },
            grid: {
              color: '#E2D9C8'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#2A2723',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 13,
              weight: '600'
            },
            bodyFont: {
              size: 12
            },
            callbacks: {
              title: function(context) {
                return context[0].raw.author;
              },
              label: function(context) {
                const data = context.raw;
                return [
                  `浏览量: ${data.count} 条`,
                  `点开率: ${data.x.toFixed(1)}%`,
                  `平均停留: ${data.y.toFixed(1)} 秒`
                ];
              }
            }
          }
        }
      }
    });
  }

  // ==================== 3. 上瘾时刻分析 ====================
  async function renderAddictionAnalysis() {
    const tweets = await db.getAllTweets();

    if (tweets.length === 0) {
      document.getElementById('addictionStats').innerHTML = '<div class="empty-state">暂无数据</div>';
      return;
    }

    // 按时间排序
    const sorted = tweets.sort((a, b) => a.firstSeenAt - b.firstSeenAt);

    // 检测"上瘾时刻"：15分钟内浏览≥10条
    const addictionMoments = [];
    const timeWindow = 15 * 60 * 1000; // 15分钟
    const threshold = 10; // 10条

    for (let i = 0; i < sorted.length; i++) {
      const startTime = sorted[i].firstSeenAt;
      const endTime = startTime + timeWindow;

      let count = 0;
      const batch = [];

      for (let j = i; j < sorted.length && sorted[j].firstSeenAt < endTime; j++) {
        count++;
        batch.push(sorted[j]);
      }

      if (count >= threshold) {
        addictionMoments.push({
          startTime,
          endTime,
          count,
          tweets: batch
        });
        i += count - 1; // 跳过已统计的推文
      }
    }

    // 统计数据
    const totalAddictionCount = addictionMoments.length;
    const totalAddictionTime = addictionMoments.reduce((sum, m) => sum + (m.endTime - m.startTime), 0);
    const maxBurst = addictionMoments.reduce((max, m) => Math.max(max, m.count), 0);

    // 渲染统计卡片
    document.getElementById('addictionStats').innerHTML = `
      <div class="stat-box">
        <span class="stat-value">${totalAddictionCount}</span>
        <span class="stat-label">上瘾时刻总次数</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">${Math.round(totalAddictionTime / 60000)}</span>
        <span class="stat-label">上瘾总时长（分钟）</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">${maxBurst}</span>
        <span class="stat-label">单次最高浏览量</span>
      </div>
    `;

    // 按天分组
    const dailyData = {};
    sorted.forEach(tweet => {
      const date = new Date(tweet.firstSeenAt);
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().split('T')[0];

      if (!dailyData[key]) {
        dailyData[key] = [];
      }
      dailyData[key].push(tweet);
    });

    // 渲染时间轴（最近7天）
    const timeline = document.getElementById('addictionTimeline');
    const recentDays = Object.keys(dailyData)
      .sort()
      .reverse()
      .slice(0, 7);

    timeline.innerHTML = '';

    recentDays.forEach(dateKey => {
      const dayTweets = dailyData[dateKey];
      const date = new Date(dateKey);
      const dateStr = date.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
      });

      // 生成24小时条形图
      const hourlyBars = [];
      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date(date);
        hourStart.setHours(hour, 0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hour + 1);

        const hourTweets = dayTweets.filter(t => {
          const time = new Date(t.firstSeenAt);
          return time >= hourStart && time < hourEnd;
        });

        let level = 'idle';
        if (hourTweets.length > 0) {
          if (hourTweets.length >= 10) level = 'addicted';
          else if (hourTweets.length >= 5) level = 'active';
          else level = 'normal';
        }

        hourlyBars.push({
          hour,
          count: hourTweets.length,
          level
        });
      }

      const dayDiv = document.createElement('div');
      dayDiv.className = 'timeline-day';
      dayDiv.innerHTML = `
        <div class="timeline-date">${dateStr} · ${dayTweets.length} 条</div>
        <div class="timeline-bars"></div>
      `;

      const barsContainer = dayDiv.querySelector('.timeline-bars');
      hourlyBars.forEach(bar => {
        const barEl = document.createElement('div');
        barEl.className = `timeline-bar ${bar.level}`;
        barEl.dataset.hour = bar.hour;
        barEl.dataset.count = bar.count;

        barEl.addEventListener('mouseenter', (e) => {
          showTooltip(
            e.pageX,
            e.pageY,
            `${bar.hour}:00 - ${bar.hour + 1}:00<br/>${bar.count} 条推文`
          );
        });

        barEl.addEventListener('mouseleave', hideTooltip);

        barsContainer.appendChild(barEl);
      });

      timeline.appendChild(dayDiv);
    });
  }

  // ==================== 初始化 ====================
  await renderRadarChart();
  await renderBubbleChart();
  await renderAddictionAnalysis();

})();
