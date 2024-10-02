const videoPlayer = document.getElementById('videoPlayer');
const togglePlayPauseBtn = document.getElementById('togglePlayPause');
const toggleEventsBtn = document.getElementById('toggleEvents');
const bufferSizeElement = document.getElementById('bufferSize');
const segmentsDownloadedElement = document.getElementById('segmentsDownloaded');

const POST_URL = 'https://vid.swaghunt.io/topics/fanatics/topic';
const HLS_STREAM_URL = 'https://vid.swaghunt.io/playlist_1920x1080_8000k.m3u8';

let isPublishingSegments = true;
let playerId = generateShortId();
let segmentsDownloaded = 0;

/**
 * Generate a shorter random video player ID (6 characters)
 * @returns {string} A random 6-character video player ID
 */
function generateShortId() {
  return Math.random().toString(36).substr(2, 6);
}

/**
 * Toggles play/pause state of the video and updates the button text.
 */
function togglePlayPause() {
  if (videoPlayer.paused) {
    videoPlayer.play();
    togglePlayPauseBtn.textContent = 'Pause';
    postPlayerAction('play');
  } else {
    videoPlayer.pause();
    togglePlayPauseBtn.textContent = 'Play';
    postPlayerAction('pause');
  }
}

/**
 * Toggles the segment publishing state and updates the button text.
 */
function toggleEvents() {
  isPublishingSegments = !isPublishingSegments;
  toggleEventsBtn.textContent = isPublishingSegments
    ? 'Hide events'
    : 'Show events';
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
      console.log('Action posted successfully');
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
}

/**
 * Update the segments downloaded count and display it.
 */
function updateSegmentCount() {
  segmentsDownloaded++;
  segmentsDownloadedElement.textContent = segmentsDownloaded;
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

  hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
    const segmentUrl = data.frag.url;
    postSegmentDownload(segmentUrl);
    updateSegmentCount();
  });

  hls.on(Hls.Events.BUFFER_APPENDED, () => {
    updateBufferSizeDisplay();
  });

  videoPlayer.addEventListener('timeupdate', updateBufferSizeDisplay);

} else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
  videoPlayer.src = HLS_STREAM_URL;
  videoPlayer.addEventListener('timeupdate', updateBufferSizeDisplay);
}
