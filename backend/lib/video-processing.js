const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { appConfig } = require('./config.js');
const {
  buildPrivateHlsAssetKey,
  resolvePrivateVideoPath,
  resolvePrivateHlsPath,
  ensureStorageDirectory,
} = require('./private-video.js');

const activeJobs = new Set();

const getTargetQualities = () => {
  const configured = Array.isArray(appConfig.videoTargetRenditions) ? appConfig.videoTargetRenditions : [];
  const supported = ['480p', '720p'];
  const result = configured.filter((entry) => supported.includes(entry));
  return result.length > 0 ? result : ['480p', '720p'];
};

const createInitialVideoDeliveryState = () => ({
  deliveryProfile: appConfig.videoDeliveryProfile,
  deliveryStrategy: appConfig.enableVideoTranscoding ? 'hls' : 'source',
  sourceFallbackAllowed: Boolean(appConfig.sourcePlaybackFallbackEnabled),
  targetQualities: getTargetQualities(),
  hlsProcessingStatus: appConfig.enableVideoTranscoding ? 'queued' : 'ready',
  hlsProcessingQueuedAt: appConfig.enableVideoTranscoding ? new Date().toISOString() : null,
  hlsProcessingStartedAt: null,
  hlsProcessingCompletedAt: null,
  hlsProcessingError: null,
  hlsManifestPath: null,
  hlsPlaybackPath: null,
});

const cleanupDirectory = (directoryPath) => {
  if (directoryPath && fs.existsSync(directoryPath)) {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  }
};

const deleteProcessedHlsAssets = async (manifestPath) => {
  const resolvedManifest = resolvePrivateHlsPath(manifestPath);
  if (!resolvedManifest) {
    return;
  }

  cleanupDirectory(path.dirname(resolvedManifest));
};

const waitForFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });

const writeMasterManifest = ({ outputDirectory, variants }) => {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  variants.forEach((variant) => {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.resolution}`);
    lines.push(`${variant.name}/index.m3u8`);
  });
  fs.writeFileSync(path.join(outputDirectory, 'master.m3u8'), `${lines.join('\n')}\n`);
};

const renditionProfiles = {
  '480p': { width: 854, height: 480, videoBitrate: '900k', maxRate: '963k', bufferSize: '1350k', bandwidth: 1000000, resolution: '854x480' },
  '720p': { width: 1280, height: 720, videoBitrate: '2200k', maxRate: '2354k', bufferSize: '3300k', bandwidth: 2500000, resolution: '1280x720' },
};

const transcodeToHls = async ({ sourcePath, outputDirectory, qualities }) => {
  cleanupDirectory(outputDirectory);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const variants = [];

  for (const quality of qualities) {
    const profile = renditionProfiles[quality];
    if (!profile) {
      continue;
    }

    const variantDir = path.join(outputDirectory, quality);
    fs.mkdirSync(variantDir, { recursive: true });
    const playlistPath = path.join(variantDir, 'index.m3u8');
    const segmentPattern = path.join(variantDir, 'segment_%03d.ts');

    const args = [
      '-y',
      '-i', sourcePath,
      '-vf', `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:a', 'aac',
      '-ar', '48000',
      '-b:a', '128k',
      '-c:v', 'libx264',
      '-profile:v', 'main',
      '-crf', '23',
      '-sc_threshold', '0',
      '-g', '48',
      '-keyint_min', '48',
      '-b:v', profile.videoBitrate,
      '-maxrate', profile.maxRate,
      '-bufsize', profile.bufferSize,
      '-hls_time', String(appConfig.videoHlsSegmentDurationSeconds),
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', segmentPattern,
      playlistPath,
    ];

    await waitForFfmpeg(args);
    variants.push({
      name: quality,
      bandwidth: profile.bandwidth,
      resolution: profile.resolution,
    });
  }

  writeMasterManifest({ outputDirectory, variants });
};

const scheduleVideoProcessing = ({ courseId, lessonId }) => {
  if (!appConfig.enableVideoTranscoding) {
    return;
  }

  const jobId = `${courseId}:${lessonId}`;
  if (activeJobs.has(jobId)) {
    return;
  }
  activeJobs.add(jobId);

  setTimeout(async () => {
    const { coursesRepository } = require('./repositories.js');
    try {
      const course = await coursesRepository.findById(courseId);
      const lesson = course ? course.modules.flatMap((module) => ([
        ...(module.lessons || []),
        ...((module.chapters || []).flatMap((chapter) => chapter.lessons || [])),
      ])).find((entry) => entry.id === String(lessonId)) : null;

      if (!lesson || !lesson.storagePath || (lesson.storageProvider || 'local') !== 'local') {
        await coursesRepository.updateLesson(courseId, lessonId, (current) => ({
          ...current,
          hlsProcessingStatus: 'failed',
          hlsProcessingCompletedAt: new Date().toISOString(),
          hlsProcessingError: 'HLS processing currently supports local private storage only.',
        }));
        return;
      }

      await coursesRepository.updateLesson(courseId, lessonId, (current) => ({
        ...current,
        hlsProcessingStatus: 'processing',
        hlsProcessingStartedAt: new Date().toISOString(),
        hlsProcessingError: null,
      }));

      const sourcePath = resolvePrivateVideoPath(lesson.storagePath);
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new Error('Source video file not found for HLS processing.');
      }

      if (!ffmpegPath) {
        throw new Error('ffmpeg runtime is unavailable.');
      }

      const outputKey = buildPrivateHlsAssetKey({ courseId, moduleId: lesson.moduleId || 'module', lessonId, assetName: 'master.m3u8' });
      const outputDirectory = path.dirname(resolvePrivateHlsPath(outputKey));
      await transcodeToHls({
        sourcePath,
        outputDirectory,
        qualities: Array.isArray(lesson.targetQualities) && lesson.targetQualities.length > 0 ? lesson.targetQualities : getTargetQualities(),
      });

      if (!appConfig.videoKeepSourceAfterProcessing && sourcePath && fs.existsSync(sourcePath)) {
        fs.unlinkSync(sourcePath);
      }

      await coursesRepository.updateLesson(courseId, lessonId, (current) => ({
        ...current,
        storagePath: appConfig.videoKeepSourceAfterProcessing ? current.storagePath : null,
        deliveryStrategy: 'hls',
        hlsProcessingStatus: 'ready',
        hlsProcessingCompletedAt: new Date().toISOString(),
        hlsManifestPath: outputKey,
        hlsPlaybackPath: outputKey,
        hlsProcessingError: null,
      }));
    } catch (error) {
      const { coursesRepository } = require('./repositories.js');
      await coursesRepository.updateLesson(courseId, lessonId, (current) => ({
        ...current,
        hlsProcessingStatus: 'failed',
        hlsProcessingCompletedAt: new Date().toISOString(),
        hlsProcessingError: error instanceof Error ? error.message : 'Video processing failed.',
      }));
    } finally {
      activeJobs.delete(jobId);
    }
  }, 25);
};

module.exports = {
  createInitialVideoDeliveryState,
  scheduleVideoProcessing,
  deleteProcessedHlsAssets,
};
