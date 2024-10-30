import { CacheClient, CollectionTtl, CacheDictionarySetFieldResponse, CacheSortedSetPutElementsResponse } from "@gomomento/sdk";

const cacheClient = new CacheClient({ defaultTtlSeconds: 3600 });
const OPERATING_SYSTEMS = ['windows', 'linux', 'macos', 'android', 'ios'];
const BROWSERS = ['google chrome', 'firefox', 'safari', 'microsoft edge', 'opera'];
const DEVICES = ['desktop', 'mobile'];
const BITRATES = ['500', '2000', '5000'];
const MAX_VIEW_TIME = 120;

let players = [];

export const runSimulation = async (playerCount) => {
  players = [];
  const simulationId = generateString(4);

  for (let i = 0; i < playerCount; i++) {
    const playerId = await createRandomPlayer(simulationId, i);
    players.push(playerId);
  }

  simulate(endTime);
};

const simulate = async (endTime) => {
  const now = Date.now();
  if (now >= endTime) {
    return;
  }

  const response = await cacheClient.sortedSetPutElements(process.env.CACHE_NAME, 'activePlayers', players.map(p => { return { playerId: now }; }));
  if (response.type == CacheSortedSetPutElementsResponse.Error) {
    console.error({ type: 'heartbeat', error: response.toString() });
  }

  setTimeout(() => simulate(endTime), 750);
};

const getRandomValueFromArray = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

const createRandomPlayer = async (simulationId, index) => {
  const playerId = `${simulationId}_player_${index}`;
  const response = await cacheClient.dictionarySetField(process.env.CACHE_NAME, 'analytics', playerId, JSON.stringify({
    bitrate: getRandomValueFromArray(BITRATES),
    playTime: Math.floor(Math.random() * MAX_VIEW_TIME),
    agent: {
      os: getRandomValueFromArray(OPERATING_SYSTEMS),
      browser: getRandomValueFromArray(BROWSERS),
      device: getRandomValueFromArray(DEVICES)
    }
  }), { ttl: new CollectionTtl(3600, true) });
  if (response.type == CacheDictionarySetFieldResponse.Error) {
    console.error(JSON.stringify({ type: 'playerCreation', error: response.toString() }));
  }

  return playerId;
};

function generateString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
