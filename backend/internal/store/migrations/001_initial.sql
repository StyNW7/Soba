-- SOBA TD v2. PostgreSQL 17+. Apply once through a migration runner.
BEGIN;
CREATE TABLE profiles (
 id uuid PRIMARY KEY, issuer text NOT NULL, identity_subject text NOT NULL,
 display_name varchar(80) NOT NULL CHECK (length(display_name)>0),
 shared_phone varchar(16) CHECK(shared_phone ~ '^\+[1-9][0-9]{6,14}$'),
 locale text NOT NULL DEFAULT 'id-ID' CHECK (locale IN ('id-ID','en-US')),
 timezone varchar(64) NOT NULL DEFAULT 'Asia/Jakarta',
 roles text[] NOT NULL DEFAULT ARRAY['user']::text[] CHECK (cardinality(roles) BETWEEN 1 AND 2 AND roles <@ ARRAY['user','guardian']::text[]),
 age_band text NOT NULL DEFAULT 'unknown' CHECK (age_band IN ('under_18','18_plus','unknown')),
 eligibility text NOT NULL DEFAULT 'pending' CHECK (eligibility IN ('pending','allowed','blocked')),
 processing_policy_version text, processing_granted_at timestamptz, processing_revoked_at timestamptz,
 deleting boolean NOT NULL DEFAULT false, history_generation bigint NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(issuer,identity_subject)
);
CREATE TABLE preferences (
 owner_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 personality text NOT NULL DEFAULT 'calm' CHECK(personality IN ('calm','friendly','encouraging')),
 voice text NOT NULL DEFAULT 'marin' CHECK(voice IN ('marin','cedar')),
 listen_first boolean NOT NULL DEFAULT true, memory_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE auth_flows (
 id uuid PRIMARY KEY, state_hash bytea UNIQUE NOT NULL, nonce_hash bytea NOT NULL,
 pkce_verifier_ciphertext bytea NOT NULL, mobile_challenge text,
 client text NOT NULL CHECK(client IN ('web','mobile')), return_path text NOT NULL CHECK(return_path IN ('/app','/guardian')),
 expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE auth_sessions (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 access_hash bytea UNIQUE NOT NULL, refresh_hash bytea UNIQUE, previous_refresh_hash bytea,
 csrf_hash bytea, client text NOT NULL CHECK(client IN ('web','mobile')),
 authenticated_at timestamptz NOT NULL, last_used_at timestamptz NOT NULL DEFAULT now(), access_expires_at timestamptz NOT NULL, refresh_expires_at timestamptz NOT NULL,
 revoked_at timestamptz, CHECK(access_expires_at<=refresh_expires_at)
);
CREATE TABLE mobile_login_codes (
 code_hash bytea PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 challenge text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE devices (
 id uuid PRIMARY KEY, owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
 name varchar(80) NOT NULL DEFAULT 'My Soba', bootstrap_hash bytea UNIQUE, credential_hash bytea UNIQUE,
 state text NOT NULL DEFAULT 'unpaired' CHECK(state IN ('unpaired','paired','revoked')),
 last_seen_at timestamptz, battery_percent smallint CHECK(battery_percent BETWEEN 0 AND 100), battery_reported_at timestamptz,
 firmware_version varchar(40) NOT NULL DEFAULT '', applied_preferences_version bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 UNIQUE(id,owner_id), CHECK(state<>'paired' OR (owner_id IS NOT NULL AND credential_hash IS NOT NULL))
);
CREATE INDEX devices_owner ON devices(owner_id,id);
CREATE TABLE device_claims (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 device_id uuid NOT NULL REFERENCES devices(id), challenge_hash bytea UNIQUE NOT NULL,
 -- Encrypted short-lived claim/credential replay material; never plaintext.
 replay_ciphertext bytea, key_version text, expires_at timestamptz NOT NULL, consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE conversation_sessions (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
 state text NOT NULL CHECK(state IN ('active','review','saved','discarded','expired','interrupted')),
 mode text NOT NULL CHECK(mode IN ('private','personal')), started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 draft_expires_at timestamptz, generation bigint NOT NULL, preferences_version bigint NOT NULL,
 UNIQUE(id,owner_id)
);
CREATE UNIQUE INDEX one_active_device_session ON conversation_sessions(device_id) WHERE state='active' AND device_id IS NOT NULL;
CREATE UNIQUE INDEX one_active_owner_session ON conversation_sessions(owner_id) WHERE state='active';
CREATE INDEX sessions_owner_time ON conversation_sessions(owner_id,started_at DESC,id DESC);
CREATE TABLE journals (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 session_id uuid, topic varchar(160) NOT NULL, reflection varchar(3000) NOT NULL, insights text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(session_id,owner_id) REFERENCES conversation_sessions(id,owner_id),
 UNIQUE(owner_id,session_id), CHECK(cardinality(insights)<=5)
);
CREATE TABLE mood_entries (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, session_id uuid,
 label text NOT NULL CHECK(label IN ('very_low','low','neutral','good','very_good','unknown')),
 source text NOT NULL CHECK(source IN ('check_in','conversation')),
 occurred_at timestamptz NOT NULL, timezone varchar(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(session_id,owner_id) REFERENCES conversation_sessions(id,owner_id),
 UNIQUE(owner_id,session_id), CHECK((source='check_in' AND session_id IS NULL) OR source='conversation')
);
CREATE TABLE memories (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, session_id uuid, candidate_id uuid,
 text varchar(500) NOT NULL CHECK(length(text)>0), category text NOT NULL CHECK(category IN ('preference','person','event','goal')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(session_id,owner_id) REFERENCES conversation_sessions(id,owner_id), UNIQUE(owner_id,session_id,candidate_id)
);
CREATE INDEX journals_owner_time ON journals(owner_id,created_at DESC,id DESC);
CREATE INDEX moods_owner_time ON mood_entries(owner_id,occurred_at DESC,id DESC);
CREATE INDEX memories_owner_time ON memories(owner_id,updated_at DESC,id DESC);
CREATE TABLE contacts (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 display_name varchar(80) NOT NULL CHECK(length(display_name)>0), phone varchar(16) CHECK(phone ~ '^\+[1-9][0-9]{6,14}$'),
 relationship text NOT NULL CHECK(relationship IN ('friend','family','guardian','other')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 UNIQUE(id,owner_id)
);
CREATE TABLE links (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, contact_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('trusted','guardian')), state text NOT NULL CHECK(state IN ('accepted','active','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(contact_id,owner_id) REFERENCES contacts(id,owner_id) ON DELETE CASCADE,
 UNIQUE(id,owner_id), UNIQUE(id,owner_id,contact_id), CHECK(owner_id<>recipient_id)
);
CREATE UNIQUE INDEX one_live_contact_link ON links(contact_id) WHERE state IN ('accepted','active');
CREATE INDEX links_recipient ON links(recipient_id,state,owner_id);
CREATE TABLE invites (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, contact_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('trusted','guardian')), code_hash bytea UNIQUE NOT NULL, code_ciphertext bytea NOT NULL,
 key_version text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, link_id uuid REFERENCES links(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(contact_id,owner_id) REFERENCES contacts(id,owner_id) ON DELETE CASCADE
);
CREATE TABLE grants (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, link_id uuid NOT NULL,
 scope text NOT NULL CHECK(scope IN ('wellbeing_pulse','mood_trend','safety_alerts','trusted_contacts','safety_plan','referral_status')),
 policy_version varchar(60) NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(link_id,owner_id) REFERENCES links(id,owner_id) ON DELETE CASCADE, UNIQUE(id,owner_id), UNIQUE(id,owner_id,link_id)
);
CREATE UNIQUE INDEX one_live_grant ON grants(link_id,scope) WHERE revoked_at IS NULL;
CREATE TABLE safety_plans (
 owner_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE, steps text[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1, CHECK(cardinality(steps)<=10)
);
CREATE TABLE content_items (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('grounding','breathing','reflection','activity','coach','safety')),
 title varchar(160) NOT NULL, locale text NOT NULL CHECK(locale IN ('id-ID','en-US')),
 steps jsonb NOT NULL CHECK(jsonb_typeof(steps)='array' AND jsonb_array_length(steps) BETWEEN 1 AND 30),
 review_status text NOT NULL CHECK(review_status IN ('draft','approved')), reviewer_id text NOT NULL,
 reviewed_at timestamptz NOT NULL, review_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 CHECK(review_expires_at>reviewed_at)
);
CREATE TABLE support_resources (
 id uuid PRIMARY KEY, name varchar(160) NOT NULL, region varchar(80) NOT NULL, locale varchar(10) NOT NULL,
 kind text NOT NULL CHECK(kind IN ('counselor','professional','crisis')), access_url varchar(2048) NOT NULL CHECK(access_url LIKE 'https://%'),
 phone varchar(16) CHECK(phone ~ '^\+[1-9][0-9]{6,14}$'), availability_text varchar(300) NOT NULL DEFAULT '',
 reviewed_at timestamptz NOT NULL, review_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 CHECK(review_expires_at>reviewed_at)
);
CREATE TABLE referrals (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 resource_id uuid NOT NULL REFERENCES support_resources(id), state text NOT NULL CHECK(state IN ('considering','contacted','appointment_reported','closed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1
);
CREATE TABLE safety_events (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 session_id uuid, policy_version text NOT NULL, reason_code text NOT NULL CHECK(reason_code IN ('help_requested','serious_signal')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 FOREIGN KEY(session_id,owner_id) REFERENCES conversation_sessions(id,owner_id), UNIQUE(id,owner_id)
);
CREATE TABLE support_requests (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 contact_id uuid NOT NULL, link_id uuid NOT NULL, grant_id uuid, safety_event_id uuid,
 state text NOT NULL CHECK(state IN ('awaiting_permission','queued','provider_accepted','acknowledged','failed','cancelled','expired')),
 reason text NOT NULL CHECK(reason IN ('user_request','safety_prompt')), confirmed_at timestamptz, acknowledged_at timestamptz,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
 FOREIGN KEY(contact_id,owner_id) REFERENCES contacts(id,owner_id) ON DELETE CASCADE,
 FOREIGN KEY(link_id,owner_id,contact_id) REFERENCES links(id,owner_id,contact_id) ON DELETE CASCADE,
 FOREIGN KEY(grant_id,owner_id,link_id) REFERENCES grants(id,owner_id,link_id),
 FOREIGN KEY(safety_event_id,owner_id) REFERENCES safety_events(id,owner_id),
 CHECK((state='awaiting_permission') OR (state IN ('cancelled','expired')) OR confirmed_at IS NOT NULL)
);
CREATE TABLE push_installations (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 platform text NOT NULL CHECK(platform IN ('ios','android','web')), token_ciphertext bytea NOT NULL, token_hash bytea UNIQUE NOT NULL,
 key_version text NOT NULL, revoked_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_jobs (
 id uuid PRIMARY KEY, request_id uuid NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
 installation_id uuid NOT NULL REFERENCES push_installations(id) ON DELETE CASCADE,
 state text NOT NULL CHECK(state IN ('queued','leased','accepted','failed','cancelled')),
 attempts smallint NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 4), next_attempt_at timestamptz NOT NULL,
 lease_token uuid, lease_expires_at timestamptz, provider_message_id text, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(request_id,installation_id)
);
CREATE INDEX notification_ready ON notification_jobs(next_attempt_at,id) WHERE state IN ('queued','leased');
CREATE TABLE data_jobs (
 id uuid PRIMARY KEY, owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
 -- receipt_hash permits account-deletion status after credentials are revoked.
 receipt_hash bytea UNIQUE, kind text NOT NULL CHECK(kind IN ('export','delete_history','delete_account')),
 state text NOT NULL CHECK(state IN ('queued','running','waiting_provider','ready','complete','failed','expired')),
 generation bigint NOT NULL, object_key text, expires_at timestamptz, error_code text,
 lease_token uuid, lease_expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE deletion_ledger (
 id uuid PRIMARY KEY, subject_hash bytea NOT NULL, scope text NOT NULL CHECK(scope IN ('history','account')),
 cutoff_at timestamptz NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY, actor_hash bytea NOT NULL, subject_hash bytea,
 action varchar(80) NOT NULL, outcome text NOT NULL CHECK(outcome IN ('allowed','denied','failed')),
 request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE idempotency_records (
 actor_key bytea NOT NULL, route text NOT NULL, key uuid NOT NULL, request_hash bytea NOT NULL,
 response_ciphertext bytea, key_version text, response_status smallint,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_key,route,key)
);
-- App writes supply the expected version in the WHERE clause. This trigger owns increments.
CREATE FUNCTION bump_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=clock_timestamp(); NEW.version=OLD.version+1; RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profiles','preferences','devices','journals','mood_entries','memories','contacts','links','grants','safety_plans','content_items','support_resources','referrals','support_requests'] LOOP
 EXECUTE format('CREATE TRIGGER update_version BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION bump_version()',t);
 END LOOP;
END $$;
COMMIT;
