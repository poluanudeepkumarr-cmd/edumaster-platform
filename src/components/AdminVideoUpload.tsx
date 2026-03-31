import React, { useState, useRef } from 'react';
import { Upload, Trash2, Play, Lock, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { EduService } from '../EduService';

interface Video {
  id: string;
  title: string;
  videoUrl?: string;
  durationMinutes?: number;
  premium?: boolean;
  uploadedAt?: string;
  fileSize?: number;
}

interface Module {
  id: string;
  title: string;
  chapters?: Array<{
    id: string;
    title: string;
    lessons: Video[];
  }>;
  lessons: Video[];
}

interface CourseForUpload {
  _id: string;
  title: string;
  modules: Module[];
}

interface AdminVideoUploadProps {
  courses: CourseForUpload[];
  onVideoUploaded?: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
  if (!dateString) return 'Recently added';
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AdminVideoUpload: React.FC<AdminVideoUploadProps> = ({ courses, onVideoUploaded }) => {
  const [selectedCourse, setSelectedCourse] = useState<string>(courses[0]?._id || '');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | 'info' | null;
    message: string;
  }>({ type: null, message: '' });
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentCourse = courses.find((c) => c._id === selectedCourse);
  const currentModule = currentCourse?.modules?.find((m) => m.id === selectedModule);
  const currentChapter = currentModule?.chapters?.find((chapter) => chapter.id === selectedChapter);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Max 500MB
      if (file.size > 500 * 1024 * 1024) {
        setUploadStatus({
          type: 'error',
          message: 'Video file too large. Maximum 500MB allowed.',
        });
        return;
      }

      // Check video type
      const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
      if (!validTypes.includes(file.type)) {
        setUploadStatus({
          type: 'error',
          message: 'Invalid video format. Supported: MP4, WebM, OGG, MOV',
        });
        return;
      }

      setVideoFile(file);
      setUploadStatus({ type: 'info', message: `Selected: ${file.name} (${formatFileSize(file.size)})` });
    }
  };

  const handleUpload = async () => {
    if (!videoFile || !selectedCourse || !selectedModule || !lessonTitle) {
      setUploadStatus({
        type: 'error',
        message: 'Please select course, subject, topic file, and enter a topic title',
      });
      return;
    }

    setUploading(true);
    try {
      await EduService.uploadVideoToModule(
        selectedCourse,
        selectedModule,
        videoFile,
        lessonTitle,
        durationMinutes,
        isPremium,
        selectedChapter || undefined,
      );

      setUploadStatus({
        type: 'success',
        message: `Topic "${lessonTitle}" uploaded successfully!`,
      });

      // Reset form
      setVideoFile(null);
      setLessonTitle('');
      setDurationMinutes(0);
      setIsPremium(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh video list
      await loadModuleVideos();

      // Call callback
      if (onVideoUploaded) {
        onVideoUploaded();
      }
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Upload failed. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  const loadModuleVideos = async () => {
    if (selectedModule && selectedCourse) {
      try {
        const response = await EduService.listVideosInModule(selectedCourse, selectedModule);
        if (Array.isArray(response)) {
          setVideos(response);
        } else if (response && typeof response === 'object' && 'videos' in response) {
          const moduleResponse = response as any;
          const moduleDetails = moduleResponse.module || {};
          if (selectedChapter) {
            const matchedChapter = (moduleDetails.chapters || []).find((chapter: any) => chapter.id === selectedChapter);
            setVideos(matchedChapter?.lessons || []);
          } else {
            setVideos(moduleResponse.videos || []);
          }
        } else {
          setVideos([]);
        }
      } catch (err) {
        console.error('Failed to load topics:', err);
      }
    }
  };

  React.useEffect(() => {
    loadModuleVideos();
  }, [selectedCourse, selectedModule, selectedChapter]);

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this topic?')) {
      return;
    }

    setDeleteLoading(videoId);
    try {
      await EduService.deleteVideoFromModule(selectedCourse, selectedModule, videoId);
      setUploadStatus({
        type: 'success',
        message: 'Topic deleted successfully',
      });
      await loadModuleVideos();
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Delete failed',
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="space-y-6 rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
      <div>
        <h3 className="text-2xl font-semibold text-[var(--ink)]">Video Upload Manager</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Upload topic videos inside a course subject and optional chapter so students see the same learning structure.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Select Course</label>
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setSelectedModule('');
              setSelectedChapter('');
              setVideos([]);
            }}
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]"
          >
            <option value="">-- Choose a course --</option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Select Subject</label>
          <select
            value={selectedModule}
            onChange={(e) => {
              setSelectedModule(e.target.value);
              setSelectedChapter('');
              setVideos([]);
            }}
            disabled={!selectedCourse}
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none disabled:opacity-50 focus:border-[var(--accent-rust)]"
          >
            <option value="">-- Choose a subject --</option>
            {currentCourse?.modules?.map((module) => (
              <option key={module.id} value={module.id}>
                {module.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Select Chapter</label>
          <select
            value={selectedChapter}
            onChange={(e) => {
              setSelectedChapter(e.target.value);
              setVideos([]);
            }}
            disabled={!selectedModule}
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none disabled:opacity-50 focus:border-[var(--accent-rust)]"
          >
            <option value="">-- Save directly under subject --</option>
            {(currentModule?.chapters || []).map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4 rounded-[24px] border-2 border-dashed border-[var(--line)] bg-[var(--accent-cream)] p-6">
        <h4 className="font-semibold text-[var(--ink)]">Upload Topic Video</h4>
        <p className="text-sm text-[var(--ink-soft)]">
          {currentChapter
            ? `This topic will be added inside chapter "${currentChapter.title}".`
            : 'If no chapter is selected, the topic is added directly under the subject.'}
        </p>

        <div>
          <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Topic Video File</label>
          <div
            className="relative rounded-2xl border-2 border-dashed border-[var(--line)] p-6 text-center cursor-pointer transition hover:border-[var(--accent-rust)]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                const input = fileInputRef.current;
                if (input) {
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  input.files = dataTransfer.files;
                  handleVideoSelect({ target: { files: dataTransfer.files } } as any);
                }
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <Upload className="h-8 w-8 text-[var(--accent-rust)]" />
              <div>
                <p className="font-semibold text-[var(--ink)]">Drag & drop or click to select</p>
                <p className="text-sm text-[var(--ink-soft)]">MP4, WebM, OGG, MOV • Max 500MB</p>
              </div>
            </div>
            {videoFile && (
              <div className="mt-3 text-sm text-[var(--ink)]">
                ✓ {videoFile.name} ({formatFileSize(videoFile.size)})
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Topic Title</label>
            <input
              type="text"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="e.g., Topic 1 - Theodolite setup"
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 0)}
              min="0"
              placeholder="0"
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPremium}
            onChange={(e) => setIsPremium(e.target.checked)}
            className="rounded border border-[var(--line)]"
          />
          <span className="text-sm font-medium text-[var(--ink)]">Mark as premium (students must enroll to watch)</span>
        </label>

        {uploadStatus.type && (
          <div
            className={`flex items-start gap-3 rounded-[20px] p-4 ${
              uploadStatus.type === 'success'
                ? 'bg-[var(--success-soft)] text-[var(--success)]'
                : uploadStatus.type === 'error'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-blue-50 text-blue-600'
            }`}
          >
            {uploadStatus.type === 'success' && <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />}
            {uploadStatus.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />}
            {uploadStatus.type === 'info' && <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />}
            <p className="text-sm">{uploadStatus.message}</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || !videoFile || !selectedCourse || !selectedModule || !lessonTitle}
          className="w-full rounded-2xl bg-[var(--accent-rust)] px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader className="h-5 w-5 animate-spin" />
              Uploading topic...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              Upload Topic
            </>
          )}
        </button>
      </div>

      {selectedModule && currentModule && (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-[var(--ink)]">
              Topics in "{currentChapter?.title || currentModule.title}" ({videos.length})
            </h4>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              {currentChapter ? `Chapter inside ${currentModule.title}` : 'Direct topics under the selected subject'}
            </p>
          </div>

          {videos.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-center text-[var(--ink-soft)]">
              No topics uploaded yet. Add one above to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="flex items-start justify-between gap-4 rounded-[20px] border border-[var(--line)] bg-[var(--accent-cream)] p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[var(--ink)]">{video.title}</p>
                      {video.premium && (
                        <div title="Premium - enrolled users only">
                          <Lock className="h-4 w-4 text-[var(--accent-rust)]" />
                        </div>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--ink-soft)]">
                      <span>Duration: {video.durationMinutes || 0} min</span>
                      <span>•</span>
                      <span>Size: {formatFileSize(video.fileSize || 0)}</span>
                      <span>•</span>
                      <span>{formatDate(video.uploadedAt)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => video.videoUrl && window.open(video.videoUrl, '_blank')}
                      disabled={!video.videoUrl}
                      className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)] transition hover:border-[var(--accent-rust)]"
                      title="Preview"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteVideo(video.id)}
                      disabled={deleteLoading === video.id}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      title="Delete"
                    >
                      {deleteLoading === video.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-[24px] bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold mb-2">ℹ️ How it works:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Select a course, then choose the subject and optional chapter where you want to add topics</li>
          <li>Upload one or more topic videos in that learning path</li>
          <li>Mark topics as premium if only enrolled students should access them</li>
          <li>Topics appear automatically in the course curriculum for students</li>
          <li>Manage or delete topics anytime using the buttons above</li>
        </ul>
      </div>
    </div>
  );
};
