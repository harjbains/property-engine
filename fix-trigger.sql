-- Fix Wealth Engine Revisions
DROP TRIGGER IF EXISTS trigger_wealth_engine_revision ON public.tax_engine_records;
DROP FUNCTION IF EXISTS save_wealth_engine_revision();
DROP TABLE IF EXISTS public.wealth_engine_revisions;

CREATE TABLE IF NOT EXISTS public.wealth_engine_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    record_key TEXT NOT NULL,
    version BIGINT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wealth_engine_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own revisions" 
    ON public.wealth_engine_revisions 
    FOR ALL 
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION save_wealth_engine_revision()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wealth_engine_revisions (user_id, record_key, version, payload)
    VALUES (NEW.user_id, NEW.record_key, COALESCE((NEW.payload->>'version')::bigint, extract(epoch from now())::bigint), NEW.payload);

    DELETE FROM public.wealth_engine_revisions
    WHERE id IN (
        SELECT id FROM (
            SELECT id, row_number() OVER (PARTITION BY user_id, record_key ORDER BY created_at DESC) as rn
            FROM public.wealth_engine_revisions
            WHERE user_id = NEW.user_id AND record_key = NEW.record_key
        ) sub
        WHERE rn > 200
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_wealth_engine_revision
    AFTER INSERT OR UPDATE ON public.tax_engine_records
    FOR EACH ROW
    EXECUTE FUNCTION save_wealth_engine_revision();
