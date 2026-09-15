export type Error = { code: "unauthenticated" | "forbidden" | "not_found" | "invalid_request" | "version_conflict" | "idempotency_conflict" | "request_in_progress" | "rate_limited" | "dependency_unavailable" | "draft_expired" | "policy_blocked" | "claim_expired" | "device_owned" | "recipient_unavailable" | "invalid_state" | "unsupported_language"; message: string; request_id: string; fields: ({ field: string; code: string })[] }

export type Profile = { id: string; display_name: string; locale: "id-ID" | "en-US"; timezone: string; roles: ("user" | "guardian")[]; eligibility: "pending" | "allowed" | "blocked"; age_band: "under_18" | "18_plus" | "unknown"; deleting: boolean; version: number; shared_phone: string | null }

export type ProfileUpdate = { display_name: string; locale: "id-ID" | "en-US"; timezone: string; roles: ("user" | "guardian")[]; age_band: "under_18" | "18_plus" | "unknown"; version: number; shared_phone: string | null }

export type Preferences = { personality: "calm" | "friendly" | "encouraging"; voice: "marin" | "cedar"; listen_first: boolean; memory_enabled: boolean; mood_history_enabled?: boolean; version: number }

export type Policy = { version: string; speech_processing_text: string; providers: (string)[]; minimum_age: number; minor_enrollment_enabled: boolean; retention_days: number; published_at: string }

export type ProcessingConsent = { accepted: boolean; policy_version: string }

export type Device = { id: string; created_at: string; updated_at: string; version: number; name: string; status: "unpaired" | "online" | "offline" | "revoked"; last_seen_at: string | null; battery_percent: number | null; battery_reported_at: string | null; firmware_version: string; applied_preferences_version: number }

export type ClaimCreate = { device_id: string }

export type Claim = { id: string; device_id: string; challenge: string | null; expires_at: string; status: "pending" | "confirmed" | "expired" }

export type ClaimConfirm = { challenge: string }

export type DeviceCredential = { device_id: string; credential: string }

export type Heartbeat = { battery_percent: number; firmware_version: string; applied_preferences_version: number }

export type HeartbeatResult = { server_time: string; preferences: Preferences; firmware_manifest_url: string | null; voice_enabled: boolean }

export type RenameDevice = { name: string; version: number }

export type VoiceTicketRequest = { device_id?: string; mode: "private" | "personal" }

export type VoiceTicket = { ticket: string; expires_at: string; websocket_path: "/v1/voice" }

export type Session = { id: string; device_id: string | null; started_at: string; ended_at: string | null; state: "active" | "review" | "saved" | "discarded" | "expired" | "interrupted"; draft_expires_at: string | null }

export type MemoryCandidate = { id: string; text: string; category: "preference" | "person" | "event" | "goal" }

export type Draft = { session_id: string; version: number; expires_at: string; mood: "very_low" | "low" | "neutral" | "good" | "very_good" | "unknown"; topic: string; reflection: string; insights: (string)[]; support_status: "none" | "offered" | "requested"; memories: (MemoryCandidate)[] }

export type SaveSelection = { version: number; save_journal: boolean; save_mood: boolean; mood: "very_low" | "low" | "neutral" | "good" | "very_good" | "unknown"; memory_candidate_ids: (string)[] }

export type SaveResult = { journal_id: string | null; mood_id: string | null; memory_ids: (string)[]; session_id: string }

export type MoodEntry = { id: string; created_at: string; updated_at: string; version: number; label: "very_low" | "low" | "neutral" | "good" | "very_good" | "unknown"; source: "check_in" | "conversation"; occurred_at: string; timezone: string }

export type MoodCreate = { label: "very_low" | "low" | "neutral" | "good" | "very_good" | "unknown"; occurred_at: string; timezone: string }

export type MoodUpdate = { label: "very_low" | "low" | "neutral" | "good" | "very_good" | "unknown"; version: number }

export type Journal = { id: string; created_at: string; updated_at: string; version: number; topic: string; reflection: string; insights: (string)[]; session_id: string | null }

export type JournalUpdate = { topic: string; reflection: string; insights: (string)[]; version: number }

export type Memory = { id: string; created_at: string; updated_at: string; version: number; text: string; category: "preference" | "person" | "event" | "goal" }

export type MemoryCreate = { text: string; category: "preference" | "person" | "event" | "goal" }

export type MemoryUpdate = { text: string; category: "preference" | "person" | "event" | "goal"; version: number }

export type MoodCount = { label: "very_low" | "low" | "neutral" | "good" | "very_good" | "unknown"; count: number }

export type TrendBucket = { start_date: string; end_date: string; state: "available" | "insufficient_data"; counts: (MoodCount)[] }

export type Trends = { timezone: string; buckets: (TrendBucket)[] }

export type Pulse = { period_start: string; period_end: string; check_in_count: number; trend: "improving" | "stable" | "declining" | "insufficient_data" }

export type ContentStep = { text: string; duration_seconds: number; audio_url: string | null }

export type ContentItem = { id: string; created_at: string; updated_at: string; version: number; kind: "grounding" | "breathing" | "reflection" | "activity" | "coach" | "safety"; title: string; locale: "id-ID" | "en-US"; steps: (ContentStep)[]; reviewed_at: string; review_expires_at: string }

export type Contact = { id: string; created_at: string; updated_at: string; version: number; display_name: string; phone: string | null; relationship: "friend" | "family" | "guardian" | "other"; linked_user_id: string | null; status: "unlinked" | "invited" | "active" | "revoked" }

export type ContactCreate = { display_name: string; phone: string | null; relationship: "friend" | "family" | "guardian" | "other" }

export type ContactUpdate = { display_name: string; phone: string | null; version: number }

export type InviteCreate = { contact_id: string; kind: "trusted" | "guardian" }

export type Invite = { id: string; code: string; expires_at: string; kind: "trusted" | "guardian"; status: "pending" | "accepted" | "active" | "revoked" | "expired" }

export type InviteAccept = { code: string }

export type Link = { id: string; created_at: string; updated_at: string; version: number; subject_id: string; recipient_id: string; contact_id: string; kind: "trusted" | "guardian"; status: "accepted" | "active" | "revoked"; subject_display_name: string; recipient_display_name: string }

export type GrantCreate = { link_id: string; scope: "wellbeing_pulse" | "mood_trend" | "safety_alerts" | "trusted_contacts" | "safety_plan" | "referral_status"; policy_version: string }

export type Grant = { id: string; created_at: string; updated_at: string; version: number; link_id: string; scope: "wellbeing_pulse" | "mood_trend" | "safety_alerts" | "trusted_contacts" | "safety_plan" | "referral_status"; policy_version: string; revoked_at: string | null }

export type Subject = { id: string; display_name: string; scopes: ("wellbeing_pulse" | "mood_trend" | "safety_alerts" | "trusted_contacts" | "safety_plan" | "referral_status")[] }

export type SafetyPlan = { version: number; steps: (string)[] }

export type SupportResource = { id: string; created_at: string; updated_at: string; version: number; name: string; region: string; locale: string; kind: "counselor" | "professional" | "crisis"; access_url: string; phone: string | null; availability_text: string; reviewed_at: string; review_expires_at: string }

export type Referral = { id: string; created_at: string; updated_at: string; version: number; resource_id: string; state: "considering" | "contacted" | "appointment_reported" | "closed"; reported_by: "user" }

export type ReferralCreate = { resource_id: string }

export type ReferralUpdate = { state: "considering" | "contacted" | "appointment_reported" | "closed"; version: number }

export type ConnectionStatus = { contacts: ({ display_name: string; relationship: string })[]; plan: SafetyPlan | null; referrals: ({ resource_name: string; state: "considering" | "contacted" | "appointment_reported" | "closed" })[]; visible_scopes: ("wellbeing_pulse" | "mood_trend" | "safety_alerts" | "trusted_contacts" | "safety_plan" | "referral_status")[] }

export type SupportCreate = { contact_id: string; reason: "user_request" | "safety_prompt"; safety_event_id?: string }

export type SupportRequest = { id: string; created_at: string; updated_at: string; version: number; contact_id: string; state: "awaiting_permission" | "queued" | "provider_accepted" | "acknowledged" | "failed" | "cancelled" | "expired"; reason: "user_request" | "safety_prompt"; expires_at: string; acknowledged_at: string | null }

export type SupportConfirm = { confirmed: "yes"; version: number }

export type Alert = { id: string; subject_id: string; subject_display_name: string; state: "queued" | "provider_accepted" | "acknowledged" | "failed" | "cancelled" | "expired"; created_at: string; expires_at: string }

export type ReachOut = { phone: string | null; message_template: string }

export type PushRegistration = { installation_id: string; platform: "ios" | "android" | "web"; token: string }

export type ExportCreate = { format: "json" }

export type DeletionCreate = { scope: "history" | "account"; confirmation: "delete" }

export type DataJob = { id: string; kind: "export" | "delete_history" | "delete_account"; state: "queued" | "running" | "waiting_provider" | "ready" | "complete" | "failed" | "expired"; created_at: string; expires_at: string | null; download_path: string | null; receipt: string | null }

export type AuthStart = { client: "web" | "mobile"; return_path: "/app" | "/guardian"; mobile_challenge?: string }

export type AuthRedirect = { authorization_url: string; expires_at: string }

export type MobileExchange = { code: string; verifier: string }

export type Tokens = { access_token: string; refresh_token: string; expires_in: number }

export type Refresh = { refresh_token: string }

export type Health = { status: "ok" }

export type GrantApproval = { version: number }

export type DevicePage = { items: (Device)[]; next_cursor: string | null }

export type SessionPage = { items: (Session)[]; next_cursor: string | null }

export type MoodEntryPage = { items: (MoodEntry)[]; next_cursor: string | null }

export type JournalPage = { items: (Journal)[]; next_cursor: string | null }

export type MemoryPage = { items: (Memory)[]; next_cursor: string | null }

export type ContentItemPage = { items: (ContentItem)[]; next_cursor: string | null }

export type ContactPage = { items: (Contact)[]; next_cursor: string | null }

export type LinkPage = { items: (Link)[]; next_cursor: string | null }

export type GrantPage = { items: (Grant)[]; next_cursor: string | null }

export type SubjectPage = { items: (Subject)[]; next_cursor: string | null }

export type SupportResourcePage = { items: (SupportResource)[]; next_cursor: string | null }

export type ReferralPage = { items: (Referral)[]; next_cursor: string | null }

export type SupportRequestPage = { items: (SupportRequest)[]; next_cursor: string | null }

export type AlertPage = { items: (Alert)[]; next_cursor: string | null }

export type Csrf = { token: string }

export type ExportData = { schema_version: "1"; exported_at: string; profile: Profile; journals: (Journal)[]; moods: (MoodEntry)[]; memories: (Memory)[] }
