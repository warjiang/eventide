package main

import (
	"context"
	"log"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/joho/godotenv/autoload"
	"github.com/warjiang/eventide/internal/config"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/internal/pgstore"
	"github.com/warjiang/eventide/migrations"
)

func main() {
	logx.Setup()
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	store, err := pgstore.New(ctx, cfg.Postgres.ConnString)
	if err != nil {
		log.Fatalf("pg: %v", err)
	}
	defer store.Close()
	if err := store.Ping(ctx); err != nil {
		log.Fatalf("pg ping: %v", err)
	}
	if err := store.EnsureMigrationsTable(ctx); err != nil {
		log.Fatalf("pg migrations table: %v", err)
	}

	files, err := listSQL()
	if err != nil {
		log.Fatalf("list: %v", err)
	}
	for _, f := range files {
		b, err := migrations.FS.ReadFile(f)
		if err != nil {
			log.Fatalf("read %s: %v", f, err)
		}
		version := strings.TrimSuffix(filepath.Base(f), filepath.Ext(f))
		applied, err := store.IsMigrationApplied(ctx, version)
		if err != nil {
			log.Fatalf("check %s: %v", f, err)
		}
		if applied {
			log.Printf("skip %s (already applied)", f)
			continue
		}
		if err := store.ApplyMigration(ctx, version, string(b)); err != nil {
			log.Fatalf("apply %s: %v", f, err)
		}
		log.Printf("applied %s", f)
	}
}

func listSQL() ([]string, error) {
	var out []string
	entries, err := migrations.FS.ReadDir(".")
	if err != nil {
		return nil, err
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			out = append(out, entry.Name())
		}
	}
	sort.Strings(out)
	return out, nil
}
