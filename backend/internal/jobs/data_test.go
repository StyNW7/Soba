package jobs

import (
	"context"
	"encoding/json"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/testutil"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRetentionRemovesCrashOrphansButKeepsLiveExport(t *testing.T) {
	p := testutil.Database(t)
	ctx := context.Background()
	owner := testutil.Owner(t, p)
	objects := FilesystemObjects{t.TempDir()}
	s := &Service{Pool: p, Config: testutil.Config(), Guards: &platform.Guards{}, Objects: objects}
	orphan, ready, fresh := platform.ID(), platform.ID(), platform.ID()
	old := time.Now().Add(-2 * time.Hour)
	for _, key := range []string{orphan, ready, fresh} {
		if err := objects.Put(ctx, key, []byte("encrypted test bytes")); err != nil {
			t.Fatal(err)
		}
		if key != fresh {
			if err := os.Chtimes(filepath.Join(objects.Directory, key+".enc"), old, old); err != nil {
				t.Fatal(err)
			}
		}
	}
	if _, err := p.Exec(ctx, `INSERT INTO data_jobs(id,owner_id,kind,state,generation,object_key,expires_at) VALUES($1::uuid,$2,'export','ready',1,$1::text,now()+interval '1 hour')`, ready, owner); err != nil {
		t.Fatal(err)
	}
	s.Retention(ctx)
	if _, err := objects.Get(ctx, orphan); !os.IsNotExist(err) {
		t.Fatal("old unreferenced object survived", err)
	}
	for _, key := range []string{ready, fresh} {
		if _, err := objects.Get(ctx, key); err != nil {
			t.Fatal("live or recent object removed", err)
		}
	}
}

func TestExportThenAccountDeletionReceipt(t *testing.T) {
	ctx := context.Background()
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	s := &Service{Pool: p, Config: testutil.Config(), Guards: &platform.Guards{}, Objects: FilesystemObjects{t.TempDir()}}
	_, e := p.Exec(ctx, `INSERT INTO memories(id,owner_id,text,category) VALUES($1,$2,'My approved memory','goal')`, platform.ID(), owner)
	if e != nil {
		t.Fatal(e)
	}
	r := testutil.Request(t, p, owner)
	a, e := s.createExport(ctx, r)
	if e != nil {
		t.Fatal(e)
	}
	if e = r.Tx.Commit(ctx); e != nil {
		t.Fatal(e)
	}
	exportID := a.Body.(map[string]any)["id"].(string)
	s.Tick(ctx)
	var state, key string
	e = p.QueryRow(ctx, `SELECT state,coalesce(object_key,'') FROM data_jobs WHERE id=$1`, exportID).Scan(&state, &key)
	if e != nil || state != "ready" {
		t.Fatalf("export %s %v", state, e)
	}
	cipher, e := s.Objects.Get(ctx, key)
	if e != nil {
		t.Fatal(e)
	}
	plain, e := platform.Decrypt(s.Config.DataKey, cipher)
	if e != nil {
		t.Fatal(e)
	}
	var data map[string]any
	if e = json.Unmarshal(plain, &data); e != nil || len(data["memories"].([]any)) != 1 {
		t.Fatal("approved memory missing")
	}
	if _, ok := data["auth_sessions"]; ok {
		t.Fatal("credentials exported")
	}
	device := platform.ID()
	_, e = p.Exec(ctx, `INSERT INTO devices(id,owner_id,state,credential_hash) VALUES($1,$2,'paired',$3)`, device, owner, platform.Hash(platform.Token()))
	if e != nil {
		t.Fatal(e)
	}
	r = testutil.Request(t, p, owner)
	r.Body = map[string]any{"scope": "account", "confirmation": "delete"}
	a, e = s.createDeletion(ctx, r)
	if e != nil {
		t.Fatal(e)
	}
	if e = r.Tx.Commit(ctx); e != nil {
		t.Fatal(e)
	}
	job := a.Body.(map[string]any)
	s.Tick(ctx)
	var count int
	if e = p.QueryRow(ctx, `SELECT count(*) FROM profiles WHERE id=$1`, owner).Scan(&count); e != nil || count != 0 {
		t.Fatal("account not deleted")
	}
	if _, e = s.Objects.Get(ctx, key); e == nil {
		t.Fatal("export not deleted")
	}
	r = &platform.Request{HTTP: httptest.NewRequest("GET", "/", nil)}
	r.HTTP.SetPathValue("id", job["id"].(string))
	r.HTTP.Header.Set("X-Deletion-Receipt", job["receipt"].(string))
	a, e = s.receipt(ctx, r)
	if e != nil {
		t.Fatal(e)
	}
	if a.Body.(map[string]any)["state"] != "complete" {
		t.Fatal(a.Body)
	}
	r.HTTP.Header.Set("X-Deletion-Receipt", platform.Token())
	if _, e = s.receipt(ctx, r); e == nil {
		t.Fatal("wrong receipt accepted")
	}
}
func TestObjectKeysCannotEscapeVolume(t *testing.T) {
	o := FilesystemObjects{t.TempDir()}
	if e := o.Put(context.Background(), "../secret", []byte("x")); e == nil {
		t.Fatal("unsafe key accepted")
	}
}

func TestHistoryDeletionRemovesReplayContentButKeepsProfile(t *testing.T) {
	ctx := context.Background()
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	s := &Service{Pool: p, Config: testutil.Config(), Guards: &platform.Guards{}, Objects: FilesystemObjects{t.TempDir()}}
	_, e := p.Exec(ctx, `INSERT INTO contacts(id,owner_id,display_name,relationship) VALUES($1,$2,'Friend','friend')`, platform.ID(), owner)
	if e != nil {
		t.Fatal(e)
	}
	_, e = p.Exec(ctx, `INSERT INTO journals(id,owner_id,topic,reflection) VALUES($1,$2,'private','private')`, platform.ID(), owner)
	if e != nil {
		t.Fatal(e)
	}
	cipher, e := platform.Encrypt(s.Config.DataKey, []byte(`{"reflection":"private"}`))
	if e != nil {
		t.Fatal(e)
	}
	_, e = p.Exec(ctx, `INSERT INTO idempotency_records(actor_key,route,key,request_hash,response_ciphertext,key_version,response_status,expires_at) VALUES($1,'PATCH /v1/journals/example',$2,$3,$4,'1',200,now()+interval '24 hours')`, platform.Hash(owner), platform.ID(), platform.Hash("request"), cipher)
	if e != nil {
		t.Fatal(e)
	}
	r := testutil.Request(t, p, owner)
	r.Body = map[string]any{"scope": "history", "confirmation": "delete"}
	if _, e = s.createDeletion(ctx, r); e != nil {
		t.Fatal(e)
	}
	if e = r.Tx.Commit(ctx); e != nil {
		t.Fatal(e)
	}
	s.Tick(ctx)
	for table, want := range map[string]int{"profiles": 1, "contacts": 1, "journals": 0, "idempotency_records": 0} {
		var count int
		if e = p.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&count); e != nil || count != want {
			t.Fatalf("%s = %d error %v", table, count, e)
		}
	}
}
