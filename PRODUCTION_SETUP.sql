-- PRODUCTION SETUP: Drop and recreate tables for authenticated users only
-- Run this in Supabase SQL Editor

-- Drop old tables if they exist
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS properties CASCADE;

-- Create properties table
CREATE TABLE properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  address text,
  created_at timestamptz default now()
);

-- Create conversations table (user_id references auth.users)
CREATE TABLE conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  property_id uuid references properties(id),
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create messages table
CREATE TABLE messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Create indexes for performance
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_property_id ON conversations(property_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_properties_slug ON properties(slug);

-- Enable Row Level Security
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Properties: readable by all
CREATE POLICY "Properties readable by all" ON properties
  FOR SELECT USING (true);

-- Conversations: visible to owner only
CREATE POLICY "Conversations visible to owner" ON conversations
  FOR SELECT USING (auth.uid() = user_id);

-- Conversations: creatable by authenticated users
CREATE POLICY "Conversations creatable by authenticated users" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Conversations: updatable by owner
CREATE POLICY "Conversations updatable by owner" ON conversations
  FOR UPDATE USING (auth.uid() = user_id);

-- Messages: visible to conversation owner
CREATE POLICY "Messages visible to conversation owner" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversation_id AND auth.uid() = user_id
    )
  );

-- Messages: insertable by conversation owner
CREATE POLICY "Messages insertable by conversation owner" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversation_id AND auth.uid() = user_id
    )
  );

-- Sample properties (optional)
INSERT INTO properties (name, slug, address) VALUES
  ('Beachfront Villa', 'beachfront-villa', '123 Ocean Ave, New Jersey'),
  ('Mountain Retreat', 'mountain-retreat', '456 Peak Rd, Colorado'),
  ('Urban Loft', 'urban-loft', '789 Market St, New York'),
  ('Lakeside Cabin', 'lakeside-cabin', '321 Lake View, Minnesota');
