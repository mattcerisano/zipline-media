'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Clock, 
  CheckCircle, 
  MessageSquare, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  FileVideo, 
  Send, 
  Trash2,
  Lock,
  Unlock,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: number; // in seconds
  created_at: string;
}

interface VideoReview {
  id: string;
  job_id: string;
  job_title: string;
  version_number: number;
  video_url: string;
  comments: Comment[];
  approved: boolean;
  created_at: string;
}

export default function ClientReview() {
  const [reviews, setReviews] = useState<VideoReview[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [useLocalStorage, setUseLocalStorage] = useState(false);

  // Video player refs & states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, []);

  const activeReview = reviews.find(r => r.id === selectedReviewId) || null;

  // Track video progress
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Jump video to specific timestamp
  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Format seconds to mm:ss
  const formatSeconds = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Fetch from Supabase or LocalStorage
  const fetchReviews = async () => {
    setIsLoading(true);
    let loadedReviews: VideoReview[] = [];
    let fallbackToLocal = false;

    try {
      const { data, error } = await supabase
        .from('video_reviews')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // If table is empty or missing, fetch jobs to bind
      if (data && data.length > 0) {
        loadedReviews = data.map(item => ({
          ...item,
          job_title: 'Commercial Cut' // Placeholder title or fetch jobs to match
        }));
      } else {
        fallbackToLocal = true;
      }
    } catch (err) {
      console.warn('Video reviews table not available in Supabase. Using local fallback.');
      fallbackToLocal = true;
    }

    if (fallbackToLocal) {
      setUseLocalStorage(true);
      const local = localStorage.getItem('studio_video_reviews_local');
      if (local) {
        try {
          loadedReviews = JSON.parse(local);
        } catch (e) {
          loadedReviews = [];
        }
      } else {
        // High fidelity mock data for first load
        loadedReviews = [
          {
            id: 'rev-1',
            job_id: 'job-1',
            job_title: 'Pekoe Commercial Cut - Director\'s Cut',
            version_number: 2,
            // Premium free stock creative video
            video_url: 'https://assets.mixkit.co/videos/preview/mixkit-cinematic-shot-of-a-guitarist-playing-electric-guitar-41793-large.mp4',
            approved: false,
            created_at: new Date().toISOString(),
            comments: [
              { id: 'c-1', author: 'Matt (Director)', text: 'Awesome guitar solo shot, but let\'s color-grade the background slightly darker to match the brand vibes.', timestamp: 4.5, created_at: new Date().toISOString() },
              { id: 'c-2', author: 'Sarah (Client)', text: 'Can we hold on this frame for 1 more second before transitioning to the logo card?', timestamp: 8.2, created_at: new Date().toISOString() }
            ]
          },
          {
            id: 'rev-2',
            job_id: 'job-2',
            job_title: 'Broadway B-Roll Reel - Client Cut',
            version_number: 1,
            video_url: 'https://assets.mixkit.co/videos/preview/mixkit-recording-studio-with-microphone-and-soundproof-walls-43573-large.mp4',
            approved: true,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            comments: [
              { id: 'c-3', author: 'Tommy (Editor)', text: 'Initial audio sync looks complete. Ready for review.', timestamp: 0.5, created_at: new Date().toISOString() },
              { id: 'c-4', author: 'Sarah (Client)', text: 'Perfect. Approved for publication!', timestamp: 12.0, created_at: new Date().toISOString() }
            ]
          }
        ];
        localStorage.setItem('studio_video_reviews_local', JSON.stringify(loadedReviews));
      }
    }

    setReviews(loadedReviews);
    if (loadedReviews.length > 0) {
      setSelectedReviewId(loadedReviews[0].id);
    }
    setIsLoading(false);
  };

  // Save active review changes
  const saveReview = async (updatedReview: VideoReview) => {
    const updatedReviews = reviews.map(r => r.id === updatedReview.id ? updatedReview : r);
    setReviews(updatedReviews);

    if (useLocalStorage) {
      localStorage.setItem('studio_video_reviews_local', JSON.stringify(updatedReviews));
    } else {
      try {
        await supabase
          .from('video_reviews')
          .upsert({
            id: updatedReview.id,
            job_id: updatedReview.job_id,
            version_number: updatedReview.version_number,
            video_url: updatedReview.video_url,
            comments: updatedReview.comments,
            approved: updatedReview.approved,
            updated_at: new Date().toISOString()
          });
      } catch (err) {
        console.error('Failed to sync review to Supabase, updating local cache:', err);
        localStorage.setItem('studio_video_reviews_local', JSON.stringify(updatedReviews));
      }
    }
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Add a timestamped comment
  const handleAddComment = () => {
    if (!activeReview || !commentText.trim()) return;

    const newComment: Comment = {
      id: 'comm_' + Date.now(),
      author: 'Matt (Editor)', // Simulated user
      text: commentText.trim(),
      timestamp: currentTime,
      created_at: new Date().toISOString()
    };

    // Sort comments by timestamp
    const updatedComments = [...activeReview.comments, newComment].sort((a, b) => a.timestamp - b.timestamp);
    const updatedReview = { ...activeReview, comments: updatedComments };
    
    saveReview(updatedReview);
    setCommentText('');
  };

  // Remove a comment
  const handleDeleteComment = (commentId: string) => {
    if (!activeReview) return;
    const updatedComments = activeReview.comments.filter(c => c.id !== commentId);
    saveReview({ ...activeReview, comments: updatedComments });
  };

  // Toggle approval status
  const handleToggleApproval = () => {
    if (!activeReview) return;
    const updatedReview = { ...activeReview, approved: !activeReview.approved };
    saveReview(updatedReview);
  };

  // Create a new version/review cut
  const handleAddNewVersion = () => {
    if (!activeReview) return;
    const nextVer = activeReview.version_number + 1;
    const newRev: VideoReview = {
      id: 'rev_' + Date.now(),
      job_id: activeReview.job_id,
      job_title: `${activeReview.job_title} (V${nextVer})`,
      version_number: nextVer,
      video_url: activeReview.video_url, // keep same url for demo
      approved: false,
      created_at: new Date().toISOString(),
      comments: []
    };

    const updated = [newRev, ...reviews];
    setReviews(updated);
    setSelectedReviewId(newRev.id);

    if (useLocalStorage) {
      localStorage.setItem('studio_video_reviews_local', JSON.stringify(updated));
    }
  };

  return (
    <div className="flex h-full bg-neutral-950 text-white overflow-hidden">
      {/* LEFT SIDEBAR: REVIEW CUTS TREE */}
      <div className="w-80 border-r border-white/10 bg-zinc-900/30 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
              <Video className="w-4 h-4" /> Review Workspace
            </h2>
            <button
              onClick={handleAddNewVersion}
              disabled={!activeReview}
              className="p-1.5 bg-white/10 hover:bg-accent hover:text-white rounded-lg text-white/70 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Upload new version cut"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] md:text-[9px] font-bold text-white/30 uppercase tracking-wider mt-1.5">
            Frame-accurate client review & approval
          </p>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40 gap-2">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Loading reviews…</span>
            </div>
          ) : reviews.length > 0 ? (
            reviews.map(rev => {
              const isSelected = rev.id === selectedReviewId;
              return (
                <div
                  key={rev.id}
                  onClick={() => setSelectedReviewId(rev.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative overflow-hidden ${
                    isSelected 
                      ? 'bg-accent/15 border-accent/25 text-white shadow-md shadow-accent/5' 
                      : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03] text-white/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate tracking-tight">{rev.job_title}</p>
                      <span className="text-[11px] md:text-[8px] font-black uppercase bg-white/5 border border-white/5 text-white/50 px-2 py-0.5 rounded-full mt-1 inline-block">
                        Version {rev.version_number}
                      </span>
                    </div>
                    
                    {/* Approved Badge */}
                    {rev.approved ? (
                      <span className="text-green-400 shrink-0" title="Approved by Client">
                        <CheckCircle className="w-5 h-5 fill-green-500/10" />
                      </span>
                    ) : (
                      <span className="text-yellow-500/60 shrink-0" title="Pending Review">
                        <Clock className="w-5 h-5" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] md:text-[9px] font-bold text-white/30 uppercase tracking-wider border-t border-white/5 pt-2 mt-1">
                    <span>{rev.comments.length} Comments</span>
                    <span>{new Date(rev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-white/30 text-xs font-semibold uppercase tracking-wider">
              No video reviews found
            </div>
          )}
        </div>

        {/* Local sandbox status */}
        <div className="p-3 bg-black/40 border-t border-white/10 flex items-center gap-1.5 text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/40">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>{useLocalStorage ? 'Local Client Sandbox' : 'Cloud Review Synced'}</span>
        </div>
      </div>

      {/* RIGHT WORKSPACE: VIDEO PLAYER & COMMENT TIMELINE */}
      <div className="flex-grow flex overflow-hidden h-full">
        {activeReview ? (
          <div className="flex-grow flex overflow-hidden h-full">
            {/* COLUMN 1: INTERACTIVE PLAYER (65% Width) */}
            <div className="flex-[5] flex flex-col border-r border-white/10 h-full overflow-hidden">
              {/* Header Title */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                <div>
                  <h1 className="text-lg font-black tracking-tight text-white">{activeReview.job_title}</h1>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mt-0.5">
                    Job ID: {activeReview.job_id} | Version {activeReview.version_number}
                  </p>
                </div>

                {/* Approval Action Button */}
                <button
                  onClick={handleToggleApproval}
                  className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-lg ${
                    activeReview.approved 
                      ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/15' 
                      : 'bg-yellow-500 hover:bg-white hover:text-black text-black shadow-yellow-500/15'
                  }`}
                >
                  {activeReview.approved ? (
                    <>
                      <CheckCircle className="w-4 h-4 fill-current text-white" /> Approved Cut
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" /> Approve Draft
                    </>
                  )}
                </button>
              </div>

              {/* Video Player Box */}
              <div className="flex-1 bg-black p-6 flex flex-col justify-center items-center overflow-hidden border-b border-white/10 relative group">
                <video
                  ref={videoRef}
                  src={activeReview.video_url}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={togglePlay}
                  className="max-h-[70vh] w-full aspect-video rounded-2xl border border-white/10 shadow-2xl bg-zinc-950 object-contain cursor-pointer"
                />

                {/* Custom Overlay Controls */}
                <div className="w-[95%] bg-zinc-900/95 border border-white/10 rounded-2xl p-4 flex items-center gap-4 mt-4 shadow-2xl relative z-10">
                  <button
                    onClick={togglePlay}
                    className="p-2 bg-white/10 hover:bg-accent rounded-full text-white transition-colors cursor-pointer shrink-0"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  {/* Timeline Scrubber */}
                  <div className="flex-grow flex items-center gap-3">
                    <span className="text-[10px] font-mono text-white/50">{formatSeconds(currentTime)}</span>
                    <div 
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const percentage = (e.clientX - rect.left) / rect.width;
                        if (videoRef.current) {
                          videoRef.current.currentTime = percentage * duration;
                        }
                      }}
                      className="flex-grow h-2 bg-white/10 rounded-full cursor-pointer relative group/scrubber"
                    >
                      {/* Play Progress */}
                      <div 
                        className="h-full bg-accent rounded-full relative" 
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/scrubber:opacity-100 transition-opacity" />
                      </div>

                      {/* Comment markers on timeline */}
                      {activeReview.comments.map(c => {
                        const percent = (c.timestamp / (duration || 1)) * 100;
                        return (
                          <div
                            key={c.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              seekTo(c.timestamp);
                            }}
                            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-yellow-500 rounded-full border border-black shadow hover:scale-125 transition-all"
                            style={{ left: `${percent}%` }}
                            title={`Comment at ${formatSeconds(c.timestamp)}`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[10px] font-mono text-white/50">{formatSeconds(duration)}</span>
                  </div>
                </div>
              </div>

              {/* Add Comment Bar */}
              <div className="p-6 bg-zinc-900/25 flex gap-4 items-center shrink-0">
                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl px-3 py-1.5 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] font-mono font-black text-white/80">{formatSeconds(currentTime)}</span>
                </div>
                <input 
                  type="text"
                  placeholder="Type your feedback (will be stamped at current time)…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  className="flex-grow bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-semibold outline-none focus:border-accent"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="bg-accent hover:bg-white hover:text-black text-white p-3 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* COLUMN 2: TIMESTAMPTED COMMENTS FEED (35% Width) */}
            <div className="flex-[3] flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-white/10 shrink-0">
                <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Review Timeline
                </h3>
                <p className="text-[11px] md:text-[9px] font-bold text-white/30 uppercase tracking-wider mt-1">
                  Click a comment to jump to that frame
                </p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-zinc-900/10">
                {activeReview.comments.length > 0 ? (
                  activeReview.comments.map(comment => (
                    <div 
                      key={comment.id}
                      onClick={() => seekTo(comment.timestamp)}
                      className="bg-black/25 border border-white/5 hover:border-accent/30 rounded-2xl p-4 text-left group transition-all cursor-pointer relative"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-[11px] font-black text-white uppercase tracking-tight">{comment.author}</p>
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              seekTo(comment.timestamp);
                            }}
                            className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-[11px] md:text-[9px] font-mono font-bold text-yellow-400 hover:bg-yellow-500 hover:text-black transition-all"
                          >
                            <Clock className="w-2.5 h-2.5" /> {formatSeconds(comment.timestamp)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteComment(comment.id);
                          }}
                          className="p-1 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete comment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs text-white/80 leading-relaxed font-sans">{comment.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-white/30 space-y-2">
                    <MessageSquare className="w-8 h-8 text-white/15 mx-auto" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">No feedback left on this version</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-white/30 select-none h-full">
            <FileVideo className="w-12 h-12 text-accent/60 mb-4" />
            <h2 className="text-base font-semibold tracking-tight text-white mb-1">No video review selected</h2>
            <p className="text-xs font-semibold uppercase tracking-wider max-w-xs leading-normal">
              Select or create a video review draft from the left panel to begin frame-accurate commenting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
