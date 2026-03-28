-- Combined scene clips (pre–Lyria). Run in Supabase SQL editor if not applied via CLI.
alter table projects add column if not exists assembled_scenes_video_url text;

comment on column projects.assembled_scenes_video_url is
  'FFmpeg concat of scene MP4s in order; Lyria input for score; final mux writes final_video_url.';
