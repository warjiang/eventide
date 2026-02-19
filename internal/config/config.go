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
	cfg.Redis.Addr = getEnvDefault("REDIS_ADDR", "127.0.0.1:6379")
	cfg.Redis.Username = os.Getenv("REDIS_USERNAME")
	cfg.Redis.Password = os.Getenv("REDIS_PASSWORD")
	cfg.Redis.DB = getEnvIntDefault("REDIS_DB", 0)

	cfg.Postgres.ConnString = getEnvDefault("PG_CONN", "postgres://eventide:eventide@127.0.0.1:5433/eventide?sslmode=disable")

	cfg.S3.Endpoint = getEnvDefault("S3_ENDPOINT", "")
	cfg.S3.Region = getEnvDefault("S3_REGION", "us-east-1")
	cfg.S3.Bucket = getEnvDefault("S3_BUCKET", "")
	cfg.S3.AccessKeyID = os.Getenv("S3_ACCESS_KEY_ID")
	cfg.S3.SecretAccessKey = os.Getenv("S3_SECRET_ACCESS_KEY")
	cfg.S3.Prefix = getEnvDefault("S3_PREFIX", "eventide")
	cfg.S3.UsePathStyle = getEnvIntDefault("S3_USE_PATH_STYLE", 1) != 0

	cfg.HTTP.Addr = getEnvDefault("HTTP_ADDR", "127.0.0.1:18080")

	cfg.Streams.TrimMaxLen = int64(getEnvIntDefault("STREAM_TRIM_MAXLEN", 100000))

	if cfg.Redis.Addr == "" {
		return Config{}, errors.New("REDIS_ADDR is required")
	}
	if cfg.Postgres.ConnString == "" {
		return Config{}, errors.New("PG_CONN is required")
	}
	return cfg, nil
}

func getEnvDefault(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

func getEnvIntDefault(key string, def int) int {
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
