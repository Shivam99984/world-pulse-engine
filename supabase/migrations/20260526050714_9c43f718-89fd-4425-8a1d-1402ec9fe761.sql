DROP POLICY IF EXISTS roles_public_read ON public.user_roles;
CREATE POLICY roles_select_own ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS rep_public_read ON public.user_reputation;
CREATE POLICY rep_select_own ON public.user_reputation FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_realtime_messages" ON realtime.messages;
CREATE POLICY "deny_all_realtime_messages" ON realtime.messages FOR SELECT TO authenticated USING (false);

CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
DECLARE ext record;
BEGIN
  FOR ext IN SELECT e.extname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE n.nspname = 'public' AND e.extname NOT IN ('plpgsql','pg_net')
  LOOP
    BEGIN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext.extname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not move %: %', ext.extname, SQLERRM;
    END;
  END LOOP;
END $$;