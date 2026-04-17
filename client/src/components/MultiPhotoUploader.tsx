import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X, ImagePlus, Camera } from "lucide-react";

interface UploadedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  uploadUrl?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
}

interface MultiPhotoUploaderProps {
  maxPhotos?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{ method: "PUT"; url: string }>;
  photos: UploadedPhoto[];
  setPhotos: React.Dispatch<React.SetStateAction<UploadedPhoto[]>>;
  disabled?: boolean;
}

export function MultiPhotoUploader({
  maxPhotos = 5,
  maxFileSize = 10485760,
  onGetUploadParameters,
  photos,
  setPhotos,
  disabled = false,
}: MultiPhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = maxPhotos - photos.length;
    const filesToAdd = files.slice(0, remainingSlots);

    const newPhotos: UploadedPhoto[] = filesToAdd
      .filter(file => {
        if (file.size > maxFileSize) return false;
        if (!file.type.startsWith('image/')) return false;
        return true;
      })
      .map(file => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending' as const,
      }));

    if (newPhotos.length === 0) return;

    setPhotos(prev => [...prev, ...newPhotos]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setUploading(true);
    for (const photo of newPhotos) {
      try {
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, status: 'uploading' } : p
        ));

        const { url } = await onGetUploadParameters();
        
        const response = await fetch(url, {
          method: 'PUT',
          body: photo.file,
          headers: { 'Content-Type': photo.file.type },
        });

        if (!response.ok) throw new Error('Upload failed');

        const publicUrl = url.split('?')[0];
        
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, status: 'uploaded', uploadUrl: publicUrl } : p
        ));
      } catch (err) {
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, status: 'error' } : p
        ));
      }
    }
    setUploading(false);
  }, [photos.length, maxPhotos, maxFileSize, onGetUploadParameters, setPhotos]);

  const removePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return prev.filter(p => p.id !== id);
    });
  }, [setPhotos]);

  const canAddMore = photos.length < maxPhotos && !disabled;

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        multiple
        className="hidden"
        data-testid="input-photo-upload"
      />
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={!canAddMore || uploading}
        className="h-10 w-10 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
        data-testid="button-add-photos"
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Camera className="w-5 h-5" />
        )}
      </Button>
    </div>
  );
}

interface PhotoPreviewBarProps {
  photos: UploadedPhoto[];
  onRemove: (id: string) => void;
}

export function PhotoPreviewBar({ photos, onRemove }: PhotoPreviewBarProps) {
  if (photos.length === 0) return null;

  return (
    <div className="flex gap-2 p-2 overflow-x-auto" data-testid="photo-preview-bar">
      {photos.map((photo) => (
        <div 
          key={photo.id} 
          className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10"
          data-testid={`photo-preview-${photo.id}`}
        >
          <img
            src={photo.previewUrl}
            alt="Upload preview"
            className="w-full h-full object-cover"
          />
          {photo.status === 'uploading' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            </div>
          )}
          {photo.status === 'error' && (
            <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </div>
          )}
          <button
            onClick={() => onRemove(photo.id)}
            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 hover:bg-black/90 transition-colors"
            data-testid={`button-remove-photo-${photo.id}`}
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ))}
    </div>
  );
}

export type { UploadedPhoto };
