-- Add comprehensive RLS policies for rule_runs table
-- Currently missing SELECT, UPDATE, DELETE policies

-- Allow users to view their own rule runs
CREATE POLICY "Users can view their own rule runs" 
ON public.rule_runs 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to update their own rule runs (if needed)
CREATE POLICY "Users can update their own rule runs" 
ON public.rule_runs 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete their own rule runs (if needed)
CREATE POLICY "Users can delete their own rule runs" 
ON public.rule_runs 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);