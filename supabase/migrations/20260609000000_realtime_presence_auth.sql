-- ============================================================
-- Realtime Authorization: presence:global channel
--
-- Supabase Realtime v2 enforces channel-level RLS via
-- realtime.messages. Without policies here, the channel
-- subscription fails silently (status = CHANNEL_ERROR) and
-- channel.track() is never called, so all users appear offline.
-- ============================================================

-- SELECT: receive presence sync events from the channel
CREATE POLICY "Authenticated users can receive presence:global"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (realtime.topic() = 'presence:global');

-- INSERT: call channel.track() to broadcast own status
CREATE POLICY "Authenticated users can track presence:global"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (realtime.topic() = 'presence:global');
