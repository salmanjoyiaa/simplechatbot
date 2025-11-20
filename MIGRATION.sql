-- MIGRATION: Update conversations table for guest user support
-- Run this in Supabase SQL Editor

-- Drop old RLS policies
DROP POLICY IF EXISTS "Conversations visible to owner" on conversations;
DROP POLICY IF EXISTS "Conversations creatable by authenticated users" on conversations;
DROP POLICY IF EXISTS "Conversations updatable by owner" on conversations;
DROP POLICY IF EXISTS "Messages visible to conversation owner" on messages;
DROP POLICY IF EXISTS "Messages insertable by conversation owner" on messages;

-- Drop the old conversations table (this will cascade to messages)
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS messages CASCADE;

-- Recreate conversations table with user_id as text (for guest users)
CREATE TABLE conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  property_id uuid references properties(id),
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Recreate messages table
CREATE TABLE messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Create indexes
CREATE INDEX idx_conversations_user_id on conversations(user_id);
CREATE INDEX idx_conversations_property_id on conversations(property_id);
CREATE INDEX idx_messages_conversation_id on messages(conversation_id);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- New RLS Policies (allow public/guest access)
-- Allow anyone to select conversations
CREATE POLICY "Conversations readable by all" on conversations
  FOR SELECT USING (true);

-- Allow anyone to insert conversations (for guest mode)
CREATE POLICY "Conversations creatable by all" on conversations
  FOR INSERT WITH CHECK (true);

-- Allow conversation owners to update
CREATE POLICY "Conversations updatable by owner" on conversations
  FOR UPDATE USING (user_id::text = user_id::text);

-- Allow anyone to select messages
CREATE POLICY "Messages readable by all" on messages
  FOR SELECT USING (true);

-- Allow anyone to insert messages
CREATE POLICY "Messages insertable by all" on messages
  FOR INSERT WITH CHECK (true);
