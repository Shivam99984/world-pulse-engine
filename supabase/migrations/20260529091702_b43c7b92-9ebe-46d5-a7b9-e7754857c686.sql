-- Restrict votes SELECT: hide other users' user_id from public
DROP POLICY IF EXISTS votes_public_read ON public.votes;
CREATE POLICY votes_select_own ON public.votes FOR SELECT USING (auth.uid() = user_id);

-- Restrict event_comments SELECT: comments are read server-side via supabaseAdmin
-- which joins display_name from profiles. Block direct public reads of raw user_id.
DROP POLICY IF EXISTS comments_public_read ON public.event_comments;
CREATE POLICY comments_select_own ON public.event_comments FOR SELECT USING (auth.uid() = user_id);