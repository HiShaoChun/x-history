// background.js - Service Worker
importScripts('db.js');

let db = null;

// 初始化数据库
async function initDatabase() {
  if (!db) {
    db = new TweetDatabase();
    await db.init();
    console.log('[X History] Database initialized');
  }
  return db;
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // 保持消息通道打开
});

async function handleMessage(message, sender) {
  await initDatabase();

  switch (message.type) {
    case 'SAVE_TWEET':
      return await saveTweet(message.data);

    case 'MARK_OPENED':
      return await markAsOpened(message.tweetId);

    case 'GET_TWEETS_BY_DATE':
      return await getTweetsByDate(message.startDate, message.endDate);

    case 'GET_ALL_TWEETS':
      return await db.getAllTweets();

    case 'CLEAR_BY_DATE':
      return await db.clearByDateRange(message.startDate, message.endDate);

    case 'CLEAR_ALL':
      await db.clearAll();
      return { success: true };

    default:
      return { error: 'Unknown message type' };
  }
}

async function saveTweet(tweetData) {
  try {
    const result = await db.saveTweet(tweetData);
    return { success: true, data: result };
  } catch (error) {
    console.error('[X History] Save failed:', error);
    return { success: false, error: error.message };
  }
}

async function markAsOpened(tweetId) {
  try {
    // 获取现有记录
    const tx = db.db.transaction(['tweets'], 'readwrite');
    const store = tx.objectStore('tweets');
    const existing = await new Promise((resolve) => {
      const req = store.get(tweetId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (existing) {
      existing.opened = true;
      await new Promise((resolve, reject) => {
        const putReq = store.put(existing);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[X History] Mark opened failed:', error);
    return { success: false, error: error.message };
  }
}

async function getTweetsByDate(startDate, endDate) {
  try {
    const tweets = await db.getTweetsByDateRange(startDate, endDate);
    return { success: true, data: tweets };
  } catch (error) {
    console.error('[X History] Get tweets failed:', error);
    return { success: false, error: error.message };
  }
}

// 扩展安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[X History] Extension installed');
  await initDatabase();
});