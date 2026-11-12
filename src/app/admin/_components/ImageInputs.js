'use client';
import { useRef, useState } from 'react';
import { App, Button, Input, Space, Tooltip, Upload } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, LinkOutlined, UploadOutlined } from '@ant-design/icons';
import { uploadImage } from '@/lib/client/api';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
const MAX_BYTES = 8 * 1024 * 1024;

const thumb = {
  width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee5dc', background: '#faf7f3', display: 'block',
};

function useUploader(folder) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(0);
  const upload = async (file) => {
    if (file.size > MAX_BYTES) {
      message.error(`${file.name} is larger than 8 MB`);
      return null;
    }
    setUploading((n) => n + 1);
    try {
      return await uploadImage(file, folder);
    } catch (e) {
      message.error(e.message || 'Upload failed');
      return null;
    } finally {
      setUploading((n) => n - 1);
    }
  };
  return { upload, uploading };
}

/** Ordered list of image URLs: upload (multiple), paste a URL, reorder, remove. Form-compatible (value/onChange). */
export function ImageListInput({ value, onChange, folder = 'products', max = 12 }) {
  const images = Array.isArray(value) ? value : [];
  const latest = useRef(images);
  latest.current = images;
  const { upload, uploading } = useUploader(folder);
  const [url, setUrl] = useState('');
  const set = (next) => onChange?.(next.slice(0, max));
  const move = (i, d) => {
    const next = [...images];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        {images.map((src, i) => (
          <div key={`${src}-${i}`} style={{ width: 88 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" style={thumb} />
            <Space size={0} style={{ marginTop: 4 }}>
              <Tooltip title="Move left">
                <Button size="small" type="text" icon={<ArrowUpOutlined rotate={-90} />} disabled={i === 0} onClick={() => move(i, -1)} />
              </Tooltip>
              <Tooltip title="Move right">
                <Button size="small" type="text" icon={<ArrowDownOutlined rotate={-90} />} disabled={i === images.length - 1} onClick={() => move(i, 1)} />
              </Tooltip>
              <Tooltip title="Remove">
                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => set(images.filter((_, k) => k !== i))} />
              </Tooltip>
            </Space>
            {i === 0 && <div style={{ fontSize: 11, color: '#8c8178' }}>Main image</div>}
          </div>
        ))}
      </div>
      <Space wrap>
        <Upload
          accept={ACCEPT}
          multiple
          showUploadList={false}
          disabled={images.length >= max}
          beforeUpload={() => true}
          customRequest={async ({ file, onSuccess, onError }) => {
            const u = await upload(file);
            if (u) {
              // Several uploads can finish before the next render: append to the latest list.
              latest.current = [...latest.current, u];
              set(latest.current);
              onSuccess?.(u);
            } else onError?.(new Error('failed'));
          }}
        >
          <Button icon={<UploadOutlined />} loading={uploading > 0} disabled={images.length >= max}>
            Upload images
          </Button>
        </Upload>
        <Space.Compact>
          <Input
            placeholder="…or paste an image URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ width: 240 }}
            prefix={<LinkOutlined />}
          />
          <Button
            disabled={!/^(https?:\/\/|\/)\S+$/.test(url.trim()) || images.length >= max}
            onClick={() => {
              set([...images, url.trim()]);
              setUrl('');
            }}
          >
            Add
          </Button>
        </Space.Compact>
      </Space>
    </div>
  );
}

/** Single image URL with upload + clear. Form-compatible (value/onChange). */
export function ImageInput({ value, onChange, folder = 'products', size = 64 }) {
  const { upload, uploading } = useUploader(folder);
  return (
    <Space align="center" wrap>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" style={{ ...thumb, width: size, height: size }} />
      ) : (
        <div style={{ ...thumb, width: size, height: size }} />
      )}
      <Upload
        accept={ACCEPT}
        showUploadList={false}
        customRequest={async ({ file, onSuccess, onError }) => {
          const u = await upload(file);
          if (u) {
            onChange?.(u);
            onSuccess?.(u);
          } else onError?.(new Error('failed'));
        }}
      >
        <Button size="small" icon={<UploadOutlined />} loading={uploading > 0}>
          {value ? 'Replace' : 'Upload'}
        </Button>
      </Upload>
      {value && (
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange?.(null)} aria-label="Remove image" />
      )}
    </Space>
  );
}
