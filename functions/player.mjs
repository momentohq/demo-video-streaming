import { AuthClient, ExpiresIn, CacheClient, CacheDictionaryLengthResponse } from "@gomomento/sdk";
import Handlebars from 'handlebars';
import template from '../templates/player.hbs';
import { getAccountKey, CONCURRENT_THRESHOLD } from "./utils/helpers.mjs";

const authClient = new AuthClient({});
const cacheClient = new CacheClient({ defaultTtlSeconds: 60 });

export const handler = async (event) => {
  try {
    let streamUrl = 'https://vid.swaghunt.io/playlist_1920x1080_8000k.m3u8';
    let streamName = 'Big Buck Bunny';
    if (event.queryStringParameters?.stream) {
      streamUrl = event.queryStringParameters.stream;
    }
    if (event.queryStringParameters?.name) {
      streamName = event.queryStringParameters.name;
    }

    let accountId = event.queryStringParameters?.accountId;
    const concurrentDevices = await getConcurrentDeviceCount(accountId);
    const isAllowed = concurrentDevices <= CONCURRENT_THRESHOLD;

    const scope = {
      permissions:
        [{
          role: 'publishonly',
          cache: process.env.CACHE_NAME,
          topic: 'stream'
        },
        {
          role: 'subscribeonly',
          cache: process.env.CACHE_NAME,
          topic: 'viewerCount'
        },
        {
          role: 'publishsubscribe',
          cache: process.env.CACHE_NAME,
          topic: 'reactions'
        }
      ]
    };

    if (accountId) {
      scope.permissions.push({
        role: 'subscribeonly',
        cache: process.env.CACHE_NAME,
        topic: accountId
      });
    }

    let token = await authClient.generateDisposableToken(scope, ExpiresIn.minutes(15));

    const data = {
      momento: {
        token: token.authToken,
        endpoint: `https://api.cache.cell-us-east-1-1.prod.a.momentohq.com/topics/${process.env.CACHE_NAME}`
      },
      stream: {
        url: streamUrl,
        name: streamName
      },
      entitlements: {
        isAllowed,
        deviceCount: concurrentDevices,
        accountId
      }
    };

    const compiledTemplate = Handlebars.compile(template);
    const html = compiledTemplate(data);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: html
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Something went wrong", }),
    };
  }
};

const getConcurrentDeviceCount = async (accountId) => {
  if (!accountId) return 0;

  const key = getAccountKey(accountId);
  let deviceCount = 0;
  const response = await cacheClient.dictionaryLength(process.env.CACHE_NAME, key);
  if (response.type === CacheDictionaryLengthResponse.Hit) {
    deviceCount = response.value();
  }
  return deviceCount;
};
