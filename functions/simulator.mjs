import { TopicClient, TopicPublishResponse } from "@gomomento/sdk";

const topicClient = new TopicClient({});

const OPERATING_SYSTEMS = ['windows', 'linux', 'macos', 'android', 'ios'];
const BROWSERS = ['google chrome', 'firefox', 'safari', 'microsoft edge', 'opera'];
const DEVICES = ['desktop', 'mobile'];
const BITRATES = ['500', '2000', '5000'];
const MAX_VIEW_TIME = 120;

let players = {};

export const runSimulation = async (playerCount) => {
  players = {};

  for (let i = 0; i < playerCount; i++) {
    const playerId = `player_${i + 1}`;
    players[playerId] = createRandomPlayerEvent();
  }

  const endTime = Date.now() + 60000;
  simulate(endTime);
};

const simulate = (endTime) => {
  if (Date.now() >= endTime) {
    return;
  }

  for (const playerId of Object.keys(players)) {
    run(playerId).catch((err) => {
      console.error(`Error in run for player ${playerId}:`, err);
    });
  }

  setTimeout(() => simulate(endTime), 750);
};

const run = async (playerId) => {
  try {
    let player = players[playerId];
    updatePlayerEvent(player);

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

    const response = await topicClient.publish(process.env.CACHE_NAME, 'stream', JSON.stringify(message));
    if (response.type == TopicPublishResponse.Error) {
      console.error(response.toString());
    }
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
