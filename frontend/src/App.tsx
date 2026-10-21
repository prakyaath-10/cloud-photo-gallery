import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const S3_BASE = import.meta.env.VITE_S3_BUCKET_URL || '';
const USER_ID = 'demo-user-1';

interface Photo {
  photoId: string;
  caption: string;
  size: number;
  uploadedAt: number;
}

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchPhotos = async () => {
    if (!API_BASE) return;
    try {
      const res = await fetch(`${API_BASE}/photos?userId=${USER_ID}`);
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (err) {
      console.error('Failed to load photos', err);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (selected) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setStatusMsg('Requesting secure upload ticket...');

    try {
      // 1. Get Pre-Signed URL
      const urlRes = await fetch(`${API_BASE}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, fileName: file.name, contentType: file.type }),
      });
      const { url, key } = await urlRes.json();

      setStatusMsg('Uploading image directly to S3...');
      // 2. Direct PUT to S3
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      setStatusMsg('Registering metadata in DynamoDB...');
      // 3. Confirm to DynamoDB
      await fetch(`${API_BASE}/confirm-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, key, caption, size: file.size }),
      });

      setFile(null);
      setPreviewUrl(null);
      setCaption('');
      setStatusMsg('Upload successful!');
      setTimeout(() => setStatusMsg(''), 3000);
      await fetchPhotos();
    } catch (err) {
      console.error('Upload failed', err);
      setStatusMsg('Upload failed. Check your API endpoints.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Top Navigation */}
      <header style={styles.navbar}>
        <div style={styles.navContainer}>
          <div style={styles.brand}>
            <span style={styles.brandIcon}>☁️</span>
            <span style={styles.brandTitle}>CloudGallery</span>
          </div>
          <span style={styles.badge}>AWS Serverless</span>
        </div>
      </header>

      {/* Main Container */}
      <main style={styles.container}>
        {/* Upload Card */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Upload New Photo</h2>
          <p style={styles.cardSubtitle}>
            Files are transferred directly to Amazon S3 via pre-signed URLs.
          </p>

          <form onSubmit={handleUpload} style={styles.form}>
            <div style={styles.uploadArea}>
              {previewUrl ? (
                <div style={styles.previewContainer}>
                  <img src={previewUrl} alt="Preview" style={styles.previewImage} />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                    style={styles.removeBtn}
                  >
                    Change Photo
                  </button>
                </div>
              ) : (
                <label style={styles.dropzone}>
                  <span style={{ fontSize: '32px' }}>📷</span>
                  <span style={styles.dropzoneText}>Click to select an image from your device</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            <div style={styles.inputGroup}>
              <input
                type="text"
                placeholder="Add a photo caption or tag..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                style={styles.textInput}
              />
              <button
                type="submit"
                disabled={!file || uploading}
                style={{
                  ...styles.submitBtn,
                  opacity: !file || uploading ? 0.6 : 1,
                  cursor: !file || uploading ? 'not-allowed' : 'pointer',
                }}
              >
                {uploading ? 'Processing...' : 'Upload Image'}
              </button>
            </div>

            {statusMsg && <p style={styles.status}>{statusMsg}</p>}
          </form>
        </section>

        {/* Gallery Section */}
        <section style={styles.gallerySection}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Your Photos</h3>
            <span style={styles.photoCount}>{photos.length} items</span>
          </div>

          {photos.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={{ fontSize: '42px' }}>🖼️</span>
              <p style={{ marginTop: '12px', color: '#64748b' }}>
                No photos found in your cloud storage yet. Upload your first picture above!
              </p>
            </div>
          ) : (
            <div style={styles.grid}>
              {photos.map((p) => (
                <div key={p.photoId} style={styles.photoCard}>
                  <div style={styles.imageWrapper}>
                    <img
                      src={`${S3_BASE}/${p.photoId}`}
                      alt={p.caption || 'User upload'}
                      style={styles.image}
                      loading="lazy"
                    />
                  </div>
                  <div style={styles.photoDetails}>
                    <p style={styles.photoCaption}>{p.caption || 'Untitled Photo'}</p>
                    <div style={styles.metaRow}>
                      <span style={styles.photoSize}>{(p.size / 1024).toFixed(1)} KB</span>
                      <span style={styles.photoDate}>
                        {new Date(p.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    backgroundColor: '#0f172a',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#f8fafc',
    margin: 0,
    padding: 0,
  },
  navbar: {
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
    padding: '16px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  navContainer: {
    maxWidth: '1000px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandIcon: {
    fontSize: '24px',
  },
  brandTitle: {
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  badge: {
    fontSize: '12px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: '12px',
    fontWeight: 600,
  },
  container: {
    maxWidth: '1000px',
    margin: '36px auto',
    padding: '0 20px',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    border: '1px solid #334155',
    padding: '24px',
    marginBottom: '40px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
  },
  cardTitle: {
    margin: '0 0 6px 0',
    fontSize: '18px',
    fontWeight: 600,
  },
  cardSubtitle: {
    margin: '0 0 20px 0',
    fontSize: '13px',
    color: '#94a3b8',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  uploadArea: {
    width: '100%',
  },
  dropzone: {
    border: '2px dashed #475569',
    borderRadius: '12px',
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    backgroundColor: '#0f172a',
    transition: 'border-color 0.2s ease',
  },
  dropzoneText: {
    fontSize: '14px',
    color: '#94a3b8',
  },
  previewContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  previewImage: {
    width: '100%',
    maxHeight: '260px',
    objectFit: 'contain',
    borderRadius: '8px',
    backgroundColor: '#0f172a',
  },
  removeBtn: {
    backgroundColor: '#334155',
    border: 'none',
    color: '#cbd5e1',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  inputGroup: {
    display: 'flex',
    gap: '12px',
  },
  textInput: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    fontSize: '14px',
    outline: 'none',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    transition: 'background-color 0.2s',
  },
  status: {
    fontSize: '13px',
    color: '#38bdf8',
    margin: 0,
  },
  gallerySection: {
    marginTop: '20px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '18px',
    margin: 0,
    fontWeight: 600,
  },
  photoCount: {
    fontSize: '13px',
    color: '#64748b',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    border: '1px dashed #334155',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '18px',
  },
  photoCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  imageWrapper: {
    width: '100%',
    height: '180px',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoDetails: {
    padding: '12px 14px',
  },
  photoCaption: {
    fontSize: '14px',
    fontWeight: 600,
    margin: '0 0 6px 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#64748b',
  },
  photoSize: {
    fontVariantNumeric: 'tabular-nums',
  },
  photoDate: {},
};