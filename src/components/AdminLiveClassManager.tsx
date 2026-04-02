import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, Radio, Trash2, Video } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { EduService } from '../EduService';
import { CourseCard, LiveClass } from '../types';

interface AdminLiveClassManagerProps {
  courses: CourseCard[];
  onChanged: () => Promise<void>;
}

const flattenLessons = (courses: CourseCard[]) =>
  courses.flatMap((course) =>
    (course.modules || []).flatMap((module) => ([
      ...(module.lessons || []).map((lesson) => ({
        courseId: course._id,
        lessonId: lesson.id,
        label: `${course.title} • ${module.title} • ${lesson.title}`,
      })),
      ...((module.chapters || []).flatMap((chapter) =>
        (chapter.lessons || []).map((lesson) => ({
          courseId: course._id,
          lessonId: lesson.id,
          label: `${course.title} • ${module.title} • ${chapter.title} • ${lesson.title}`,
        })))),
    ])));

const createInitialForm = () => ({
  courseId: '',
  moduleId: '',
  chapterId: '',
  title: '',
  instructor: '',
  startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  durationMinutes: 90,
  provider: 'EduMaster Live',
  mode: 'live',
  status: 'scheduled',
  livePlaybackType: 'jitsi',
  livePlaybackUrl: '',
  embedUrl: '',
  roomUrl: '',
  recordingUrl: '',
  replayCourseId: '',
  replayLessonId: '',
  attendees: 0,
  maxAttendees: 1000,
  chatEnabled: true,
  doubtSolving: true,
  replayAvailable: true,
  requiresEnrollment: true,
  topicTags: '',
});

export const AdminLiveClassManager: React.FC<AdminLiveClassManagerProps> = ({
  courses,
  onChanged,
}) => {
  const [form, setForm] = useState(createInitialForm());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [studioActive, setStudioActive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const replayLessons = useMemo(() => flattenLessons(courses), [courses]);
  const selectedCourse = useMemo(
    () => courses.find((course) => course._id === form.courseId) || null,
    [courses, form.courseId],
  );
  const selectedModule = useMemo(
    () => selectedCourse?.modules?.find((module) => module.id === form.moduleId) || null,
    [selectedCourse, form.moduleId],
  );
  const jitsiMeetDomain = (import.meta.env.VITE_JITSI_MEET_DOMAIN || 'meet.jit.si').trim();

  useEffect(() => {
    let cancelled = false;
    void EduService.getAdminLiveClasses().then((data) => {
      if (!cancelled) {
        setLiveClasses(data);
      }
    }).catch(() => {
      if (!cancelled) {
        setLiveClasses([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const fillFromLiveClass = (liveClass: LiveClass) => {
    setSelectedId(liveClass._id);
    setForm({
      courseId: liveClass.courseId || '',
      moduleId: liveClass.moduleId || '',
      chapterId: liveClass.chapterId || '',
      title: liveClass.title,
      instructor: liveClass.instructor,
      startTime: liveClass.startTime.slice(0, 16),
      durationMinutes: liveClass.durationMinutes,
      provider: liveClass.provider,
      mode: liveClass.mode || 'live',
      status: liveClass.status || 'scheduled',
      livePlaybackType: liveClass.livePlaybackType || 'hls',
      livePlaybackUrl: liveClass.livePlaybackUrl || '',
      embedUrl: liveClass.embedUrl || '',
      roomUrl: liveClass.roomUrl || '',
      recordingUrl: liveClass.recordingUrl || '',
      replayCourseId: liveClass.replayCourseId || '',
      replayLessonId: liveClass.replayLessonId || '',
      attendees: liveClass.attendees || 0,
      maxAttendees: liveClass.maxAttendees || 1000,
      chatEnabled: liveClass.chatEnabled !== false,
      doubtSolving: liveClass.doubtSolving !== false,
      replayAvailable: liveClass.replayAvailable !== false,
      requiresEnrollment: liveClass.requiresEnrollment !== false,
      topicTags: (liveClass.topicTags || []).join(', '),
    });
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm(createInitialForm());
  };

  const buildPayload = () => ({
    ...form,
    courseId: form.courseId || null,
    moduleId: form.moduleId || null,
    chapterId: form.chapterId || null,
    moduleTitle: selectedModule?.title || null,
    chapterTitle: selectedModule?.chapters?.find((chapter) => chapter.id === form.chapterId)?.title || null,
    replayCourseId: form.replayCourseId || null,
    replayLessonId: form.replayLessonId || null,
    topicTags: form.topicTags.split(',').map((item) => item.trim()).filter(Boolean),
    startTime: new Date(form.startTime).toISOString(),
  });

  const buildJitsiUrls = (liveClassId: string) => {
    const roomSeed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const roomName = `EduMaster-${liveClassId}-${roomSeed}`.replace(/[^A-Za-z0-9-]/g, '');
    const roomUrl = `https://${jitsiMeetDomain}/${roomName}`;
    const embedUrl = `${roomUrl}#config.prejoinPageEnabled=false&config.requireDisplayName=false&config.disableDeepLinking=true&config.startWithAudioMuted=false&config.startWithVideoMuted=false&interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true`;
    return { roomName, roomUrl, embedUrl };
  };

  const refreshLiveData = async () => {
    await onChanged();
    setLiveClasses(await EduService.getAdminLiveClasses());
  };

  const attachPreviewStream = (stream: MediaStream | null) => {
    if (previewRef.current) {
      previewRef.current.srcObject = stream;
    }
  };

  const stopLocalStudio = () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    attachPreviewStream(null);
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (selectedId) {
        await EduService.updateLiveClass(selectedId, buildPayload());
        setMessage('Live class updated.');
      } else {
        await EduService.createLiveClass(buildPayload());
        setMessage('Live class scheduled.');
      }

      await refreshLiveData();
      resetForm();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (liveClassId: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await EduService.deleteLiveClass(liveClassId);
      setMessage('Live class deleted.');
      if (selectedId === liveClassId) {
        resetForm();
      }
      await refreshLiveData();
    } finally {
      setBusy(false);
    }
  };

  const startNow = async () => {
    if (!selectedId) {
      return;
    }

    if (!form.courseId || !form.moduleId) {
      setStudioError('Choose course and subject so the recording can be saved under the correct path.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStudioError('This browser does not support camera and microphone capture.');
      return;
    }

    setBusy(true);
    setMessage(null);
    setStudioError(null);
    try {
      if (form.livePlaybackType === 'jitsi') {
        const { roomUrl, embedUrl } = buildJitsiUrls(selectedId);
        const nextPayload = {
          ...buildPayload(),
          livePlaybackType: 'jitsi',
          embedUrl,
          roomUrl,
          livePlaybackUrl: null,
          provider: 'Jitsi Meet',
        };
        await EduService.updateLiveClass(selectedId, nextPayload);
        await EduService.startLiveClass(selectedId);
        setForm((current) => ({
          ...current,
          livePlaybackType: 'jitsi',
          embedUrl,
          roomUrl,
          livePlaybackUrl: '',
          provider: 'Jitsi Meet',
        }));
        setStudioActive(true);
        setViewerCount(0);
        setMessage('Free Jitsi live class started inside the app.');
        await refreshLiveData();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      localStreamRef.current = stream;
      attachPreviewStream(stream);
      recordedChunksRef.current = [];

      if (typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(
          stream,
          MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? { mimeType: 'video/webm;codecs=vp9,opus' }
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
              ? { mimeType: 'video/webm;codecs=vp8,opus' }
              : undefined,
        );
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      }

      await EduService.updateLiveClass(selectedId, {
        ...buildPayload(),
        livePlaybackType: 'livekit',
        livePlaybackUrl: null,
        embedUrl: null,
        roomUrl: null,
        provider: 'EduMaster Live Studio',
      });
      await EduService.startLiveClass(selectedId);

      const join = await EduService.getLiveKitJoinToken(selectedId, 'host');
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;
      room.on(RoomEvent.ParticipantConnected, () => {
        setViewerCount(room.numParticipants > 0 ? room.numParticipants - 1 : 0);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setViewerCount(room.numParticipants > 0 ? room.numParticipants - 1 : 0);
      });

      await room.connect(join.url, join.token, {
        autoSubscribe: true,
      });

      await Promise.all(stream.getTracks().map(async (mediaTrack) => {
        await room.localParticipant.publishTrack(mediaTrack, {
          source: mediaTrack.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone,
        });
      }));

      setStudioActive(true);
      setViewerCount(room.numParticipants > 0 ? room.numParticipants - 1 : 0);
      setMessage('Live class started inside the app.');
      await refreshLiveData();
    } catch (error) {
      stopLocalStudio();
      setStudioActive(false);
      setStudioError(error instanceof Error ? error.message : 'Unable to start in-app live studio.');
    } finally {
      setBusy(false);
    }
  };

  const endNow = async () => {
    if (!selectedId) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setStudioError(null);
    try {
      if (form.livePlaybackType === 'jitsi') {
        await EduService.updateLiveClass(selectedId, {
          ...buildPayload(),
          replayAvailable: false,
        });
        await EduService.endLiveClass(selectedId, {
          ...buildPayload(),
          replayAvailable: false,
          recordingUrl: null,
        });
        setStudioActive(false);
        setViewerCount(0);
        setMessage('Jitsi live class ended. Free test mode does not auto-save recording.');
        await refreshLiveData();
        resetForm();
        return;
      }

      let recordedFile: File | null = null;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        recordedFile = await new Promise<File | null>((resolve) => {
          const recorder = mediaRecorderRef.current;
          recorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
            if (!blob.size) {
              resolve(null);
              return;
            }

            const extension = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
            resolve(new File([blob], `${form.title.replace(/\s+/g, '-').toLowerCase()}-recording.${extension}`, {
              type: recorder.mimeType || `video/${extension}`,
            }));
          };
          recorder.stop();
        });
      }

      stopLocalStudio();
      setStudioActive(false);
      setViewerCount(0);

      let replayLessonId = form.replayLessonId || null;
      if (recordedFile && form.courseId && form.moduleId) {
        const upload = await EduService.uploadVideoToModule(
          form.courseId,
          form.moduleId,
          recordedFile,
          `${form.title} Recording`,
          form.durationMinutes,
          true,
          form.chapterId || undefined,
        ) as any;
        replayLessonId = upload?.video?.id || replayLessonId;
      }

      await EduService.updateLiveClass(selectedId, {
        ...buildPayload(),
        livePlaybackType: 'livekit',
        replayCourseId: form.courseId || null,
        replayLessonId,
        recordingUrl: null,
      });
      await EduService.endLiveClass(selectedId, {
        ...buildPayload(),
        replayCourseId: form.courseId || null,
        replayLessonId,
        recordingUrl: null,
        replayAvailable: true,
      });
      setMessage('Live class ended and replay metadata saved.');
      await refreshLiveData();
      resetForm();
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : 'Unable to stop live studio cleanly.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => () => {
    mediaRecorderRef.current?.state !== 'inactive' && mediaRecorderRef.current?.stop();
    stopLocalStudio();
  }, []);

  return (
    <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">Live operations</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Schedule live classes</h2>
        </div>
        <button onClick={resetForm} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--ink)]">
          New live class
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <select
            value={form.courseId}
            onChange={(event) => setForm((current) => ({
              ...current,
              courseId: event.target.value,
              moduleId: '',
              chapterId: '',
            }))}
            className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none"
          >
            <option value="">No course lock</option>
            {courses.map((course) => <option key={course._id} value={course._id}>{course.title}</option>)}
          </select>
          <select
            value={form.moduleId}
            onChange={(event) => setForm((current) => ({ ...current, moduleId: event.target.value, chapterId: '' }))}
            className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none"
            disabled={!selectedCourse}
          >
            <option value="">{selectedCourse ? 'Choose subject' : 'Choose course first'}</option>
            {(selectedCourse?.modules || []).map((module) => (
              <option key={module.id} value={module.id}>{module.title}</option>
            ))}
          </select>
          <select
            value={form.chapterId}
            onChange={(event) => setForm((current) => ({ ...current, chapterId: event.target.value }))}
            className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none"
            disabled={!selectedModule || !selectedModule.chapters?.length}
          >
            <option value="">{selectedModule?.chapters?.length ? 'Whole subject or choose chapter' : 'No chapter split'}</option>
            {(selectedModule?.chapters || []).map((chapter) => (
              <option key={chapter.id} value={chapter.id}>{chapter.title}</option>
            ))}
          </select>
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Live class title" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <input value={form.instructor} onChange={(event) => setForm((current) => ({ ...current, instructor: event.target.value }))} placeholder="Instructor" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <input type="datetime-local" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <input type="number" value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} placeholder="Duration minutes" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <input value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} placeholder="Provider label" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <select value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value }))} className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none">
            <option value="live">Live</option>
            <option value="replay">Replay</option>
          </select>
          <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none">
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="ended">Ended</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={form.livePlaybackType} onChange={(event) => setForm((current) => ({ ...current, livePlaybackType: event.target.value }))} className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none">
            <option value="jitsi">Free Jitsi testing</option>
            <option value="livekit">Production live studio</option>
            <option value="hls">Protected HLS stream</option>
            <option value="iframe">Embedded room / player</option>
          </select>
          <input value={form.livePlaybackUrl} onChange={(event) => setForm((current) => ({ ...current, livePlaybackUrl: event.target.value }))} placeholder="Live playback URL (.m3u8 or mp4)" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <input value={form.embedUrl} onChange={(event) => setForm((current) => ({ ...current, embedUrl: event.target.value }))} placeholder="Embed URL (optional)" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <input value={form.roomUrl} onChange={(event) => setForm((current) => ({ ...current, roomUrl: event.target.value }))} placeholder="Fallback room URL" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <input value={form.recordingUrl} onChange={(event) => setForm((current) => ({ ...current, recordingUrl: event.target.value }))} placeholder="External replay URL (optional)" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <select value={`${form.replayCourseId}::${form.replayLessonId}`} onChange={(event) => {
            const [replayCourseId, replayLessonId] = event.target.value.split('::');
            setForm((current) => ({ ...current, replayCourseId: replayCourseId || '', replayLessonId: replayLessonId || '' }));
          }} className="md:col-span-2 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none">
            <option value="::">Attach protected replay lesson later</option>
            {replayLessons.map((lesson) => (
              <option key={`${lesson.courseId}:${lesson.lessonId}`} value={`${lesson.courseId}::${lesson.lessonId}`}>
                {lesson.label}
              </option>
            ))}
          </select>
          <input value={form.topicTags} onChange={(event) => setForm((current) => ({ ...current, topicTags: event.target.value }))} placeholder="Comma-separated tags" className="md:col-span-2 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
            <input type="number" value={form.attendees} onChange={(event) => setForm((current) => ({ ...current, attendees: Number(event.target.value) }))} placeholder="Expected attendees" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input type="number" value={form.maxAttendees} onChange={(event) => setForm((current) => ({ ...current, maxAttendees: Number(event.target.value) }))} placeholder="Capacity target" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
          </div>
          <div className="md:col-span-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { key: 'chatEnabled', label: 'Chat enabled' },
              { key: 'doubtSolving', label: 'Doubt solving' },
              { key: 'replayAvailable', label: 'Replay visible' },
              { key: 'requiresEnrollment', label: 'Enrollment required' },
            ].map((toggle) => (
              <label key={toggle.key} className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-3 text-sm font-medium text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={Boolean(form[toggle.key as keyof typeof form])}
                  onChange={(event) => setForm((current) => ({ ...current, [toggle.key]: event.target.checked }))}
                />
                {toggle.label}
              </label>
            ))}
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button onClick={() => void submit()} disabled={busy} className="rounded-2xl bg-[var(--ink)] px-5 py-4 font-semibold text-white disabled:opacity-60">
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : selectedId ? 'Update live class' : 'Schedule live class'}
            </button>
            {selectedId && (
              <>
                <button onClick={() => void startNow()} disabled={busy} className="rounded-2xl bg-[var(--accent-rust)] px-5 py-4 font-semibold text-white disabled:opacity-60">
                  Start live now
                </button>
                <button onClick={() => void endNow()} disabled={busy} className="rounded-2xl border border-[var(--line)] bg-white px-5 py-4 font-semibold text-[var(--ink)] disabled:opacity-60">
                  End and publish replay
                </button>
              </>
            )}
            {message && <div className="rounded-2xl bg-[var(--success-soft)] px-4 py-4 text-sm text-[var(--success)]">{message}</div>}
            {studioError && <div className="rounded-2xl bg-[var(--danger-soft)] px-4 py-4 text-sm text-[var(--danger)]">{studioError}</div>}
          </div>
          {selectedId && (
            <div className="md:col-span-2 rounded-[24px] border border-[var(--line)] bg-[var(--accent-cream)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">In-app live studio</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    Admin camera and mic stream directly from this application. When you end the live, the recording is uploaded back into the selected course path.
                  </p>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                  {studioActive ? `${viewerCount} live viewer${viewerCount === 1 ? '' : 's'}` : 'Studio idle'}
                </div>
              </div>
              <div className="mt-4 overflow-hidden rounded-[22px] bg-black">
                {form.livePlaybackType === 'jitsi' && studioActive && form.embedUrl ? (
                  <iframe
                    src={form.embedUrl}
                    title="Jitsi live studio"
                    allow="camera; microphone; fullscreen; display-capture; autoplay"
                    className="h-[260px] w-full bg-black"
                  />
                ) : (
                  <video ref={previewRef} autoPlay muted playsInline className="h-[260px] w-full bg-black object-cover" />
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <Video className="h-4 w-4" />
                {form.livePlaybackType === 'jitsi'
                  ? (studioActive ? 'Jitsi room is live inside the app for free testing.' : 'Start the Jitsi room to teach inside the app for free testing.')
                  : (studioActive ? 'Camera and microphone are broadcasting from the admin browser.' : 'Preview will appear here when you start the live studio.')}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {liveClasses.map((liveClass) => (
            <div key={liveClass._id} className="rounded-[24px] border border-[var(--line)] bg-[var(--accent-cream)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                    <Radio className="h-4 w-4" />
                    {liveClass.status || liveClass.mode}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--ink)]">{liveClass.title}</h3>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{liveClass.provider} • {liveClass.attendees}/{liveClass.maxAttendees || 1000}</p>
                  {(liveClass.courseId || liveClass.moduleTitle || liveClass.chapterTitle) && (
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                      {[liveClass.moduleTitle || 'Course replay', liveClass.chapterTitle].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
                <button onClick={() => void remove(liveClass._id)} disabled={busy} className="rounded-2xl border border-[var(--line)] p-3 text-[var(--ink-soft)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-[var(--ink-soft)]">{new Date(liveClass.startTime).toLocaleString('en-IN')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => fillFromLiveClass(liveClass)} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)]">
                  Edit
                </button>
                {(liveClass.topicTags || []).slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-3 py-2 text-xs text-[var(--ink-soft)]">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
