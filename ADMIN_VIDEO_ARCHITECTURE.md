# Video Upload System - Architecture Diagram

## Data Flow: Admin Uploading Video

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN UI (React)                        │
│                    (AdminVideoUpload.tsx)                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Select Course Dropdown → Select Module Dropdown         │  │
│  │ Drag-Drop Video File                                    │  │
│  │ Enter: Title, Duration, Premium Toggle                 │  │
│  │ Click: Upload  →  Delete  →  Preview                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                 EduService.uploadVideoToModule()
                 {FormData with file + metadata}
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ROOT EXPRESS SERVER                          │
│                      (server.ts)                                │
│                                                                 │
│  Route: POST /backend/api/courses/:courseId/modules/...        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND API LAYER (Express)                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │    Backend Course Routes (course.routes.js)             │  │
│  │                                                          │  │
│  │  1. Multer middleware (validate file)                   │  │
│  │  2. Admin middleware (check role)                       │  │
│  │  3. Video Upload Controller                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│    VIDEO UPLOAD CONTROLLER (video-upload.controller.js)        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ uploadVideoToModule():                                   │  │
│  │   ✓ Validate file (type, size)                          │  │
│  │   ✓ Generate unique filename                            │  │
│  │   ✓ Move to uploads/videos/                             │  │
│  │   ✓ Update course.modules[].lessons[]                   │  │
│  │   ✓ Store metadata (size, date, duration)               │  │
│  │   ✓ Return video object                                 │  │
│  │                                                          │  │
│  │ deleteVideoFromModule():                                │  │
│  │   ✓ Find video by ID                                    │  │
│  │   ✓ Delete file from disk                               │  │
│  │   ✓ Update course metadata                              │  │
│  │                                                          │  │
│  │ listVideosInModule():                                   │  │
│  │   ✓ Query module lessons                                │  │
│  │   ✓ Return all videos                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Filesystem      │  │   Database       │
        │  /uploads/       │  │  (MongoDB/       │
        │   videos/        │  │   PostgreSQL)    │
        │                  │  │                  │
        │  ✓ lesson-1.mp4  │  │  course {        │
        │  ✓ lesson-2.webm │  │    modules: [{   │
        │  ✓ lesson-3.ogg  │  │      lessons: [{ │
        │                  │  │        id: '...' │
        │  Total: 500MB    │  │        title:... │
        │  Max per file    │  │        videoUrl: │
        │                  │  │        premium:..│
        │                  │  │      }]          │
        │                  │  │    }]            │
        │                  │  │  }               │
        └──────────────────┘  └──────────────────┘
```

## Data Structure: Course with Videos

```typescript
// Before: Course without videos
Course {
  _id: "course_123"
  title: "SSC JE Mathematics"
  modules: [ ]           // Empty
}

         │
         │ Admin creates module and uploads videos
         ▼

// After: Course with videos organized by modules
Course {
  _id: "course_123"
  title: "SSC JE Mathematics"
  category: "SSC JE"
  modules: [
    {
      id: "module_arithmetic",
      title: "Arithmetic Basics",
      lessons: [
        {
          id: "video_1234567890",
          title: "Numbers & Operations",
          type: "video",
          videoUrl: "/uploads/videos/lesson-1234567890.mp4",
          durationMinutes: 45,
          premium: false,
          fileSize: 524288000,
          mimeType: "video/mp4",
          uploadedAt: "2026-03-30T10:30:00Z",
          uploadedBy: "admin_user_id"
        },
        {
          id: "video_0987654321",
          title: "Addition & Subtraction",
          type: "video",
          videoUrl: "/uploads/videos/lesson-0987654321.mp4",
          durationMinutes: 38,
          premium: false,
          fileSize: 419430400,
          mimeType: "video/mp4",
          uploadedAt: "2026-03-30T10:35:00Z",
          uploadedBy: "admin_user_id"
        }
      ]
    },
    {
      id: "module_geometry",
      title: "Geometry Basics",
      lessons: [
        {
          id: "video_1111222233",
          title: "Points & Lines",
          type: "video",
          videoUrl: "/uploads/videos/lesson-1111222233.mp4",
          durationMinutes: 50,
          premium: true,      // ← Premium: enrollment required
          fileSize: 629856000,
          mimeType: "video/mp4",
          uploadedAt: "2026-03-30T11:00:00Z",
          uploadedBy: "admin_user_id"
        }
      ]
    }
  ]
}
```

## Workflow: Upload to Student View

```
ADMIN SIDE:                          STUDENT SIDE:
─────────────────────────────────────────────────────

┌────────────────────┐
│ Admin Panel        │
│ Video Uploader     │          (Not visible yet)
└────────┬───────────┘
         │
         │ Upload video to:
         │ Course: SSC JE Math
         │ Module: Arithmetic
         │
         ▼
┌────────────────────┐
│ File Storage       │
│ uploads/videos/    │          ✓ Course appears
│  lesson-1.mp4      │            in student catalog
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Database Update    │
│ course.modules[0]  │
│  .lessons[]        │
└────────┬───────────┘
         │              ┌──────────────────────────┐
         └─────────────→│ Student Refreshes        │
                        │ Dashboard Hydration      │
                        │ (Get platform overview)  │
                        └────────────┬─────────────┘
                                     │
                                     ▼
                        ┌──────────────────────────┐
                        │ Course appears in UI     │
                        │ Modules visible          │
                        │ Videos in module list    │
                        │                          │
                        │ If FREE: Play button     │
                        │ If PREMIUM:              │
                        │   - Show lock icon       │
                        │   - "Enroll to watch"    │
                        └──────────────────────────┘
```

## File Upload Flow

```
User selects video
       │
       ▼
┌─────────────────────┐
│ Client Validation   │
│ • File size check   │
│ • Type check (video)│
│ • Show preview      │
└─────────┬───────────┘
          │
    (Valid? → Upload)
          │
          ▼
┌─────────────────────┐
│ Multer              │
│ (Upload Middleware) │
│                     │
│ • Receive file      │
│ • Parse form data   │
│ • Store temp file   │
│ • Validate again    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Video Controller    │
│                     │
│ • Generate ID       │
│ • Create filename   │
│ • Move to permanent │
│ • Create metadata   │
│ • Update course     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Success Response    │
│                     │
│ ✓ Video saved       │
│ ✓ Metadata stored   │
│ ✓ Return video obj  │
└─────────────────────┘
```

## User Hierarchy

```
                    ┌──────────────────┐
                    │   Student User   │
                    │                  │
                    │ Can:             │
                    │ • View courses   │
                    │ • Enroll courses │
                    │ • Watch videos   │
                    │ • Track progress │
                    └──────────────────┘


                    ┌──────────────────┐
                    │   Admin User     │
                    │                  │
                    │ Can:             │
                    │ • Create courses │
                    │ • Upload videos  │
                    │ • Manage videos  │
                    │ • View analytics │
                    │ • Seed data      │
                    └──────────────────┘


        Request Flow for Video Upload:
        ────────────────────────────────

        Admin Browser
            │
            ├─→ POST /courses/:id/modules/:id/videos
            │   (with JWT + Admin role)
            │
            ├─→ Multer validates file
            │
            └─→ Controller stores file + metadata
                   │
                   ├─→ Save to disk: /uploads/videos/
                   └─→ Update in DB: course.modules
                       │
                       └─→ Response: Success + video object
                           │
                           └─→ Admin UI: "Video uploaded!"
                               Student UI: Video now playable
```

## Permission Model

```
┌──────────────────────────────────────────┐
│         Permission Layers                │
├──────────────────────────────────────────┤
│ Layer 1: Authentication                  │
│ ├─ JWT token required                    │
│ └─ Token validation (not expired)        │
│                                          │
│ Layer 2: Authorization (Admin Role)      │
│ ├─ User role must be 'admin'             │
│ └─ Checked by requireAdmin middleware    │
│                                          │
│ Layer 3: File Validation                 │
│ ├─ Video type: mp4, webm, ogg, mov       │
│ ├─ File size: < 500MB                    │
│ └─ MIME type check                       │
│                                          │
│ Layer 4: Data Authorization              │
│ ├─ Course must exist                     │
│ ├─ Module must exist in course           │
│ └─ Admin creating (tracked)              │
│                                          │
│ Layer 5: Access Control (Premium)        │
│ ├─ Non-premium: all students             │
│ └─ Premium: enrolled only                │
└──────────────────────────────────────────┘
```

## API Response Examples

### Upload Success
```json
{
  "message": "Video uploaded successfully",
  "video": {
    "id": "video_1234567890",
    "title": "Numbers & Operations",
    "type": "video",
    "videoUrl": "/uploads/videos/lesson-1234567890.mp4",
    "originalFilename": "lesson.mp4",
    "fileSize": 524288000,
    "mimeType": "video/mp4",
    "uploadedAt": "2026-03-30T10:30:00.000Z",
    "uploadedBy": "admin_user_id",
    "durationMinutes": 45,
    "premium": false
  },
  "course": { ... }
}
```

### Upload Error
```json
{
  "message": "Video file too large. Max 500MB allowed."
}

OR

{
  "message": "Invalid video format. Supported: MP4, WebM, OGG, MOV"
}
```

## Component Hierarch (Frontend)

```
App.tsx
  │
  ├─ AuthContext
  │  └─ JWT token management
  │
  ├─ AdminTab
  │  │
  │  └─ AdminVideoUpload (NEW)
  │     │
  │     ├─ Course selector
  │     │  └─ Option for each course
  │     │
  │     ├─ Module selector
  │     │  └─ Options from selected course
  │     │
  │     ├─ File uploader
  │     │  ├─ Drag-drop zone
  │     │  └─ File input
  │     │
  │     ├─ Video form
  │     │  ├─ Lesson title input
  │     │  ├─ Duration input
  │     │  └─ Premium toggle
  │     │
  │     ├─ Video list
  │     │  ├─ Video card (title, duration, size)
  │     │  ├─ Preview button
  │     │  └─ Delete button
  │     │
  │     └─ Status messages
  │        ├─ Success feedback
  │        └─ Error feedback
  │
  └─ EduService
     └─ API methods:
        ├─ uploadVideoToModule()
        ├─ listVideosInModule()
        ├─ deleteVideoFromModule()
        └─ getVideoMetadata()
```

---

## Key Integration Points

| Component | Role | Integration |
|-----------|------|-------------|
| **Multer** | File upload middleware | Validates & streams files |
| **Express** | HTTP server | Routes requests to controllers |
| **MongoDB/PostgreSQL** | Database | Stores metadata |
| **Filesystem** | Storage | Persists video files |
| **React** | Frontend UI | Displays upload interface |
| **JWT** | Authentication | Secures admin routes |

---

This system allows admins to upload and organize videos by course section, while students experience them in a hierarchical learning structure with access control.
