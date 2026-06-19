-- 002_add_reminder_sent.sql
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP WITH TIME ZONE;
