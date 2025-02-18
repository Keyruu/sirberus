package main

import (
	"net/http"
	"os"
)

func main() {
	// Serve embedded frontend
	http.Handle("/", http.FileServer(
		http.FS(os.DirFS("web/dist")),
	))

	// API endpoints
	http.HandleFunc("/api/units", func(w http.ResponseWriter, r *http.Request) {})
	http.HandleFunc("/api/containers", func(w http.ResponseWriter, r *http.Request) {})
}
