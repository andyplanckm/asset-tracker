BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_future_balance_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.recorded_on > (now() AT TIME ZONE 'Asia/Shanghai')::date THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'future_balance_date_not_allowed';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS balances_prevent_future_recorded_on ON public.balances;

CREATE TRIGGER balances_prevent_future_recorded_on
BEFORE INSERT OR UPDATE ON public.balances
FOR EACH ROW
EXECUTE FUNCTION public.prevent_future_balance_dates();

COMMENT ON FUNCTION public.prevent_future_balance_dates() IS
    'Prevents balance records later than the current calendar date in Asia/Shanghai.';

DROP POLICY IF EXISTS "Users can manage their own accounts" ON public.accounts;
CREATE POLICY "Users can manage their own accounts"
    ON public.accounts FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own balances" ON public.balances;
CREATE POLICY "Users can manage their own balances"
    ON public.balances FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

COMMIT;
