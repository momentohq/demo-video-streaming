import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { CacheClient } from '@gomomento/sdk';

const cacheClient = new CacheClient({ defaultTtlSeconds: 3600 });
ffmpeg.setFfmpegPath(path.join(process.cwd(), 'lib', 'ffmpeg.exe'));

export const transcode = (rtmpUrl, streamName) => {
  ffmpeg(rtmpUrl)
    // 1080p Output
    .size('1920x1080')
    .videoBitrate('5000k')
    .output(`${streamName}/1080p/playlist.m3u8`)
    .outputOptions([
      '-c:v libx264',
      '-g 48',
      '-sc_threshold 0',
      '-f hls',
      '-hls_time 1',
      '-hls_list_size 0',
      `-hls_segment_filename ${streamName}/1080p/${streamName}_1080p_segment%03d.ts`
    ])
    // 720p Output
    .size('1280x720')
    .videoBitrate('3000k')
    .output(`${streamName}/720p/playlist.m3u8`)
    .outputOptions([
      '-c:v libx264',
      '-g 48',
      '-sc_threshold 0',
      '-f hls',
      '-hls_time 1',
      '-hls_list_size 0',
      `-hls_segment_filename ${streamName}/720p/${streamName}_720p_segment%03d.ts`
    ])
    // 480p Output
    .size('854x480')
    .videoBitrate('1500k')
    .output(`${streamName}/480p/playlist.m3u8`)
    .outputOptions([
      '-c:v libx264',
      '-g 48',
      '-sc_threshold 0',
      '-f hls',
      '-hls_time 1',
      '-hls_list_size 0',
      `-hls_segment_filename ${streamName}/480p/${streamName}_480p_segment%03d.ts`
    ])
    .on('end', () => {
      console.log('Transcoding complete');
    })
    .on('error', (err) => {
      console.error(`Error during transcoding: ${err.message}`);
    })
    .run();

  watchAndUploadSegments(streamName, ['1080p', '720p', '480p']);
  uploadMasterPlaylist(streamName);
};

const watchAndUploadSegments = (streamName, directories) => {
  for (const directory of directories) {
    const streamDirectory = `${streamName}/${directory}`;
    if (!fs.existsSync(streamDirectory)) {
      fs.mkdirSync(streamDirectory, { recursive: true });
    }

    fs.watch(streamDirectory, (eventType, fileName) => {
      if (fileName.endsWith('.ts') || fileName.endsWith('.m3u8')) {
        const location = `${streamDirectory}/${fileName}`;
        const key = `${streamName}_${directory}_${fileName}`;
        uploadToMomento(location, key);
      }
    });
  }
};

const uploadToMomento = async (filepath, key) => {
  try {
    const fileData = fs.readFileSync(filepath);
    await cacheClient.set(process.env.CACHE_NAME, key, fileData);
    console.log(`${key} uploaded`);
  } catch (error) {
    console.error(`Failed to upload ${key}:`, error);
  }
};

const uploadMasterPlaylist = async (streamName) => {
  const masterPlaylist = `#EXTM3U
  #EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
  ${streamName}_1080p_playlist.m3u8
  #EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
  ${streamName}_720p_playlist.m3u8
  #EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
  ${streamName}_480p_playlist.m3u8
  `;

  await cacheClient.set(process.env.CACHE_CLIENT, `${streamName}_playlist.m3u8`, masterPlaylist);
};
