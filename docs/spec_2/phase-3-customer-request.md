# Phase 3: Customer Request Flow

## Purpose

Build the customer interface for submitting help requests. This includes a form for describing the issue, selecting a category, uploading photos, and initiating the payment pre-authorization. This is the entry point for the entire service flow.

---

## Why We Need This Phase

1. **Problem Capture** - Customers must describe their issue clearly for Helpers
2. **Visual Context** - Photos help Helpers understand the problem before accepting
3. **Category Routing** - Categories help match requests with appropriate Helpers
4. **Payment Security** - Pre-authorization ensures customers can pay before starting
5. **Request Queue** - Creates the request that Helpers will see and claim

---

## Benefits

- Customers can easily describe their home repair issue
- Photo upload provides visual context for better diagnosis
- Payment pre-authorization reduces payment failures
- Structured data enables efficient Helper matching
- Real-time status updates keep customers informed

---

## Prerequisites

- Phase 2 completed (authentication working)
- Firebase Storage enabled
- Stripe account created and API keys available

---

## Implementation Tasks

### Task 3.1: Create Photo Upload Component

Create `src/components/customer/PhotoUpload.tsx`:

```typescript
import { useState, useRef, ChangeEvent } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase_client';
import { useAuth } from '../../hooks/use_auth';
import { app_config } from '../../config/app_config';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface PhotoUploadProps {
  photos: string[];
  on_photos_change: (photos: string[]) => void;
  max_photos?: number;
}

export function PhotoUpload({
  photos,
  on_photos_change,
  max_photos = app_config.photos.max_count,
}: PhotoUploadProps) {
  const { user } = useAuth();
  const file_input_ref = useRef<HTMLInputElement>(null);
  const [is_uploading, set_is_uploading] = useState(false);
  const [upload_error, set_upload_error] = useState<string | null>(null);

  const handle_file_select = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    set_upload_error(null);
    set_is_uploading(true);

    const new_photos: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!app_config.photos.allowed_types.includes(file.type)) {
        set_upload_error('Only JPEG, PNG, and WebP images are allowed');
        continue;
      }

      // Validate file size
      if (file.size > app_config.photos.max_size_mb * 1024 * 1024) {
        set_upload_error(`Files must be under ${app_config.photos.max_size_mb}MB`);
        continue;
      }

      // Check max photos limit
      if (photos.length + new_photos.length >= max_photos) {
        set_upload_error(`Maximum ${max_photos} photos allowed`);
        break;
      }

      try {
        // Upload to Firebase Storage
        const timestamp = Date.now();
        const storage_path = `requests/${user.uid}/${timestamp}_${file.name}`;
        const storage_ref = ref(storage, storage_path);

        await uploadBytes(storage_ref, file);
        const download_url = await getDownloadURL(storage_ref);
        new_photos.push(download_url);
      } catch (err) {
        console.error('Upload error:', err);
        set_upload_error('Failed to upload image. Please try again.');
      }
    }

    if (new_photos.length > 0) {
      on_photos_change([...photos, ...new_photos]);
    }

    set_is_uploading(false);

    // Reset file input
    if (file_input_ref.current) {
      file_input_ref.current.value = '';
    }
  };

  const remove_photo = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    on_photos_change(updated);
  };

  const can_add_more = photos.length < max_photos;

  return (
    <div>
      <label className="label">
        Photos of the Issue <span className="text-gray-400">(at least 1 required)</span>
      </label>

      {/* Photo Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
        {photos.map((url, index) => (
          <div key={index} className="relative aspect-square group">
            <img
              src={url}
              alt={`Issue photo ${index + 1}`}
              className="w-full h-full object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => remove_photo(index)}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full
                         opacity-0 group-hover:opacity-100 transition-opacity
                         flex items-center justify-center text-sm font-bold"
            >
              x
            </button>
          </div>
        ))}

        {/* Add Photo Button */}
        {can_add_more && (
          <button
            type="button"
            onClick={() => file_input_ref.current?.click()}
            disabled={is_uploading}
            className="aspect-square border-2 border-dashed border-gray-300 rounded-lg
                       flex flex-col items-center justify-center text-gray-400
                       hover:border-primary-400 hover:text-primary-500 transition-colors
                       disabled:opacity-50"
          >
            {is_uploading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <span className="text-2xl">+</span>
                <span className="text-xs mt-1">Add Photo</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={file_input_ref}
        type="file"
        accept={app_config.photos.allowed_types.join(',')}
        multiple
        onChange={handle_file_select}
        className="hidden"
      />

      {upload_error && <p className="error-text">{upload_error}</p>}

      <p className="text-xs text-gray-500 mt-2">
        {photos.length}/{max_photos} photos uploaded. Clear, well-lit photos help get better assistance.
      </p>
    </div>
  );
}
```

### Task 3.2: Create Category Selector Component

Create `src/components/customer/CategorySelector.tsx`:

```typescript
import { app_config, CategoryValue } from '../../config/app_config';

interface CategorySelectorProps {
  selected: CategoryValue | null;
  on_select: (category: CategoryValue) => void;
}

export function CategorySelector({ selected, on_select }: CategorySelectorProps) {
  return (
    <div>
      <label className="label">What type of issue is this?</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {app_config.categories.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => on_select(category.value)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selected === category.value
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <span className="text-2xl block mb-1">{category.icon}</span>
            <span className="font-medium text-gray-900">{category.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Task 3.3: Create Request Form Page

Create `src/pages/customer/RequestForm.tsx`:

```typescript
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase_client';
import { useAuth } from '../../hooks/use_auth';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PhotoUpload } from '../../components/customer/PhotoUpload';
import { CategorySelector } from '../../components/customer/CategorySelector';
import { app_config, CategoryValue } from '../../config/app_config';

export function RequestForm() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [category, set_category] = useState<CategoryValue | null>(null);
  const [description, set_description] = useState('');
  const [photos, set_photos] = useState<string[]>([]);
  const [is_submitting, set_is_submitting] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const validate_form = (): boolean => {
    if (!category) {
      set_error('Please select a category');
      return false;
    }

    if (description.length < app_config.validation.min_description_length) {
      set_error(
        `Please describe the issue in at least ${app_config.validation.min_description_length} characters`
      );
      return false;
    }

    if (photos.length === 0) {
      set_error('Please upload at least one photo of the issue');
      return false;
    }

    return true;
  };

  const handle_submit = async (e: FormEvent) => {
    e.preventDefault();
    set_error(null);

    if (!validate_form() || !user) return;

    set_is_submitting(true);

    try {
      // Create request document
      const request_data = {
        customer_id: user.uid,
        customer_phone: user.phone,
        category,
        description: description.trim(),
        photo_urls: photos,
        status: 'pending',
        payment_status: 'pending',
        amount: app_config.session.default_price_cents,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      const doc_ref = await addDoc(collection(db, 'requests'), request_data);

      // Navigate to waiting/payment page
      navigate(`/customer/request/${doc_ref.id}/payment`);
    } catch (err) {
      console.error('Error creating request:', err);
      set_error('Failed to submit request. Please try again.');
      set_is_submitting(false);
    }
  };

  const description_length = description.length;
  const min_length = app_config.validation.min_description_length;
  const is_description_valid = description_length >= min_length;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Get Help Now</h1>
          <p className="text-gray-600 mt-1">
            Describe your issue and a professional will guide you through the fix.
          </p>
        </div>

        <form onSubmit={handle_submit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Category Selection */}
          <div className="card">
            <CategorySelector selected={category} on_select={set_category} />
          </div>

          {/* Description */}
          <div className="card">
            <label htmlFor="description" className="label">
              Describe the Problem
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => set_description(e.target.value)}
              rows={4}
              className="input-field resize-none"
              placeholder="What's happening? When did it start? What have you tried?"
              disabled={is_submitting}
            />
            <div className="flex justify-between mt-2 text-xs">
              <span className={is_description_valid ? 'text-green-600' : 'text-gray-400'}>
                {description_length}/{min_length} characters minimum
              </span>
              {!is_description_valid && description_length > 0 && (
                <span className="text-amber-600">
                  {min_length - description_length} more characters needed
                </span>
              )}
            </div>
          </div>

          {/* Photo Upload */}
          <div className="card">
            <PhotoUpload photos={photos} on_photos_change={set_photos} />
          </div>

          {/* Price Info */}
          <div className="card bg-primary-50 border-primary-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Session Fee</h3>
                <p className="text-sm text-gray-600">
                  Up to {app_config.session.max_duration_minutes} minutes with a professional
                </p>
              </div>
              <span className="text-2xl font-bold text-primary-600">
                ${(app_config.session.default_price_cents / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={is_submitting}
            className="btn-primary w-full py-3 text-lg flex items-center justify-center"
          >
            {is_submitting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Submitting...
              </>
            ) : (
              'Continue to Payment'
            )}
          </button>

          <p className="text-xs text-center text-gray-500">
            Your card will be pre-authorized but not charged until the session is complete.
          </p>
        </form>
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
import { db } from '../../services/firebase_client';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Request } from '../../types';

const STATUS_CONFIG = {
  pending: {
    title: 'Finding a Helper',
    description: 'We\'re matching you with an available professional...',
    icon: '🔍',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  claimed: {
    title: 'Helper Assigned',
    description: 'A professional has accepted your request and will start the session shortly.',
    icon: '✓',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  in_session: {
    title: 'Session in Progress',
    description: 'Your guidance session is active.',
    icon: '📹',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  completed: {
    title: 'Session Complete',
    description: 'Thank you for using HomePro Assist!',
    icon: '🎉',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  cancelled: {
    title: 'Request Cancelled',
    description: 'This request has been cancelled.',
    icon: '✕',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
  },
};

export function RequestStatus() {
  const { request_id } = useParams<{ request_id: string }>();
  const navigate = useNavigate();
  const [request, set_request] = useState<Request | null>(null);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    if (!request_id) return;

    const unsubscribe = onSnapshot(
      doc(db, 'requests', request_id),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = { id: snapshot.id, ...snapshot.data() } as Request;
          set_request(data);

          // Redirect to session page if session started
          if (data.session_id && data.status === 'in_session') {
            navigate(`/customer/session/${data.session_id}`);
          }
        }
        set_loading(false);
      },
      (err) => {
        console.error('Error fetching request:', err);
        set_loading(false);
      }
    );

    return () => unsubscribe();
  }, [request_id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Request Not Found</h1>
          <p className="text-gray-600 mt-2">This request may have been deleted.</p>
        </div>
      </div>
    );
  }

  const status_info = STATUS_CONFIG[request.status];

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-md mx-auto px-4 py-8">
        {/* Status Card */}
        <div className={`card ${status_info.bg} border-0 text-center mb-6`}>
          <span className="text-5xl block mb-4">{status_info.icon}</span>
          <h1 className={`text-xl font-bold ${status_info.color}`}>
            {status_info.title}
          </h1>
          <p className="text-gray-600 mt-2">{status_info.description}</p>

          {request.status === 'pending' && (
            <div className="mt-6">
              <LoadingSpinner size="md" />
              <p className="text-sm text-gray-500 mt-2">
                Usually takes less than 15 minutes
              </p>
            </div>
          )}
        </div>

        {/* Request Summary */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Your Request</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Category</span>
              <span className="capitalize font-medium">{request.category}</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-1">Description</span>
              <p className="text-gray-700">{request.description}</p>
            </div>
            {request.photo_urls.length > 0 && (
              <div>
                <span className="text-gray-500 block mb-2">Photos</span>
                <div className="flex space-x-2">
                  {request.photo_urls.slice(0, 4).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cancel Button (only for pending) */}
        {request.status === 'pending' && (
          <button className="w-full mt-6 py-2 text-gray-500 hover:text-red-600 transition-colors text-sm">
            Cancel Request
          </button>
        )}
      </main>
    </div>
  );
}
```

### Task 3.5: Update Routes

Update `src/App.tsx` to add the new customer routes:

```typescript
// Add imports
import { RequestForm } from './pages/customer/RequestForm';
import { RequestStatus } from './pages/customer/RequestStatus';

// Update customer routes:
<Route path="/customer">
  <Route path="login" element={<CustomerLogin />} />
  <Route path="signup" element={<CustomerSignup />} />
  <Route
    path="request"
    element={
      <ProtectedRoute allowed_role="customer">
        <RequestForm />
      </ProtectedRoute>
    }
  />
  <Route
    path="request/:request_id/status"
    element={
      <ProtectedRoute allowed_role="customer">
        <RequestStatus />
      </ProtectedRoute>
    }
  />
  <Route
    path="request/:request_id/payment"
    element={
      <ProtectedRoute allowed_role="customer">
        {/* Payment page - Phase 6 */}
        <div>Payment Page - Phase 6</div>
      </ProtectedRoute>
    }
  />
  <Route
    path="session/:session_id"
    element={
      <ProtectedRoute allowed_role="customer">
        <CustomerSession />
      </ProtectedRoute>
    }
  />
</Route>
```

---

## Verification Tests

### Test 1: Form Renders

1. Login as Customer
2. Navigate to `/customer/request`

**Expected:** Form displays with category selector, description field, and photo upload

### Test 2: Category Selection

1. Click on a category button

**Expected:** Category highlights with blue border and background

### Test 3: Description Validation

1. Type less than 20 characters
2. Try to submit

**Expected:** Error message about minimum characters shown

### Test 4: Photo Upload

1. Click "Add Photo" button
2. Select an image file

**Expected:** Image uploads and displays as thumbnail

### Test 5: Photo Removal

1. Hover over uploaded photo
2. Click the X button

**Expected:** Photo is removed from list

### Test 6: Photo Limit

1. Upload 5 photos
2. Try to upload another

**Expected:** "Add Photo" button hidden or error shown

### Test 7: Form Submission

1. Fill out complete form
2. Click "Continue to Payment"

**Expected:**
- Request document created in Firestore
- Redirected to payment page

### Test 8: Firestore Document

1. Check Firebase Console > Firestore > requests

**Expected:** Document contains:
- customer_id matching user
- category, description, photo_urls
- status: 'pending'
- payment_status: 'pending'
- amount in cents

### Test 9: Request Status Page

1. Navigate to `/customer/request/{id}/status`

**Expected:** Status page shows "Finding a Helper" with spinner

### Test 10: Real-time Status Updates

1. Manually update request status in Firestore Console

**Expected:** Status page updates automatically without refresh

---

## Deliverables Checklist

- [ ] PhotoUpload component with Firebase Storage integration
- [ ] CategorySelector component with app_config categories
- [ ] RequestForm page with validation
- [ ] RequestStatus page with real-time updates
- [ ] Request document created in Firestore
- [ ] Photo URLs stored correctly
- [ ] Routes updated
- [ ] Form validation working
- [ ] Character counter for description
- [ ] Loading states during submission

---

## Next Phase

Once all tests pass, proceed to **Phase 4: Helper Dashboard** to build the interface where Helpers view and claim requests.
