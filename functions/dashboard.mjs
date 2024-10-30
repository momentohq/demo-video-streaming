import { CacheClient, CacheDictionaryFetchResponse, CacheSortedSetFetchResponse } from "@gomomento/sdk";
import Handlebars from 'handlebars';
import template from '../templates/dashboard.hbs';

const cacheClient = new CacheClient({ defaultTtlSeconds: 10 });

export const handler = async (event) => {
  try {
    const analytics = await getAnalytics();
    Handlebars.registerHelper('json', function (context) { return JSON.stringify(context); });

    const compiledTemplate = Handlebars.compile(template);
    const html = compiledTemplate({ data: analytics, refreshTime: new Date().toLocaleTimeString() });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: html,
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Something went wrong", }),
    };
  }
};

const getAnalytics = async () => {
  let analytics = {};
  const analyticsResponse = await cacheClient.dictionaryFetch(process.env.CACHE_NAME, 'analytics');
  if (analyticsResponse.type == CacheDictionaryFetchResponse.Error) {
    console.error(analyticsResponse.toString());
  } else if (analyticsResponse.type == CacheDictionaryFetchResponse.Hit) {
    analytics = analyticsResponse.value();
  }

  let totalPlayers = 0;
  const playerIds = [];
  const playTimes = [];
  const bitrates = [];
  const agents = {
    browsers: {},
    devices: {
      mobile: 0,
      desktop: 0
    },
    os: {}
  };

  let viewerCount = 0;
  const activePlayers = await cacheClient.sortedSetFetchByScore(process.env.CACHE_NAME, 'activePlayers', { minScore: Date.now() - 2000 });
  if (activePlayers.type == CacheSortedSetFetchResponse.Hit) {
    viewerCount = activePlayers.value().length;
  }

  Object.entries(analytics).forEach(([playerId, playerDataString]) => {
    const playerData = JSON.parse(playerDataString);
    totalPlayers++;

    playerIds.push(playerId);
    playTimes.push(playerData.playTime);

    const bitrate = Number(playerData.bitrate);
    if (!isNaN(bitrate)) {
      bitrates.push(bitrate);
    }

    if (playerData.agent) {
      const browser = playerData.agent.browser.toLowerCase();
      agents.browsers[browser] = (agents.browsers[browser] || 0) + 1;

      if (playerData.agent.device.toLowerCase() == 'desktop') {
        agents.devices.desktop++;
      } else {
        agents.devices.mobile++;
      }

      const os = playerData.agent.os.toLowerCase();
      agents.os[os] = (agents.os[os] || 0) + 1;
    }
  });

  const totalPlayTime = playTimes.reduce((a, b) => a + b, 0);
  const avgPlayTime = totalPlayTime / playTimes.length;

  return {
    playTime: {
      total: totalPlayTime,
      average: avgPlayTime
    },
    bitrates: {
      min: Math.round(Math.min(...bitrates)) ?? 0,
      max: Math.round(Math.max(...bitrates)) ?? 0,
      average: Math.round(bitrates.reduce((a, b) => a + b, 0) / bitrates.length) ?? 0
    },
    players: {
      active: viewerCount,
      total: totalPlayers
    },
    agents
  };
};
