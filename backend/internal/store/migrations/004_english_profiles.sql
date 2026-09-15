ALTER TABLE profiles ALTER COLUMN locale SET DEFAULT 'en-US';
UPDATE profiles SET locale='en-US', version=version+1, updated_at=now() WHERE locale <> 'en-US';
