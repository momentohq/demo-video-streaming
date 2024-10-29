import express from 'express';
import { CacheClient, TopicClient, CacheSortedSetFetchResponse } from '@gomomento/sdk';

const cacheClient = new CacheClient({ defaultTtlSeconds: 60 });
const topicClient = new TopicClient({});
let lastViewerCountTime = 0;

async function run() {
  if (process.env.ENVIRONMENT !== 'production') {
    const dotenv = await import('dotenv');
    dotenv.config();
  }

  const app = express();
  app.listen(8000, () => {
    console.log('Listening on port 8000. This is for the AppRunner health check.');
  });

  broadcastViewerCount();
}

const broadcastViewerCount = async () => {
  try {
    const now = Date.now();

    let viewerCount = 0;
    const activePlayers = await cacheClient.sortedSetFetchByScore(process.env.CACHE_NAME, 'activePlayers', { minScore: lastViewerCountTime });
    if (activePlayers.type == CacheSortedSetFetchResponse.Hit) {
      viewerCount = activePlayers.value().length;
    }

    await topicClient.publish(process.env.CACHE_NAME, 'viewerCount', `${viewerCount}`);
    lastViewerCountTime = now;
  } catch (err) {
    console.error(err);
  } finally {
    setTimeout(() => broadcastViewerCount(), 2000);
  }
};

run();
