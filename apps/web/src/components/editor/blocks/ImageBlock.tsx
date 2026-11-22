import React, { useState, useRef } from 'react';
import { ImageBlockContent } from '@notebook/shared';
import { ApiClient } from '../../../api/client';
import { Image as ImageIcon, Upload, Trash2, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

export interface ImageBlockProps {
  content: ImageBlockContent;
  onChange: (updated: ImageBlockContent) => void;
  onDelete?: () => void;
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ content, onChange, onDelete }) => {
  const { url = '', caption = '' } = content || {};
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);
      const res = await ApiClient.uploadImage(file);
      onChange({
        ...(content || {}),
        url: res.url,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    // reset input value so re-selecting the same file fires change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleUrlSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onChange({
      ...(content || {}),
      url: trimmed,
    });
    setUrlInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUrlSubmit();
    }
  };

  const handleClearImage = () => {
    onChange({
      ...(content || {}),
      url: '',
    });
  };

  // 1. Upload / Empty state
  if (!url) {
    return (
      <div className="w-full my-2">
        <div
          data-testid="image-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all ${
            isDragging
              ? 'border-stone-900 bg-stone-100/60 dark:border-stone-100 dark:bg-stone-800/40'
              : 'border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/40 hover:border-stone-300 dark:hover:border-stone-600'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            data-testid="image-file-input"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-4 text-stone-500 dark:text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin text-stone-600 dark:text-stone-300" />
              <p className="text-xs font-medium">Uploading image...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-3 w-full max-w-sm">
              <div className="p-3 bg-stone-100 dark:bg-stone-700 rounded-full text-stone-500 dark:text-stone-300">
                <ImageIcon className="w-6 h-6" />
              </div>

              <div>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
                  Drag & drop an image here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-stone-900 dark:text-stone-100 font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    browse
                  </button>
                </p>
                <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                  PNG, JPG, GIF, WebP, SVG up to 10MB
                </p>
              </div>

              {/* Or paste URL */}
              <div className="w-full flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Paste image URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
                <button
                  type="button"
                  onClick={() => handleUrlSubmit()}
                  disabled={!urlInput.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 rounded-lg hover:opacity-90 disabled:opacity-40 transition"
                >
                  Add Image
                </button>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Image Loaded state
  return (
    <div className="group/image relative w-full my-2 flex flex-col items-center">
      {/* Floating Toolbar Controls */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/image:opacity-100 transition-opacity bg-stone-900/70 backdrop-blur-md px-1.5 py-1 rounded-lg text-white z-10">
        <button
          type="button"
          onClick={handleClearImage}
          title="Replace image"
          aria-label="Replace image"
          className="p-1 hover:bg-white/20 rounded text-xs transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete image block"
            aria-label="Delete image block"
            className="p-1 hover:bg-red-500/80 rounded text-xs text-red-200 hover:text-white transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Image Preview */}
      <div className="w-full flex justify-center overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/60">
        <img
          src={url}
          alt={caption || 'Note image'}
          className="max-h-[500px] w-auto max-w-full object-contain rounded-xl"
          loading="lazy"
        />
      </div>

      {/* Caption Input */}
      <div className="w-full max-w-lg mt-1.5">
        <input
          type="text"
          placeholder="Add a caption..."
          aria-label="Image caption"
          value={caption}
          onChange={(e) => onChange({ ...(content || {}), caption: e.target.value })}
          className="w-full text-center text-xs text-stone-500 dark:text-stone-400 bg-transparent border-b border-transparent hover:border-stone-200 focus:border-stone-300 dark:focus:border-stone-600 focus:outline-none py-1 placeholder-stone-400 dark:placeholder-stone-500 transition-colors"
        />
      </div>
    </div>
  );
};
