const fs = require('fs');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { appConfig } = require('./config.js');
const {
  buildPrivateVideoStorageKey,
  resolvePrivateVideoPath,
  ensureStorageDirectory,
} = require('./private-video.js');

let s3Client = null;

const hasS3Credentials = () => Boolean(
  appConfig.storageBucket
  && appConfig.storageRegion
  && appConfig.s3AccessKeyId
  && appConfig.s3SecretAccessKey,
);

const inferStorageProvider = ({ storageProvider, storagePath }) => {
  if (storageProvider) {
    return storageProvider;
  }

  if (storagePath && path.isAbsolute(String(storagePath))) {
    return 'local';
  }

  return getPrivateVideoStorageProvider();
};

const getPrivateVideoStorageProvider = () => (
  appConfig.privateVideoStorageProvider === 's3' && hasS3Credentials() ? 's3' : 'local'
);

const getS3Client = () => {
  if (s3Client) {
    return s3Client;
  }

  s3Client = new S3Client({
    region: appConfig.storageRegion,
    endpoint: appConfig.s3Endpoint || undefined,
    forcePathStyle: Boolean(appConfig.s3ForcePathStyle),
    credentials: {
      accessKeyId: appConfig.s3AccessKeyId,
      secretAccessKey: appConfig.s3SecretAccessKey,
    },
  });

  return s3Client;
};

const buildStorageKeyFromUpload = ({ courseId, moduleId, lessonId, originalName }) =>
  buildPrivateVideoStorageKey({ courseId, moduleId, lessonId, originalName });

const storePrivateVideoUpload = async ({
  tempFilePath,
  courseId,
  moduleId,
  lessonId,
  originalName,
  mimeType,
}) => {
  const storageKey = buildStorageKeyFromUpload({
    courseId,
    moduleId,
    lessonId,
    originalName,
  });
  const provider = getPrivateVideoStorageProvider();

  if (provider === 's3') {
    await getS3Client().send(new PutObjectCommand({
      Bucket: appConfig.storageBucket,
      Key: storageKey,
      Body: fs.createReadStream(tempFilePath),
      ContentType: mimeType || 'video/mp4',
    }));
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return {
      storageProvider: 's3',
      storagePath: storageKey,
      accessPolicy: {
        type: 'signed-object-url',
        drmReady: Boolean(appConfig.privateVideoDrmEnabled),
      },
    };
  }

  const localPath = resolvePrivateVideoPath(storageKey);
  if (!localPath) {
    throw new Error('Local private video path could not be resolved');
  }
  ensureStorageDirectory(localPath);
  fs.renameSync(tempFilePath, localPath);

  return {
    storageProvider: 'local',
    storagePath: storageKey,
    accessPolicy: {
      type: 'signed-stream',
      drmReady: Boolean(appConfig.privateVideoDrmEnabled),
    },
  };
};

const deleteStoredPrivateVideo = async ({ storageProvider, storagePath }) => {
  if (!storagePath) {
    return;
  }

  const provider = inferStorageProvider({ storageProvider, storagePath });
  if (provider === 's3' && hasS3Credentials()) {
    await getS3Client().send(new DeleteObjectCommand({
      Bucket: appConfig.storageBucket,
      Key: storagePath,
    }));
    return;
  }

  const localPath = resolvePrivateVideoPath(storagePath);
  if (localPath && fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
  }
};

const getSignedPrivateVideoUrl = async ({ storagePath, mimeType }) => {
  if (!storagePath) {
    return null;
  }

  if (getPrivateVideoStorageProvider() !== 's3' || !hasS3Credentials()) {
    return null;
  }

  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: appConfig.storageBucket,
      Key: storagePath,
      ResponseContentType: mimeType || 'video/mp4',
    }),
    { expiresIn: appConfig.privateVideoDeliveryUrlTtlSeconds },
  );
};

module.exports = {
  getPrivateVideoStorageProvider,
  buildStorageKeyFromUpload,
  storePrivateVideoUpload,
  deleteStoredPrivateVideo,
  getSignedPrivateVideoUrl,
};
