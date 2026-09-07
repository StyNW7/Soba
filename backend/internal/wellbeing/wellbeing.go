// Package wellbeing implements the owner's private wellbeing records and the
// reviewed content directories.
package wellbeing

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Service contains the database and application dependencies used by the
// wellbeing handlers. All authority comes from the authenticated request owner.
type Service struct {
	Pool        *pgxpool.Pool
	Config      platform.Config
	CancelOwner func(string)
}

// Handlers returns the operation IDs used by the shared HTTP contract router.
func (s *Service) Handlers() map[string]platform.Handler {
	return map[string]platform.Handler{
		"listMoodEntry":        s.listMood,
		"createMoodEntry":      s.createMood,
		"getMoodEntry":         s.getMood,
		"updateMoodEntry":      s.updateMood,
		"deleteMoodEntry":      s.deleteMood,
		"listJournal":          s.listJournal,
		"getJournal":           s.getJournal,
		"updateJournal":        s.updateJournal,
		"deleteJournal":        s.deleteJournal,
		"listMemory":           s.listMemory,
		"createMemory":         s.createMemory,
		"getMemory":            s.getMemory,
		"updateMemory":         s.updateMemory,
		"deleteMemory":         s.deleteMemory,
		"listReferral":         s.listReferral,
		"createReferral":       s.createReferral,
		"getReferral":          s.getReferral,
		"updateReferral":       s.updateReferral,
		"deleteReferral":       s.deleteReferral,
		"getMoodTrends":        s.getMoodTrends,
		"listToolkit":          s.listToolkit,
		"getToolkit":           s.getToolkit,
		"listParentCoach":      s.listParentCoach,
		"getParentCoach":       s.getParentCoach,
		"listSupportResources": s.listSupportResources,
		"getSupportResource":   s.getSupportResource,
		"getSafetyPlan":        s.getSafetyPlan,
		"setSafetyPlan":        s.setSafetyPlan,
	}
}

const (
	maxText = 3000
)

var moodLabels = [...]string{"very_low", "low", "neutral", "good", "very_good", "unknown"}

const moodProjection = `jsonb_build_object(
	'id',id,
	'created_at',created_at,
	'updated_at',updated_at,
	'version',version,
	'label',label,
	'source',source,
	'occurred_at',occurred_at,
	'timezone',timezone)`

const journalProjection = `jsonb_build_object(
	'id',id,
	'created_at',created_at,
	'updated_at',updated_at,
	'version',version,
	'topic',topic,
	'reflection',reflection,
	'insights',insights,
	'session_id',session_id)`

const memoryProjection = `jsonb_build_object(
	'id',id,
	'created_at',created_at,
	'updated_at',updated_at,
	'version',version,
	'text',text,
	'category',category)`

const referralProjection = `jsonb_build_object(
	'id',id,
	'created_at',created_at,
	'updated_at',updated_at,
	'version',version,
	'resource_id',resource_id,
	'state',state,
	'reported_by','user')`

const contentProjection = `jsonb_build_object(
	'id',id,
	'created_at',created_at,
	'updated_at',updated_at,
	'version',version,
	'kind',kind,
	'title',title,
	'locale',locale,
	'steps',steps,
	'reviewed_at',reviewed_at,
	'review_expires_at',review_expires_at)`

const supportResourceProjection = `jsonb_build_object(
	'id',id,
	'created_at',created_at,
	'updated_at',updated_at,
	'version',version,
	'name',name,
	'region',region,
	'locale',locale,
	'kind',kind,
	'access_url',access_url,
	'phone',phone,
	'availability_text',availability_text,
	'reviewed_at',reviewed_at,
	'review_expires_at',review_expires_at)`

func (s *Service) listMood(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "mood-entries")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, readQuery(r, s.Pool), `SELECT `+moodProjection+` FROM mood_entries
		WHERE owner_id=$1 AND (occurred_at,id)<($2,$3::uuid)
		ORDER BY occurred_at DESC,id DESC LIMIT $4`, r.Owner(), stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	next := nextCursor(s.Config.CursorKey, r.Owner(), "mood-entries", items, n, "occurred_at")
	return platform.OK(map[string]any{"items": itemsOrEmpty(items, n), "next_cursor": next}), nil
}

func (s *Service) createMood(ctx context.Context, r *platform.Request) (platform.Result, error) {
	label := r.String("label")
	if !validMoodLabel(label) {
		return platform.Result{}, platform.Invalid("Invalid mood label.")
	}
	when, err := parseDateTime(r.String("occurred_at"))
	if err != nil {
		return platform.Result{}, platform.Invalid("Invalid occurrence time.")
	}
	zone := r.String("timezone")
	if !validTimezone(zone) {
		return platform.Result{}, platform.Invalid("Invalid timezone.")
	}
	now := time.Now().UTC()
	if when.Before(now.Add(-7*24*time.Hour)) || when.After(now.Add(5*time.Minute)) {
		return platform.Result{}, platform.Invalid("Check-in time must be within the allowed range.")
	}
	id := platform.ID()
	if _, err = r.Tx.Exec(ctx, `INSERT INTO mood_entries(id,owner_id,session_id,label,source,occurred_at,timezone)
		VALUES($1,$2,NULL,$3,'check_in',$4,$5)`, id, r.Owner(), label, when, zone); err != nil {
		return platform.Result{}, err
	}
	item, err := platform.Row(ctx, r.Tx, `SELECT `+moodProjection+` FROM mood_entries WHERE id=$1 AND owner_id=$2`, id, r.Owner())
	return platform.Created(item), err
}

func (s *Service) getMood(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := platform.Row(ctx, readQuery(r, s.Pool), `SELECT `+moodProjection+` FROM mood_entries WHERE id=$1 AND owner_id=$2`, requestID(r), r.Owner())
	return platform.OK(item), err
}

func (s *Service) updateMood(ctx context.Context, r *platform.Request) (platform.Result, error) {
	label := r.String("label")
	if !validMoodLabel(label) {
		return platform.Result{}, platform.Invalid("Invalid mood label.")
	}
	item, err := platform.Row(ctx, r.Tx, `UPDATE mood_entries SET label=$3 WHERE id=$1 AND owner_id=$2 AND version=$4 RETURNING `+moodProjection,
		requestID(r), r.Owner(), label, bodyInt(r, "version"))
	if err == nil {
		return platform.OK(item), nil
	}
	return updateFailure(ctx, r, s.Pool, err, `SELECT EXISTS(SELECT 1 FROM mood_entries WHERE id=$1 AND owner_id=$2)`, requestID(r), r.Owner())
}

func (s *Service) deleteMood(ctx context.Context, r *platform.Request) (platform.Result, error) {
	tag, err := r.Tx.Exec(ctx, `DELETE FROM mood_entries WHERE id=$1 AND owner_id=$2`, requestID(r), r.Owner())
	if err != nil {
		return platform.Result{}, err
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, platform.NotFound()
	}
	return platform.NoContent(), nil
}

func (s *Service) listJournal(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "journals")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, readQuery(r, s.Pool), `SELECT `+journalProjection+` FROM journals
		WHERE owner_id=$1 AND (created_at,id)<($2,$3::uuid)
		ORDER BY created_at DESC,id DESC LIMIT $4`, r.Owner(), stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	next := nextCursor(s.Config.CursorKey, r.Owner(), "journals", items, n, "created_at")
	return platform.OK(map[string]any{"items": itemsOrEmpty(items, n), "next_cursor": next}), nil
}

func (s *Service) getJournal(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := platform.Row(ctx, readQuery(r, s.Pool), `SELECT `+journalProjection+` FROM journals WHERE id=$1 AND owner_id=$2`, requestID(r), r.Owner())
	return platform.OK(item), err
}

func (s *Service) updateJournal(ctx context.Context, r *platform.Request) (platform.Result, error) {
	topic := r.String("topic")
	reflection := r.String("reflection")
	if err := validateText(topic, 160, "Topic"); err != nil {
		return platform.Result{}, err
	}
	if err := validateText(reflection, maxText, "Reflection"); err != nil {
		return platform.Result{}, err
	}
	insights, err := stringSlice(r.Body["insights"], 5, 300, 0, "Insights")
	if err != nil {
		return platform.Result{}, err
	}
	item, err := platform.Row(ctx, r.Tx, `UPDATE journals SET topic=$3,reflection=$4,insights=$5
		WHERE id=$1 AND owner_id=$2 AND version=$6 RETURNING `+journalProjection,
		requestID(r), r.Owner(), topic, reflection, insights, bodyInt(r, "version"))
	if err == nil {
		return platform.OK(item), nil
	}
	return updateFailure(ctx, r, s.Pool, err, `SELECT EXISTS(SELECT 1 FROM journals WHERE id=$1 AND owner_id=$2)`, requestID(r), r.Owner())
}

func (s *Service) deleteJournal(ctx context.Context, r *platform.Request) (platform.Result, error) {
	tag, err := r.Tx.Exec(ctx, `DELETE FROM journals WHERE id=$1 AND owner_id=$2`, requestID(r), r.Owner())
	if err != nil {
		return platform.Result{}, err
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, platform.NotFound()
	}
	return platform.NoContent(), nil
}

func (s *Service) listMemory(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "memories")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, readQuery(r, s.Pool), `SELECT `+memoryProjection+` FROM memories
		WHERE owner_id=$1 AND (updated_at,id)<($2,$3::uuid)
		ORDER BY updated_at DESC,id DESC LIMIT $4`, r.Owner(), stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	next := nextCursor(s.Config.CursorKey, r.Owner(), "memories", items, n, "updated_at")
	return platform.OK(map[string]any{"items": itemsOrEmpty(items, n), "next_cursor": next}), nil
}

func (s *Service) createMemory(ctx context.Context, r *platform.Request) (platform.Result, error) {
	text := r.String("text")
	if err := validateText(text, 500, "Memory"); err != nil {
		return platform.Result{}, err
	}
	if strings.TrimSpace(text) == "" {
		return platform.Result{}, platform.Invalid("Memory cannot be blank.")
	}
	category := r.String("category")
	if !validMemoryCategory(category) {
		return platform.Result{}, platform.Invalid("Invalid memory category.")
	}
	id := platform.ID()
	if _, err := r.Tx.Exec(ctx, `INSERT INTO memories(id,owner_id,session_id,candidate_id,text,category)
		VALUES($1,$2,NULL,NULL,$3,$4)`, id, r.Owner(), text, category); err != nil {
		return platform.Result{}, err
	}
	item, err := platform.Row(ctx, r.Tx, `SELECT `+memoryProjection+` FROM memories WHERE id=$1 AND owner_id=$2`, id, r.Owner())
	return platform.Created(item), err
}

func (s *Service) getMemory(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := platform.Row(ctx, readQuery(r, s.Pool), `SELECT `+memoryProjection+` FROM memories WHERE id=$1 AND owner_id=$2`, requestID(r), r.Owner())
	return platform.OK(item), err
}

func (s *Service) updateMemory(ctx context.Context, r *platform.Request) (platform.Result, error) {
	text := r.String("text")
	if err := validateText(text, 500, "Memory"); err != nil {
		return platform.Result{}, err
	}
	if strings.TrimSpace(text) == "" {
		return platform.Result{}, platform.Invalid("Memory cannot be blank.")
	}
	category := r.String("category")
	if !validMemoryCategory(category) {
		return platform.Result{}, platform.Invalid("Invalid memory category.")
	}
	item, err := platform.Row(ctx, r.Tx, `UPDATE memories SET text=$3,category=$4
		WHERE id=$1 AND owner_id=$2 AND version=$5 RETURNING `+memoryProjection,
		requestID(r), r.Owner(), text, category, bodyInt(r, "version"))
	if err != nil {
		return updateFailure(ctx, r, s.Pool, err, `SELECT EXISTS(SELECT 1 FROM memories WHERE id=$1 AND owner_id=$2)`, requestID(r), r.Owner())
	}
	scheduleCancel(r, s.CancelOwner)
	return platform.OK(item), nil
}

func (s *Service) deleteMemory(ctx context.Context, r *platform.Request) (platform.Result, error) {
	tag, err := r.Tx.Exec(ctx, `DELETE FROM memories WHERE id=$1 AND owner_id=$2`, requestID(r), r.Owner())
	if err != nil {
		return platform.Result{}, err
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, platform.NotFound()
	}
	scheduleCancel(r, s.CancelOwner)
	return platform.NoContent(), nil
}

func (s *Service) listReferral(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, cursor, err := page(r, s.Config.CursorKey, "referrals")
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, readQuery(r, s.Pool), `SELECT `+referralProjection+` FROM referrals
		WHERE owner_id=$1 AND (created_at,id)<($2,$3::uuid)
		ORDER BY created_at DESC,id DESC LIMIT $4`, r.Owner(), stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	next := nextCursor(s.Config.CursorKey, r.Owner(), "referrals", items, n, "created_at")
	return platform.OK(map[string]any{"items": itemsOrEmpty(items, n), "next_cursor": next}), nil
}

func (s *Service) createReferral(ctx context.Context, r *platform.Request) (platform.Result, error) {
	resourceID := r.String("resource_id")
	var available bool
	if err := r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM support_resources WHERE id=$1 AND review_expires_at>now())`, resourceID).Scan(&available); err != nil {
		return platform.Result{}, err
	}
	if !available {
		return platform.Result{}, platform.NotFound()
	}
	id := platform.ID()
	if _, err := r.Tx.Exec(ctx, `INSERT INTO referrals(id,owner_id,resource_id,state) VALUES($1,$2,$3,'considering')`, id, r.Owner(), resourceID); err != nil {
		return platform.Result{}, err
	}
	item, err := platform.Row(ctx, r.Tx, `SELECT `+referralProjection+` FROM referrals WHERE id=$1 AND owner_id=$2`, id, r.Owner())
	return platform.Created(item), err
}

func (s *Service) getReferral(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := platform.Row(ctx, readQuery(r, s.Pool), `SELECT `+referralProjection+` FROM referrals WHERE id=$1 AND owner_id=$2`, requestID(r), r.Owner())
	return platform.OK(item), err
}

func (s *Service) updateReferral(ctx context.Context, r *platform.Request) (platform.Result, error) {
	state := r.String("state")
	if !validReferralState(state) {
		return platform.Result{}, platform.Invalid("Invalid referral state.")
	}
	var current string
	var currentVersion int64
	if err := r.Tx.QueryRow(ctx, `SELECT state,version FROM referrals WHERE id=$1 AND owner_id=$2 FOR UPDATE`, requestID(r), r.Owner()).Scan(&current, &currentVersion); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return platform.Result{}, platform.NotFound()
		}
		return platform.Result{}, err
	}
	if bodyInt(r, "version") != currentVersion {
		return platform.Result{}, platform.Conflict()
	}
	if !validReferralTransition(current, state) {
		return platform.Result{}, platform.Invalid("This referral state change is not allowed.")
	}
	item, err := platform.Row(ctx, r.Tx, `UPDATE referrals SET state=$3
		WHERE id=$1 AND owner_id=$2 AND version=$4 RETURNING `+referralProjection,
		requestID(r), r.Owner(), state, bodyInt(r, "version"))
	if err == nil {
		return platform.OK(item), nil
	}
	return updateFailure(ctx, r, s.Pool, err, `SELECT EXISTS(SELECT 1 FROM referrals WHERE id=$1 AND owner_id=$2)`, requestID(r), r.Owner())
}

func (s *Service) deleteReferral(ctx context.Context, r *platform.Request) (platform.Result, error) {
	tag, err := r.Tx.Exec(ctx, `DELETE FROM referrals WHERE id=$1 AND owner_id=$2`, requestID(r), r.Owner())
	if err != nil {
		return platform.Result{}, err
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, platform.NotFound()
	}
	return platform.NoContent(), nil
}

func (s *Service) getMoodTrends(ctx context.Context, r *platform.Request) (platform.Result, error) {
	from, to, err := trendDates(r)
	if err != nil {
		return platform.Result{}, err
	}
	q := readQuery(r, s.Pool)
	var timezone string
	if err = q.QueryRow(ctx, `SELECT timezone FROM profiles WHERE id=$1 AND NOT deleting`, r.Owner()).Scan(&timezone); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return platform.Result{}, platform.NotFound()
		}
		return platform.Result{}, err
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return platform.Result{}, platform.Invalid("The profile timezone is invalid.")
	}
	fromLocal := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, location)
	toLocal := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, location)
	rows, err := q.Query(ctx, `SELECT label,occurred_at FROM mood_entries
		WHERE owner_id=$1 AND occurred_at >= $2 AND occurred_at < $3`, r.Owner(), fromLocal.UTC(), toLocal.UTC())
	if err != nil {
		return platform.Result{}, err
	}
	defer rows.Close()
	entries := make([]TrendEntry, 0)
	for rows.Next() {
		var entry TrendEntry
		if err = rows.Scan(&entry.Label, &entry.OccurredAt); err != nil {
			return platform.Result{}, err
		}
		entries = append(entries, entry)
	}
	if err = rows.Err(); err != nil {
		return platform.Result{}, err
	}
	buckets := CalculateMoodBuckets(from, to, location, entries)
	return platform.OK(map[string]any{"timezone": timezone, "buckets": buckets}), nil
}

func (s *Service) listToolkit(ctx context.Context, r *platform.Request) (platform.Result, error) {
	locale := queryValue(r, "locale")
	if !validLocale(locale) {
		return platform.Result{}, platform.Invalid("A valid locale is required.")
	}
	filter := "toolkit:" + locale
	n, cursor, err := page(r, s.Config.CursorKey, filter)
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, readQuery(r, s.Pool), `SELECT `+contentProjection+` FROM content_items
		WHERE kind<>'coach' AND locale=$1 AND review_status='approved' AND review_expires_at>now()
		AND (created_at,id)<($2,$3::uuid) ORDER BY created_at DESC,id DESC LIMIT $4`, locale, stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	next := nextCursor(s.Config.CursorKey, r.Owner(), filter, items, n, "created_at")
	return platform.OK(map[string]any{"items": itemsOrEmpty(items, n), "next_cursor": next}), nil
}

func (s *Service) getToolkit(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := platform.Row(ctx, readQuery(r, s.Pool), `SELECT `+contentProjection+` FROM content_items
		WHERE id=$1 AND kind<>'coach' AND review_status='approved' AND review_expires_at>now()`, requestID(r))
	return platform.OK(item), err
}

func (s *Service) listParentCoach(ctx context.Context, r *platform.Request) (platform.Result, error) {
	locale := queryValue(r, "locale")
	if !validLocale(locale) {
		return platform.Result{}, platform.Invalid("A valid locale is required.")
	}
	filter := "parent-coach:" + locale
	n, cursor, err := page(r, s.Config.CursorKey, filter)
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, readQuery(r, s.Pool), `SELECT `+contentProjection+` FROM content_items
		WHERE kind='coach' AND locale=$1 AND review_status='approved' AND review_expires_at>now()
		AND (created_at,id)<($2,$3::uuid) ORDER BY created_at DESC,id DESC LIMIT $4`, locale, stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	next := nextCursor(s.Config.CursorKey, r.Owner(), filter, items, n, "created_at")
	return platform.OK(map[string]any{"items": itemsOrEmpty(items, n), "next_cursor": next}), nil
}

func (s *Service) getParentCoach(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := platform.Row(ctx, readQuery(r, s.Pool), `SELECT `+contentProjection+` FROM content_items
		WHERE id=$1 AND kind='coach' AND review_status='approved' AND review_expires_at>now()`, requestID(r))
	return platform.OK(item), err
}

func (s *Service) listSupportResources(ctx context.Context, r *platform.Request) (platform.Result, error) {
	region := queryValue(r, "region")
	locale := queryValue(r, "locale")
	if locale != "" && !validLocale(locale) {
		return platform.Result{}, platform.Invalid("Invalid locale.")
	}
	filter := fmt.Sprintf("support-resources:%s:%s", region, locale)
	n, cursor, err := page(r, s.Config.CursorKey, filter)
	if err != nil {
		return platform.Result{}, err
	}
	stamp, id := pageStart(cursor)
	items, err := platform.Rows(ctx, readQuery(r, s.Pool), `SELECT `+supportResourceProjection+` FROM support_resources
		WHERE review_expires_at>now() AND ($1='' OR region=$1) AND ($2='' OR locale=$2)
		AND (created_at,id)<($3,$4::uuid) ORDER BY created_at DESC,id DESC LIMIT $5`, region, locale, stamp, id, n+1)
	if err != nil {
		return platform.Result{}, err
	}
	next := nextCursor(s.Config.CursorKey, r.Owner(), filter, items, n, "created_at")
	return platform.OK(map[string]any{"items": itemsOrEmpty(items, n), "next_cursor": next}), nil
}

func (s *Service) getSupportResource(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := platform.Row(ctx, readQuery(r, s.Pool), `SELECT `+supportResourceProjection+` FROM support_resources
		WHERE id=$1 AND review_expires_at>now()`, requestID(r))
	return platform.OK(item), err
}

func (s *Service) getSafetyPlan(ctx context.Context, r *platform.Request) (platform.Result, error) {
	item, err := platform.Row(ctx, readQuery(r, s.Pool), `SELECT jsonb_build_object('version',version,'steps',steps)
		FROM safety_plans WHERE owner_id=$1`, r.Owner())
	return platform.OK(item), err
}

func (s *Service) setSafetyPlan(ctx context.Context, r *platform.Request) (platform.Result, error) {
	steps, err := stringSlice(r.Body["steps"], 10, 500, 1, "Safety plan step")
	if err != nil {
		return platform.Result{}, err
	}
	expected := bodyInt(r, "version")
	item, err := platform.Row(ctx, r.Tx, `UPDATE safety_plans SET steps=$2
		WHERE owner_id=$1 AND version=$3 RETURNING jsonb_build_object('version',version,'steps',steps)`, r.Owner(), steps, expected)
	if err == nil {
		return platform.OK(item), nil
	}
	if !isNotFound(err) {
		return platform.Result{}, err
	}
	var exists bool
	if err = readQuery(r, s.Pool).QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM safety_plans WHERE owner_id=$1)`, r.Owner()).Scan(&exists); err != nil {
		return platform.Result{}, err
	}
	if exists || expected != 1 {
		return platform.Result{}, platform.Conflict()
	}
	item, err = platform.Row(ctx, r.Tx, `INSERT INTO safety_plans(owner_id,steps,version) VALUES($1,$2,1)
		RETURNING jsonb_build_object('version',version,'steps',steps)`, r.Owner(), steps)
	return platform.OK(item), err
}

// TrendEntry is deliberately small so the trend calculator can be reused by
// another package without exposing journal or conversation data.
type TrendEntry struct {
	Label      string
	OccurredAt time.Time
}

// TrendBucket is the public, privacy-safe shape used by trend calculations.
type TrendBucket struct {
	StartDate string      `json:"start_date"`
	EndDate   string      `json:"end_date"`
	State     string      `json:"state"`
	Counts    []MoodCount `json:"counts"`
}

// MoodCount is one label count in an available trend bucket.
type MoodCount struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

// CalculateMoodBuckets creates complete daily buckets. It keeps unknown labels,
// reports no-data days with an empty count list, and uses the supplied IANA
// location for date boundaries.
func CalculateMoodBuckets(from, to time.Time, location *time.Location, entries []TrendEntry) []TrendBucket {
	if location == nil {
		location = time.UTC
	}
	// from and to are calendar dates. Keep their date components when assigning
	// the profile location; converting UTC midnight first would shift dates in
	// negative-offset time zones.
	start := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, location)
	end := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, location)
	if !end.After(start) {
		return []TrendBucket{}
	}
	buckets := make([]TrendBucket, 0)
	for day := start; day.Before(end); day = day.AddDate(0, 0, 1) {
		counts := map[string]int{}
		for _, entry := range entries {
			at := entry.OccurredAt.In(location)
			if at.Year() == day.Year() && at.YearDay() == day.YearDay() {
				counts[entry.Label]++
			}
		}
		bucket := TrendBucket{
			StartDate: day.Format("2006-01-02"),
			EndDate:   day.AddDate(0, 0, 1).Format("2006-01-02"),
			State:     "insufficient_data",
			Counts:    []MoodCount{},
		}
		if len(counts) > 0 {
			bucket.State = "available"
			bucket.Counts = make([]MoodCount, 0, len(moodLabels))
			for _, label := range moodLabels {
				bucket.Counts = append(bucket.Counts, MoodCount{Label: label, Count: counts[label]})
			}
		}
		buckets = append(buckets, bucket)
	}
	return buckets
}

func trendDates(r *platform.Request) (time.Time, time.Time, error) {
	fromText := queryValue(r, "from")
	toText := queryValue(r, "to")
	from, err := time.Parse("2006-01-02", fromText)
	if err != nil {
		return time.Time{}, time.Time{}, platform.Invalid("Invalid start date.")
	}
	to, err := time.Parse("2006-01-02", toText)
	if err != nil {
		return time.Time{}, time.Time{}, platform.Invalid("Invalid end date.")
	}
	days := int(to.Sub(from).Hours() / 24)
	if days < 1 || days > 366 {
		return time.Time{}, time.Time{}, platform.Invalid("The trend range must be 1 to 366 days.")
	}
	return from, to, nil
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

func nextCursor(key []byte, owner, filter string, items []map[string]any, limit int, timestampField string) any {
	if len(items) <= limit {
		return nil
	}
	items = items[:limit]
	last := items[len(items)-1]
	stamp, ok := timestamp(last[timestampField])
	if !ok {
		return nil
	}
	id, ok := last["id"].(string)
	if !ok {
		return nil
	}
	return platform.NextCursor(key, owner, filter, id, stamp)
}

func itemsOrEmpty(items []map[string]any, limit int) []map[string]any {
	if len(items) > limit {
		return items[:limit]
	}
	return items
}

func timestamp(value any) (time.Time, bool) {
	s, ok := value.(string)
	if !ok {
		return time.Time{}, false
	}
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		t, err = time.Parse(time.RFC3339, s)
	}
	return t, err == nil
}

func readQuery(r *platform.Request, pool *pgxpool.Pool) platform.Queryer {
	return r.Q(pool)
}

func requestID(r *platform.Request) string {
	if r.HTTP == nil {
		return ""
	}
	return r.ID()
}

func queryValue(r *platform.Request, name string) string {
	if r.HTTP == nil || r.HTTP.URL == nil {
		return ""
	}
	return r.HTTP.URL.Query().Get(name)
}

func updateFailure(ctx context.Context, r *platform.Request, pool *pgxpool.Pool, updateErr error, existsSQL string, args ...any) (platform.Result, error) {
	if !isNotFound(updateErr) {
		return platform.Result{}, updateErr
	}
	var exists bool
	if err := readQuery(r, pool).QueryRow(ctx, existsSQL, args...).Scan(&exists); err != nil {
		return platform.Result{}, err
	}
	if exists {
		return platform.Result{}, platform.Conflict()
	}
	return platform.Result{}, platform.NotFound()
}

func isNotFound(err error) bool {
	var api *platform.Error
	return errors.As(err, &api) && api.Status == http.StatusNotFound
}

func scheduleCancel(r *platform.Request, cancel func(string)) {
	if cancel == nil {
		return
	}
	owner := r.Owner()
	r.AfterCommit = append(r.AfterCommit, func() { cancel(owner) })
}

func parseDateTime(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, errors.New("empty timestamp")
	}
	t, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}, err
	}
	return t.UTC(), nil
}

func validTimezone(value string) bool {
	if value == "" || !utf8.ValidString(value) {
		return false
	}
	_, err := time.LoadLocation(value)
	return err == nil
}

func validLocale(value string) bool { return value == "id-ID" || value == "en-US" }

func validMoodLabel(value string) bool {
	for _, label := range moodLabels {
		if value == label {
			return true
		}
	}
	return false
}

func validMemoryCategory(value string) bool {
	switch value {
	case "preference", "person", "event", "goal":
		return true
	default:
		return false
	}
}

func validReferralState(value string) bool {
	switch value {
	case "considering", "contacted", "appointment_reported", "closed":
		return true
	default:
		return false
	}
}

func validReferralTransition(current, next string) bool {
	if current == next {
		return true
	}
	switch current {
	case "considering":
		return next == "contacted" || next == "appointment_reported" || next == "closed"
	case "contacted":
		return next == "appointment_reported" || next == "closed"
	case "appointment_reported":
		return next == "closed"
	case "closed":
		return next == "considering"
	default:
		return false
	}
}

func validateText(value string, max int, name string) error {
	if !utf8.ValidString(value) || len([]rune(value)) > max {
		return platform.Invalid(fmt.Sprintf("%s is too long.", name))
	}
	return nil
}

func stringSlice(value any, maxItems, maxChars, minChars int, name string) ([]string, error) {
	if value == nil {
		return nil, platform.Invalid(name + " list is required.")
	}
	var values []string
	switch v := value.(type) {
	case []string:
		values = v
	case []any:
		values = make([]string, 0, len(v))
		for _, item := range v {
			s, ok := item.(string)
			if !ok {
				return nil, platform.Invalid(name + " must contain text.")
			}
			values = append(values, s)
		}
	default:
		return nil, platform.Invalid(name + " must be a list.")
	}
	if len(values) > maxItems {
		return nil, platform.Invalid(name + " list is too long.")
	}
	for _, value := range values {
		if !utf8.ValidString(value) || len([]rune(value)) > maxChars || len([]rune(value)) < minChars {
			return nil, platform.Invalid(name + " item is invalid.")
		}
	}
	return values, nil
}

func bodyInt(r *platform.Request, key string) int64 {
	if value := r.Int(key); value != 0 {
		return value
	}
	switch value := r.Body[key].(type) {
	case int:
		return int64(value)
	case int8:
		return int64(value)
	case int16:
		return int64(value)
	case int32:
		return int64(value)
	case int64:
		return value
	case uint:
		return int64(value)
	case uint8:
		return int64(value)
	case uint16:
		return int64(value)
	case uint32:
		return int64(value)
	case uint64:
		return int64(value)
	default:
		return 0
	}
}
