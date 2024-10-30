import { TopicClient } from "@gomomento/sdk";

const topicClient = new TopicClient({});

const OPERATING_SYSTEMS = ['windows', 'linux', 'macos', 'android', 'ios'];
const BROWSERS = ['google chrome', 'firefox', 'safari', 'microsoft edge', 'opera'];
const DEVICES = ['desktop', 'mobile'];
const BITRATES = ['500', '2000', '5000'];
const MAX_VIEW_TIME = 120;

let players = {};

export const runSimulation = async (playerCount) => {
  const playerPromises = Array.from({ length: playerCount }, (_, i) => {
    const playerId = `player_${i + 1}`;
    return simulatePlayer(playerId);
  });

  await Promise.all(playerPromises);
};

const simulatePlayer = async (playerId) => {
  const endTime = Date.now() + 60000;
  players[playerId] = createRandomPlayerEvent();

  const intervalId = setInterval(async () => {
    if (Date.now() >= endTime) {
      clearInterval(intervalId);
      return;
    }

    try {
      await run(playerId);
    } catch (error) {
      console.error(`Error for player ${playerId}:`, error);
    }
  }, 750); 
};

const run = async (playerId) => {
  try {
    let player = players[playerId];
    if (!player) {
      player = createRandomPlayerEvent();
    } else {
      player = updatePlayerEvent(player);
    }

    players[playerId] = player;

    const message = {
      playerId,
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
  } catch (err) {
    console.error(err);
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

export const clearSimulation = () => {
  players = [];
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
