-- Enable realtime for advanced_research table
ALTER TABLE advanced_research REPLICA IDENTITY FULL;

-- Add the table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE advanced_research;