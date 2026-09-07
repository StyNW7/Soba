-- Preserve the issuer ID-token auth_time while the mobile callback hands off
-- to the app through a short-lived one-time login code. The exchange service
-- must copy this value into the authenticated session; callback time is not a
-- substitute for the issuer authentication time during destructive actions.
ALTER TABLE mobile_login_codes
    ADD COLUMN auth_time timestamptz NOT NULL;
