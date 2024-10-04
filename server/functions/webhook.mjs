import { CacheClient, CacheSortedSetFetchResponse, CollectionTtl, TopicClient } from '@gomomento/sdk';
const cacheClient = new CacheClient({ defaultTtlSeconds: 10 });
const topicClient = new TopicClient({});

let lastViewerCountTime = 0;

export const handler = async (event) => {
  const messageWrapper = JSON.parse(event.body);
  const { playerId, action, bitrate, playTime, agent } = JSON.parse(messageWrapper.text);
  if (!playerId) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Missing playerId' }),
    };
  }

  const now = Date.now();
  await cacheClient.sortedSetPutElement(process.env.CACHE_NAME, 'activePlayers', playerId, now);
  await broadcastViewerCount(now);
  switch (action.toLowerCase()) {
    case 'heartbeat':
      await cacheClient.dictionarySetField(process.env.CACHE_NAME, 'analytics', playerId, JSON.stringify({
        bitrate,
        playTime,
        lastHeartbeat: now,
        ...agent && { agent }
      }), { ttl: new CollectionTtl(3600, true) });
      break;
    default:
      //Do nothing otherwise
      break;
  }
};

const broadcastViewerCount = async (now) => {
  if (now - lastViewerCountTime < 1000) {
    return;
  }

  let viewerCount = 0;
  const activePlayers = await cacheClient.sortedSetFetchByScore(process.env.CACHE_NAME, 'activePlayers', { minScore: lastViewerCountTime });
  if (activePlayers.type == CacheSortedSetFetchResponse.Hit) {
    viewerCount = activePlayers.value().length;
  }

  await topicClient.publish(process.env.CACHE_NAME, 'viewerCount', `${viewerCount}`);
  lastViewerCountTime = now;
};

