package store

import (
	"bytes"
	"testing"
)

func TestStripOuterTransaction(t *testing.T) {
	input := []byte("-- header\nBEGIN;\nCREATE TABLE example (id integer);\nDO $$ BEGIN RAISE NOTICE 'inside'; END $$;\nCOMMIT;\n")
	got, err := stripOuterTransaction(input)
	if err != nil {
		t.Fatalf("stripOuterTransaction returned error: %v", err)
	}
	want := []byte("-- header\n\nCREATE TABLE example (id integer);\nDO $$ BEGIN RAISE NOTICE 'inside'; END $$;\n\n")
	if !bytes.Equal(got, want) {
		t.Fatalf("unexpected script after stripping outer transaction:\n got %q\nwant %q", got, want)
	}
}

func TestStripOuterTransactionLeavesUnwrappedScriptUnchanged(t *testing.T) {
	input := []byte("CREATE TABLE example (id integer);\n")
	got, err := stripOuterTransaction(input)
	if err != nil {
		t.Fatalf("stripOuterTransaction returned error: %v", err)
	}
	if !bytes.Equal(got, input) {
		t.Fatalf("unwrapped script changed: got %q want %q", got, input)
	}
}

func TestStripOuterTransactionRejectsIncompleteWrapper(t *testing.T) {
	if _, err := stripOuterTransaction([]byte("BEGIN; CREATE TABLE example (id integer);")); err == nil {
		t.Fatal("expected missing COMMIT error")
	}
}

func TestEmbeddedMigrations(t *testing.T) {
	migrations, err := loadMigrations()
	if err != nil {
		t.Fatalf("loadMigrations returned error: %v", err)
	}
	if len(migrations) != 5 {
		t.Fatalf("got %d embedded migrations, want 4", len(migrations))
	}
	if migrations[1].name != "initial" || migrations[2].name != "mobile_auth_time" || migrations[3].name != "idempotency_resources" {
		t.Fatalf("unexpected migration names: %#v", migrations)
	}
}
