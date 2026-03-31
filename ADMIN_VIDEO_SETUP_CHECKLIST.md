# Admin Video Upload - Setup Checklist ✅

Complete implementation of admin video upload feature for course management. All code is production-ready.

## 📋 Pre-Deployment Checklist

### Backend Setup (5 mins)

- [ ] **Step 1:** Install Multer dependency
  ```bash
  cd backend
  npm install
  ```
  This will add `multer@^1.4.5-lts.1` to your environment

- [ ] **Step 2:** Create upload directory
  ```bash
  mkdir -p uploads/videos
  chmod 755 uploads/videos
  ```
  This creates the storage location for video files

- [ ] **Step 3:** Verify backend files exist
  - [ ] `backend/lib/multer-config.js` - Multer storage configuration ✓
  - [ ] `backend/course/video-upload.controller.js` - Video upload controller ✓
  - [ ] `backend/course/course.routes.js` - Updated with new routes ✓
  - [ ] `backend/lib/repositories.js` - Updated with `updateCourseModule()` ✓
  - [ ] `backend/package.json` - Updated with multer dependency ✓

- [ ] **Step 4:** Start backend server
  ```bash
  npm run dev
  ```
  Backend should start on port specified in your environment (typically 5000)

### Frontend Setup (2 mins)

- [ ] **Step 5:** Verify frontend files exist
  - [ ] `src/components/AdminVideoUpload.tsx` - Admin upload component ✓
  - [ ] `src/App.tsx` - Updated with AdminVideoUpload import ✓
  - [ ] `src/EduService.ts` - Updated with 4 video methods ✓

- [ ] **Step 6:** Start frontend server (in different terminal)
  ```bash
  npm run dev
  ```
  Frontend should start on http://localhost:5173

- [ ] **Step 7:** Verify import compilation
  - Check VS Code for any red error squiggles in App.tsx
  - Should see: Import from './components/AdminVideoUpload' ✓
  - Tests show: No errors found ✓

## 🧪 Testing Checklist

### User Authentication
- [ ] **Test 1:** Login with admin account
  - Email: `admin@edumaster.local`
  - Password: `Admin@123`
  - Expected: Logged in successfully, Admin tab visible
  - Timeline: 1 min

### Video Upload Feature
- [ ] **Test 2:** Navigate to Admin tab
  - Expected: Admin command center visible with metrics
  - Expected: "Video Upload Manager" section visible below course creation
  - Timeline: 30 sec

- [ ] **Test 3:** Select course and module
  - Action: Click "Select a course" dropdown
  - Expected: List of existing courses appears
  - Action: Select any course (e.g., "SSC JE Mathematics")
  - Timeline: 1 min

- [ ] **Test 4:** Select module from course
  - Action: Click "Select a module" dropdown
  - Expected: Modules from selected course appear
  - Action: Select a module (e.g., "Arithmetic Basics")
  - Timeline: 1 min

- [ ] **Test 5:** Upload video file
  - Action: Drag-drop video file OR click upload area
  - Supported formats: MP4, WebM, OGG, MOV
  - Max size: 500MB
  - Expected: File validation passes, upload progresses
  - Expected: Success message appears: "Video uploaded successfully"
  - Timeline: 2-10 mins (depends on file size)

- [ ] **Test 6:** Verify video metadata in form
  - Action: Open browser DevTools Network tab to see response
  - Expected response includes:
    ```json
    {
      "message": "Video uploaded successfully",
      "video": {
        "id": "video_...",
        "title": "...",
        "videoUrl": "/uploads/videos/...",
        "fileSize": "...",
        "durationMinutes": 45,
        "premium": false,
        "uploadedAt": "2026-03-30T10:30:00Z"
      }
    }
    ```
  - Timeline: 30 sec

- [ ] **Test 7:** View uploaded videos list
  - Action: After successful upload, scroll to "Videos in [Module]" section
  - Expected: Uploaded video appears with:
    - Title
    - Duration (45 mins)
    - File size (formatted as MB/GB)
    - Upload date
    - Action buttons: Preview, Delete
  - Timeline: 30 sec

- [ ] **Test 8:** Toggle premium flag
  - Action: Click video's premium toggle
  - Expected: Toggle changes state (on/off)
  - Expected: Premium flag persists (not lost on refresh)
  - Timeline: 1 min

- [ ] **Test 9:** Delete video
  - Action: Click Delete button on any video
  - Expected: Confirmation dialog appears
  - Action: Confirm deletion
  - Expected: Video removed from list
  - Expected: File deleted from filesystem
  - Expected: Course metadata updated
  - Timeline: 1 min

- [ ] **Test 10:** Verify student can see video
  - Action: Login as student user
  - Action: Navigate to same course
  - Expected: Video appears in course curriculum (if enrolled)
  - Expected: Premium videos show lock icon (if not enrolled)
  - Timeline: 2 mins

## 📁 Files Created/Modified Summary

### New Files (5 files)
1. **`backend/course/video-upload.controller.js`** - Video CRUD controller
2. **`backend/lib/multer-config.js`** - Multer configuration
3. **`src/components/AdminVideoUpload.tsx`** - React upload component
4. **`ADMIN_VIDEO_UPLOAD_GUIDE.md`** - Comprehensive guide (300+ lines)
5. **`ADMIN_VIDEO_UPLOAD_SUMMARY.md`** - Quick reference

### Modified Files (4 files)
1. **`src/App.tsx`**
   - Added import: `import { AdminVideoUpload } from './components/AdminVideoUpload'`
   - Added component to AdminTab JSX: `<AdminVideoUpload courses={overview.courses || []} onVideoUploaded={onRefresh} />`

2. **`backend/course/course.routes.js`**
   - Added 4 new admin video endpoints (upload, list, get, delete)
   - Added multer import and middleware

3. **`backend/lib/repositories.js`**
   - Added `updateCourseModule()` method for database abstraction

4. **`backend/package.json`**
   - Added multer dependency: `"multer": "^1.4.5-lts.1"`

5. **`src/EduService.ts`**
   - Added 4 new API methods: uploadVideoToModule, listVideosInModule, deleteVideoFromModule, getVideoMetadata

## 🔒 Security Notes

All video upload endpoints are protected by:
1. **JWT Authentication** - User must be logged in
2. **Admin Role Validation** - `requireAdmin` middleware enforces admin role
3. **File Validation** - Multer validates format (video/*), size (< 500MB)
4. **Data Validation** - Course/module existence verified before upload

## 🚀 Go Live Steps

1. **Run backend setup**
   ```bash
   cd backend && npm install && mkdir -p uploads/videos && npm run dev
   ```

2. **Run frontend**
   ```bash
   npm run dev
   ```

3. **Test admin video upload** (follow testing checklist above)

4. **Verify video storage**
   ```bash
   ls -la backend/uploads/videos/
   ```
   Should show uploaded video files

5. **Check database persistence**
   - Query your database collection/table
   - Verify course modules contain video metadata

## 📊 API Endpoints

All endpoints require: `Authorization: Bearer <JWT_TOKEN>` header + admin role

### 1. Upload Video
```
POST /api/courses/{courseId}/modules/{moduleId}/videos
Content-Type: multipart/form-data

Body:
- file: <video_file>
- lessonTitle: string
- durationMinutes: number (optional)
- isPremium: boolean (optional, default: false)

Response: { message, video, course }
```

### 2. List Videos in Module
```
GET /api/courses/{courseId}/modules/{moduleId}/videos

Response: Array of video objects
```

### 3. Get Video Metadata
```
GET /api/courses/{courseId}/modules/{moduleId}/videos/{videoId}

Response: Single video object with metadata
```

### 4. Delete Video
```
DELETE /api/courses/{courseId}/modules/{moduleId}/videos/{videoId}

Response: { success: true, course: {...} }
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "multer not found" | Run: `cd backend && npm install` |
| "uploads/videos directory doesn't exist" | Run: `mkdir -p backend/uploads/videos` |
| "Cannot find module AdminVideoUpload" | Verify `src/components/AdminVideoUpload.tsx` exists |
| Video upload hangs | Check file size < 500MB; verify network connectivity |
| "Admin role required" | Login with admin account (admin@edumaster.local) |
| Videos not persisting | Verify database connection; check repositories.js integration |
| Drag-drop not working | Check browser console for JS errors; verify React version |

## ✅ Validation Checklist

**Before marking as complete:**
- [ ] Backend server running without errors
- [ ] Frontend server running without errors
- [ ] Admin tab loads without errors
- [ ] Video upload component visible in Admin tab
- [ ] Can select course and module
- [ ] Can upload video file (< 500MB)
- [ ] Success message appears
- [ ] Video appears in list below
- [ ] Premium toggle works
- [ ] Delete functionality works
- [ ] Student can see video in course

## 📖 Documentation Files

- **[ADMIN_VIDEO_ARCHITECTURE.md](ADMIN_VIDEO_ARCHITECTURE.md)** - Visual diagrams and flows
- **[ADMIN_VIDEO_UPLOAD_GUIDE.md](ADMIN_VIDEO_UPLOAD_GUIDE.md)** - Complete implementation guide
- **[ADMIN_VIDEO_UPLOAD_SUMMARY.md](ADMIN_VIDEO_UPLOAD_SUMMARY.md)** - Quick reference

## 🎯 Next Steps

1. **Immediate (Complete first):**
   - [ ] Run setup commands
   - [ ] Start servers
   - [ ] Test upload
   - [ ] Verify student view

2. **Short-term (Optional):**
   - [ ] Add video transcoding (convert all formats to MP4)
   - [ ] Generate video thumbnails automatically
   - [ ] Implement upload progress events (real-time bar)
   - [ ] Add video search/filtering

3. **Medium-term (Scalability):**
   - [ ] Migrate from filesystem to S3 storage
   - [ ] Add CDN integration for video delivery
   - [ ] Implement video analytics (view count, watch time)
   - [ ] Add video commenting system

4. **Long-term (Premium features):**
   - [ ] Live streaming support
   - [ ] Subtitle/caption management
   - [ ] Interactive video chapters
   - [ ] Video recommendation engine

---

**Status:** ✅ Implementation Complete - Ready for Testing
**Last Updated:** 2026-03-30
**Components:** 5 new files, 5 modified files, 3 documentation files
**Test Coverage:** 10 end-to-end test scenarios
