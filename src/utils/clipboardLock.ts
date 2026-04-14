/**
 * 剪贴板处理锁机制
 * 防止并发处理相同内容导致重复
 */

// 正在处理的内容哈希集合
const processingHashes = new Set<string>();

// 最近处理的内容哈希（带时间戳，用于清理）
interface ProcessedItem {
  hash: string;
  timestamp: number;
}
const recentlyProcessed: ProcessedItem[] = [];
const MAX_RECENT_SIZE = 50;
const CLEANUP_INTERVAL = 60000; // 60秒清理一次

/**
 * 生成内容哈希
 */
export const generateContentHash = (
  type: string,
  value: string | string[],
): string => {
  const valueStr = Array.isArray(value) ? JSON.stringify(value) : value;
  return `${type}:${valueStr}`;
};

/**
 * 尝试获取处理锁
 * @returns 是否成功获取锁
 */
export const tryAcquireLock = (hash: string): boolean => {
  // 检查是否正在处理
  if (processingHashes.has(hash)) {
    return false;
  }

  // 检查最近是否处理过（5秒内）
  const now = Date.now();
  const fiveSecondsAgo = now - 5000;
  const wasRecentlyProcessed = recentlyProcessed.some(
    (item) => item.hash === hash && item.timestamp > fiveSecondsAgo,
  );

  if (wasRecentlyProcessed) {
    return false;
  }

  // 获取锁
  processingHashes.add(hash);
  return true;
};

/**
 * 释放处理锁
 */
export const releaseLock = (hash: string): void => {
  processingHashes.delete(hash);

  // 记录到最近处理列表
  recentlyProcessed.push({
    hash,
    timestamp: Date.now(),
  });

  // 限制列表大小
  if (recentlyProcessed.length > MAX_RECENT_SIZE) {
    recentlyProcessed.shift();
  }
};

/**
 * 检查是否正在处理
 */
export const isProcessing = (hash: string): boolean => {
  return processingHashes.has(hash);
};

/**
 * 定期清理过期的最近处理记录
 */
const cleanup = () => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  const index = recentlyProcessed.findIndex(
    (item) => item.timestamp > fiveMinutesAgo,
  );

  if (index > 0) {
    recentlyProcessed.splice(0, index);
  }
};

// 启动清理定时器
setInterval(cleanup, CLEANUP_INTERVAL);
