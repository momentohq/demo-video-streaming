import { CacheClient, CacheDictionaryFetchResponse } from "@gomomento/sdk";
const cacheClient = new CacheClient({ defaultTtlSeconds: 10 });

export const handler = async (event) => {
  try {
    const analytics = await getAnalytics();
    const html = renderPage(analytics);

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

  const currentTime = Date.now();
  const activeThreshold = 5000;

  let activePlayers = 0;
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

  Object.entries(analytics).forEach(([playerId, playerDataString]) => {
    const playerData = JSON.parse(playerDataString);
    totalPlayers++;

    if (currentTime - playerData.lastHeartbeat <= activeThreshold) {
      activePlayers++;
    }

    playerIds.push(playerId);
    playTimes.push(playerData.playTime);
    bitrates.push(playerData.bitrate);

    if(playerData.agent){
      const browser = playerData.agent.browser.toLowerCase();
      agents.browsers[browser] = (agents.browsers[browser] || 0) + 1;

      if(playerData.agent.device.toLowerCase() == 'desktop'){
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
      min: Math.min(...bitrates),
      max: Math.max(...bitrates),
      average: bitrates.reduce((a, b) => a + b, 0) / bitrates.length
    },
    players: {
      active: activePlayers,
      total: totalPlayers
    },
    agents
  };
};

const renderPage = (analytics) => {
  return `
    <!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Dashboard | Momento</title>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            mint: '#00c88c',
            darkMint: '#03a876',
            lightMint: '#abe7d2',
            forest: '#25392b',
            darkGray: '#1e1f21',
            squirrel: '#c2b2a9',
            mediumGray: '#32353B'
          }
        }
      }
    }
  </script>
  <style>
    body {
      font-family: 'Manrope', sans-serif;
    }
  </style>
</head>

<body class="bg-darkGray text-white">
  <header class="bg-forest text-white py-4 px-6 w-full fixed top-0">
    <div class="max-w-full mx-auto flex items-center">
      <img id="logo" src="assets/momento-logo-white.png" alt="Momento Logo" class="w-44">
    </div>
  </header>

  <!-- Main Container -->
  <div class="container mx-auto mt-24 px-4 lg:px-0">
    <div class="lg:flex lg:space-x-6 justify-center">
      <!-- Analytics Container -->
      <div class="bg-mediumGray rounded-lg shadow-lg py-4 px-4 lg:p-6 relative lg:w-2/3">
        <img src="assets/momento-mark-white.png" alt="Momento Mark" class="absolute top-4 right-4 lg:w-12 w-10">
        <h2 class="text-3xl lg:text-2xl">Video Streaming Analytics</h2>

        <!-- Stats Row -->
        <div class="grid grid-cols-3 mt-6 items-center justify-center">
          <!-- Active Players -->
          <div class="text-center mb-4">
            <p class="text-mint lg:text-lg font-semibold">Active Players</p>
            <p id="activePlayers" class="text-lg lg:text-2xl">0</p>
          </div>
          <!-- Total Players -->
          <div class="text-center mb-4">
            <p class="text-mint lg:text-lg font-semibold">Total Players</p>
            <p id="totalPlayers" class="text-lg lg:text-2xl">0</p>
          </div>
          <!-- Avg Play Time -->
          <div class="text-center mb-4">
            <p class="text-mint lg:text-lg font-semibold">Avg Play Time</p>
            <p id="avgPlayTime" class="text-lg lg:text-2xl">0s</p>
          </div>
        </div>

        <!-- Bitrate Stats -->
        <div class="mt-6 bg-gray-700 rounded-lg shadow-md p-4">
          <h3 class="text-xl mb-2">Bitrate Statistics</h3>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <p class="text-mint font-semibold">Min Bitrate</p>
              <p id="minBitrate" class="text-lg">0 kbps</p>
            </div>
            <div class="flex flex-col items-center">
              <p class="text-mint font-semibold">Avg Bitrate</p>
              <p id="avgBitrate" class="text-lg">0 kbps</p>
            </div>
            <div class="flex flex-col items-end">
              <p class="text-mint font-semibold">Max Bitrate</p>
              <p id="maxBitrate" class="text-lg">0 kbps</p>
            </div>
          </div>
        </div>

        <!-- Bitrate Chart -->
        <div class="mt-6 bg-gray-700 rounded-lg shadow-md p-4">
          <h3 class="text-xl mb-2">Bitrate Distribution</h3>
          <canvas id="bitrateChart"></canvas>
        </div>

        <div class="mt-6 bg-gray-700 rounded-lg shadow-md p-4">
          <h3 class="text-xl mb-4">Agent Distribution</h3>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="w-max-48 h-max-48 m-auto">
              <canvas id="browserChart" class="h-48"></canvas>
            </div>
            <div class="w-max-48 h-max-48 m-auto">
              <canvas id="deviceChart" class="h-48"></canvas>
            </div>
            <div class="w-max-48 h-max-48 m-auto">
              <canvas id="osChart" class="h-48"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function renderPage(analytics) {
      document.getElementById('activePlayers').textContent = analytics.players.active;
      document.getElementById('totalPlayers').textContent = analytics.players.total;
      document.getElementById('avgPlayTime').textContent = formatTime(analytics.playTime.average);
      document.getElementById('minBitrate').textContent = analytics.bitrates.min.toFixed(2) + " kbps";
      document.getElementById('avgBitrate').textContent = analytics.bitrates.average.toFixed(2)+ " kbps";
      document.getElementById('maxBitrate').textContent = analytics.bitrates.max.toFixed(2) + " kbps";

      renderBitrateChart(analytics.bitrates);
      renderAgentCharts(analytics.agents);
    }

    function formatTime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      let timeString = '';
      if(hours > 0) timeString += hours + 'h ';
      if(minutes > 0) timeString += minutes + 'm ';
      if(seconds > 0) timeString += secs + 's';

      return timeString;
    }

    function renderBitrateChart(bitrates) {
      const ctx = document.getElementById('bitrateChart').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Min', 'Average', 'Max'],
          datasets: [{
            label: 'Bitrate (kbps)',
            data: [bitrates.min, bitrates.average, bitrates.max],
            backgroundColor: ['#abe7d2', '#00c88c', '#03a876'],
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: 'white' }
            },
            x: {
              ticks: { color: 'white' }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }

      function renderAgentCharts(agents) {
      const browserCtx = document.getElementById('browserChart').getContext('2d');
      const deviceCtx = document.getElementById('deviceChart').getContext('2d');
      const osCtx = document.getElementById('osChart').getContext('2d');

      // Prepare data for browsers chart
      const browserLabels = Object.keys(agents.browsers);
      const browserData = Object.values(agents.browsers);

      // Prepare data for devices chart
      const deviceLabels = ['Mobile', 'Desktop'];
      const deviceData = [agents.devices.mobile, agents.devices.desktop];

      // Prepare data for OS chart
      const osLabels = Object.keys(agents.os);
      const osData = Object.values(agents.os);

      // Browser Chart
      new Chart(browserCtx, {
        type: 'doughnut',
        data: {
          labels: browserLabels,
          datasets: [{
            label: 'Browsers',
            data: browserData,
            backgroundColor: ['#abe7d2', '#00c88c', '#03a876', '#c2b2a9', '#25392b'],
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: 'white' } },
          }
        }
      });

      // Device Chart
      new Chart(deviceCtx, {
        type: 'doughnut',
        data: {
          labels: deviceLabels,
          datasets: [{
            label: 'Devices',
            data: deviceData,
            backgroundColor: ['#00c88c', '#25392b'],
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: 'white' } },
          }
        }
      });

      // OS Chart
      new Chart(osCtx, {
        type: 'doughnut',
        data: {
          labels: osLabels,
          datasets: [{
            label: 'Operating Systems',
            data: osData,
            backgroundColor: ['#abe7d2', '#00c88c', '#03a876', '#c2b2a9', '#25392b'],
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: 'white' } },
          }
        }
      });
    }

    const analytics = ${JSON.stringify(analytics)};

    renderPage(analytics);
  </script>
</body>

</html>
  `;
};
