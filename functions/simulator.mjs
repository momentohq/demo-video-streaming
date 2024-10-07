import { TopicClient, CacheClient, CacheDictionaryFetchResponse } from "@gomomento/sdk";

const topicClient = new TopicClient({});
const cacheClient = new CacheClient({ defaultTtlSeconds: 300 });

const OPERATING_SYSTEMS = ['windows', 'linux', 'macos', 'android', 'ios'];
const BROWSERS = ['google chrome', 'firefox', 'safari', 'microsoft edge', 'opera'];
const DEVICES = ['desktop', 'mobile'];
const BITRATES = ['500', '2000', '5000'];
const MAX_VIEW_TIME = 120;

export const handler = async (state) => {
  try {
    const { id } = state;
    let player;
    const playerResponse = await cacheClient.dictionaryFetch(process.env.CACHE_NAME, id);
    switch (playerResponse.type) {
      case CacheDictionaryFetchResponse.Hit:
        player = playerResponse.value();
        player = updatePlayerEvent(player);
        break;
      case CacheDictionaryFetchResponse.Error:
        console.error(playerResponse.toString());
      case CacheDictionaryFetchResponse.Miss:
        player = createRandomPlayerEvent();
        break;
    }

    const message = {
      playerId: id,
      action: 'heartbeat',
      bitrate: player.bitrate,
      playTime: player.playTime,
      agent: {
        os: player.operatingSystem,
        browser: player.browser,
        device: player.device
      }
    };

    await topicClient.publish(process.env.CACHE_NAME, 'stream', JSON.stringify(message));
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false };
  }
};

const getRandomValueFromArray = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

const createRandomPlayerEvent = () => {
  return {
    bitrate: getRandomValueFromArray(BITRATES),
    playTime: Math.floor(Math.random() * MAX_VIEW_TIME),
    operatingSystem: getRandomValueFromArray(OPERATING_SYSTEMS),
    browser: getRandomValueFromArray(BROWSERS),
    device: getRandomValueFromArray(DEVICES)
  };
};

const updatePlayerEvent = (player) => {
  const diff = MAX_VIEW_TIME - player.playTime;
  player.playTime += Math.floor(Math.random() * diff);
  player.bitrate = getRandomValueFromArray(BITRATES);

  return player;
};
