import { CacheClient, CacheDictionaryIncrementResponse, CollectionTtl, TopicClient } from '@gomomento/sdk';
import { getAccountKey, CONCURRENT_THRESHOLD } from './utils/helpers.mjs';
const cacheClient = new CacheClient({ defaultTtlSeconds: 10 });
const topicClient = new TopicClient({});

export const handler = async (event) => {
  try {
    const messageWrapper = JSON.parse(event.body);
    const { playerId, action, bitrate, playTime, agent, accountId } = JSON.parse(messageWrapper.text);
    if (!playerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing playerId' }),
      };
    }

    const now = Date.now();
    await cacheClient.sortedSetPutElement(process.env.CACHE_NAME, 'activePlayers', playerId, now);
    switch (action.toLowerCase()) {
      case 'heartbeat':
        await cacheClient.dictionarySetField(process.env.CACHE_NAME, 'analytics', playerId, JSON.stringify({
          bitrate,
          playTime,
          ...agent && { agent }
        }), { ttl: new CollectionTtl(3600, true) });
        break;
      default:
        //Do nothing otherwise
        break;
    }

    if (accountId) {
      const key = getAccountKey(accountId);
      const response = await cacheClient.dictionaryIncrement(process.env.CACHE_NAME, key, playerId, 1);
      if (response.type === CacheDictionaryIncrementResponse.Success) {
        const heartbeatCount = response.valueNumber();
        if (heartbeatCount === 1) {
          const lengthResponse = await cacheClient.dictionaryLength(process.env.CACHE_NAME, key);
          const deviceCount = lengthResponse.value();
          if (deviceCount > CONCURRENT_THRESHOLD) {
            await topicClient.publish(process.env.CACHE_NAME, accountId, JSON.stringify({ type: 'reject', id: playerId }));
          }
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Something went wrong' }),
    };
  }
};

