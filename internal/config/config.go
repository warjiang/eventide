package config

import (
	"errors"
	"os"
	"strconv"
)

type RedisConfig struct {
	Addr     string
	Username string
	Password string
	DB       int
}

type HTTPConfig struct {
	Addr string
}

type Config struct {
	Redis    RedisConfig
	Postgres PostgresConfig
	HTTP     HTTPConfig
	S3       S3Config

	Streams struct {
		TrimMaxLen int64
	}
}

type PostgresConfig struct {
	ConnString string
}

type S3Config struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	Prefix          string
	UsePathStyle    bool
}

func FromEnv() (Config, error) {
	var cfg Config
	cfg.Redis.Addr = getenvDefault("REDIS_ADDR", "127.0.0.1:6379")
	cfg.Redis.Username = os.Getenv("REDIS_USERNAME")
	cfg.Redis.Password = os.Getenv("REDIS_PASSWORD")
	cfg.Redis.DB = getenvIntDefault("REDIS_DB", 0)

	cfg.Postgres.ConnString = getenvDefault("PG_CONN", "postgres://eventide:eventide@127.0.0.1:5433/eventide?sslmode=disable")

	cfg.S3.Endpoint = getenvDefault("S3_ENDPOINT", "")
	cfg.S3.Region = getenvDefault("S3_REGION", "us-east-1")
	cfg.S3.Bucket = getenvDefault("S3_BUCKET", "")
	cfg.S3.AccessKeyID = os.Getenv("S3_ACCESS_KEY_ID")
	cfg.S3.SecretAccessKey = os.Getenv("S3_SECRET_ACCESS_KEY")
	cfg.S3.Prefix = getenvDefault("S3_PREFIX", "eventide")
	cfg.S3.UsePathStyle = getenvIntDefault("S3_USE_PATH_STYLE", 1) != 0

	cfg.HTTP.Addr = getenvDefault("HTTP_ADDR", "127.0.0.1:18080")

	cfg.Streams.TrimMaxLen = int64(getenvIntDefault("STREAM_TRIM_MAXLEN", 100000))

	if cfg.Redis.Addr == "" {
		return Config{}, errors.New("REDIS_ADDR is required")
	}
	if cfg.Postgres.ConnString == "" {
		return Config{}, errors.New("PG_CONN is required")
	}
	return cfg, nil
}

func getenvDefault(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

func getenvIntDefault(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
