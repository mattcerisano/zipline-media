import { NextResponse } from 'next/server';
import { getValidGoogleToken } from '@/lib/google-auth';
import { getAuthedUserId } from '@/lib/api-auth';

function extractFolderId(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9-_]+)/) || url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function formatBytes(bytes: number | string | undefined): string {
  if (!bytes) return 'Unknown';
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num)) return 'Unknown';
  if (num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const driveUrl = searchParams.get('url');

  const generateMockFiles = () => {
    return [
      { name: '01_Director_Cut_V2.mp4', size: '1.4 GB', type: 'video', date: '3 days ago', url: driveUrl || '#' },
      { name: 'Audio_Mix_Stems_Master.zip', size: '320 MB', type: 'archive', date: '2 days ago', url: driveUrl || '#' },
      { name: 'Zipline_Creative_Brief.pdf', size: '12 MB', type: 'document', date: '5 days ago', url: driveUrl || '#' },
      { name: 'Client_Feedback_Grid.xlsx', size: '4.8 MB', type: 'document', date: 'Yesterday', url: driveUrl || '#' },
      { name: 'Raw_Production_Still_01.jpg', size: '8.5 MB', type: 'image', date: 'Yesterday', url: driveUrl || '#' },
    ];
  };

  // Identity comes from the verified session so a user can only list folders
  // through their own connected Drive account.
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 1. Get valid Google token
  const token = await getValidGoogleToken(userId);
  if (!token) {
    return NextResponse.json({ files: generateMockFiles(), isLive: false });
  }

  // 2. Extract Folder ID
  const folderId = driveUrl ? extractFolderId(driveUrl) : null;
  if (!folderId) {
    return NextResponse.json({ files: generateMockFiles(), isLive: false });
  }

  try {
    // 3. Call Google Drive API to list files in folder
    const queryUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&orderBy=folder,name`;
    const res = await fetch(queryUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API returned ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const googleFiles = (data.files || []).map((file: any) => {
      let fileType = 'document';
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        fileType = 'folder';
      } else if (file.mimeType.startsWith('video/')) {
        fileType = 'video';
      } else if (file.mimeType.startsWith('audio/')) {
        fileType = 'audio';
      } else if (file.mimeType.startsWith('image/')) {
        fileType = 'image';
      } else if (file.mimeType.includes('zip') || file.mimeType.includes('tar') || file.mimeType.includes('rar')) {
        fileType = 'archive';
      }

      const date = new Date(file.modifiedTime).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      return {
        name: file.name,
        size: fileType === 'folder' ? '--' : formatBytes(file.size),
        type: fileType,
        date: date,
        url: file.webViewLink || '#',
      };
    });

    return NextResponse.json({ files: googleFiles, isLive: true });
  } catch (err: any) {
    console.error('Google Drive API error:', err.message);
    return NextResponse.json({ files: generateMockFiles(), isLive: false });
  }
}
