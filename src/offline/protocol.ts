export interface OfflineAsset {
  url: string;
  bytes: number;
  /** SHA-256 of the uncompressed response body. */
  revision: string;
}

export interface OfflineManifest {
  version: string;
  base: string;
  totalBytes: number;
  assets: OfflineAsset[];
}

export interface OfflineRequest {
  type: 'STATUS' | 'DOWNLOAD' | 'ACTIVATE';
  /** Active worker version to retain while its page restarts into an update. */
  activeVersion?: string;
}

export interface OfflineReply {
  type: 'STATUS' | 'PROGRESS' | 'ERROR' | 'ACTIVATING';
  version: string;
  ready: boolean;
  downloading: boolean;
  completed: number;
  total: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}
