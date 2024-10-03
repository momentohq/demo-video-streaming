import { AuthClient, ExpiresIn } from "@gomomento/sdk";

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
    return {
      statusCode: 200,
      body: JSON.stringify({
        token: token.authToken,
        momentoEndpoint: `https://api.cache.cell-us-east-1-1.prod.a.momentohq.com/topics/${process.env.CACHE_NAME}`
      })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Something went wrong", }),
    };
  }
};
