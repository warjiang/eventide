package httpx

import (
	"context"
	"errors"
	"net/http"
	"time"
)

type Server struct {
	srv *http.Server
}

func New(addr string, handler http.Handler) *Server {
	return &Server{srv: &http.Server{Addr: addr, Handler: handler}}
}

func (s *Server) ListenAndServe() error {
	if err := s.srv.ListenAndServe(); err != nil {
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return s.srv.Shutdown(ctx)
}
