BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_account_type_change_with_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.type IS DISTINCT FROM OLD.type
       AND EXISTS (
           SELECT 1
           FROM public.balances
           WHERE account_id = OLD.id
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'account_type_locked_by_history';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_lock_type_with_history ON public.accounts;

CREATE TRIGGER accounts_lock_type_with_history
BEFORE UPDATE OF type ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_account_type_change_with_history();

COMMENT ON FUNCTION public.prevent_account_type_change_with_history() IS
    'Prevents changing an account type after balance history exists, preserving historical meaning.';

COMMIT;
