# Phase 3: Customer Request Flow

## Purpose

Implement the customer request submission flow, including the request form, photo upload to Firebase Storage, and request creation in Firestore. This is the entry point for customers seeking help with home repairs.

---

## Why We Need This Phase

1. **Core User Journey** - This is step 1 of the 3-step process (Request → Match → Guide)
2. **Problem Context** - Photos and descriptions help Helpers understand issues before connecting
3. **Data Capture** - Collect all necessary information for Helper dispatch
4. **User Experience** - Simple, fast form completion (target: under 2 minutes)

---

## Benefits

- Customers can quickly describe their repair issue
- Photo uploads provide visual context for Helpers
- Category selection enables future Helper specialization matching
- Request status tracking keeps customers informed
- Foundation for payment pre-authorization (Phase 6)

---

## Prerequisites

- Phase 2 completed (authentication working)
- Firebase Storage enabled in Firebase Console
- Firebase Storage rules configured

---

## Implementation Tasks

### Task 3.1: Configure Firebase Storage Rules

Create `storage.rules`:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Request photos - customers can upload, authenticated users can read
    match /requests/{requestId}/{fileName} {
      // Allow authenticated users to upload
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024  // Max 10MB
                   && request.resource.contentType.matches('image/.*');

      // Allow authenticated users to read
      allow read: if request.auth != null;
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only storage
```

### Task 3.2: Create Image Upload Hook

Create `src/hooks/useImageUpload.ts`:

```typescript
import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';

interface UploadProgress {
  file: File;
  progress: number;
  url?: string;
  error?: string;
}

export function useImageUpload() {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadImages = async (files: File[], requestId: string): Promise<string[]> => {
    setIsUploading(true);
    const urls: string[] = [];

    // Initialize upload progress for all files
    setUploads(files.map(file => ({ file, progress: 0 })));

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop();
        const fileName = `${Date.now()}-${i}.${fileExtension}`;
        const storageRef = ref(storage, `requests/${requestId}/${fileName}`);

        // Upload file
        await uploadBytes(storageRef, file);

        // Get download URL
        const url = await getDownloadURL(storageRef);
        urls.push(url);

        // Update progress
        setUploads(prev =>
          prev.map((upload, index) =>
            index === i ? { ...upload, progress: 100, url } : upload
          )
        );
      }

      return urls;
    } catch (error: any) {
      console.error('Upload error:', error);
      throw new Error('Failed to upload images. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const clearUploads = () => {
    setUploads([]);
  };

  return {
    uploads,
    isUploading,
    uploadImages,
    clearUploads,
  };
}
```

### Task 3.3: Create Request Form Page

Create `src/pages/customer/RequestForm.tsx`:

```typescript
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useImageUpload } from '../../hooks/useImageUpload';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { RequestCategory } from '../../types';

const CATEGORIES: { value: RequestCategory; label: string; icon: string }[] = [
  { value: 'plumbing', label: 'Plumbing', icon: '🚿' },
  { value: 'electrical', label: 'Electrical', icon: '⚡' },
  { value: 'hvac', label: 'HVAC', icon: '❄️' },
  { value: 'appliance', label: 'Appliance', icon: '🔧' },
  { value: 'other', label: 'Other', icon: '🏠' },
];

const SESSION_PRICE_CENTS = parseInt(
  import.meta.env.VITE_SESSION_PRICE_CENTS || '2500',
  10
);

export function RequestForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<RequestCategory | ''>('');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uploadImages, isUploading } = useImageUpload();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Validate file types
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if (validFiles.length !== files.length) {
      setError('Please select only image files (JPEG, PNG, etc.)');
      return;
    }

    // Limit to 5 photos
    if (selectedFiles.length + validFiles.length > 5) {
      setError('Maximum 5 photos allowed');
      return;
    }

    setError(null);
    setSelectedFiles(prev => [...prev, ...validFiles]);

    // Create preview URLs
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      setError('Please select a category');
      return;
    }

    if (!description.trim()) {
      setError('Please describe your issue');
      return;
    }

    if (selectedFiles.length === 0) {
      setError('Please upload at least one photo');
      return;
    }

    if (!user) {
      setError('You must be logged in');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Generate a temporary ID for the request (will be replaced by Firestore)
      const tempRequestId = `temp-${Date.now()}`;

      // Upload images first
      const photoUrls = await uploadImages(selectedFiles, tempRequestId);

      // Create request document
      const requestData = {
        customerId: user.uid,
        customerPhone: user.phone,
        category,
        description: description.trim(),
        photoUrls,
        status: 'pending',
        paymentStatus: 'pending',
        amount: SESSION_PRICE_CENTS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'requests'), requestData);

      // Navigate to waiting/status page
      navigate(`/customer/request/${docRef.id}/status`);
    } catch (err: any) {
      console.error('Error creating request:', err);
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="card">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            What do you need help with?
          </h1>
          <p className="text-gray-600 mb-6">
            Describe your issue and upload photos. A professional will connect with you shortly.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Category *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      category === cat.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="text-2xl mb-1 block">{cat.icon}</span>
                    <span className="text-sm font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Describe the issue *
              </label>
              <textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="input-field min-h-[120px] resize-none"
                placeholder="Example: My kitchen faucet is leaking from the base. It started yesterday and is getting worse. I've tried tightening it but that didn't help."
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Include details like when it started, what you've tried, and any relevant model numbers.
              </p>
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Photos * (at least 1, maximum 5)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Clear photos help the professional understand your issue faster.
              </p>

              {/* Preview Grid */}
              {previewUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm font-bold hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              {selectedFiles.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                >
                  <span className="block text-2xl mb-1">📷</span>
                  <span className="text-sm">
                    {selectedFiles.length === 0
                      ? 'Click to add photos'
                      : `Add more photos (${5 - selectedFiles.length} remaining)`}
                  </span>
                </button>
              )}

              {/*
                capture="environment" enables the rear camera on mobile devices.
                This allows users to take photos directly instead of just selecting from gallery.
                - "environment" = rear/back camera (preferred for photographing repairs)
                - "user" = front/selfie camera
                Note: capture is ignored on desktop browsers.
              */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Price Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Session fee</span>
                <span className="text-xl font-bold text-gray-900">
                  ${(SESSION_PRICE_CENTS / 100).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                You'll only be charged after a successful session. Payment will be requested before connecting.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="btn-primary w-full py-3 text-lg flex items-center justify-center"
            >
              {isSubmitting || isUploading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  {isUploading ? 'Uploading photos...' : 'Submitting...'}
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
```

### Task 3.4: Create Request Status Page

Create `src/pages/customer/RequestStatus.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Request, RequestStatus as RequestStatusType } from '../../types';

const STATUS_CONFIG: Record<RequestStatusType, { label: string; color: string; description: string }> = {
  pending: {
    label: 'Waiting for Helper',
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Your request is being sent to available professionals.',
  },
  claimed: {
    label: 'Helper Assigned',
    color: 'bg-blue-100 text-blue-800',
    description: 'A professional has accepted your request and is preparing to connect.',
  },
  in_session: {
    label: 'In Session',
    color: 'bg-green-100 text-green-800',
    description: 'Your video session is active.',
  },
  completed: {
    label: 'Completed',
    color: 'bg-gray-100 text-gray-800',
    description: 'Your session has ended.',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800',
    description: 'This request has been cancelled.',
  },
};

export function RequestStatus() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setError('Invalid request ID');
      setLoading(false);
      return;
    }

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      doc(db, 'requests', requestId),
      (doc) => {
        if (doc.exists()) {
          setRequest({ id: doc.id, ...doc.data() } as Request);

          // If session started, redirect to session page
          const data = doc.data();
          if (data.status === 'in_session' && data.sessionId) {
            navigate(`/customer/session/${data.sessionId}`);
          }
        } else {
          setError('Request not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching request:', err);
        setError('Failed to load request status');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [requestId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="card text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Error</h1>
            <p className="text-gray-600">{error || 'Request not found'}</p>
            <button
              onClick={() => navigate('/customer/request')}
              className="btn-primary mt-4"
            >
              Submit New Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[request.status];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="card">
          {/* Status Badge */}
          <div className="text-center mb-6">
            <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          {/* Animated Waiting Indicator */}
          {request.status === 'pending' && (
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-primary-200 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
            </div>
          )}

          <p className="text-center text-gray-600 mb-8">
            {statusConfig.description}
          </p>

          {/* Request Details */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Details</h2>

            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-500">Category</span>
                <p className="text-gray-900 capitalize">{request.category}</p>
              </div>

              <div>
                <span className="text-sm text-gray-500">Description</span>
                <p className="text-gray-900">{request.description}</p>
              </div>

              {/* Photos */}
              {request.photoUrls.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500">Photos</span>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {request.photoUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Photo ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cancel Button (only for pending requests) */}
          {request.status === 'pending' && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  // TODO: Implement cancel functionality
                  console.log('Cancel request');
                }}
                className="btn-secondary w-full"
              >
                Cancel Request
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

### Task 3.5: Update App Routes

Update `src/App.tsx` to include the new pages:

```typescript
// Add imports at the top
import { RequestForm } from './pages/customer/RequestForm';
import { RequestStatus } from './pages/customer/RequestStatus';

// Update the customer routes section:
<Route path="/customer">
  <Route path="login" element={<CustomerLogin />} />
  <Route
    path="request"
    element={
      <ProtectedRoute allowedRole="customer">
        <RequestForm />
      </ProtectedRoute>
    }
  />
  <Route
    path="request/:requestId/status"
    element={
      <ProtectedRoute allowedRole="customer">
        <RequestStatus />
      </ProtectedRoute>
    }
  />
  <Route
    path="session/:sessionId"
    element={
      <ProtectedRoute allowedRole="customer">
        <CustomerSession />
      </ProtectedRoute>
    }
  />
  <Route index element={<Navigate to="/customer/login" replace />} />
</Route>
```

### Task 3.6: Create Image Compression Utility (Optional but Recommended)

Create `src/utils/imageCompression.ts`:

```typescript
export async function compressImage(file: File, maxSizeMB: number = 2): Promise<File> {
  // If file is already small enough, return as-is
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions (max 1920px on longest side)
        const maxDimension = 1920;
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          0.8 // Quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}
```

---

## Verification Tests

### Test 1: Form Renders Correctly

1. Sign in as a Customer
2. Navigate to `/customer/request`

**Expected:** Form displays with category buttons, description textarea, photo upload area, and price info

### Test 2: Category Selection

1. Click on each category button

**Expected:** Selected category is highlighted with blue border

### Test 3: Photo Upload

1. Click the photo upload area
2. Select 1-3 images from your device

**Expected:** Images appear as previews with remove (×) buttons

### Test 4: Photo Removal

1. Upload a photo
2. Click the × button on the photo

**Expected:** Photo is removed from preview

### Test 5: Photo Limit Enforcement

1. Try to upload more than 5 photos

**Expected:** Error message "Maximum 5 photos allowed"

### Test 6: Form Validation

1. Try to submit without selecting a category

**Expected:** Error message "Please select a category"

2. Try to submit without photos

**Expected:** Error message "Please upload at least one photo"

### Test 7: Successful Submission

1. Fill in all required fields (category, description, at least 1 photo)
2. Click "Submit Request"

**Expected:**
- Loading spinner shows during upload
- Redirected to `/customer/request/{id}/status`
- Status shows "Waiting for Helper"

### Test 8: Real-time Status Updates

1. Submit a request
2. Open Firebase Console > Firestore
3. Manually change the request status to "claimed"

**Expected:** Status page updates in real-time without refresh

### Test 9: Firestore Data

1. Submit a request
2. Check Firebase Console > Firestore > requests collection

**Expected:** Document contains: customerId, customerPhone, category, description, photoUrls[], status, amount, timestamps

### Test 10: Storage Data

1. Submit a request
2. Check Firebase Console > Storage

**Expected:** Images stored under `requests/{requestId}/` folder

---

## Deliverables Checklist

- [ ] Firebase Storage rules configured and deployed
- [ ] Image upload hook created and working
- [ ] Request form page with all fields
- [ ] Category selection working
- [ ] Photo upload with previews working
- [ ] Photo removal working
- [ ] Form validation working
- [ ] Request creation in Firestore working
- [ ] Request status page with real-time updates
- [ ] Loading states shown during operations
- [ ] Error handling working

---

## Next Phase

Once all tests pass, proceed to **Phase 4: Helper Dashboard** to implement the Helper console where professionals can view and claim incoming requests.
