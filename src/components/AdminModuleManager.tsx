import React, { useMemo, useState } from 'react';
import { Loader, Pencil, Plus, Trash2 } from 'lucide-react';
import { EduService } from '../EduService';

interface ModuleItem {
  id: string;
  title: string;
  description?: string;
  order?: number;
  lessons?: Array<{ id: string }>;
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

const emptyForm = {
  title: '',
  description: '',
  order: '',
};

export const AdminModuleManager: React.FC<AdminModuleManagerProps> = ({ courses, onModulesChanged }) => {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?._id || '');
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({
    type: null,
    text: '',
  });

  const selectedCourse = useMemo(
    () => courses.find((course) => course._id === selectedCourseId) || null,
    [courses, selectedCourseId],
  );

  const resetForm = () => {
    setEditingModuleId(null);
    setForm(emptyForm);
  };

  const refresh = async () => {
    if (onModulesChanged) {
      await onModulesChanged();
    }
  };

  const handleSubmit = async () => {
    if (!selectedCourseId || !form.title.trim()) {
      setMessage({ type: 'error', text: 'Please choose a course and enter a module title.' });
      return;
    }

    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        ...(form.order.trim() ? { order: Number(form.order) } : {}),
      };

      if (editingModuleId) {
        await EduService.updateCourseModule(selectedCourseId, editingModuleId, payload);
        setMessage({ type: 'success', text: 'Module updated successfully.' });
      } else {
        await EduService.addModuleToCourse(selectedCourseId, payload);
        setMessage({ type: 'success', text: 'Module created successfully.' });
      }

      resetForm();
      await refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to save module right now.',
      });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (module: ModuleItem) => {
    setEditingModuleId(module.id);
    setForm({
      title: module.title || '',
      description: module.description || '',
      order: module.order ? String(module.order) : '',
    });
    setMessage({ type: null, text: '' });
  };

  const handleDelete = async (moduleId: string) => {
    if (!selectedCourseId || !window.confirm('Delete this module and all videos inside it?')) {
      return;
    }

    setBusy(true);
    try {
      await EduService.deleteCourseModule(selectedCourseId, moduleId);
      setMessage({ type: 'success', text: 'Module deleted successfully.' });
      if (editingModuleId === moduleId) {
        resetForm();
      }
      await refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to delete module right now.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
      <div>
        <h3 className="text-2xl font-semibold text-[var(--ink)]">Course Module Manager</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Create, update, and delete modules for existing or newly created courses.
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
                resetForm();
                setMessage({ type: null, text: '' });
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

          <div className="rounded-[24px] border border-[var(--line)] bg-[var(--accent-cream)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-[var(--ink)]">
                {editingModuleId ? 'Edit module' : 'Add module'}
              </h4>
              {editingModuleId && (
                <button
                  onClick={resetForm}
                  className="text-sm font-medium text-[var(--accent-rust)]"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-4">
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Module title"
                className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]"
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Module description"
                className="h-28 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]"
              />
              <input
                type="number"
                min="1"
                value={form.order}
                onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))}
                placeholder="Display order"
                className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent-rust)]"
              />
              <button
                onClick={() => void handleSubmit()}
                disabled={busy || !selectedCourseId || !form.title.trim()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? <Loader className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                {editingModuleId ? 'Update module' : 'Create module'}
              </button>
            </div>

            {message.type && (
              <div
                className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'bg-[var(--success-soft)] text-[var(--success)]'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {message.text}
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-[var(--ink)]">
            Modules in {selectedCourse?.title || 'selected course'}
          </h4>
          <div className="mt-4 space-y-3">
            {(selectedCourse?.modules || []).length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-center text-[var(--ink-soft)]">
                No modules yet. Create one here and it will appear in course details for students too.
              </div>
            ) : (
              (selectedCourse?.modules || []).map((module) => (
                <div
                  key={module.id}
                  className="rounded-[22px] border border-[var(--line)] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--ink)]">{module.title}</p>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {module.description || 'No description added yet.'}
                      </p>
                      <p className="mt-2 text-xs text-[var(--ink-soft)]">
                        Order: {module.order || 'Auto'} • Lessons/videos: {module.lessons?.length || 0}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(module)}
                        className="rounded-lg border border-[var(--line)] bg-[var(--accent-cream)] px-3 py-2 text-[var(--ink)]"
                        title="Edit module"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void handleDelete(module.id)}
                        disabled={busy}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-600 disabled:opacity-50"
                        title="Delete module"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
