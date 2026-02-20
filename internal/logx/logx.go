package logx

import (
	"log"
	"os"
)

func Setup() {
	log.SetOutput(os.Stdout)
	log.SetFlags(log.LstdFlags | log.LUTC | log.Lmicroseconds)
}
