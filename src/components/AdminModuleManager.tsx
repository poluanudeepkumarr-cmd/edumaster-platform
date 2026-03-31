import React, { useMemo, useState } from 'react';
import { BookCopy, Loader, Pencil, Plus, Rows3, Trash2 } from 'lucide-react';
import { EduService } from '../EduService';

interface ChapterItem {
  id: string;
  title: string;
  description?: string;
  order?: number;
  lessons?: Array<{ id: string }>;
}

interface ModuleItem {
  id: string;
  title: string;
  description?: string;
  order?: number;
  lessons?: Array<{ id: string }>;
  chapters?: ChapterItem[];
}

interface CourseItem {
  _id: string;
  title: string;
  modules: ModuleItem[];
}

interface AdminModuleManagerProps {
  courses: CourseItem[];
  onModulesChanged?: () => void | Promise<void>;
}

const emptyForm = { title: '', description: '', order: '' };

export const AdminModuleManager: React.FC<AdminModuleManagerProps> = ({ courses, onModulesChanged }) => {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?._id || '');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState(emptyForm);
  const [chapterForm, setChapterForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  const selectedCourse = useMemo(
    () => courses.find((course) => course._id === selectedCourseId) || null,
    [courses, selectedCourseId],
  );
  const selectedModule = useMemo(
    () => selectedCourse?.modules.find((module) => module.id === selectedModuleId) || null,
    [selectedCourse, selectedModuleId],
  );

  const refresh = async () => {
    if (onModulesChanged) {
      await onModulesChanged();
    }
  };

  const resetModuleForm = () => {
    setEditingModuleId(null);
    setModuleForm(emptyForm);
  };

  const resetChapterForm = () => {
    setEditingChapterId(null);
    setChapterForm(emptyForm);
  };

  const startEditModule = (module: ModuleItem) => {
    setEditingModuleId(module.id);
    setModuleForm({
      title: module.title || '',
      description: module.description || '',
      order: module.order ? String(module.order) : '',
    });
    setSelectedModuleId(module.id);
    setMessage({ type: null, text: '' });
  };

  const startEditChapter = (chapter: ChapterItem) => {
    setEditingChapterId(chapter.id);
    setChapterForm({
      title: chapter.title || '',
      description: chapter.description || '',
      order: chapter.order ? String(chapter.order) : '',
    });
    setMessage({ type: null, text: '' });
  };

  const handleModuleSubmit = async () => {
    if (!selectedCourseId || !moduleForm.title.trim()) {
      setMessage({ type: 'error', text: 'Please choose a course and enter a subject name.' });
      return;
    }

    setBusy(true);
    try {
      const payload = {
        title: moduleForm.title.trim(),
        description: moduleForm.description.trim(),
        ...(moduleForm.order.trim() ? { order: Number(moduleForm.order) } : {}),
      };

      if (editingModuleId) {
        await EduService.updateCourseModule(selectedCourseId, editingModuleId, payload);
        setMessage({ type: 'success', text: 'Subject updated successfully.' });
      } else {
        await EduService.addModuleToCourse(selectedCourseId, payload);
        setMessage({ type: 'success', text: 'Subject created successfully.' });
      }

      resetModuleForm();
      await refresh();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save subject right now.' });
    } finally {
      setBusy(false);
    }
  };

  const handleChapterSubmit = async () => {
    if (!selectedCourseId || !selectedModuleId || !chapterForm.title.trim()) {
      setMessage({ type: 'error', text: 'Choose a subject and enter a chapter title.' });
      return;
    }

    setBusy(true);
    try {
      const payload = {
        title: chapterForm.title.trim(),
        description: chapterForm.description.trim(),
        ...(chapterForm.order.trim() ? { order: Number(chapterForm.order) } : {}),
      };

      if (editingChapterId) {
        await EduService.updateChapterInModule(selectedCourseId, selectedModuleId, editingChapterId, payload);
        setMessage({ type: 'success', text: 'Chapter updated successfully.' });
      } else {
        await EduService.addChapterToModule(selectedCourseId, selectedModuleId, payload);
        setMessage({ type: 'success', text: 'Chapter created successfully.' });
      }

      resetChapterForm();
      await refresh();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save chapter right now.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!selectedCourseId || !window.confirm('Delete this subject and all chapters/topics inside it?')) {
      return;
    }

    setBusy(true);
    try {
      await EduService.deleteCourseModule(selectedCourseId, moduleId);
      if (selectedModuleId === moduleId) {
        setSelectedModuleId('');
      }
      resetModuleForm();
      resetChapterForm();
      setMessage({ type: 'success', text: 'Subject deleted successfully.' });
      await refresh();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to delete subject right now.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!selectedCourseId || !selectedModuleId || !window.confirm('Delete this chapter and its topics?')) {
      return;
    }

    setBusy(true);
    try {
      await EduService.deleteChapterFromModule(selectedCourseId, selectedModuleId, chapterId);
      if (editingChapterId === chapterId) {
        resetChapterForm();
      }
      setMessage({ type: 'success', text: 'Chapter deleted successfully.' });
      await refresh();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to delete chapter right now.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
      <div>
        <h3 className="text-2xl font-semibold text-[var(--ink)]">Subject, Chapter & Topic Structure</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Build your learning tree as course → subject → chapter. Videos/topics added under a chapter appear for students in the same structure.
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--ink)]">Select Course</label>
            <select
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSelectedModuleId('');
                resetModuleForm();
                resetChapterForm();
                setMessage({ type: null, text: '' });
              }}
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]"
            >
              <option value="">-- Choose a course --</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>{course.title}</option>
              ))}
            </select>
          </div>

          <div className="rounded-[24px] border border-[var(--line)] bg-[var(--accent-cream)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-[var(--ink)]">{editingModuleId ? 'Edit subject' : 'Add subject'}</h4>
              {editingModuleId && <button onClick={resetModuleForm} className="text-sm font-medium text-[var(--accent-rust)]">Cancel edit</button>}
            </div>
            <div className="mt-4 grid gap-4">
              <input value={moduleForm.title} onChange={(event) => setModuleForm((current) => ({ ...current, title: event.target.value }))} placeholder="Subject title, e.g. Surveying" className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]" />
              <textarea value={moduleForm.description} onChange={(event) => setModuleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Subject description" className="h-24 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]" />
              <input type="number" min="1" value={moduleForm.order} onChange={(event) => setModuleForm((current) => ({ ...current, order: event.target.value }))} placeholder="Display order" className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]" />
              <button onClick={() => void handleModuleSubmit()} disabled={busy || !selectedCourseId || !moduleForm.title.trim()} className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50">
                {busy ? <Loader className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                {editingModuleId ? 'Update subject' : 'Create subject'}
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--line)] bg-[var(--accent-cream)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-[var(--ink)]">{editingChapterId ? 'Edit chapter' : 'Add chapter'}</h4>
              {editingChapterId && <button onClick={resetChapterForm} className="text-sm font-medium text-[var(--accent-rust)]">Cancel edit</button>}
            </div>
            <div className="mt-4 grid gap-4">
              <select value={selectedModuleId} onChange={(event) => setSelectedModuleId(event.target.value)} className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]">
                <option value="">-- Choose subject --</option>
                {(selectedCourse?.modules || []).map((module) => (
                  <option key={module.id} value={module.id}>{module.title}</option>
                ))}
              </select>
              <input value={chapterForm.title} onChange={(event) => setChapterForm((current) => ({ ...current, title: event.target.value }))} placeholder="Chapter title, e.g. Theodolite" className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]" />
              <textarea value={chapterForm.description} onChange={(event) => setChapterForm((current) => ({ ...current, description: event.target.value }))} placeholder="Chapter description" className="h-24 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]" />
              <input type="number" min="1" value={chapterForm.order} onChange={(event) => setChapterForm((current) => ({ ...current, order: event.target.value }))} placeholder="Display order" className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]" />
              <button onClick={() => void handleChapterSubmit()} disabled={busy || !selectedCourseId || !selectedModuleId || !chapterForm.title.trim()} className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white disabled:opacity-50">
                {busy ? <Loader className="h-5 w-5 animate-spin" /> : <BookCopy className="h-5 w-5" />}
                {editingChapterId ? 'Update chapter' : 'Create chapter'}
              </button>
            </div>
          </div>

          {message.type && (
            <div className={`rounded-2xl px-4 py-3 text-sm ${message.type === 'success' ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-red-50 text-red-600'}`}>
              {message.text}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-[var(--ink)]">Structure in {selectedCourse?.title || 'selected course'}</h4>
          {(selectedCourse?.modules || []).length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-center text-[var(--ink-soft)]">
              No subjects yet. Start by creating a subject like Surveying.
            </div>
          ) : (
            (selectedCourse?.modules || []).map((module) => (
              <div key={module.id} className="rounded-[22px] border border-[var(--line)] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Rows3 className="h-4 w-4 text-[var(--accent-rust)]" />
                      <p className="font-semibold text-[var(--ink)]">{module.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">{module.description || 'No subject description yet.'}</p>
                    <p className="mt-2 text-xs text-[var(--ink-soft)]">Chapters: {module.chapters?.length || 0} • Direct topics: {module.lessons?.length || 0}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEditModule(module)} className="rounded-lg border border-[var(--line)] bg-[var(--accent-cream)] px-3 py-2 text-[var(--ink)]" title="Edit subject"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => void handleDeleteModule(module.id)} disabled={busy} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-600 disabled:opacity-50" title="Delete subject"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {(module.chapters || []).length === 0 ? (
                    <div className="rounded-2xl bg-[var(--accent-cream)] px-4 py-3 text-sm text-[var(--ink-soft)]">
                      No chapters yet. Add one like Theodolite under this subject.
                    </div>
                  ) : (
                    (module.chapters || []).map((chapter) => (
                      <div key={chapter.id} className="rounded-2xl bg-[var(--accent-cream)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-[var(--ink)]">{chapter.title}</p>
                            <p className="mt-1 text-sm text-[var(--ink-soft)]">{chapter.description || 'No chapter description yet.'}</p>
                            <p className="mt-2 text-xs text-[var(--ink-soft)]">Topics/videos: {chapter.lessons?.length || 0}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setSelectedModuleId(module.id); startEditChapter(chapter); }} className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)]"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => { setSelectedModuleId(module.id); void handleDeleteChapter(chapter.id); }} disabled={busy} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
