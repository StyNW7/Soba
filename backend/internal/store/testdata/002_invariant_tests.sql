-- Test only. Run in an isolated database after the embedded migrations.
-- All fixtures roll back.
BEGIN;
INSERT INTO profiles(id,issuer,identity_subject,display_name) VALUES
 ('10000000-0000-4000-8000-000000000001','test','alice','Alice'),
 ('10000000-0000-4000-8000-000000000002','test','bob','Bob');
INSERT INTO devices(id,owner_id,state,credential_hash) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','paired',decode('01','hex'));
INSERT INTO conversation_sessions(id,owner_id,device_id,state,mode,generation,preferences_version) VALUES
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','active','private',1,1);
DO $$ BEGIN
 BEGIN
 INSERT INTO conversation_sessions(id,owner_id,device_id,state,mode,generation,preferences_version) VALUES
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','active','private',1,1);
 RAISE EXCEPTION 'FAIL: duplicate active session accepted';
 EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: duplicate active session rejected'; END;
 BEGIN
 INSERT INTO journals(id,owner_id,session_id,topic,reflection) VALUES
 ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','test','test');
 RAISE EXCEPTION 'FAIL: cross-owner journal accepted';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS: cross-owner journal rejected'; END;
 BEGIN
 INSERT INTO devices(id,state) VALUES('20000000-0000-4000-8000-000000000003','paired');
 RAISE EXCEPTION 'FAIL: paired device without owner accepted';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: paired device requires owner and credential'; END;
 BEGIN
 UPDATE devices SET battery_percent=101 WHERE id='20000000-0000-4000-8000-000000000001';
 RAISE EXCEPTION 'FAIL: invalid battery accepted';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: battery bound enforced'; END;
 BEGIN
 INSERT INTO mood_entries(id,owner_id,label,source,occurred_at,timezone) VALUES
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','diagnosis','check_in',now(),'Asia/Jakarta');
 RAISE EXCEPTION 'FAIL: invalid mood enum accepted';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: mood enum enforced'; END;
END $$;
INSERT INTO contacts(id,owner_id,display_name,relationship) VALUES
 ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Bob','guardian');
INSERT INTO links(id,owner_id,recipient_id,contact_id,kind,state) VALUES
 ('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','guardian','active');
INSERT INTO grants(id,owner_id,link_id,scope,policy_version) VALUES
 ('80000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','safety_alerts','test');
DO $$ BEGIN
 BEGIN
 INSERT INTO grants(id,owner_id,link_id,scope,policy_version) VALUES
 ('80000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','safety_alerts','test');
 RAISE EXCEPTION 'FAIL: duplicate live grant accepted';
 EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: duplicate live grant rejected'; END;
 BEGIN
 INSERT INTO support_requests(id,owner_id,contact_id,link_id,state,reason,expires_at) VALUES
 ('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','queued','user_request',now()+interval '15 minutes');
 RAISE EXCEPTION 'FAIL: unconfirmed queued request accepted';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: queued request requires confirmation'; END;
 UPDATE profiles SET display_name='Alice updated' WHERE id='10000000-0000-4000-8000-000000000001' AND version=1;
 IF (SELECT version FROM profiles WHERE id='10000000-0000-4000-8000-000000000001')<>2 THEN RAISE EXCEPTION 'FAIL: version not incremented'; END IF;
 UPDATE profiles SET display_name='stale' WHERE id='10000000-0000-4000-8000-000000000001' AND version=1;
 IF FOUND THEN RAISE EXCEPTION 'FAIL: stale version changed row'; END IF;
 RAISE NOTICE 'PASS: version increment and stale-update exclusion';
END $$;
-- All selected save writes must roll back together on a failed second write.
DO $$ BEGIN
 BEGIN
 INSERT INTO journals(id,owner_id,session_id,topic,reflection) VALUES
 ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','test','test');
 INSERT INTO mood_entries(id,owner_id,label,source,occurred_at,timezone) VALUES
 ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','invalid','check_in',now(),'Asia/Jakarta');
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM journals WHERE id='40000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'FAIL: partial save remained'; END IF;
 RAISE NOTICE 'PASS: selected save transaction rolls back together';
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('transcript','raw_audio','prompt','draft_body')) THEN RAISE EXCEPTION 'FAIL: forbidden content column'; END IF;
 RAISE NOTICE 'PASS: no transcript/audio/prompt/draft columns';
END $$;
ROLLBACK;
