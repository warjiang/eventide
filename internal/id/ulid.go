package id

import (
	"crypto/rand"
	"time"

	"github.com/oklog/ulid/v2"
)

func NewULID() (string, error) {
	t := time.Now().UTC()
	entropy := ulid.Monotonic(rand.Reader, 0)
	return ulid.MustNew(ulid.Timestamp(t), entropy).String(), nil
}
