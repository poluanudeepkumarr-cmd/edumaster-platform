import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Radio } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { EduService } from '../EduService';
import { LiveClassAccess } from '../types';

export const LiveBroadcastViewer = ({
  liveClassId,
  access,
}: {
  liveClassId: string;
  access: LiveClassAccess;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        setLoading(true);
        setError(null);

        const join = await EduService.getLiveKitJoinToken(liveClassId, 'viewer');
        if (cancelled) {
          return;
        }

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        const attachRemoteTrack = () => {
          const participants = Array.from(room.remoteParticipants.values());
          const publishedTracks = participants.flatMap((participant) => Array.from(participant.trackPublications.values()));

          const videoPublication = publishedTracks.find((publication) => publication.track?.kind === Track.Kind.Video);
          const audioPublication = publishedTracks.find((publication) => publication.track?.kind === Track.Kind.Audio);

          if (videoPublication?.videoTrack && videoRef.current) {
            videoPublication.videoTrack.attach(videoRef.current);
          }

          if (audioPublication?.audioTrack && audioRef.current) {
            audioPublication.audioTrack.attach(audioRef.current);
          }
        };

        room.on(RoomEvent.TrackSubscribed, attachRemoteTrack);
        room.on(RoomEvent.ParticipantConnected, attachRemoteTrack);

        await room.connect(join.url, join.token);
        attachRemoteTrack();

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to join live class.');
          setLoading(false);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [liveClassId]);

  if (error) {
    return (
      <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
        {error}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-black">
      {access.watermarkText && (
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
          {access.watermarkText}
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/55 text-white">
          <LoaderCircle className="h-6 w-6 animate-spin" />
          <div className="flex items-center gap-2 text-sm font-medium">
            <Radio className="h-4 w-4" />
            Joining live classroom...
          </div>
        </div>
      )}
      <video ref={videoRef} autoPlay playsInline controls className="h-[420px] w-full bg-black" />
      <audio ref={audioRef} autoPlay />
    </div>
  );
};
