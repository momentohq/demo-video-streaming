const videoPlayer = document.getElementById('videoPlayer');
const togglePlayPauseBtn = document.getElementById('togglePlayPause');
const toggleEventsBtn = document.getElementById('toggleEvents');
const bufferSizeElement = document.getElementById('bufferSize');
const segmentsDownloadedElement = document.getElementById('segmentsDownloaded');

const POST_URL = 'https://vid.swaghunt.io/topics/fanatics/topic';
const HLS_STREAM_URL = 'https://vid.swaghunt.io/playlist_1920x1080_8000k.m3u8';

let segmentsDownloaded = 0;
let downloadTimes = [];
let isPublishingSegments = true;
let playerId = localStorage.getItem('playerId');
if (!playerId) {
  playerId = generateShortId();
  localStorage.setItem('playerId', playerId);
}

/**
 * Generate a shorter random video player ID (6 characters)
 * @returns {string} A random 6-character video player ID
 */
function generateShortId() {
  return Math.random().toString(36).substr(2, 6);
}

function togglePublish() {
  const toggleBg = document.getElementById('toggleBg');
  const toggleCircle = document.getElementById('toggleCircle');

  if (isPublishingSegments) {
    isPublishingSegments = false;
    toggleBg.classList.replace('bg-mint', 'bg-gray-500');
    toggleCircle.style.transform = 'translateX(0)';
  } else {
    isPublishingSegments = true;
    toggleBg.classList.replace('bg-gray-500', 'bg-mint');
    toggleCircle.style.transform = 'translateX(20px)';
  }
}

/**
 * Posts player actions (play/pause) to the server.
 * @param {string} action - The action to post (e.g., 'play', 'pause').
 */
async function postPlayerAction(action) {
  const data = {
    playerId,
    action,
    timestamp: new Date().toISOString(),
  };

  console.log(`Posting action: ${action}`, data);

  try {
    const response = await fetch(POST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      addEvent(action);
    } else {
      console.error(`Failed to post action: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error posting action:', error);
  }
}

/**
 * Posts segment download data to the server, respecting the publishing toggle.
 * @param {string} segmentUrl - The URL of the segment being downloaded.
 */
async function postSegmentDownload(segmentUrl) {
  if (!isPublishingSegments) return;

  // Extract only the last part of the segment URL
  const relativeSegmentUrl = segmentUrl.substring(segmentUrl.lastIndexOf('/') + 1);
  const data = {
    playerId,
    segmentUrl: relativeSegmentUrl,
    timestamp: new Date().toISOString(),
  };

  console.log(`Posting segment download: ${relativeSegmentUrl}`, data);

  await fetch(POST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const eventContainer = document.getElementById('eventContainer');
  const lastEvent = eventContainer.lastChild;
  if (lastEvent && lastEvent.textContent.includes('Segment downloaded')) {
    let count = 2;
    const match = lastEvent.textContent.match(/\((\d+)\)/);
    if (match) {
      count = parseInt(match[1]) + 1;
    }
    const lastEventDescription = lastEvent.querySelector('.description');
    lastEventDescription.textContent = `${lastEventDescription.textContent.split('(')[0]} (${count})`;
  } else {
    addEvent('Segment downloaded');
  }
}

function addEvent(action) {
  const eventContainer = document.getElementById('eventContainer');
  const event = document.createElement('li');
  const time = document.createElement('strong');
  time.textContent = new Date().toLocaleTimeString();

  const eventText = document.createElement('span');
  eventText.textContent = ` - ${action}`;
  eventText.className = "description";

  event.appendChild(time);
  event.appendChild(eventText);
  eventContainer.appendChild(event);
}

/**
 * Update the segments downloaded count and display it.
 */
function updateSegmentCount() {
  segmentsDownloaded++;
  segmentsDownloadedElement.textContent = segmentsDownloaded;
}

/**
 * Update the average download time for segments
 */
function updateAvgDownloadTime() {
  const avgDownloadTime = downloadTimes.reduce((a, b) => a + b, 0) / downloadTimes.length;
  const avgDownloadTimeElement = document.getElementById('avgDownloadTime');
  avgDownloadTimeElement.textContent = avgDownloadTime.toFixed(0) + "ms";
}

/**
 * Calculate the look-ahead buffer size in seconds.
 * @returns {number} The number of seconds of video that are buffered ahead of the current playback time.
 */
function getLookAheadBufferSize() {
  const buffered = videoPlayer.buffered;
  const currentTime = videoPlayer.currentTime;

  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= currentTime && buffered.end(i) > currentTime) {
      return buffered.end(i) - currentTime;
    }
  }

  return 0;
}

/**
 * Update the look-ahead buffer size display.
 */
function updateBufferSizeDisplay() {
  const lookAheadBufferSize = getLookAheadBufferSize();
  bufferSizeElement.textContent = lookAheadBufferSize.toFixed(2) + "s";
}

if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource(HLS_STREAM_URL);
  hls.attachMedia(videoPlayer);

  const segmentStartTimes = new Map();
  hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
    const segmentUrl = data.frag.url;
    segmentStartTimes.set(segmentUrl, performance.now());
  });

  hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
    const segmentUrl = data.frag.url;
    postSegmentDownload(segmentUrl);
    updateSegmentCount();

    if (segmentStartTimes.has(segmentUrl)) {
      const startTime = segmentStartTimes.get(segmentUrl);
      const downloadTime = performance.now() - startTime;
      segmentStartTimes.delete(segmentUrl);
      downloadTimes.push(downloadTime);
      updateAvgDownloadTime();
    }
  });

  hls.on(Hls.Events.BUFFER_APPENDED, () => updateBufferSizeDisplay());
  hls.on(Hls.Events.MANIFEST_LOADED, () => addEvent('Manifest loaded'));

  videoPlayer.addEventListener('timeupdate', updateBufferSizeDisplay);
  videoPlayer.addEventListener('play', () => postPlayerAction('Play'));
  videoPlayer.addEventListener('pause', () => postPlayerAction('Pause'));

} else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
  videoPlayer.src = HLS_STREAM_URL;
  videoPlayer.addEventListener('timeupdate', updateBufferSizeDisplay);
}
