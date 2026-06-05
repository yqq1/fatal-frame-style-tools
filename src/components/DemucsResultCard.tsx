import { Download } from 'lucide-react';

type DemucsResultCardProps = {
  downloadUrl: string;
  name: string;
  size: number;
};

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function DemucsResultCard({ downloadUrl, name, size }: DemucsResultCardProps) {
  return (
    <div className="demucs-result-card">
      <div>
        <strong>{name}</strong>
        <span>{formatBytes(size)}</span>
      </div>
      <audio controls src={downloadUrl} />
      <a href={downloadUrl} download>
        <Download size={16} aria-hidden="true" />
        下载
      </a>
    </div>
  );
}
