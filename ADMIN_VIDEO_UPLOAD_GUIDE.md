# Admin Video Upload Feature - Implementation Guide

## Overview

This feature allows administrators to upload videos directly to course modules, organizing them by course sections. Videos are stored locally and can be marked as premium.

## What's Included

### Backend Components

#### 1. **Video Upload Controller** (`backend/course/video-upload.controller.js`)
- `uploadVideoToModule()` - Upload and store video files
- `deleteVideoFromModule()` - Remove videos from modules
- `listVideosInModule()` - Fetch all videos in a module
- `getVideoMetadata()` - Get single video details

#### 2. **Multer Configuration** (`backend/lib/multer-config.js`)
- File storage configuration
- Video type validation (MP4, WebM, OGG, MOV)
- File size limit: 500MB per video
- Error handling for invalid uploads

#### 3. **Updated Routes** (`backend/course/course.routes.js`)
New admin endpoints:
```
POST   /backend/api/courses/:courseId/modules/:moduleId/videos
DELETE /backend/api/courses/:courseId/modules/:moduleId/videos/:videoId
GET    /backend/api/courses/:courseId/modules/:moduleId/videos
GET    /backend/api/courses/:courseId/modules/:moduleId/videos/:videoId
```

#### 4. **Database Updates** (`backend/lib/repositories.js`)
- `updateCourseModule()` method added to `coursesRepository`
- Supports PostgreSQL, MongoDB, and memory mode
- Automatic module creation if not exists

### Frontend Components

#### 1. **Admin Video Upload Component** (`src/components/AdminVideoUpload.tsx`)
Features:
- Course and module selection dropdown
- Drag-and-drop video upload interface
- Video file validation pre-upload
- Progress indicator during upload
- Video listing with metadata
- Delete functionality with confirmation
- Success/error feedback messages

#### 2. **EduService Methods** (`src/EduService.ts`)
```typescript
uploadVideoToModule()      // Upload video with metadata
listVideosInModule()       // Fetch all videos in module
deleteVideoFromModule()    // Remove video from module
getVideoMetadata()         // Get video details
```

### Database Schema Changes

Videos are stored as lessons within modules:
```typescript
interface Video {
  id: string                  // Unique video ID
  title: string              // Lesson title
  type: 'video'              // Always 'video'
  videoUrl: string           // Path to uploaded file
  originalFilename: string   // Original file name
  fileSize: number           // Bytes
  mimeType: string           // Video MIME type
  uploadedAt: string         // ISO timestamp
  uploadedBy: string         // Admin user ID
  durationMinutes: number    // Video length
  premium: boolean           // Access control flag
}
```

## Installation Steps

### 1. Install Backend Dependency
```bash
cd backend
npm install multer@^1.4.5-lts.1
cd ..
```

### 2. Create Uploads Directory
```bash
mkdir -p uploads/videos
chmod 755 uploads/videos
```

### 3. (Optional) Add to .gitignore
```gitignore
# Uploaded videos
uploads/videos/*.mp4
uploads/videos/*.webm
uploads/videos/*.ogg
uploads/videos/*.mov
```

### 4. Restart Backend Server
```bash
npm run dev
```

##Usage Guide

### For Admins

#### Creating a Course with Videos

1. **Create Course** (if not exists)
   - Go to Admin panel → Create course
   - Fill course details (title, subject, category, etc.)

2. **Add Module to Course**
   - Edit course JSON to include modules:
   ```json
   {
     "title": "SSC JE Mathematics",
     "modules": [
       {
         "id": "module_basics",
         "title": "Arithmetic Basics",
         "lessons": []
       }
     ]
   }
   ```

3. **Upload Videos Using UI**
   - Open Admin Video Upload component
   - Select course from dropdown
   - Select module within that course
   - Click upload area or drag-drop video file
   - Fill in:
     - Lesson title (e.g., "Numbers & Operations")
     - Duration in minutes
     - Check premium if needed
   - Click "Upload Video"
   - Video appears in list below

4. **Manage Videos**
   - Preview: Click play button
   - Delete: Click trash icon
   - All changes immediate for students

### API Endpoints

#### Upload Video
```bash
curl -X POST \
  -H "Authorization: Bearer <jwt_token>" \
  -F "video=@lesson.mp4" \
  -F "courseId=course_123" \
  -F "moduleId=module_456" \
  -F "lessonTitle=Lesson Name" \
  -F "durationMinutes=45" \
  -F "isPremium=false" \
  http://localhost:3000/backend/api/courses/course_123/modules/module_456/videos
```

Response:
```json
{
  "message": "Video uploaded successfully",
  "video": {
    "id": "video_1234567890",
    "title": "Lesson Name",
    "type": "video",
    "videoUrl": "/uploads/videos/lesson-1234567890.mp4",
    "durationMinutes": 45,
    "premium": false,
    "uploadedAt": "2026-03-30T10:30:00Z",
    "fileSize": 524288000
  },
  "course": { ... }
}
```

#### List Videos in Module
```bash
curl -H "Authorization: Bearer <jwt_token>" \
  http://localhost:3000/backend/api/courses/course_123/modules/module_456/videos
```

#### Delete Video
```bash
curl -X DELETE \
  -H "Authorization: Bearer <jwt_token>" \
  http://localhost:3000/backend/api/courses/course_123/modules/module_456/videos/video_id
```

## Data Storage

### File Organization
```
project/
├── uploads/
│   └── videos/
│       ├── lesson-1234567890.mp4
│       ├── lecture-9876543210.webm
│       └── demo-1122334455.mov
└── ...
```

### Database Storage (MongoDB/PostgreSQL)
Courses table with embedded video metadata:
```json
{
  "_id": "course_123",
  "title": "SSC JE Mathematics",
  "modules": [
    {
      "id": "module_basics",
      "title": "Arithmetic Basics",
      "lessons": [
        {
          "id": "video_1234567890",
          "title": "Numbers & Operations",
          "type": "video",
          "videoUrl": "/uploads/videos/lesson-1234567890.mp4",
          "durationMinutes": 45,
          "premium": false,
          "uploadedAt": "2026-03-30T10:30:00Z",
          "uploadedBy": "admin_user_id",
          "fileSize": 524288000,
          "mimeType": "video/mp4"
        }
      ]
    }
  ]
}
```

## Student Experience

### Viewing Videos
- Free courses: All videos playable immediately
- Premium videos: Play button disabled until enrolled
- Access control per video (premium flag)
- Progress tracking: Students can mark videos as complete
- Resume playback: Last watched position saved

### Lesson Hierarchy
```
Course (SSC JE Mathematics)
├── Module (Arithmetic Basics)
│   ├── Video 1: Numbers & Operations (45 min)
│   ├── Video 2: Addition & Subtraction (38 min)
│   └── Video 3: Multiplication (42 min)
├── Module (Geometry Basics)
│   ├── Video 1: Points & Lines (50 min)
│   └── Video 2: Angles (40 min)
└── Module (Trigonometry)
    └── Video 1: Basics (60 min)
```

## Security Features

### Authentication
- Requires admin role + JWT token
- Protected routes middleware enforced
- Session validation on each upload

### File Validation
- Video type checking (whitelist: MP4, WebM, OGG, MOV)
- File size limits (max 500MB)
- Filename sanitization
- Automatic rejection of invalid formats

### Access Control
- Premium videos require enrollment
- Admin-only upload endpoints
- Course ownership verification
- Deletion confirmation required

## Technical Details

### Video Processing
- Files stored in `uploads/videos/` directory
- Unique filenames: `{name}-{timestamp-random}.{ext}`
- Original filename preserved in metadata
- Served as static files via Express

### Performance
- Multer handles streaming (memory-efficient)
- Large files processed without full loading
- Async upload with progress tracking
- Metadata stored separately from file

### Compatibility
- PostgreSQL: Modules stored as JSONB
- MongoDB: Nested objects in lessons array
- Memory mode: In-memory arrays for demo

## Troubleshooting

### Upload Fails
**File too large**
- Solution: Break into smaller files (max 500MB)

**Invalid video format**
- Supported: MP4, WebM, OGG, MOV
- Solution: Convert using FFmpeg
```bash
ffmpeg -i input.avi -c:v libx264 -crf 23 output.mp4
```

**Permissions error**
- Solution: Check `uploads/videos/` directory permissions
```bash
chmod 755 uploads/videos
```

### Videos Not Showing
**Module not found**
- Solution: Create module first, then upload

**Course not selected**
- Solution: Ensure course is selected in dropdown

**Authentication failed**
- Solution: Verify JWT token is valid
- Check admin role in user data

## Production Deployment

### For S3/Cloud Storage (Optional)
Replace local storage with AWS S3:

```javascript
// Install: npm install aws-sdk
const AWS = require('aws-sdk');
const s3Storage = require('multer-s3');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const upload = multer({
  storage: s3Storage({
    s3: s3,
    bucket: process.env.S3_BUCKET || 'edumaster-videos',
    acl: 'private',
    key: (req, file, cb) => {
      cb(null, `videos/${Date.now()}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
});
```

#### Environment Variables
```bash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=edumaster-videos
```

### For CDN Delivery
```bash
# Update video URLs to CDN endpoints
videoUrl: `https://cdn.example.com/videos/${videoId}.mp4`
```

### Backup Strategy
```bash
# Automated backup of videos
aws s3 sync uploads/videos s3://backup-bucket/videos/
```

## Future Enhancements

1. **Video Transcoding**
   - Auto-convert to multiple formats
   - Adaptive bitrate streaming

2. **Thumbnails**
   - Auto-generate from first frame
   - Custom thumbnail upload

3. **Analytics**
   - Track video views
   - Student engagement metrics
   - Average watch time

4. **Live Streaming**
   - Real-time video broadcasts
   - Interactive chat during live

5. **Video Processing**
   - Subtitle generation (auto-transcribe)
   - Playback speed control
   - Quality selection

## Support & Resources

- **Frontend Component**: `src/components/AdminVideoUpload.tsx`
- **Backend Controller**: `backend/course/video-upload.controller.js`
- **API Routes**: `backend/course/course.routes.js`
- **Configuration**: `backend/lib/multer-config.js`
- **Service Methods**: `src/EduService.ts`

## Questions?

Refer to the main project analysis for architecture details:
- [PROJECT_ANALYSIS.md](../PROJECT_ANALYSIS.md)
- [API_DESIGN.md](../API_DESIGN.md)
- [QUICK_REFERENCE.md](../QUICK_REFERENCE.md)
