-- Migration: 0009_story_3_16_rich_media.sql
-- Story 3.16: Rich Media Support (Video, Animated GIF, Poster Frames)

PRAGMA foreign_keys = OFF;

ALTER TABLE media ADD COLUMN media_type TEXT DEFAULT 'image';
ALTER TABLE media ADD COLUMN poster_id INTEGER REFERENCES media(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE media ADD COLUMN poster_url TEXT;
ALTER TABLE media ADD COLUMN loop INTEGER DEFAULT 1;
ALTER TABLE media ADD COLUMN auto_play INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS media_media_type_idx ON media (media_type);
CREATE INDEX IF NOT EXISTS media_poster_id_idx ON media (poster_id);
