import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

const MAX_SIZE = 5 * 1024 * 1024;

const ProfilePhotoEditor = ({ user, onUpdated, selfOnly = false }) => {
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const selectFile = (nextFile) => {
    setError('');
    setMessage('');
    if (!nextFile) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(nextFile.type)) {
      setError('Choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (nextFile.size > MAX_SIZE) {
      setError('The image must be 5 MB or smaller.');
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return nextPreviewUrl;
    });
  };

  const openCamera = async () => {
    setError('');
    setMessage('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera capture is not available in this browser. Use Choose image instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (cameraError) {
      setError(cameraError.name === 'NotAllowedError'
        ? 'Camera permission was denied. Use Choose image instead.'
        : 'Unable to open the camera. Use Choose image instead.');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      setError('The camera is still starting. Try again in a moment.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) selectFile(new File([blob], `profile-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
    closeCamera();
  };

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setMessage('');
    const formData = new FormData();
    formData.append('profile_photo', file, file.name);
    try {
      const endpoint = selfOnly ? '/users/me/profile-photo' : `/users/${user.user_id}/profile-photo`;
      const response = await api.put(endpoint, formData);
      if (!response.data?.success || !response.data?.data?.profile_photo_url) {
        throw new Error('The server did not confirm the saved profile photo.');
      }
      onUpdated(response.data.data);
      setFile(null);
      setPreviewUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return '';
      });
      setMessage('Profile photo saved.');
    } catch (uploadError) {
      setError(uploadError.response?.data?.message || uploadError.message || 'Unable to upload profile photo.');
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const endpoint = selfOnly ? '/users/me/profile-photo' : `/users/${user.user_id}/profile-photo`;
      const response = await api.delete(endpoint);
      if (!response.data?.success || response.data?.data?.profile_photo_url) {
        throw new Error('The server did not confirm profile photo removal.');
      }
      onUpdated(response.data.data);
      setMessage('Profile photo removed.');
    } catch (removeError) {
      setError(removeError.response?.data?.message || removeError.message || 'Unable to remove profile photo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ''; }} />
        <button type="button" className="dashboard-button" onClick={() => inputRef.current?.click()} disabled={loading}>Change Profile Photo</button>
        <button type="button" className="dashboard-button" onClick={openCamera} disabled={loading}>Use camera</button>
        {user.profile_photo_url && <button type="button" className="table-action" onClick={remove} disabled={loading}>Remove photo</button>}
      </div>
      {previewUrl && <div className="mt-4 flex flex-wrap items-center gap-4"><img src={previewUrl} alt="Selected profile preview" className="h-24 w-24 rounded-xl object-cover ring-2 ring-emerald-200" /><button type="button" className="dashboard-button primary" onClick={upload} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button></div>}
      {cameraOpen && <div className="mt-4 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-3"><video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg" /><div className="mt-3 flex gap-2"><button type="button" className="dashboard-button primary" onClick={capturePhoto}>Take photo</button><button type="button" className="dashboard-button" onClick={closeCamera}>Cancel</button></div></div>}
      {message && <p className="mt-3 text-sm font-bold text-emerald-700" role="status">{message}</p>}
      {error && <p className="mt-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
    </div>
  );
};

export default ProfilePhotoEditor;
