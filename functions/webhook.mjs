import { CacheClient, CollectionTtl } from '@gomomento/sdk';
const cacheClient = new CacheClient({ defaultTtlSeconds: 10 });

export const handler = async (event) => {
  try {
    const messageWrapper = JSON.parse(event.body);
    const { playerId, action, bitrate, playTime, agent } = JSON.parse(messageWrapper.text);
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
