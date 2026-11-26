import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageBlock } from '../src/components/editor/blocks/ImageBlock';
import { ApiClient } from '../src/api/client';
import { ImageBlockContent } from '@notebook/shared';

vi.mock('../src/api/client', () => ({
  ApiClient: {
    uploadImage: vi.fn(),
  },
}));

describe('ImageBlock (Web)', () => {
  const mockOnChange = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty / Upload State', () => {
    const emptyContent: ImageBlockContent = {
      url: '',
      caption: '',
    };

    it('renders dropzone, file input, and URL input when url is empty', () => {
      render(
        <ImageBlock
          content={emptyContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/paste image url/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add image/i })).toBeInTheDocument();
    });

    it('defensively handles null or undefined content without crashing', () => {
      render(
        <ImageBlock
          content={null as any}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/paste image url/i)).toBeInTheDocument();
    });

    it('allows entering an image URL and clicking Add Image', () => {
      render(
        <ImageBlock
          content={emptyContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const urlInput = screen.getByPlaceholderText(/paste image url/i);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/photo.png' } });

      const addBtn = screen.getByRole('button', { name: /add image/i });
      fireEvent.click(addBtn);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/photo.png',
        })
      );
    });

    it('submits URL when Enter key is pressed in URL input', () => {
      render(
        <ImageBlock
          content={emptyContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const urlInput = screen.getByPlaceholderText(/paste image url/i);
      fireEvent.change(urlInput, { target: { value: 'https://example.com/photo2.png' } });
      fireEvent.keyDown(urlInput, { key: 'Enter', code: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/photo2.png',
        })
      );
    });

    it('uploads file when file is selected via input and updates content', async () => {
      const mockUploadResponse = {
        url: '/uploads/uploaded-pic.png',
        filename: 'uploaded-pic.png',
        sizeBytes: 12345,
      };
      (ApiClient.uploadImage as any).mockResolvedValueOnce(mockUploadResponse);

      render(
        <ImageBlock
          content={emptyContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const file = new File(['dummy image content'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(ApiClient.uploadImage).toHaveBeenCalledWith(file);
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/uploads/uploaded-pic.png',
          })
        );
      });
    });

    it('handles drag and drop file upload', async () => {
      const mockUploadResponse = {
        url: '/uploads/dropped-pic.jpg',
        filename: 'dropped-pic.jpg',
        sizeBytes: 54321,
      };
      (ApiClient.uploadImage as any).mockResolvedValueOnce(mockUploadResponse);

      render(
        <ImageBlock
          content={emptyContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const dropzone = screen.getByTestId('image-dropzone');
      const file = new File(['dropped image'], 'drop.jpg', { type: 'image/jpeg' });

      fireEvent.dragOver(dropzone);
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
        },
      });

      expect(ApiClient.uploadImage).toHaveBeenCalledWith(file);
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/uploads/dropped-pic.jpg',
          })
        );
      });
    });

    it('displays error message when upload fails', async () => {
      (ApiClient.uploadImage as any).mockRejectedValueOnce(new Error('File exceeds 10MB limit'));

      render(
        <ImageBlock
          content={emptyContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const file = new File(['large content'], 'large.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/file exceeds 10mb limit/i)).toBeInTheDocument();
      });
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Rendered Image State', () => {
    const loadedContent: ImageBlockContent = {
      url: '/uploads/test-image.jpg',
      caption: 'A scenic mountain view',
    };

    it('renders image preview and caption input when url is present', () => {
      render(
        <ImageBlock
          content={loadedContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/uploads/test-image.jpg');
      expect(img).toHaveAttribute('alt', 'A scenic mountain view');

      const captionInput = screen.getByPlaceholderText(/add a caption/i);
      expect(captionInput).toHaveValue('A scenic mountain view');
    });

    it('calls onChange when caption is updated', () => {
      render(
        <ImageBlock
          content={loadedContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const captionInput = screen.getByPlaceholderText(/add a caption/i);
      fireEvent.change(captionInput, { target: { value: 'New updated caption' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/uploads/test-image.jpg',
          caption: 'New updated caption',
        })
      );
    });

    it('calls onDelete when delete button is clicked', () => {
      render(
        <ImageBlock
          content={loadedContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const deleteBtn = screen.getByTitle(/delete image block/i);
      fireEvent.click(deleteBtn);

      expect(mockOnDelete).toHaveBeenCalled();
    });

    it('allows clearing / replacing the image', () => {
      render(
        <ImageBlock
          content={loadedContent}
          onChange={mockOnChange}
          onDelete={mockOnDelete}
        />
      );

      const replaceBtn = screen.getByTitle(/replace image/i);
      fireEvent.click(replaceBtn);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '',
        })
      );
    });

    it('wraps rendered image in an auto-fitting left-aligned container without stretching background to full width', () => {
      render(
        <ImageBlock
          content={{ url: 'https://example.com/test.png', caption: 'Test photo' }}
          onChange={() => {}}
        />
      );
      const img = screen.getByAltText('Test photo');
      const container = img.closest('div');
      expect(container).toHaveClass('max-w-fit');
      expect(container).not.toHaveClass('w-full');
      expect(container).not.toHaveClass('mx-auto');

      const outerWrapper = container?.parentElement;
      expect(outerWrapper).toHaveClass('items-start');
      expect(outerWrapper).not.toHaveClass('items-center');

      const captionInput = screen.getByPlaceholderText(/add a caption/i);
      expect(captionInput).toHaveClass('text-left');
    });
  });
});
