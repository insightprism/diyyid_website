import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/common/Header';
import { CategorySelector } from '../../components/customer/CategorySelector';
import { PhotoUpload } from '../../components/customer/PhotoUpload';
import { app_config } from '../../config/app_config';
import { db, storage } from '../../services/firebase_client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../hooks/use_auth';

export function RequestForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [category, set_category] = useState('');
  const [description, set_description] = useState('');
  const [photos, set_photos] = useState<File[]>([]);
  const [is_loading, set_is_loading] = useState(false);
  const [error, set_error] = useState('');

  const selected_category = app_config.categories.find(c => c.value === category);
  const base_price = selected_category?.base_price || 0;

  const validate_form = (): boolean => {
    if (!category) {
      set_error('Please select a category');
      return false;
    }
    if (description.length < app_config.validation.description_min_length) {
      set_error(`Description must be at least ${app_config.validation.description_min_length} characters`);
      return false;
    }
    if (description.length > app_config.validation.description_max_length) {
      set_error(`Description must be less than ${app_config.validation.description_max_length} characters`);
      return false;
    }
    return true;
  };

  const upload_photos = async (request_id: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const photo_ref = ref(storage, `requests/${request_id}/photo_${i}_${Date.now()}`);
      await uploadBytes(photo_ref, photo);
      const url = await getDownloadURL(photo_ref);
      urls.push(url);
    }
    return urls;
  };

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    set_error('');

    if (!validate_form()) return;
    if (!user) {
      set_error('You must be logged in');
      return;
    }

    set_is_loading(true);

    try {
      const request_ref = await addDoc(collection(db, 'requests'), {
        customer_id: user.uid,
        customer_name: user.display_name || 'Customer',
        category,
        description,
        photo_urls: [],
        status: 'pending',
        amount: base_price,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      if (photos.length > 0) {
        const photo_urls = await upload_photos(request_ref.id);
        await addDoc(collection(db, 'requests'), {
          photo_urls,
        });
      }

      navigate(`/customer/status/${request_ref.id}`);
    } catch (err) {
      console.error('Error creating request:', err);
      set_error('Failed to create request. Please try again.');
    } finally {
      set_is_loading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          What do you need help with?
        </h1>

        <form onSubmit={handle_submit} className="space-y-6">
          <div>
            <label className="label">Category</label>
            <CategorySelector
              value={category}
              on_change={set_category}
            />
          </div>

          <div>
            <label className="label">Describe your issue</label>
            <textarea
              value={description}
              onChange={(e) => set_description(e.target.value)}
              rows={4}
              className="input-field resize-none"
              placeholder="Please describe what you're trying to fix or install. Include any relevant details like model numbers, error messages, or what you've already tried..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {description.length}/{app_config.validation.description_max_length} characters
            </p>
          </div>

          <div>
            <label className="label">Photos (optional but helpful)</label>
            <PhotoUpload
              photos={photos}
              on_change={set_photos}
              max_photos={app_config.validation.max_photos}
            />
          </div>

          {category && (
            <div className="bg-primary-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Session Price</span>
                <span className="text-xl font-bold text-primary-600">
                  ${(base_price / 100).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Payment is pre-authorized and only charged after session completion
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={is_loading || !category}
            className="btn-primary w-full"
          >
            {is_loading ? 'Creating Request...' : 'Continue to Payment'}
          </button>
        </form>
      </div>
    </div>
  );
}
