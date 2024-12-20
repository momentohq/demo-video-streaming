import express from 'express';
import { CacheClient, TopicClient, CacheSortedSetFetchResponse } from '@gomomento/sdk';
import { runSimulation } from './functions/simulator.mjs';
import { transcode } from './functions/transcode.mjs';

const cacheClient = new CacheClient({ defaultTtlSeconds: 60 });
const topicClient = new TopicClient({});

async function run() {
  if (process.env.ENVIRONMENT !== 'production') {
    const dotenv = await import('dotenv');
    dotenv.config();
  }

  const app = express();
  app.use(express.json());

  app.listen(8000, () => {
    console.log('Listening on port 8000. This is for the AppRunner health check.');
  });

  app.post('/simulations', (req, res) => {
    try {
      const { playerCount } = req.body;
      res.status(202).json({ message: `Simulation started for ${playerCount} players` });
      runSimulation(playerCount);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Something went wrong' });
    }
  });

  app.post('/streams', (req, res) => {
    try {
      const { rtmpUrl, streamName } = req.body;

      if (!rtmpUrl || !streamName) {
        return res.status(400).json({ error: 'RTMP url and stream name are required' });
      }

      const stream = streamName.replace(/[^a-zA-Z]/g, "").toLowerCase();
      res.status(202).json({ stream: `${stream}_playlist.m3u8` });
      transcode(rtmpUrl, stream);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Something went wrong' });
    }
  });

  broadcastViewerCount();
}

const broadcastViewerCount = async () => {
  try {
    let viewerCount = 0;
    const activePlayers = await cacheClient.sortedSetFetchByScore(process.env.CACHE_NAME, 'activePlayers', { minScore: Date.now() - 2000 });
    if (activePlayers.type == CacheSortedSetFetchResponse.Hit) {
      viewerCount = activePlayers.value().length;
    }

    await topicClient.publish(process.env.CACHE_NAME, 'viewerCount', `${viewerCount}`);
  } catch (err) {
    console.error(err);
  } finally {
    setTimeout(() => broadcastViewerCount(), 2000);
  }
};

run();
