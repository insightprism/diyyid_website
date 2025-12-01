import { useRef, ChangeEvent } from 'react';
import { app_config } from '../../config/app_config';

interface PhotoUploadProps {
  photos: File[];
  on_change: (photos: File[]) => void;
  max_photos?: number;
}

export function PhotoUpload({
  photos,
  on_change,
  max_photos = app_config.photos.max_count,
}: PhotoUploadProps) {
  const file_input_ref = useRef<HTMLInputElement>(null);

  const handle_file_select = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const new_photos: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check max photos limit
      if (photos.length + new_photos.length >= max_photos) {
        break;
      }

      // Validate file type
      if (!app_config.photos.allowed_types.includes(file.type)) {
        continue;
      }

      // Validate file size
      if (file.size > app_config.photos.max_size_mb * 1024 * 1024) {
        continue;
      }

      new_photos.push(file);
    }

    if (new_photos.length > 0) {
      on_change([...photos, ...new_photos]);
    }

    // Reset file input
    if (file_input_ref.current) {
      file_input_ref.current.value = '';
    }
  };

  const remove_photo = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    on_change(updated);
  };

  const can_add_more = photos.length < max_photos;

  return (
    <div className="space-y-3">
      {/* Photo Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {photos.map((file, index) => (
          <div key={index} className="relative aspect-square group">
            <img
              src={URL.createObjectURL(file)}
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
            className="aspect-square border-2 border-dashed border-gray-300 rounded-lg
                       flex flex-col items-center justify-center text-gray-400
                       hover:border-primary-400 hover:text-primary-500 transition-colors"
          >
            <span className="text-2xl">+</span>
            <span className="text-xs mt-1">Add Photo</span>
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

      <p className="text-xs text-gray-500">
        {photos.length}/{max_photos} photos. Clear photos help get better assistance.
      </p>
    </div>
  );
}
