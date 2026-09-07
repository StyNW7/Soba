// Package support implements contacts, permissioned guardian views, support
// requests, recipient alerts, push installations, and the notification worker.
package support

import (
	"context"
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/StyNW7/Soba/backend/internal/conversation"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/push"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Service contains all dependencies used by the support handlers. The HTTP
// server owns the owner guard and transaction for authenticated writes. The
// worker uses the same guard instance for dispatch fencing.
type Service struct {
	Pool        *pgxpool.Pool
	Config      platform.Config
	Guards      *platform.Guards
	Sender      push.Sender
	SafetyEvent func(owner, id string) (conversation.SafetyEvent, bool)
}

// Handlers returns operation IDs consumed by the shared contract router.
func (s *Service) Handlers() map[string]platform.Handler {
	return map[string]platform.Handler{
		"listContact":                 s.listContact,
		"createContact":               s.createContact,
		"getContact":                  s.getContact,
		"updateContact":               s.updateContact,
		"deleteContact":               s.deleteContact,
		"createInvite":                s.createInvite,
		"acceptInvite":                s.acceptInvite,
		"listLinks":                   s.listLinks,
		"approveLink":                 s.approveLink,
		"revokeLink":                  s.revokeLink,
		"listGrants":                  s.listGrants,
		"createGrant":                 s.createGrant,
		"revokeGrant":                 s.revokeGrant,
		"listGuardianSubjects":        s.listGuardianSubjects,
		"getGuardianPulse":            s.getGuardianPulse,
		"getGuardianTrends":           s.getGuardianTrends,
		"getGuardianConnectionStatus": s.getGuardianConnectionStatus,
		"listRecipientAlerts":         s.listRecipientAlerts,
		"acknowledgeAlert":            s.acknowledgeAlert,
		"getReachOut":                 s.getReachOut,
		"createSupportRequest":        s.createSupportRequest,
		"listSupportRequests":         s.listSupportRequests,
		"getSupportRequest":           s.getSupportRequest,
		"cancelSupportRequest":        s.cancelSupportRequest,
		"confirmSupportRequest":       s.confirmSupportRequest,
		"registerPush":                s.registerPush,
		"unregisterPush":              s.unregisterPush,
	}
}

const (
	inviteLifetime   = 24 * time.Hour
	supportLifetime  = 15 * time.Minute
	messageTemplate  = "I am here with you. You can reach out when you are ready."
	maxDisplayName   = 80
	maxPolicyVersion = 60
)

var (
	contactProjection = `jsonb_build_object(
		'id',c.id,
		'created_at',c.created_at,
		'updated_at',c.updated_at,
		'version',c.version,
		'display_name',c.display_name,
		'phone',c.phone,
		'relationship',c.relationship,
		'linked_user_id',CASE WHEN l.state IN ('accepted','active') THEN l.recipient_id ELSE NULL END,
		'status',CASE
			WHEN l.state='active' THEN 'active'
			WHEN i.id IS NOT NULL OR l.state='accepted' THEN 'invited'
			WHEN l.state='revoked' THEN 'revoked'
			ELSE 'unlinked' END)`
	linkProjection = `jsonb_build_object(
			'id',l.id,
			'created_at',l.created_at,
			'updated_at',l.updated_at,
			'version',l.version,
			'subject_id',l.owner_id,
			'recipient_id',l.recipient_id,
			'contact_id',l.contact_id,
			'kind',l.kind,
			'status',l.state,
			'subject_display_name',sp.display_name,
			'recipient_display_name',rp.display_name)`
	grantProjection = `jsonb_build_object(
			'id',g.id,
			'created_at',g.created_at,
			'updated_at',g.updated_at,
			'version',g.version,
			'link_id',g.link_id,
			'scope',g.scope,
			'policy_version',g.policy_version,
			'revoked_at',g.revoked_at)`
	supportProjection = `jsonb_build_object(
			'id',q.id,
			'created_at',q.created_at,
			'updated_at',q.updated_at,
			'version',q.version,
			'contact_id',q.contact_id,
			'state',CASE WHEN q.expires_at<=now() AND q.state IN ('awaiting_permission','queued','provider_accepted') THEN 'expired' ELSE q.state END,
			'reason',q.reason,
			'expires_at',q.expires_at,
			'acknowledged_at',q.acknowledged_at)`
	alertProjection = `jsonb_build_object(
			'id',q.id,
			'subject_id',q.owner_id,
			'subject_display_name',p.display_name,
			'state',CASE WHEN q.expires_at<=now() AND q.state IN ('queued','provider_accepted') THEN 'expired' ELSE q.state END,
			'created_at',q.created_at,
			'expires_at',q.expires_at)`
)

var moodLabels = [...]string{"very_low", "low", "neutral", "good", "very_good", "unknown"}

func (s *Service) listContact(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "contacts")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, r.Q(s.Pool), `SELECT `+contactProjection+` FROM contacts c
		JOIN profiles p ON p.id=c.owner_id AND NOT p.deleting
		LEFT JOIN LATERAL (
			SELECT l1.* FROM links l1 JOIN profiles lp1 ON lp1.id=l1.recipient_id AND NOT lp1.deleting
			WHERE l1.owner_id=c.owner_id AND l1.contact_id=c.id
			ORDER BY CASE l1.state WHEN 'active' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END,
			l1.updated_at DESC,l1.id DESC LIMIT 1
		) l ON true
		LEFT JOIN LATERAL (
			SELECT i1.* FROM invites i1 WHERE i1.owner_id=c.owner_id AND i1.contact_id=c.id
			AND i1.consumed_at IS NULL AND i1.expires_at>now()
			ORDER BY i1.created_at DESC,i1.id DESC LIMIT 1
		) i ON true
		WHERE c.owner_id=$1 AND (c.created_at,c.id)<($2,$3::uuid)
		ORDER BY c.created_at DESC,c.id DESC LIMIT $4`, r.Owner(), stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	return platform.OK(pageBody(items, n, s.Config.CursorKey, r.Owner(), "contacts", "created_at")), nil
}

func (s *Service) createContact(ctx context.Context, r *platform.Request) (platform.Result, error) {
	name, err := displayName(r.String("display_name"))
	if err != nil {
		return platform.Result{}, err
	}
	phone := nullablePhone(r.Body["phone"])
	if !validNullablePhone(r.Body["phone"], phone) {
		return platform.Result{}, platform.Invalid("Invalid phone number.")
	}
	relationship := r.String("relationship")
	if !validRelationship(relationship) {
		return platform.Result{}, platform.Invalid("Invalid relationship.")
	}
	id := platform.ID()
	if _, err = r.Tx.Exec(ctx, `INSERT INTO contacts(id,owner_id,display_name,phone,relationship) VALUES($1,$2,$3,$4,$5)`, id, r.Owner(), name, phone, relationship); err != nil {
		return platform.Result{}, err
	}
	item, err := contact(ctx, r.Tx, id, r.Owner())
	return platform.Created(item), err
}

func (s *Service) getContact(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := contact(ctx, r.Q(s.Pool), requestID(r), r.Owner())
	return platform.OK(item), err
}

func (s *Service) updateContact(ctx context.Context, r *platform.Request) (platform.Result, error) {
	name, err := displayName(r.String("display_name"))
	if err != nil {
		return platform.Result{}, err
	}
	phone := nullablePhone(r.Body["phone"])
	if !validNullablePhone(r.Body["phone"], phone) {
		return platform.Result{}, platform.Invalid("Invalid phone number.")
	}
	tag, err := r.Tx.Exec(ctx, `UPDATE contacts SET display_name=$3,phone=$4
		WHERE id=$1 AND owner_id=$2 AND version=$5`, requestID(r), r.Owner(), name, phone, bodyVersion(r))
	if err != nil {
		return platform.Result{}, err
	}
	if tag.RowsAffected() == 1 {
		item, queryErr := contact(ctx, r.Tx, requestID(r), r.Owner())
		return platform.OK(item), queryErr
	}
	var exists bool
	if e := r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM contacts WHERE id=$1 AND owner_id=$2)`, requestID(r), r.Owner()).Scan(&exists); e != nil {
		return platform.Result{}, e
	}
	if exists {
		return platform.Result{}, platform.Conflict()
	}
	return platform.Result{}, platform.NotFound()
}

func (s *Service) deleteContact(ctx context.Context, r *platform.Request) (platform.Result, error) {
	rows, err := r.Tx.Query(ctx, `SELECT id,owner_id FROM links WHERE owner_id=$1 AND contact_id=$2 AND state IN ('accepted','active')`, r.Owner(), requestID(r))
	if err != nil {
		return platform.Result{}, err
	}
	type linkKey struct{ id, owner string }
	keys := make([]linkKey, 0)
	for rows.Next() {
		var v linkKey
		if err = rows.Scan(&v.id, &v.owner); err != nil {
			rows.Close()
			return platform.Result{}, err
		}
		keys = append(keys, v)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return platform.Result{}, err
	}
	for _, key := range keys {
		unlock, e := s.lockDispatch(ctx, key.owner, key.id)
		if e != nil {
			return platform.Result{}, e
		}
		defer unlock()
	}
	// Remove dependent support records before the contact/link cascade. The
	// support-request grant reference intentionally has no delete cascade so
	// grant evidence cannot disappear while a request still points at it.
	if _, err = r.Tx.Exec(ctx, `DELETE FROM support_requests WHERE contact_id=$1 AND owner_id=$2`, requestID(r), r.Owner()); err != nil {
		return platform.Result{}, err
	}
	tag, err := r.Tx.Exec(ctx, `DELETE FROM contacts WHERE id=$1 AND owner_id=$2`, requestID(r), r.Owner())
	if err != nil {
		return platform.Result{}, err
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, platform.NotFound()
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE notification_jobs SET state='cancelled',lease_token=NULL,lease_expires_at=NULL WHERE installation_id=$1 AND state IN ('queued','leased')`, requestID(r)); err != nil {
		return platform.Result{}, err
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE support_requests q SET state='failed'
		WHERE q.state='queued'
		AND EXISTS(SELECT 1 FROM notification_jobs j WHERE j.request_id=q.id AND j.installation_id=$1)
		AND NOT EXISTS(SELECT 1 FROM notification_jobs j WHERE j.request_id=q.id AND j.state IN ('queued','leased','accepted'))`, requestID(r)); err != nil {
		return platform.Result{}, err
	}
	return platform.NoContent(), nil
}

func (s *Service) createInvite(ctx context.Context, r *platform.Request) (platform.Result, error) {
	contactID := r.String("contact_id")
	kind := r.String("kind")
	if !validLinkKind(kind) {
		return platform.Result{}, platform.Invalid("Invalid invite kind.")
	}
	var contactExists bool
	if err := r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM contacts WHERE id=$1 AND owner_id=$2)`, contactID, r.Owner()).Scan(&contactExists); err != nil {
		return platform.Result{}, err
	}
	if !contactExists {
		return platform.Result{}, platform.NotFound()
	}
	var live bool
	if err := r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM links WHERE contact_id=$1 AND state IN ('accepted','active'))`, contactID).Scan(&live); err != nil {
		return platform.Result{}, err
	}
	if live {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This contact is already linked.")
	}
	code := platform.Token()
	ciphertext, err := platform.Encrypt(s.Config.DataKey, []byte(code))
	if err != nil {
		return platform.Result{}, err
	}
	id := platform.ID()
	expires := time.Now().UTC().Add(inviteLifetime)
	if _, err = r.Tx.Exec(ctx, `INSERT INTO invites(id,owner_id,contact_id,kind,code_hash,code_ciphertext,key_version,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, id, r.Owner(), contactID, kind, platform.Hash(code), ciphertext, s.Config.KeyVersion, expires); err != nil {
		return platform.Result{}, err
	}
	return platform.Created(map[string]any{"id": id, "code": code, "expires_at": expires, "kind": kind, "status": "pending"}), nil
}

func (s *Service) acceptInvite(ctx context.Context, r *platform.Request) (platform.Result, error) {
	code := r.String("code")
	if code == "" {
		return platform.Result{}, platform.Invalid("Invitation code is required.")
	}
	var inviteID, subjectID, contactID, kind string
	var expires time.Time
	var consumed *time.Time
	var linkID *string
	err := r.Tx.QueryRow(ctx, `SELECT i.id,i.owner_id,i.contact_id,i.kind,i.expires_at,i.consumed_at,i.link_id
		FROM invites i JOIN contacts c ON c.id=i.contact_id AND c.owner_id=i.owner_id
		JOIN profiles p ON p.id=i.owner_id AND NOT p.deleting
		WHERE i.code_hash=$1 FOR UPDATE`, platform.Hash(code)).Scan(&inviteID, &subjectID, &contactID, &kind, &expires, &consumed, &linkID)
	if errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	}
	if err != nil {
		return platform.Result{}, err
	}
	if subjectID == r.Owner() {
		return platform.Result{}, platform.Fail(403, "forbidden", "The inviter cannot accept this invitation.")
	}
	if consumed != nil || linkID != nil {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This invitation was already used.")
	}
	if !time.Now().UTC().Before(expires) {
		return platform.Result{}, platform.Fail(410, "invalid_state", "This invitation expired.")
	}
	var live bool
	if err = r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM links WHERE contact_id=$1 AND state IN ('accepted','active'))`, contactID).Scan(&live); err != nil {
		return platform.Result{}, err
	}
	if live {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This contact is already linked.")
	}
	newLink := platform.ID()
	if _, err = r.Tx.Exec(ctx, `INSERT INTO links(id,owner_id,recipient_id,contact_id,kind,state) VALUES($1,$2,$3,$4,$5,'accepted')`, newLink, subjectID, r.Owner(), contactID, kind); err != nil {
		return platform.Result{}, err
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE invites SET consumed_at=now(),link_id=$2 WHERE id=$1`, inviteID, newLink); err != nil {
		return platform.Result{}, err
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE invites SET consumed_at=now() WHERE contact_id=$1 AND id<>$2 AND consumed_at IS NULL`, contactID, inviteID); err != nil {
		return platform.Result{}, err
	}
	item, err := link(ctx, r.Tx, newLink, r.Owner())
	return platform.OK(item), err
}

func (s *Service) listLinks(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "links")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, r.Q(s.Pool), `SELECT `+linkProjection+` FROM links l
		JOIN profiles sp ON sp.id=l.owner_id AND NOT sp.deleting
		JOIN profiles rp ON rp.id=l.recipient_id AND NOT rp.deleting
		WHERE (l.owner_id=$1 OR l.recipient_id=$1) AND (l.created_at,l.id)<($2,$3::uuid)
		ORDER BY l.created_at DESC,l.id DESC LIMIT $4`, r.Owner(), stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	return platform.OK(pageBody(items, n, s.Config.CursorKey, r.Owner(), "links", "created_at")), nil
}

func (s *Service) approveLink(ctx context.Context, r *platform.Request) (platform.Result, error) {
	linkID := requestID(r)
	var state string
	var version int64
	if err := r.Tx.QueryRow(ctx, `SELECT state,version FROM links WHERE id=$1 AND owner_id=$2 FOR UPDATE`, linkID, r.Owner()).Scan(&state, &version); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	if state != "accepted" {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This link is not waiting for approval.")
	}
	if bodyVersion(r) != version {
		return platform.Result{}, platform.Conflict()
	}
	_, err := r.Tx.Exec(ctx, `UPDATE links SET state='active' WHERE id=$1 AND owner_id=$2 AND version=$3`, linkID, r.Owner(), version)
	if err != nil {
		return platform.Result{}, err
	}
	item, err := link(ctx, r.Tx, linkID, r.Owner())
	return platform.OK(item), err
}

func (s *Service) revokeLink(ctx context.Context, r *platform.Request) (platform.Result, error) {
	linkID := requestID(r)
	var subject string
	if err := r.Tx.QueryRow(ctx, `SELECT owner_id FROM links WHERE id=$1 AND (owner_id=$2 OR recipient_id=$2) FOR UPDATE`, linkID, r.Owner()).Scan(&subject); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	unlock, err := s.lockDispatch(ctx, subject, linkID)
	if err != nil {
		return platform.Result{}, err
	}
	defer unlock()
	if _, err = r.Tx.Exec(ctx, `UPDATE links SET state='revoked' WHERE id=$1 AND (owner_id=$2 OR recipient_id=$2) AND state<>'revoked'`, linkID, r.Owner()); err != nil {
		return platform.Result{}, err
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE grants SET revoked_at=COALESCE(revoked_at,now()) WHERE link_id=$1 AND revoked_at IS NULL`, linkID); err != nil {
		return platform.Result{}, err
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE notification_jobs j SET state='cancelled',lease_token=NULL,lease_expires_at=NULL FROM support_requests q WHERE j.request_id=q.id AND q.link_id=$1 AND j.state IN ('queued','leased')`, linkID); err != nil {
		return platform.Result{}, err
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE support_requests SET state='cancelled' WHERE link_id=$1 AND state IN ('awaiting_permission','queued')`, linkID); err != nil {
		return platform.Result{}, err
	}
	return platform.NoContent(), nil
}

func (s *Service) listGrants(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "grants")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, r.Q(s.Pool), `SELECT `+grantProjection+` FROM grants g
		JOIN profiles p ON p.id=g.owner_id AND NOT p.deleting
		WHERE g.owner_id=$1 AND (g.created_at,g.id)<($2,$3::uuid)
		ORDER BY g.created_at DESC,g.id DESC LIMIT $4`, r.Owner(), stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	return platform.OK(pageBody(items, n, s.Config.CursorKey, r.Owner(), "grants", "created_at")), nil
}

func (s *Service) createGrant(ctx context.Context, r *platform.Request) (platform.Result, error) {
	linkID, scope, policy := r.String("link_id"), r.String("scope"), r.String("policy_version")
	if !validScope(scope) || len([]rune(policy)) < 1 || len([]rune(policy)) > maxPolicyVersion {
		return platform.Result{}, platform.Invalid("Invalid grant.")
	}
	if policy != s.Config.PolicyVersion {
		return platform.Result{}, platform.Fail(403, "policy_blocked", "This permission policy is no longer current.")
	}
	var kind, state string
	if err := r.Tx.QueryRow(ctx, `SELECT kind,state FROM links WHERE id=$1 AND owner_id=$2 FOR UPDATE`, linkID, r.Owner()).Scan(&kind, &state); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	if state != "active" {
		return platform.Result{}, platform.Fail(403, "forbidden", "This link is not active.")
	}
	if scope != "safety_alerts" && kind != "guardian" {
		return platform.Result{}, platform.Fail(403, "forbidden", "This scope is available only to guardian links.")
	}
	var live bool
	if err := r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM grants WHERE link_id=$1 AND scope=$2 AND revoked_at IS NULL)`, linkID, scope).Scan(&live); err != nil {
		return platform.Result{}, err
	}
	if live {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This scope is already granted.")
	}
	id := platform.ID()
	if _, err := r.Tx.Exec(ctx, `INSERT INTO grants(id,owner_id,link_id,scope,policy_version) VALUES($1,$2,$3,$4,$5)`, id, r.Owner(), linkID, scope, policy); err != nil {
		return platform.Result{}, err
	}
	item, err := grant(ctx, r.Tx, id, r.Owner())
	return platform.Created(item), err
}

func (s *Service) revokeGrant(ctx context.Context, r *platform.Request) (platform.Result, error) {
	grantID := requestID(r)
	var linkID string
	if err := r.Tx.QueryRow(ctx, `SELECT link_id FROM grants WHERE id=$1 AND owner_id=$2`, grantID, r.Owner()).Scan(&linkID); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	unlock, err := s.lockDispatch(ctx, r.Owner(), linkID)
	if err != nil {
		return platform.Result{}, err
	}
	defer unlock()
	if _, err = r.Tx.Exec(ctx, `UPDATE grants SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND owner_id=$2`, grantID, r.Owner()); err != nil {
		return platform.Result{}, err
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE notification_jobs j SET state='cancelled',lease_token=NULL,lease_expires_at=NULL FROM support_requests q WHERE j.request_id=q.id AND q.grant_id=$1 AND j.state IN ('queued','leased')`, grantID); err != nil {
		return platform.Result{}, err
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE support_requests SET state='cancelled' WHERE grant_id=$1 AND state IN ('awaiting_permission','queued')`, grantID); err != nil {
		return platform.Result{}, err
	}
	return platform.NoContent(), nil
}

func (s *Service) listGuardianSubjects(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "guardian-subjects")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, r.Q(s.Pool), `SELECT jsonb_build_object('id',p.id,'display_name',p.display_name,'scopes',COALESCE(scopes.scopes,'{}'::text[]),'created_at',l.created_at)
		FROM links l JOIN profiles p ON p.id=l.owner_id AND NOT p.deleting
		LEFT JOIN LATERAL (SELECT array_agg(g.scope ORDER BY g.scope) AS scopes FROM grants g WHERE g.link_id=l.id AND g.revoked_at IS NULL AND g.policy_version=$2) scopes ON true
		WHERE l.recipient_id=$1 AND l.kind='guardian' AND l.state='active'
		AND NOT EXISTS(SELECT 1 FROM data_jobs d WHERE d.owner_id=p.id AND d.kind='delete_history' AND d.state IN ('queued','running','waiting_provider'))
		AND (l.created_at,l.id)<($3,$4::uuid) ORDER BY l.created_at DESC,l.id DESC LIMIT $5`, r.Owner(), s.Config.PolicyVersion, stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	return platform.OK(subjectPageBody(items, n, s.Config.CursorKey, r.Owner())), nil
}

func (s *Service) getGuardianPulse(ctx context.Context, r *platform.Request) (platform.Result, error) {
	access, err := s.guardianAccess(ctx, r, requestID(r), "wellbeing_pulse")
	if err != nil {
		return platform.Result{}, err
	}
	from, to, err := pulseDates(r)
	if err != nil {
		return platform.Result{}, err
	}
	entries, err := s.guardianMoods(ctx, r.Q(s.Pool), access.subject, access.timezone, from, to)
	if err != nil {
		return platform.Result{}, err
	}
	weekOne, weekTwo := splitWeeks(entries, from, access.timezone)
	knownOne := knownMoods(weekOne)
	knownTwo := knownMoods(weekTwo)
	trend := "insufficient_data"
	if len(knownOne) >= 3 && len(knownTwo) >= 3 {
		delta := meanMood(knownTwo) - meanMood(knownOne)
		switch {
		case delta >= 0.5:
			trend = "improving"
		case delta <= -0.5:
			trend = "declining"
		default:
			trend = "stable"
		}
	}
	checkIns := 0
	for _, e := range weekTwo {
		if e.Source == "check_in" {
			checkIns++
		}
	}
	return platform.OK(map[string]any{"period_start": from.Format("2006-01-02"), "period_end": to.Format("2006-01-02"), "check_in_count": checkIns, "trend": trend}), nil
}

func (s *Service) getGuardianTrends(ctx context.Context, r *platform.Request) (platform.Result, error) {
	access, err := s.guardianAccess(ctx, r, requestID(r), "mood_trend")
	if err != nil {
		return platform.Result{}, err
	}
	from, to, err := weekDates(r)
	if err != nil {
		return platform.Result{}, err
	}
	entries, err := s.guardianMoods(ctx, r.Q(s.Pool), access.subject, access.timezone, from, to)
	if err != nil {
		return platform.Result{}, err
	}
	location, err := time.LoadLocation(access.timezone)
	if err != nil {
		return platform.Result{}, platform.Invalid("The profile timezone is invalid.")
	}
	buckets := make([]trendBucket, 0, int(to.Sub(from).Hours()/24/7))
	for start := from; start.Before(to); start = start.AddDate(0, 0, 7) {
		end := start.AddDate(0, 0, 7)
		counts := map[string]int{}
		total := 0
		for _, entry := range entries {
			local := entry.OccurredAt.In(location)
			if !local.Before(end) && !local.Equal(end) {
				continue
			}
			if local.Before(start) {
				continue
			}
			total++
			counts[entry.Label]++
		}
		bucket := trendBucket{StartDate: start.Format("2006-01-02"), EndDate: end.Format("2006-01-02"), State: "insufficient_data", Counts: []moodCount{}}
		if total >= 3 {
			bucket.State = "available"
			bucket.Counts = make([]moodCount, 0, len(moodLabels))
			for _, label := range moodLabels {
				bucket.Counts = append(bucket.Counts, moodCount{Label: label, Count: counts[label]})
			}
		}
		buckets = append(buckets, bucket)
	}
	return platform.OK(map[string]any{"timezone": access.timezone, "buckets": buckets}), nil
}

func (s *Service) getGuardianConnectionStatus(ctx context.Context, r *platform.Request) (platform.Result, error) {
	access, err := s.guardianLink(ctx, r, requestID(r))
	if err != nil {
		return platform.Result{}, err
	}
	rows, err := r.Q(s.Pool).Query(ctx, `SELECT scope FROM grants WHERE link_id=$1 AND owner_id=$2 AND revoked_at IS NULL AND policy_version=$3 ORDER BY scope`, access.linkID, access.subject, s.Config.PolicyVersion)
	if err != nil {
		return platform.Result{}, err
	}
	scopes := make([]string, 0)
	for rows.Next() {
		var scope string
		if err = rows.Scan(&scope); err != nil {
			rows.Close()
			return platform.Result{}, err
		}
		scopes = append(scopes, scope)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return platform.Result{}, err
	}
	visible := make(map[string]bool, len(scopes))
	for _, scope := range scopes {
		visible[scope] = true
	}
	if !visible["trusted_contacts"] && !visible["safety_plan"] && !visible["referral_status"] {
		return platform.Result{}, platform.Fail(403, "forbidden", "Connection details are not shared.")
	}
	contacts := []map[string]any{}
	if visible["trusted_contacts"] {
		contacts, err = platform.Rows(ctx, r.Q(s.Pool), `SELECT jsonb_build_object('display_name',display_name,'relationship',relationship) FROM contacts WHERE owner_id=$1 ORDER BY created_at,id LIMIT 20`, access.subject)
		if err != nil {
			return platform.Result{}, err
		}
	}
	var plan any
	if visible["safety_plan"] {
		plan, err = platform.Row(ctx, r.Q(s.Pool), `SELECT jsonb_build_object('version',version,'steps',steps) FROM safety_plans WHERE owner_id=$1`, access.subject)
		if err != nil && !isNotFound(err) {
			return platform.Result{}, err
		}
	}
	referrals := []map[string]any{}
	if visible["referral_status"] {
		referrals, err = platform.Rows(ctx, r.Q(s.Pool), `SELECT jsonb_build_object('resource_name',sr.name,'state',rf.state) FROM referrals rf JOIN support_resources sr ON sr.id=rf.resource_id WHERE rf.owner_id=$1 ORDER BY rf.created_at DESC,rf.id DESC LIMIT 20`, access.subject)
		if err != nil {
			return platform.Result{}, err
		}
	}
	return platform.OK(map[string]any{"contacts": contacts, "plan": plan, "referrals": referrals, "visible_scopes": scopes}), nil
}

func (s *Service) listRecipientAlerts(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "alerts")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, r.Q(s.Pool), `SELECT `+alertProjection+` FROM support_requests q
		JOIN links l ON l.id=q.link_id AND l.recipient_id=$1 AND l.state='active'
		JOIN profiles rp ON rp.id=l.recipient_id AND NOT rp.deleting
		JOIN profiles p ON p.id=q.owner_id AND NOT p.deleting
		JOIN grants g ON g.id=q.grant_id AND g.link_id=l.id AND g.owner_id=q.owner_id AND g.scope='safety_alerts' AND g.revoked_at IS NULL AND g.policy_version=$2
		WHERE q.state <> 'awaiting_permission'
		AND NOT EXISTS(SELECT 1 FROM data_jobs d WHERE d.owner_id=q.owner_id AND d.kind='delete_history' AND d.state IN ('queued','running','waiting_provider'))
		AND (q.created_at,q.id)<($3,$4::uuid) ORDER BY q.created_at DESC,q.id DESC LIMIT $5`, r.Owner(), s.Config.PolicyVersion, stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	return platform.OK(pageBody(items, n, s.Config.CursorKey, r.Owner(), "alerts", "created_at")), nil
}

func (s *Service) acknowledgeAlert(ctx context.Context, r *platform.Request) (platform.Result, error) {
	access, err := s.alert(ctx, r.Tx, requestID(r), r.Owner(), true)
	if err != nil {
		return platform.Result{}, err
	}
	if access.state == "acknowledged" {
		return platform.OK(access.body), nil
	}
	if access.expires.Before(time.Now().UTC()) {
		return platform.Result{}, platform.Fail(410, "invalid_state", "This alert expired.")
	}
	if access.state != "queued" && access.state != "provider_accepted" {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This alert cannot be acknowledged.")
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE support_requests SET state='acknowledged',acknowledged_at=now() WHERE id=$1 AND link_id=$2 AND state IN ('queued','provider_accepted')`, requestID(r), access.linkID); err != nil {
		return platform.Result{}, err
	}
	if _, err = r.Tx.Exec(ctx, `UPDATE notification_jobs SET state='cancelled',lease_token=NULL,lease_expires_at=NULL WHERE request_id=$1 AND state IN ('queued','leased')`, requestID(r)); err != nil {
		return platform.Result{}, err
	}
	item, err := s.alert(ctx, r.Tx, requestID(r), r.Owner(), true)
	if err != nil {
		return platform.Result{}, err
	}
	return platform.OK(item.body), nil
}

func (s *Service) getReachOut(ctx context.Context, r *platform.Request) (platform.Result, error) {
	var phone *string
	var expires time.Time
	var state string
	err := r.Q(s.Pool).QueryRow(ctx, `SELECT p.shared_phone,q.expires_at,q.state FROM support_requests q
		JOIN links l ON l.id=q.link_id AND l.recipient_id=$2 AND l.state='active'
		JOIN profiles rp ON rp.id=l.recipient_id AND NOT rp.deleting
		JOIN profiles p ON p.id=q.owner_id AND NOT p.deleting
		JOIN grants g ON g.id=q.grant_id AND g.link_id=l.id AND g.owner_id=q.owner_id AND g.scope='safety_alerts' AND g.revoked_at IS NULL AND g.policy_version=$3
		WHERE q.id=$1 AND q.state IN ('queued','provider_accepted','acknowledged')
		AND NOT EXISTS(SELECT 1 FROM data_jobs d WHERE d.owner_id=q.owner_id AND d.kind='delete_history' AND d.state IN ('queued','running','waiting_provider'))`, requestID(r), r.Owner(), s.Config.PolicyVersion).Scan(&phone, &expires, &state)
	if errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	}
	if err != nil {
		return platform.Result{}, err
	}
	if !time.Now().UTC().Before(expires) || state == "cancelled" || state == "expired" || state == "failed" {
		return platform.Result{}, platform.Fail(410, "invalid_state", "This support request is no longer available.")
	}
	var publicPhone any
	if phone != nil {
		publicPhone = *phone
	}
	return platform.OK(map[string]any{"phone": publicPhone, "message_template": messageTemplate}), nil
}

func (s *Service) createSupportRequest(ctx context.Context, r *platform.Request) (platform.Result, error) {
	contactID, reason := r.String("contact_id"), r.String("reason")
	if !validSupportReason(reason) {
		return platform.Result{}, platform.Invalid("Invalid support request reason.")
	}
	var event conversation.SafetyEvent
	if reason == "safety_prompt" {
		eventID := r.String("safety_event_id")
		if eventID == "" || s.SafetyEvent == nil {
			return platform.Result{}, platform.Invalid("A live safety event is required.")
		}
		var ok bool
		event, ok = s.SafetyEvent(r.Owner(), eventID)
		if !ok || event.ID != eventID || event.Owner != r.Owner() || !time.Now().UTC().Before(event.Expires) {
			return platform.Result{}, platform.NotFound()
		}
	}
	access, err := s.supportRecipient(ctx, r.Tx, contactID, r.Owner())
	if err != nil {
		return platform.Result{}, err
	}
	if access.installations == 0 {
		return platform.Result{}, platform.Fail(409, "recipient_unavailable", "The recipient has no active notification installation.")
	}
	var count int
	if err = r.Tx.QueryRow(ctx, `SELECT count(*) FROM support_requests WHERE owner_id=$1 AND link_id=$2 AND created_at>now()-interval '1 hour'`, r.Owner(), access.linkID).Scan(&count); err != nil {
		return platform.Result{}, err
	}
	if count >= 3 {
		return platform.Result{}, platform.Fail(429, "rate_limited", "Too many support requests.")
	}
	if reason == "safety_prompt" {
		if _, err = r.Tx.Exec(ctx, `INSERT INTO safety_events(id,owner_id,session_id,policy_version,reason_code,expires_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id,owner_id) DO NOTHING`, event.ID, r.Owner(), nullableUUID(event.SessionID), s.Config.PolicyVersion, validReasonCode(event.ReasonCode), event.Expires); err != nil {
			return platform.Result{}, err
		}
	}
	id := platform.ID()
	var safetyID any
	if reason == "safety_prompt" {
		safetyID = event.ID
	}
	if _, err = r.Tx.Exec(ctx, `INSERT INTO support_requests(id,owner_id,contact_id,link_id,grant_id,safety_event_id,state,reason,expires_at) VALUES($1,$2,$3,$4,$5,$6,'awaiting_permission',$7,now()+interval '15 minutes')`, id, r.Owner(), contactID, access.linkID, access.grantID, safetyID, reason); err != nil {
		return platform.Result{}, err
	}
	item, err := supportRequest(ctx, r.Tx, id, r.Owner())
	return platform.Created(item), err
}

func (s *Service) listSupportRequests(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "support-requests")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, r.Q(s.Pool), `SELECT `+supportProjection+` FROM support_requests q
		JOIN profiles p ON p.id=q.owner_id AND NOT p.deleting
		WHERE q.owner_id=$1 AND (q.created_at,q.id)<($2,$3::uuid) ORDER BY q.created_at DESC,q.id DESC LIMIT $4`, r.Owner(), stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	return platform.OK(pageBody(items, n, s.Config.CursorKey, r.Owner(), "support-requests", "created_at")), nil
}

func (s *Service) getSupportRequest(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := supportRequest(ctx, r.Q(s.Pool), requestID(r), r.Owner())
	return platform.OK(item), err
}

func (s *Service) cancelSupportRequest(ctx context.Context, r *platform.Request) (platform.Result, error) {
	var linkID string
	var state string
	var expires time.Time
	if err := r.Tx.QueryRow(ctx, `SELECT link_id,state,expires_at FROM support_requests WHERE id=$1 AND owner_id=$2 FOR UPDATE`, requestID(r), r.Owner()).Scan(&linkID, &state, &expires); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	unlock, err := s.lockDispatch(ctx, r.Owner(), linkID)
	if err != nil {
		return platform.Result{}, err
	}
	defer unlock()
	if state == "awaiting_permission" || state == "queued" {
		if !time.Now().UTC().Before(expires) {
			return platform.Result{}, platform.Fail(410, "invalid_state", "This support request expired.")
		}
		if _, err = r.Tx.Exec(ctx, `UPDATE support_requests SET state='cancelled' WHERE id=$1 AND owner_id=$2 AND state IN ('awaiting_permission','queued')`, requestID(r), r.Owner()); err != nil {
			return platform.Result{}, err
		}
		_, err = r.Tx.Exec(ctx, `UPDATE notification_jobs SET state='cancelled',lease_token=NULL,lease_expires_at=NULL WHERE request_id=$1 AND state IN ('queued','leased')`, requestID(r))
		return platform.NoContent(), err
	}
	if state == "acknowledged" || state == "cancelled" {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This support request cannot be cancelled.")
	}
	if !time.Now().UTC().Before(expires) || state == "expired" {
		return platform.Result{}, platform.Fail(410, "invalid_state", "This support request expired.")
	}
	return platform.Result{}, platform.Fail(409, "invalid_state", "This support request cannot be cancelled.")
}

func (s *Service) confirmSupportRequest(ctx context.Context, r *platform.Request) (platform.Result, error) {
	if r.String("confirmed") != "yes" {
		return platform.Result{}, platform.Invalid("Confirmation is required.")
	}
	id := requestID(r)
	var deleting bool
	if err := r.Tx.QueryRow(ctx, `SELECT deleting FROM profiles WHERE id=$1 FOR UPDATE`, r.Owner()).Scan(&deleting); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	} else if deleting {
		return platform.Result{}, platform.Fail(403, "policy_blocked", "Account data is not available.")
	}
	var linkID, grantID, recipientID, state string
	var version int64
	var expires time.Time
	var linkState string
	if err := r.Tx.QueryRow(ctx, `SELECT id,recipient_id,state FROM links WHERE id=(SELECT link_id FROM support_requests WHERE id=$1 AND owner_id=$2) AND owner_id=$2 FOR UPDATE`, id, r.Owner()).Scan(&linkID, &recipientID, &linkState); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	var grantScope, grantPolicy string
	var revokedAt *time.Time
	if err := r.Tx.QueryRow(ctx, `SELECT id,scope,policy_version,revoked_at FROM grants WHERE id=(SELECT grant_id FROM support_requests WHERE id=$1 AND owner_id=$2 AND link_id=$3) AND owner_id=$2 AND link_id=$3 FOR UPDATE`, id, r.Owner(), linkID).Scan(&grantID, &grantScope, &grantPolicy, &revokedAt); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	if err := r.Tx.QueryRow(ctx, `SELECT state,version,expires_at FROM support_requests WHERE id=$1 AND owner_id=$2 AND link_id=$3 AND grant_id=$4 FOR UPDATE`, id, r.Owner(), linkID, grantID).Scan(&state, &version, &expires); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	if bodyVersion(r) != version {
		return platform.Result{}, platform.Conflict()
	}
	if state != "awaiting_permission" {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This support request was already decided.")
	}
	if !time.Now().UTC().Before(expires) {
		return platform.Result{}, platform.Fail(410, "invalid_state", "This support request expired.")
	}
	if linkState != "active" || grantScope != "safety_alerts" || revokedAt != nil || grantPolicy != s.Config.PolicyVersion {
		return platform.Result{}, platform.Fail(403, "forbidden", "Support permission is no longer active.")
	}
	var recipientDeleting bool
	if err := r.Tx.QueryRow(ctx, `SELECT deleting FROM profiles WHERE id=$1`, recipientID).Scan(&recipientDeleting); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	if recipientDeleting {
		return platform.Result{}, platform.Fail(403, "forbidden", "Support permission is no longer active.")
	}
	var historyDeleting bool
	if err := r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM data_jobs WHERE owner_id=$1 AND kind='delete_history' AND state IN ('queued','running','waiting_provider'))`, r.Owner()).Scan(&historyDeleting); err != nil {
		return platform.Result{}, err
	}
	if historyDeleting {
		return platform.Result{}, platform.Fail(403, "policy_blocked", "History deletion is in progress.")
	}
	var installationCount int
	if err := r.Tx.QueryRow(ctx, `SELECT count(*) FROM push_installations pi JOIN profiles p ON p.id=pi.owner_id AND NOT p.deleting WHERE pi.owner_id=$1 AND pi.revoked_at IS NULL`, recipientID).Scan(&installationCount); err != nil {
		return platform.Result{}, err
	}
	if installationCount == 0 {
		return platform.Result{}, platform.Fail(409, "recipient_unavailable", "The recipient has no active notification installation.")
	}
	if _, err := r.Tx.Exec(ctx, `UPDATE support_requests SET state='queued',confirmed_at=now() WHERE id=$1 AND owner_id=$2 AND version=$3`, id, r.Owner(), version); err != nil {
		return platform.Result{}, err
	}
	rows, err := r.Tx.Query(ctx, `SELECT pi.id FROM push_installations pi JOIN profiles p ON p.id=pi.owner_id AND NOT p.deleting WHERE pi.owner_id=$1 AND pi.revoked_at IS NULL`, recipientID)
	if err != nil {
		return platform.Result{}, err
	}
	installations := make([]string, 0, installationCount)
	for rows.Next() {
		var installation string
		if scanErr := rows.Scan(&installation); scanErr != nil {
			rows.Close()
			return platform.Result{}, scanErr
		}
		installations = append(installations, installation)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return platform.Result{}, err
	}
	if len(installations) == 0 {
		return platform.Result{}, platform.Fail(409, "recipient_unavailable", "The recipient has no active notification installation.")
	}
	for _, installation := range installations {
		if _, insertErr := r.Tx.Exec(ctx, `INSERT INTO notification_jobs(id,request_id,installation_id,state,next_attempt_at) VALUES($1,$2,$3,'queued',now())`, platform.ID(), id, installation); insertErr != nil {
			return platform.Result{}, insertErr
		}
	}
	item, err := supportRequest(ctx, r.Tx, id, r.Owner())
	return platform.OK(item), err
}

func (s *Service) registerPush(ctx context.Context, r *platform.Request) (platform.Result, error) {
	installation, platformName, token := r.String("installation_id"), r.String("platform"), r.String("token")
	if !validPushPlatform(platformName) || token == "" || len([]rune(token)) > 4096 {
		return platform.Result{}, platform.Invalid("Invalid push registration.")
	}
	var owner string
	err := r.Tx.QueryRow(ctx, `SELECT owner_id FROM push_installations WHERE id=$1`, installation).Scan(&owner)
	if err == nil && owner != r.Owner() {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This installation belongs to another account.")
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, err
	}
	var tokenOwner string
	var tokenInstallation string
	err = r.Tx.QueryRow(ctx, `SELECT id,owner_id FROM push_installations WHERE token_hash=$1`, platform.Hash(token)).Scan(&tokenInstallation, &tokenOwner)
	if err == nil {
		if tokenOwner != r.Owner() {
			return platform.Result{}, platform.Fail(409, "invalid_state", "This notification token belongs to another account.")
		}
		if tokenInstallation != installation {
			return platform.Result{}, platform.Fail(409, "invalid_state", "This notification token is registered to another installation.")
		}
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, err
	}
	ciphertext, err := platform.Encrypt(s.Config.DataKey, []byte(token))
	if err != nil {
		return platform.Result{}, err
	}
	if owner == r.Owner() {
		_, err = r.Tx.Exec(ctx, `UPDATE push_installations SET platform=$2,token_ciphertext=$3,token_hash=$4,key_version=$5,revoked_at=NULL,updated_at=now() WHERE id=$1 AND owner_id=$6`, installation, platformName, ciphertext, platform.Hash(token), s.Config.KeyVersion, r.Owner())
	} else {
		_, err = r.Tx.Exec(ctx, `INSERT INTO push_installations(id,owner_id,platform,token_ciphertext,token_hash,key_version) VALUES($1,$2,$3,$4,$5,$6)`, installation, r.Owner(), platformName, ciphertext, platform.Hash(token), s.Config.KeyVersion)
	}
	return platform.NoContent(), err
}

func (s *Service) unregisterPush(ctx context.Context, r *platform.Request) (platform.Result, error) {
	tag, err := r.Tx.Exec(ctx, `UPDATE push_installations SET revoked_at=now(),updated_at=now() WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL`, requestID(r), r.Owner())
	if err != nil {
		return platform.Result{}, err
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, platform.NotFound()
	}
	return platform.NoContent(), nil
}

type guardianLink struct {
	subject, recipient, linkID, kind, timezone string
}

type supportAccess struct {
	linkID, grantID, recipient string
	installations              int
}

type alertAccess struct {
	body    map[string]any
	linkID  string
	state   string
	expires time.Time
}

type moodEntry struct {
	Label      string
	Source     string
	OccurredAt time.Time
}

type moodCount struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

type trendBucket struct {
	StartDate string      `json:"start_date"`
	EndDate   string      `json:"end_date"`
	State     string      `json:"state"`
	Counts    []moodCount `json:"counts"`
}

func contact(ctx context.Context, q platform.Queryer, id, owner string) (map[string]any, error) {
	return platform.Row(ctx, q, `SELECT `+contactProjection+` FROM contacts c
		JOIN profiles p ON p.id=c.owner_id AND NOT p.deleting
	LEFT JOIN LATERAL (SELECT l1.* FROM links l1 JOIN profiles lp1 ON lp1.id=l1.recipient_id AND NOT lp1.deleting WHERE l1.owner_id=c.owner_id AND l1.contact_id=c.id ORDER BY CASE l1.state WHEN 'active' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END,l1.updated_at DESC,l1.id DESC LIMIT 1) l ON true
		LEFT JOIN LATERAL (SELECT i1.* FROM invites i1 WHERE i1.owner_id=c.owner_id AND i1.contact_id=c.id AND i1.consumed_at IS NULL AND i1.expires_at>now() ORDER BY i1.created_at DESC,i1.id DESC LIMIT 1) i ON true
		WHERE c.id=$1 AND c.owner_id=$2`, id, owner)
}

func link(ctx context.Context, q platform.Queryer, id, actor string) (map[string]any, error) {
	return platform.Row(ctx, q, `SELECT `+linkProjection+` FROM links l
		JOIN profiles sp ON sp.id=l.owner_id AND NOT sp.deleting
		JOIN profiles rp ON rp.id=l.recipient_id AND NOT rp.deleting
		WHERE l.id=$1 AND (l.owner_id=$2 OR l.recipient_id=$2)`, id, actor)
}

func grant(ctx context.Context, q platform.Queryer, id, owner string) (map[string]any, error) {
	return platform.Row(ctx, q, `SELECT `+grantProjection+` FROM grants g JOIN profiles p ON p.id=g.owner_id AND NOT p.deleting WHERE g.id=$1 AND g.owner_id=$2`, id, owner)
}

func supportRequest(ctx context.Context, q platform.Queryer, id, owner string) (map[string]any, error) {
	return platform.Row(ctx, q, `SELECT `+supportProjection+` FROM support_requests q JOIN profiles p ON p.id=q.owner_id AND NOT p.deleting WHERE q.id=$1 AND q.owner_id=$2`, id, owner)
}

func (s *Service) guardianLink(ctx context.Context, r *platform.Request, subject string) (guardianLink, error) {
	var out guardianLink
	err := r.Q(s.Pool).QueryRow(ctx, `SELECT l.owner_id,l.recipient_id,l.id,l.kind,p.timezone
		FROM links l JOIN profiles p ON p.id=l.owner_id AND NOT p.deleting
		WHERE l.owner_id=$1 AND l.recipient_id=$2 AND l.kind='guardian' AND l.state='active'
		AND NOT EXISTS(SELECT 1 FROM data_jobs d WHERE d.owner_id=l.owner_id AND d.kind='delete_history' AND d.state IN ('queued','running','waiting_provider'))`, subject, r.Owner()).Scan(&out.subject, &out.recipient, &out.linkID, &out.kind, &out.timezone)
	if errors.Is(err, pgx.ErrNoRows) {
		return guardianLink{}, platform.NotFound()
	}
	if err != nil {
		return guardianLink{}, err
	}
	return out, nil
}

func (s *Service) guardianAccess(ctx context.Context, r *platform.Request, subject, scope string) (guardianLink, error) {
	access, err := s.guardianLink(ctx, r, subject)
	if err != nil {
		return guardianLink{}, err
	}
	var allowed bool
	if err = r.Q(s.Pool).QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM grants WHERE link_id=$1 AND owner_id=$2 AND scope=$3 AND revoked_at IS NULL AND policy_version=$4)`, access.linkID, subject, scope, s.Config.PolicyVersion).Scan(&allowed); err != nil {
		return guardianLink{}, err
	}
	if !allowed {
		return guardianLink{}, platform.Fail(403, "forbidden", "This scope is not shared with you.")
	}
	return access, nil
}

func (s *Service) guardianMoods(ctx context.Context, q platform.Queryer, subject, timezone string, from, to time.Time) ([]moodEntry, error) {
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return nil, platform.Invalid("The profile timezone is invalid.")
	}
	start := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, location)
	end := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, location)
	rows, err := q.Query(ctx, `SELECT label,source,occurred_at FROM mood_entries WHERE owner_id=$1 AND occurred_at >= $2 AND occurred_at < $3 ORDER BY occurred_at,id`, subject, start.UTC(), end.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := make([]moodEntry, 0)
	for rows.Next() {
		var entry moodEntry
		if err = rows.Scan(&entry.Label, &entry.Source, &entry.OccurredAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (s *Service) supportRecipient(ctx context.Context, q platform.Queryer, contactID, owner string) (supportAccess, error) {
	var access supportAccess
	err := q.QueryRow(ctx, `SELECT l.id,g.id,l.recipient_id,
		(SELECT count(*) FROM push_installations pi WHERE pi.owner_id=l.recipient_id AND pi.revoked_at IS NULL)
		FROM contacts c JOIN profiles sp ON sp.id=c.owner_id AND NOT sp.deleting
		JOIN links l ON l.contact_id=c.id AND l.owner_id=c.owner_id AND l.state='active'
		JOIN profiles p ON p.id=l.recipient_id AND NOT p.deleting
		JOIN grants g ON g.link_id=l.id AND g.owner_id=l.owner_id AND g.scope='safety_alerts' AND g.revoked_at IS NULL AND g.policy_version=$3
		WHERE c.id=$1 AND c.owner_id=$2 AND NOT EXISTS(SELECT 1 FROM data_jobs d WHERE d.owner_id=c.owner_id AND d.kind='delete_history' AND d.state IN ('queued','running','waiting_provider'))`, contactID, owner, s.Config.PolicyVersion).Scan(&access.linkID, &access.grantID, &access.recipient, &access.installations)
	if errors.Is(err, pgx.ErrNoRows) {
		// A known contact with an active link but no current grant is a
		// recognized relationship with insufficient permission.
		var active bool
		if e := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM contacts c JOIN links l ON l.contact_id=c.id AND l.owner_id=c.owner_id AND l.state='active' WHERE c.id=$1 AND c.owner_id=$2)`, contactID, owner).Scan(&active); e != nil {
			return supportAccess{}, e
		}
		if active {
			return supportAccess{}, platform.Fail(403, "forbidden", "Safety alerts are not shared with this contact.")
		}
		return supportAccess{}, platform.NotFound()
	}
	if err != nil {
		return supportAccess{}, err
	}
	return access, nil
}

func (s *Service) alert(ctx context.Context, q platform.Queryer, id, recipient string, withBody bool) (alertAccess, error) {
	var out alertAccess
	var subject string
	var display string
	var created time.Time
	err := q.QueryRow(ctx, `SELECT q.link_id,q.state,q.expires_at,q.owner_id,p.display_name,q.created_at
		FROM support_requests q JOIN links l ON l.id=q.link_id AND l.recipient_id=$2 AND l.state='active'
		JOIN profiles rp ON rp.id=l.recipient_id AND NOT rp.deleting
		JOIN profiles p ON p.id=q.owner_id AND NOT p.deleting
		WHERE q.id=$1 AND NOT EXISTS(SELECT 1 FROM data_jobs d WHERE d.owner_id=q.owner_id AND d.kind='delete_history' AND d.state IN ('queued','running','waiting_provider'))`, id, recipient).Scan(&out.linkID, &out.state, &out.expires, &subject, &display, &created)
	if errors.Is(err, pgx.ErrNoRows) {
		return alertAccess{}, platform.NotFound()
	}
	if err != nil {
		return alertAccess{}, err
	}
	var allowed bool
	if err = q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM grants WHERE id=(SELECT grant_id FROM support_requests WHERE id=$1) AND link_id=$2 AND owner_id=$3 AND scope='safety_alerts' AND revoked_at IS NULL AND policy_version=$4)`, id, out.linkID, subject, s.Config.PolicyVersion).Scan(&allowed); err != nil {
		return alertAccess{}, err
	}
	if !allowed {
		return alertAccess{}, platform.Fail(403, "forbidden", "Safety alerts are not currently shared with you.")
	}
	if withBody {
		out.body = map[string]any{"id": id, "subject_id": subject, "subject_display_name": display, "state": out.state, "created_at": created, "expires_at": out.expires}
	}
	return out, nil
}

func (s *Service) lockDispatch(ctx context.Context, subject, linkID string) (func(), error) {
	if s.Guards == nil {
		return func() {}, nil
	}
	return s.Guards.Lock(ctx, "support-dispatch:"+subject+":"+linkID)
}

func page(r *platform.Request, key []byte, filter string) (int, *platform.Cursor, error) {
	if r.HTTP == nil {
		return 20, nil, nil
	}
	return platform.Page(r, key, filter)
}

func pageStart(cursor *platform.Cursor) (time.Time, string) {
	if cursor == nil {
		return time.Now().UTC().Add(time.Hour), "ffffffff-ffff-ffff-ffff-ffffffffffff"
	}
	return cursor.Time, cursor.ID
}

func pageBody(items []map[string]any, limit int, key []byte, owner, filter, field string) map[string]any {
	var next any
	if len(items) > limit {
		items = items[:limit]
		last := items[len(items)-1]
		if id, ok := last["id"].(string); ok {
			if stamp, ok := timestamp(last[field]); ok {
				next = platform.NextCursor(key, owner, filter, id, stamp)
			}
		}
	}
	if items == nil {
		items = []map[string]any{}
	}
	return map[string]any{"items": items, "next_cursor": next}
}

func subjectPageBody(items []map[string]any, limit int, key []byte, owner string) map[string]any {
	var next any
	if len(items) > limit {
		items = items[:limit]
		last := items[len(items)-1]
		if id, ok := last["id"].(string); ok {
			if stamp, ok := timestamp(last["created_at"]); ok {
				next = platform.NextCursor(key, owner, "guardian-subjects", id, stamp)
			}
		}
	}
	for _, item := range items {
		delete(item, "created_at")
	}
	if items == nil {
		items = []map[string]any{}
	}
	return map[string]any{"items": items, "next_cursor": next}
}

func timestamp(value any) (time.Time, bool) {
	s, ok := value.(string)
	if !ok {
		return time.Time{}, false
	}
	t, err := time.Parse(time.RFC3339Nano, s)
	return t, err == nil
}

func isNotFound(err error) bool {
	var api *platform.Error
	return errors.As(err, &api) && api.Status == http.StatusNotFound
}

func requestID(r *platform.Request) string {
	if r.HTTP == nil {
		return ""
	}
	return r.HTTP.PathValue("id")
}

func bodyVersion(r *platform.Request) int64 {
	if v := r.Int("version"); v != 0 {
		return v
	}
	switch v := r.Body["version"].(type) {
	case int:
		return int64(v)
	case int64:
		return v
	case int32:
		return int64(v)
	case float64:
		return int64(v)
	default:
		return 0
	}
}

func nullablePhone(value any) any {
	if value == nil {
		return nil
	}
	if text, ok := value.(string); ok {
		return text
	}
	return nil
}

func validNullablePhone(value any, phone any) bool {
	if value == nil {
		return phone == nil
	}
	if phone == nil {
		return value == nil
	}
	text, ok := phone.(string)
	if !ok {
		return false
	}
	if text == "" {
		return false
	}
	if len(text) < 8 || len(text) > 16 || text[0] != '+' {
		return false
	}
	for _, r := range text[1:] {
		if r < '0' || r > '9' {
			return false
		}
	}
	return text[1] != '0'
}

func displayName(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || !utf8.ValidString(value) || len([]rune(value)) > maxDisplayName {
		return "", platform.Invalid("Display name is invalid.")
	}
	return value, nil
}

func validRelationship(value string) bool {
	switch value {
	case "friend", "family", "guardian", "other":
		return true
	default:
		return false
	}
}

func validLinkKind(value string) bool { return value == "trusted" || value == "guardian" }

func validScope(value string) bool {
	switch value {
	case "wellbeing_pulse", "mood_trend", "safety_alerts", "trusted_contacts", "safety_plan", "referral_status":
		return true
	default:
		return false
	}
}

func validSupportReason(value string) bool {
	return value == "user_request" || value == "safety_prompt"
}

func validPushPlatform(value string) bool {
	return value == "ios" || value == "android" || value == "web"
}

func validReasonCode(value string) string {
	if value == "serious_signal" {
		return value
	}
	return "help_requested"
}

func nullableUUID(value string) any {
	if value == "" {
		return nil
	}
	if _, err := uuid.Parse(value); err != nil {
		return nil
	}
	return value
}

func pulseDates(r *platform.Request) (time.Time, time.Time, error) {
	from, to, err := parseDates(r)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	if from.Weekday() != time.Monday || to.Weekday() != time.Monday || int(to.Sub(from).Hours()/24) != 14 {
		return time.Time{}, time.Time{}, platform.Invalid("Pulse dates must contain two complete Monday-to-Monday weeks.")
	}
	return from, to, nil
}

func weekDates(r *platform.Request) (time.Time, time.Time, error) {
	from, to, err := parseDates(r)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	days := int(to.Sub(from).Hours() / 24)
	if from.Weekday() != time.Monday || to.Weekday() != time.Monday || days < 7 || days > 91 || days%7 != 0 {
		return time.Time{}, time.Time{}, platform.Invalid("Trend dates must be complete Monday-to-Monday weeks.")
	}
	return from, to, nil
}

func parseDates(r *platform.Request) (time.Time, time.Time, error) {
	var fromText, toText string
	if r.HTTP != nil && r.HTTP.URL != nil {
		fromText, toText = r.HTTP.URL.Query().Get("from"), r.HTTP.URL.Query().Get("to")
	}
	from, err := time.Parse("2006-01-02", fromText)
	if err != nil {
		return time.Time{}, time.Time{}, platform.Invalid("Invalid start date.")
	}
	to, err := time.Parse("2006-01-02", toText)
	if err != nil {
		return time.Time{}, time.Time{}, platform.Invalid("Invalid end date.")
	}
	return from, to, nil
}

func splitWeeks(entries []moodEntry, from time.Time, timezone string) ([]moodEntry, []moodEntry) {
	location, _ := time.LoadLocation(timezone)
	start := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, location)
	second := start.AddDate(0, 0, 7)
	end := second.AddDate(0, 0, 7)
	one, two := []moodEntry{}, []moodEntry{}
	for _, entry := range entries {
		at := entry.OccurredAt.In(location)
		switch {
		case !at.Before(start) && at.Before(second):
			one = append(one, entry)
		case !at.Before(second) && at.Before(end):
			two = append(two, entry)
		}
	}
	return one, two
}

func moodOrdinal(label string) (float64, bool) {
	switch label {
	case "very_low":
		return 1, true
	case "low":
		return 2, true
	case "neutral":
		return 3, true
	case "good":
		return 4, true
	case "very_good":
		return 5, true
	default:
		return 0, false
	}
}

func knownMoods(entries []moodEntry) []float64 {
	values := make([]float64, 0, len(entries))
	for _, entry := range entries {
		if value, ok := moodOrdinal(entry.Label); ok {
			values = append(values, value)
		}
	}
	return values
}

func meanMood(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var total float64
	for _, value := range values {
		total += value
	}
	return total / float64(len(values))
}

type notificationJob struct {
	id, requestID, installationID, subjectID, recipientID, linkID string
	tokenCiphertext                                               []byte
	keyVersion, lease                                             string
	expires                                                       time.Time
}

// Run starts the notification worker. It checks once per second as required
// by the backend contract and exits when the caller cancels the context.
func (s *Service) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.Tick(ctx)
		}
	}
}

// Tick performs one bounded notification pass. It is intentionally exported so
// integration tests can run the same claim and dispatch path without sleeping.
func (s *Service) Tick(ctx context.Context) {
	if s.Pool == nil {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 55*time.Second)
	defer cancel()
	s.expireSupportRequests(ctx)
	jobs, err := s.claimJobs(ctx)
	if err != nil {
		return
	}
	for _, job := range jobs {
		if err = s.dispatchJob(ctx, job); err != nil {
			// The lease remains bounded. A later pass reclaims it after thirty
			// seconds, so a worker panic or provider timeout cannot lose a job.
			continue
		}
	}
}

func (s *Service) expireSupportRequests(ctx context.Context) {
	_, _ = s.Pool.Exec(ctx, `UPDATE notification_jobs j SET state='cancelled',lease_token=NULL,lease_expires_at=NULL FROM support_requests q WHERE j.request_id=q.id AND q.expires_at<=now() AND j.state IN ('queued','leased')`)
	_, _ = s.Pool.Exec(ctx, `UPDATE support_requests SET state='expired' WHERE expires_at<=now() AND state IN ('awaiting_permission','queued','provider_accepted')`)
}

func (s *Service) claimJobs(ctx context.Context) ([]notificationJob, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(context.Background())
	lease := platform.ID()
	// Dispatch one lease per pass. The provider call is external; one job
	// keeps the 30-second lease from expiring while a preceding job runs.
	rows, err := tx.Query(ctx, `WITH ready AS (
		SELECT id FROM notification_jobs
		WHERE (state='queued' AND next_attempt_at<=now())
		   OR (state='leased' AND lease_expires_at<=now())
		ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1
	)
	UPDATE notification_jobs j SET state='leased',lease_token=$1,lease_expires_at=now()+interval '30 seconds'
	FROM ready WHERE j.id=ready.id
	RETURNING j.id,j.request_id,j.installation_id`, lease)
	if err != nil {
		return nil, err
	}
	type claimed struct{ id, requestID, installationID string }
	claimedRows := make([]claimed, 0, 1)
	for rows.Next() {
		var row claimed
		if err = rows.Scan(&row.id, &row.requestID, &row.installationID); err != nil {
			rows.Close()
			return nil, err
		}
		claimedRows = append(claimedRows, row)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return nil, err
	}
	jobs := make([]notificationJob, 0, len(claimedRows))
	for _, row := range claimedRows {
		var job notificationJob
		err = tx.QueryRow(ctx, `SELECT j.id,j.request_id,j.installation_id,q.owner_id,l.recipient_id,q.link_id,q.expires_at,pi.token_ciphertext,pi.key_version
			FROM notification_jobs j JOIN support_requests q ON q.id=j.request_id
			JOIN links l ON l.id=q.link_id AND l.owner_id=q.owner_id
			JOIN push_installations pi ON pi.id=j.installation_id
			WHERE j.id=$1 AND j.lease_token=$2`, row.id, lease).Scan(&job.id, &job.requestID, &job.installationID, &job.subjectID, &job.recipientID, &job.linkID, &job.expires, &job.tokenCiphertext, &job.keyVersion)
		if err != nil {
			return nil, err
		}
		job.lease = lease
		jobs = append(jobs, job)
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return jobs, nil
}

func (s *Service) dispatchJob(ctx context.Context, job notificationJob) error {
	keyVersion, lease := job.keyVersion, job.lease
	owners := []string{job.subjectID, job.recipientID}
	sort.Strings(owners)
	unlocks := make([]func(), 0, len(owners))
	for _, owner := range owners {
		unlockOwner, lockErr := s.guard(ctx, owner)
		if lockErr != nil {
			for i := len(unlocks) - 1; i >= 0; i-- {
				unlocks[i]()
			}
			return lockErr
		}
		unlocks = append(unlocks, unlockOwner)
	}
	defer func() {
		for i := len(unlocks) - 1; i >= 0; i-- {
			unlocks[i]()
		}
	}()
	unlockDispatch, err := s.lockDispatch(ctx, job.subjectID, job.linkID)
	if err != nil {
		return err
	}
	defer unlockDispatch()
	var tokenCiphertext []byte
	var expires, leaseExpires time.Time
	var state, currentKeyVersion string
	var recipient string
	err = s.Pool.QueryRow(ctx, `SELECT q.state,q.expires_at,j.lease_expires_at,pi.token_ciphertext,pi.key_version,l.recipient_id
		FROM notification_jobs j JOIN support_requests q ON q.id=j.request_id
		JOIN links l ON l.id=q.link_id AND l.owner_id=q.owner_id AND l.state='active'
		JOIN grants g ON g.id=q.grant_id AND g.link_id=l.id AND g.owner_id=q.owner_id AND g.scope='safety_alerts' AND g.revoked_at IS NULL AND g.policy_version=$3
		JOIN profiles p ON p.id=q.owner_id AND NOT p.deleting
		JOIN profiles rp ON rp.id=l.recipient_id AND NOT rp.deleting
		JOIN push_installations pi ON pi.id=j.installation_id AND pi.owner_id=l.recipient_id AND pi.revoked_at IS NULL
		WHERE j.id=$1 AND j.lease_token=$2 AND j.state='leased' AND j.lease_expires_at>now() AND q.state IN ('queued','provider_accepted')
		AND NOT EXISTS(SELECT 1 FROM data_jobs d WHERE d.owner_id=q.owner_id AND d.kind='delete_history' AND d.state IN ('queued','running','waiting_provider'))`, job.id, lease, s.Config.PolicyVersion).Scan(&state, &expires, &leaseExpires, &tokenCiphertext, &currentKeyVersion, &recipient)
	if errors.Is(err, pgx.ErrNoRows) {
		_, _ = s.Pool.Exec(ctx, `UPDATE notification_jobs SET state='cancelled',lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND state='leased'`, job.id, lease)
		return nil
	}
	if err != nil {
		return err
	}
	_ = recipient
	if !time.Now().UTC().Before(expires) {
		_, _ = s.Pool.Exec(ctx, `UPDATE notification_jobs SET state='cancelled',lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND state='leased'`, job.id, lease)
		return nil
	}
	if currentKeyVersion != keyVersion || currentKeyVersion != s.Config.KeyVersion {
		return s.recordJobOutcome(ctx, job, lease, push.Outcome{Permanent: true, Code: "key_version"}, errors.New("notification key version changed"))
	}
	plain, err := platform.Decrypt(s.Config.DataKey, tokenCiphertext)
	if err != nil {
		return s.recordJobOutcome(ctx, job, lease, push.Outcome{Permanent: true, Code: "invalid_installation"}, err)
	}
	if s.Sender == nil {
		return s.recordJobOutcome(ctx, job, lease, push.Outcome{Permanent: true, Code: "provider_unavailable"}, errors.New("push sender is not configured"))
	}
	sendTimeout := 5 * time.Second
	if remaining := time.Until(expires); remaining < sendTimeout {
		sendTimeout = remaining
	}
	if remaining := time.Until(leaseExpires); remaining < sendTimeout {
		sendTimeout = remaining
	}
	if sendTimeout <= 0 {
		_, _ = s.Pool.Exec(ctx, `UPDATE notification_jobs SET state='cancelled',lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND state='leased'`, job.id, lease)
		return nil
	}
	sendCtx, cancel := context.WithTimeout(ctx, sendTimeout)
	outcome, sendErr := s.Sender.Send(sendCtx, string(plain), job.requestID, expires)
	cancel()
	return s.recordJobOutcome(ctx, job, lease, outcome, sendErr)
}

func (s *Service) recordJobOutcome(ctx context.Context, job notificationJob, lease string, outcome push.Outcome, sendErr error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	if outcome.Accepted {
		var accepted bool
		err = tx.QueryRow(ctx, `UPDATE notification_jobs SET state='accepted',attempts=attempts+1,provider_message_id=$3,error_code=NULL,lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND state='leased' RETURNING true`, job.id, lease, outcome.MessageID).Scan(&accepted)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE support_requests SET state='provider_accepted' WHERE id=$1 AND state='queued' AND expires_at>now()`, job.requestID)
	} else if outcome.Permanent {
		code := outcome.Code
		if code == "" {
			code = "provider_rejected"
		}
		var failed bool
		err = tx.QueryRow(ctx, `UPDATE notification_jobs SET state='failed',attempts=LEAST(attempts+1,4),error_code=$3,lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND state='leased' RETURNING true`, job.id, lease, code).Scan(&failed)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		if outcome.InvalidToken {
			if _, err = tx.Exec(ctx, `UPDATE push_installations SET revoked_at=now(),updated_at=now() WHERE id=$1 AND revoked_at IS NULL`, job.installationID); err != nil {
				return err
			}
		}
	} else {
		var attempts int
		if err = tx.QueryRow(ctx, `SELECT attempts FROM notification_jobs WHERE id=$1 AND lease_token=$2 AND state='leased' FOR UPDATE`, job.id, lease).Scan(&attempts); errors.Is(err, pgx.ErrNoRows) {
			return nil
		} else if err != nil {
			return err
		}
		attempts++
		if attempts >= 4 {
			_, err = tx.Exec(ctx, `UPDATE notification_jobs SET state='failed',attempts=4,error_code=$3,lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND state='leased'`, job.id, lease, transientCode(outcome, sendErr))
		} else {
			delay := []time.Duration{10 * time.Second, 30 * time.Second, 120 * time.Second}[attempts-1]
			_, err = tx.Exec(ctx, `UPDATE notification_jobs SET state='queued',attempts=$3,error_code=$4,next_attempt_at=now()+$5::interval,lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_token=$2 AND state='leased'`, job.id, lease, attempts, transientCode(outcome, sendErr), delay.String())
		}
	}
	if err != nil {
		return err
	}
	// Expiry wins over any retry result. Otherwise a request with no accepted
	// job and no pending jobs is a truthful failed request.
	if _, err = tx.Exec(ctx, `UPDATE support_requests q SET state=CASE
		WHEN q.expires_at<=now() AND q.state NOT IN ('acknowledged','cancelled') THEN 'expired'
		WHEN q.state IN ('queued','provider_accepted') AND EXISTS(SELECT 1 FROM notification_jobs j WHERE j.request_id=q.id AND j.state='accepted') THEN 'provider_accepted'
		WHEN q.state='queued' AND NOT EXISTS(SELECT 1 FROM notification_jobs j WHERE j.request_id=q.id AND j.state IN ('queued','leased','accepted')) THEN 'failed'
		ELSE q.state END
		WHERE q.id=$1`, job.requestID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func transientCode(outcome push.Outcome, sendErr error) string {
	if outcome.Code != "" {
		return outcome.Code
	}
	if sendErr != nil {
		return "provider_unavailable"
	}
	return "provider_unavailable"
}

func (s *Service) guard(ctx context.Context, owner string) (func(), error) {
	if s.Guards == nil {
		return func() {}, nil
	}
	return s.Guards.Lock(ctx, owner)
}
