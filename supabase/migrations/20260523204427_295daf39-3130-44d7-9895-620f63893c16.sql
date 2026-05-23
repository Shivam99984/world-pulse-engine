-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'expert', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_public_read" ON public.user_roles FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Reputation
CREATE TABLE public.user_reputation (
  user_id uuid PRIMARY KEY,
  points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep_public_read" ON public.user_reputation FOR SELECT USING (true);

-- Comments
CREATE TABLE public.event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read" ON public.event_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON public.event_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_own" ON public.event_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON public.event_comments FOR DELETE USING (auth.uid() = user_id);

-- Reports
CREATE TABLE public.event_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select_own" ON public.event_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reports_insert_own" ON public.event_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger: when a vote is cast, give event author? No author — give the voter 1 point for participating
CREATE OR REPLACE FUNCTION public.award_vote_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_reputation (user_id, points)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id) DO UPDATE SET points = public.user_reputation.points + 1, updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER votes_award_points
AFTER INSERT ON public.votes
FOR EACH ROW EXECUTE FUNCTION public.award_vote_points();