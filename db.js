// IndexedDB 封装层
class TweetDatabase {
  constructor() {
    this.dbName = 'XHistoryDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('tweets')) {
          const store = db.createObjectStore('tweets', { keyPath: 'tweetId' });
          store.createIndex('firstSeenAt', 'firstSeenAt', { unique: false });
          store.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
          store.createIndex('author', 'author', { unique: false });
        }
      };
    });
  }

  async saveTweet(tweetData) {
    const tx = this.db.transaction(['tweets'], 'readwrite');
    const store = tx.objectStore('tweets');

    // 尝试获取已有记录
    const existing = await new Promise((resolve) => {
      const req = store.get(tweetData.tweetId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    let record;
    if (existing) {
      // 更新已有记录：dwellMs 为增量累加，viewCount 仅在新浏览时 +1
      // 防御：单次增量上限 60 秒，过大视为异常数据丢弃
      let delta = tweetData.dwellMs || 0;
      if (delta < 0 || delta > 60000) delta = 0;

      record = {
        ...existing,
        lastSeenAt: tweetData.lastSeenAt,
        dwellMs: existing.dwellMs + delta,
        viewCount: existing.viewCount + (tweetData.isNewView ? 1 : 0),
        opened: existing.opened || tweetData.opened
      };
    } else {
      // 新记录：首次 dwellMs 同样做上限保护
      let initialDwell = tweetData.dwellMs || 0;
      if (initialDwell < 0 || initialDwell > 60000) initialDwell = 0;

      record = {
        tweetId: tweetData.tweetId,
        author: tweetData.author,
        text: tweetData.text,
        url: tweetData.url,
        firstSeenAt: tweetData.firstSeenAt || Date.now(),
        lastSeenAt: tweetData.lastSeenAt || Date.now(),
        dwellMs: initialDwell,
        viewCount: 1,
        opened: tweetData.opened || false
      };
    }

    return new Promise((resolve, reject) => {
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = () => reject(putReq.error);
    });
  }

  async getTweetsByDateRange(startDate, endDate) {
    const tx = this.db.transaction(['tweets'], 'readonly');
    const store = tx.objectStore('tweets');
    const index = store.index('firstSeenAt');

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTweets() {
    const tx = this.db.transaction(['tweets'], 'readonly');
    const store = tx.objectStore('tweets');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearByDateRange(startDate, endDate) {
    const tweets = await this.getTweetsByDateRange(startDate, endDate);
    const tx = this.db.transaction(['tweets'], 'readwrite');
    const store = tx.objectStore('tweets');

    for (const tweet of tweets) {
      store.delete(tweet.tweetId);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(tweets.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll() {
    const tx = this.db.transaction(['tweets'], 'readwrite');
    const store = tx.objectStore('tweets');

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// 导出为全局可用
if (typeof window !== 'undefined') {
  window.TweetDatabase = TweetDatabase;
}
