import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { LiveClassAccess, ProtectedLessonPlayback } from '../types';

const EMBEDDED_ROOM_ALLOW =
  'autoplay; camera; clipboard-write; display-capture; encrypted-media; fullscreen; microphone; picture-in-picture; screen-wake-lock';

export const ProtectedLivePlayback = ({ access }: { access: LiveClassAccess }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const replayPlayback = access.replayPlayback as ProtectedLessonPlayback | null;

  useEffect(() => {
    const video = videoRef.current;
    const streamUrl = access.streamUrl
      || (replayPlayback?.playerType === 'private-video' ? replayPlayback.streamUrl : null);
    const streamFormat = access.streamFormat
      || (replayPlayback?.playerType === 'private-video' ? replayPlayback.streamFormat : null);

    if (!video || !streamUrl) {
      return undefined;
    }

    if (streamFormat === 'hls' && Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    video.src = streamUrl;
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };
  }, [access.streamFormat, access.streamUrl, replayPlayback?.playerType, replayPlayback?.streamFormat, replayPlayback?.streamUrl]);

  if (access.accessType === 'embedded-room' && access.embedUrl) {
    return (
      <iframe
        src={access.embedUrl}
        title={access.title}
        allow={EMBEDDED_ROOM_ALLOW}
        allowFullScreen
        className="h-[420px] w-full rounded-[28px] border border-[var(--line)] bg-black"
      />
    );
  }

  if (replayPlayback?.playerType === 'youtube' && replayPlayback.embedUrl) {
    return (
      <iframe
        src={replayPlayback.embedUrl}
        title={access.title}
        allow="autoplay; encrypted-media; picture-in-picture"
        className="h-[420px] w-full rounded-[28px] border border-[var(--line)] bg-black"
      />
    );
  }

  if (
    access.accessType === 'live-stream'
    || access.accessType === 'recording-link'
    || (replayPlayback?.playerType === 'private-video' && replayPlayback.streamUrl)
  ) {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-black">
        {access.watermarkText && (
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
            {access.watermarkText}
          </div>
        )}
        <video ref={videoRef} controls playsInline className="h-[420px] w-full bg-black" />
      </div>
    );
  }

  if (access.accessType === 'recording-link' && access.replayExternalUrl) {
    return (
      <a
        href={access.replayExternalUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white"
      >
        Open replay
      </a>
    );
  }

  return (
    <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
      {access.statusMessage}
    </div>
  );
};
