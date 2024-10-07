import { AuthClient, ExpiresIn } from "@gomomento/sdk";
import Handlebars from 'handlebars';
import template from '../templates/player.hbs';

const authClient = new AuthClient({});

export const handler = async (event) => {
  try {
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
        }]
    };

    let token = await authClient.generateDisposableToken(scope, ExpiresIn.minutes(15));

    const data = {
      momento: {
        token: token.authToken,
        endpoint: `https://api.cache.cell-us-east-1-1.prod.a.momentohq.com/topics/${process.env.CACHE_NAME}`
      },
      streamUrl: 'https://vid.swaghunt.io/playlist_1920x1080_8000k.m3u8'
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
